/**
 * Offline Data Export API
 * Exports all branch data for offline setup
 * Use this when setting up a new branch that will work offline
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/offline/export?branchId={branchId}
 *
 * Exports all data for a branch to be imported on an offline device:
 * - Categories and Menu items
 * - Ingredients and Inventory
 * - Users for the branch
 * - Recent Orders (configurable limit)
 * - Recent Shifts (configurable limit)
 * - Recent Waste logs (configurable limit)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const limit = parseInt(searchParams.get('limit') || '1000');

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'branchId is required' },
        { status: 400 }
      );
    }

    // Verify branch exists
    const branch = await db.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      );
    }

    console.log(`[Offline Export] Exporting data for branch ${branchId}...`);

    // Export all data in parallel
    const [
      categories,
      menuItems,
      ingredients,
      inventory,
      users,
      orders,
      shifts,
      wasteLogs
    ] = await Promise.all([
      // Categories
      db.category.findMany({ where: { isActive: true } }),

      // Menu items with variants and categories
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
      }),

      // Ingredients with categories
      db.ingredient.findMany({
        where: { isActive: true },
        include: {
          category: true
        }
      }),

      // Branch inventory
      db.branchInventory.findMany({
        where: { branchId },
        include: {
          ingredient: { select: { id: true, name: true, unit: true } }
        }
      }),

      // Users for this branch
      db.user.findMany({
        where: {
          branchId,
          isActive: true
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          fullName: true,
          role: true,
          branchId: true
        }
      }),

      // Recent orders
      db.order.findMany({
        where: { branchId },
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
      }),

      // Recent shifts
      db.shift.findMany({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, name: true, fullName: true }
          }
        }
      }),

      // Recent waste logs
      db.wasteLog.findMany({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          menuItem: {
            select: { id: true, name: true }
          },
          ingredient: {
            select: { id: true, name: true, unit: true }
          }
        }
      })
    ]);

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      branch: {
        id: branch.id,
        name: branch.branchName
      },
      data: {
        categories,
        menuItems,
        ingredients,
        inventory,
        users,
        orders,
        shifts,
        wasteLogs
      },
      summary: {
        categories: categories.length,
        menuItems: menuItems.length,
        ingredients: ingredients.length,
        inventory: inventory.length,
        users: users.length,
        orders: orders.length,
        shifts: shifts.length,
        wasteLogs: wasteLogs.length
      }
    };

    console.log(`[Offline Export] Export complete:`, exportData.summary);

    return NextResponse.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('[Offline Export] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
