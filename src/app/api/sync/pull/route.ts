// Sync Pull API
// Downloads updated data from central to branch (DOWN sync)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SyncDirection, SyncStatus } from '@prisma/client';
import {
  getSyncStatus,
  createSyncHistory,
  updateSyncHistory,
  updateBranchLastSync,
  incrementVersion,
  getLatestVersion
} from '@/lib/sync-utils';

/**
 * POST /api/sync/pull
 * Body:
 * - branchId: string (required)
 * - force: boolean (optional) - Force full sync regardless of versions
 *
 * Downloads updated data from central to branch:
 * - Menu items (if menu version changed)
 * - Pricing (if pricing version changed)
 * - Recipes (if recipe version changed)
 * - Ingredients (if ingredient version changed)
 * - Users (if user version changed)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, force = false, sinceDate, limit = 1000 } = body;

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'branchId is required' },
        { status: 400 }
      );
    }

    // Get branch and sync status first (before creating sync history)
    const branch = await db.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Now create sync history with valid branchId
    const syncHistoryId = await createSyncHistory(
      branchId,
      SyncDirection.DOWN,
      0
    );

    const syncStatus = await getSyncStatus(branchId);
    let totalRecordsProcessed = 0;
    let totalConflicts = 0;
    const updates: string[] = [];

    // Get latest versions
    const latestMenuVersion = await getLatestVersion('menuVersion');
    const latestPricingVersion = await getLatestVersion('pricingVersion');
    const latestRecipeVersion = await getLatestVersion('recipeVersion');
    const latestIngredientVersion = await getLatestVersion('ingredientVersion');
    const latestUserVersion = await getLatestVersion('userVersion');

    // Data to return for offline storage
    const dataToReturn: any = {};

    // ============================================
    // Sync Categories & Menu Items (Menu Version)
    // ============================================
    if (force || syncStatus.pendingDownloads.menu) {
      console.log(`[Sync Pull] Syncing menu items for branch ${branchId}...`);

      // Get all active categories and menu items
      const [categories, menuItems] = await Promise.all([
        db.category.findMany({ where: { isActive: true } }),
        db.menuItem.findMany({
          where: { isActive: true },
          include: {
            category: true,
            variants: {
              where: { isActive: true },
              include: {
                variantOption: true
              }
            }
          }
        })
      ]);

      dataToReturn.categories = categories;
      dataToReturn.menuItems = menuItems;

      // For a centralized system, data is already in the database
      // We just need to update the branch's version
      await incrementVersion(branchId, 'menuVersion');

      totalRecordsProcessed += categories.length + menuItems.length;
      updates.push(`Menu: ${categories.length} categories, ${menuItems.length} items`);
    }

    // ============================================
    // Sync Pricing (Pricing Version)
    // ============================================
    if (force || syncStatus.pendingDownloads.pricing) {
      console.log(`[Sync Pull] Syncing pricing for branch ${branchId}...`);

      // Get all menu items with their prices
      const menuItems = await db.menuItem.findMany({
        where: { isActive: true },
        select: { id: true, name: true, price: true, taxRate: true }
      });

      // Get menu item variants with pricing
      const variants = await db.menuItemVariant.findMany({
        where: { isActive: true },
        include: {
          menuItem: { select: { id: true, name: true } },
          variantOption: { select: { name: true } }
        }
      });

      await incrementVersion(branchId, 'pricingVersion');

      totalRecordsProcessed += menuItems.length + variants.length;
      updates.push(`Pricing: ${menuItems.length} items, ${variants.length} variants`);
    }

    // ============================================
    // Sync Recipes (Recipe Version)
    // ============================================
    if (force || syncStatus.pendingDownloads.recipe) {
      console.log(`[Sync Pull] Syncing recipes for branch ${branchId}...`);

      // Get all recipes
      const recipes = await db.recipe.findMany({
        include: {
          menuItem: { select: { id: true, name: true } },
          ingredient: { select: { id: true, name: true, unit: true } },
          variant: {
            select: { id: true },
            where: { isActive: true }
          }
        }
      });

      await incrementVersion(branchId, 'recipeVersion');

      totalRecordsProcessed += recipes.length;
      updates.push(`Recipes: ${recipes.length} recipes`);
    }

    // ============================================
    // Sync Ingredients (Ingredient Version)
    // ============================================
    if (force || syncStatus.pendingDownloads.ingredient) {
      console.log(`[Sync Pull] Syncing ingredients for branch ${branchId}...`);

      // Get all ingredients
      const ingredients = await db.ingredient.findMany({
        where: { isActive: true },
        include: {
          category: true
        }
      });

      // Get branch inventory
      const inventory = await db.branchInventory.findMany({
        where: { branchId },
        include: {
          ingredient: { select: { id: true, name: true, unit: true } }
        }
      });

      dataToReturn.ingredients = ingredients;
      dataToReturn.inventory = inventory;

      await incrementVersion(branchId, 'ingredientVersion');

      totalRecordsProcessed += ingredients.length + inventory.length;
      updates.push(`Ingredients: ${ingredients.length} ingredients, ${inventory.length} inventory records`);
    }

    // ============================================
    // Sync Users (User Version)
    // ============================================
    if (force || syncStatus.pendingDownloads.users) {
      console.log(`[Sync Pull] Syncing users for branch ${branchId}...`);

      // Get all users for this branch
      const users = await db.user.findMany({
        where: {
          branchId,
          isActive: true
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          branchId: true
        }
      });

      dataToReturn.users = users;

      await incrementVersion(branchId, 'userVersion');

      totalRecordsProcessed += users.length;
      updates.push(`Users: ${users.length} users`);
    }

    // ============================================
    // Sync Orders (Always pull recent orders for offline access)
    // ============================================
    console.log(`[Sync Pull] Syncing orders for branch ${branchId}...`);

    const orderWhere: any = { branchId };
    if (sinceDate) {
      orderWhere.createdAt = { gte: new Date(sinceDate) };
    }

    const orders = await db.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true }
            }
          }
        },
        customer: true
      }
    });

    dataToReturn.orders = orders;
    totalRecordsProcessed += orders.length;
    updates.push(`Orders: ${orders.length} orders`);

    // ============================================
    // Sync Shifts (Always pull recent shifts for offline access)
    // ============================================
    console.log(`[Sync Pull] Syncing shifts for branch ${branchId}...`);

    const shiftWhere: any = { branchId };
    if (sinceDate) {
      shiftWhere.createdAt = { gte: new Date(sinceDate) };
    }

    const shifts = await db.shift.findMany({
      where: shiftWhere,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        cashier: {
          select: { id: true, username: true, name: true }
        }
      }
    });

    dataToReturn.shifts = shifts;
    totalRecordsProcessed += shifts.length;
    updates.push(`Shifts: ${shifts.length} shifts`);

    // ============================================
    // Sync Waste Logs (Always pull recent waste logs for offline access)
    // ============================================
    console.log(`[Sync Pull] Syncing waste logs for branch ${branchId}...`);

    const wasteWhere: any = { branchId };
    if (sinceDate) {
      wasteWhere.createdAt = { gte: new Date(sinceDate) };
    }

    const wasteLogs = await db.wasteLog.findMany({
      where: wasteWhere,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true }
        },
        recorder: {
          select: { id: true, username: true, name: true }
        }
      }
    });

    dataToReturn.wasteLogs = wasteLogs;
    totalRecordsProcessed += wasteLogs.length;
    updates.push(`Waste Logs: ${wasteLogs.length} waste logs`);

    // ============================================
    // Sync Branches (for admin access to all branches)
    // ============================================
    console.log(`[Sync Pull] Syncing branches...`);

    const allBranches = await db.branch.findMany({
      where: { isActive: true }
    });

    dataToReturn.branches = allBranches;
    updates.push(`Branches: ${allBranches.length} branches`);

    // ============================================
    // Sync Delivery Areas (for POS delivery functionality)
    // ============================================
    console.log(`[Sync Pull] Syncing delivery areas...`);

    const deliveryAreas = await db.deliveryArea.findMany({
      where: { isActive: true }
    });

    dataToReturn.deliveryAreas = deliveryAreas;
    updates.push(`Delivery Areas: ${deliveryAreas.length} areas`);

    // ============================================
    // Sync Customers (for customer lookup)
    // ============================================
    console.log(`[Sync Pull] Syncing customers for branch ${branchId}...`);

    // Get customers for this branch OR customers without a branch (global customers)
    const customerWhere: any = {
      OR: [
        { branchId: branchId },
        { branchId: null }
      ]
    };

    if (sinceDate) {
      customerWhere.createdAt = { gte: new Date(sinceDate) };
    }

    const customers = await db.customer.findMany({
      where: customerWhere,
      orderBy: { createdAt: 'desc' }
    });

    // Also get all customer addresses for this branch's customers
    const customerIds = customers.map(c => c.id);
    const customerAddresses = await db.customerAddress.findMany({
      where: {
        customerId: { in: customerIds }
      }
    });

    dataToReturn.customers = customers;
    dataToReturn.customerAddresses = customerAddresses;
    totalRecordsProcessed += customers.length + customerAddresses.length;
    updates.push(`Customers: ${customers.length} customers, ${customerAddresses.length} addresses`);

    // ============================================
    // Sync Couriers (for delivery management)
    // ============================================
    console.log(`[Sync Pull] Syncing couriers for branch ${branchId}...`);

    const couriers = await db.courier.findMany({
      where: {
        branchId,
        isActive: true
      }
    });

    dataToReturn.couriers = couriers;
    updates.push(`Couriers: ${couriers.length} couriers`);

    // ============================================
    // Sync Receipt Settings (for receipt printing offline)
    // ============================================
    console.log(`[Sync Pull] Syncing receipt settings...`);

    const receiptSettings = await db.receiptSettings.findFirst();

    if (receiptSettings) {
      dataToReturn.receiptSettings = receiptSettings;
      updates.push(`Receipt Settings: 1 settings`);
    } else {
      // Create default settings if not found
      const defaultSettings = await db.receiptSettings.create({
        storeName: 'Emperor Coffee',
        branchName: 'Coffee Shop',
        headerText: 'Quality Coffee Since 2024',
        footerText: 'Visit us again soon!',
        thankYouMessage: 'Thank you for your purchase!',
        fontSize: 'medium',
        showLogo: true,
        showCashier: true,
        showDateTime: true,
        showOrderType: true,
        showCustomerInfo: true,
        openCashDrawer: true,
        cutPaper: true,
        cutType: 'full',
        paperWidth: 80,
      });
      dataToReturn.receiptSettings = defaultSettings;
      updates.push(`Receipt Settings: 1 default settings created`);
    }

    // ============================================
    // Update Branch Last Sync Time
    // ============================================
    await updateBranchLastSync(branchId);

    // ============================================
    // Finalize Sync History
    // ============================================
    const finalStatus = totalConflicts > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS;

    await updateSyncHistory(
      syncHistoryId,
      finalStatus,
      totalRecordsProcessed,
      totalConflicts > 0 ? `${totalConflicts} conflicts detected` : undefined
    );

    // Return sync result
    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      data: {
        ...dataToReturn, // Include all pulled data for offline storage
        branchId: branch.id,
        branchName: branch.branchName,
        syncHistoryId,
        recordsProcessed: totalRecordsProcessed,
        conflicts: totalConflicts,
        updates,
        versions: {
          before: syncStatus.currentVersions,
          after: {
            menuVersion: latestMenuVersion,
            pricingVersion: latestPricingVersion,
            recipeVersion: latestRecipeVersion,
            ingredientVersion: latestIngredientVersion,
            userVersion: latestUserVersion
          }
        }
      }
    });
  } catch (error: any) {
    console.error('[Sync Pull Error]', error);

    // Only update sync history if it was created successfully
    if (typeof syncHistoryId !== 'undefined') {
      await updateSyncHistory(
        syncHistoryId,
        SyncStatus.FAILED,
        0,
        error.message || 'Unknown error'
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Sync pull failed'
      },
      { status: 500 }
    );
  }
}
