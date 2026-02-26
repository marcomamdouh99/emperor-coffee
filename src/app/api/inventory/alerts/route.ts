import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema for alert check request
const checkAlertsSchema = z.object({
  branchId: z.string(),
});

// GET /api/inventory/alerts - Get all alerts for a branch
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    // Get low stock alerts
    const lowStockAlerts = await db.branchInventory.findMany({
      where: {
        branchId,
        ingredient: {
          OR: [
            // Alert based on ingredient's custom alert threshold
            {
              alertThreshold: { gt: 0 },
            },
            // Or reorder threshold
            {
              reorderThreshold: { gt: 0 },
            },
          ],
        },
      },
      include: {
        ingredient: true,
      },
    });

    const filteredLowStock = lowStockAlerts.filter((inv) => {
      const threshold = inv.ingredient.alertThreshold || inv.ingredient.reorderThreshold;
      return inv.currentStock <= threshold;
    });

    // Get expiry alerts (expiring within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiryAlerts = await db.branchInventory.findMany({
      where: {
        branchId,
        expiryDate: {
          lte: sevenDaysFromNow,
          gte: new Date(),
        },
      },
      include: {
        ingredient: true,
      },
    });

    // Get already expired items
    const expiredItems = await db.branchInventory.findMany({
      where: {
        branchId,
        expiryDate: {
          lt: new Date(),
        },
        currentStock: { gt: 0 },
      },
      include: {
        ingredient: true,
      },
    });

    // Format low stock alerts
    const formattedLowStock = filteredLowStock.map((inv) => ({
      id: inv.id,
      type: 'LOW_STOCK' as const,
      priority: inv.currentStock === 0 ? ('URGENT' as const) : ('HIGH' as const),
      title: inv.currentStock === 0 ? 'Out of Stock' : 'Low Stock Alert',
      message: `${inv.ingredient.name} is running low (${inv.currentStock.toFixed(2)} ${inv.ingredient.unit})`,
      entityId: inv.id,
      entityType: 'BranchInventory',
      data: {
        ingredientId: inv.ingredientId,
        ingredientName: inv.ingredient.name,
        currentStock: inv.currentStock,
        threshold: inv.ingredient.alertThreshold || inv.ingredient.reorderThreshold,
        unit: inv.ingredient.unit,
      },
    }));

    // Format expiry alerts
    const formattedExpiry = expiryAlerts.map((inv) => {
      const daysUntilExpiry = Math.ceil(
        (inv.expiryDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: inv.id,
        type: 'EXPIRY_WARNING' as const,
        priority: daysUntilExpiry <= 3 ? ('HIGH' as const) : ('NORMAL' as const),
        title: 'Expiry Warning',
        message: `${inv.ingredient.name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} (${inv.expiryDate!.toLocaleDateString()})`,
        entityId: inv.id,
        entityType: 'BranchInventory',
        data: {
          ingredientId: inv.ingredientId,
          ingredientName: inv.ingredient.name,
          expiryDate: inv.expiryDate,
          currentStock: inv.currentStock,
          unit: inv.ingredient.unit,
        },
      };
    });

    // Format expired items
    const formattedExpired = expiredItems.map((inv) => ({
      id: inv.id,
      type: 'EXPIRED' as const,
      priority: 'URGENT' as const,
      title: 'Item Expired',
      message: `${inv.ingredient.name} has expired on ${inv.expiryDate!.toLocaleDateString()}`,
      entityId: inv.id,
      entityType: 'BranchInventory',
      data: {
        ingredientId: inv.ingredientId,
        ingredientName: inv.ingredient.name,
        expiryDate: inv.expiryDate,
        currentStock: inv.currentStock,
        unit: inv.ingredient.unit,
      },
    }));

    const allAlerts = [...formattedLowStock, ...formattedExpiry, ...formattedExpired];

    // Sort by priority (URGENT > HIGH > NORMAL > LOW)
    const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    allAlerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      alerts: allAlerts,
      summary: {
        lowStock: formattedLowStock.length,
        expiringSoon: formattedExpiry.length,
        expired: formattedExpired.length,
        total: allAlerts.length,
      },
    });
  } catch (error) {
    console.error('Error fetching inventory alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory alerts' },
      { status: 500 }
    );
  }
}
