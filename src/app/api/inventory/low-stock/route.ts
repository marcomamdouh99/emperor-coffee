import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      );
    }

    // Get all inventory records below reorder threshold
    const lowStockItems = await db.branchInventory.findMany({
      where: {
        branchId,
      },
      include: {
        ingredient: {
          select: {
            name: true,
            unit: true,
            reorderThreshold: true,
          },
        },
      },
    });

    // Filter items below threshold
    const alerts = lowStockItems
      .filter(item => item.currentStock <= item.ingredient.reorderThreshold)
      .map(item => ({
        branchId: item.branchId,
        ingredientId: item.ingredientId,
        ingredientName: item.ingredient.name,
        currentStock: item.currentStock,
        unit: item.ingredient.unit,
        reorderThreshold: item.ingredient.reorderThreshold,
        deficit: item.ingredient.reorderThreshold - item.currentStock,
        urgency: item.currentStock <= 0 ? 'CRITICAL' : 'WARNING',
      }))
      .sort((a, b) => {
        // Critical items first, then by deficit amount
        if (a.urgency === 'CRITICAL' && b.urgency !== 'CRITICAL') return -1;
        if (b.urgency === 'CRITICAL' && a.urgency !== 'CRITICAL') return 1;
        return b.deficit - a.deficit;
      });

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.urgency === 'CRITICAL').length,
        warning: alerts.filter(a => a.urgency === 'WARNING').length,
      },
    });
  } catch (error: any) {
    console.error('Low stock check error:', error);
    return NextResponse.json(
      { error: 'Failed to check low stock' },
      { status: 500 }
    );
  }
}
