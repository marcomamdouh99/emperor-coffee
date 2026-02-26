import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Fetch all ingredients
    const ingredients = await db.ingredient.findMany({
      orderBy: { name: 'asc' },
    });

    // Fetch branch inventory
    const branchInventory = await db.branchInventory.findMany({
      where: { branchId },
    });

    // Create a map of ingredient -> branch inventory
    const inventoryMap = new Map(
      branchInventory.map(inv => [inv.ingredientId, inv])
    );

    // Combine ingredient data with inventory data
    const inventoryData = ingredients.map(ingredient => {
      const inventory = inventoryMap.get(ingredient.id);
      const currentStock = inventory?.currentStock || 0;
      const threshold = ingredient.reorderThreshold;

      // Determine stock status
      let status: 'ok';
      if (currentStock <= threshold * 0.5) {
        status = 'critical';
      } else if (currentStock <= threshold) {
        status = 'low';
      }

      return {
        ingredient: ingredient.name,
        ingredientId: ingredient.id,
        currentStock,
        threshold: `${threshold} ${ingredient.unit}`,
        unit: ingredient.unit,
        status,
      };
    });

    return NextResponse.json({ inventory: inventoryData });
  } catch (error) {
    console.error('Get inventory reports error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory reports' },
      { status: 500 }
    );
  }
}
