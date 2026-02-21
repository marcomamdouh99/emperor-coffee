import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    // Fetch all ingredients (branchId is optional now)
    const ingredients = await db.ingredient.findMany({
      orderBy: { name: 'asc' },
    });

    // Get branch inventory for each ingredient (only if branchId is provided)
    let ingredientsWithInventory = ingredients;

    if (branchId) {
      const branchInventory = await db.branchInventory.findMany({
        where: { branchId },
      });

      // Create a map of ingredient -> branch inventory
      const inventoryMap = new Map(
        branchInventory.map(inv => [inv.ingredientId, inv])
      );

      // Combine ingredient data with inventory data
      ingredientsWithInventory = ingredients.map(ingredient => {
        const inventory = inventoryMap.get(ingredient.id);
        const stock = inventory?.currentStock || 0;
        return {
          ...ingredient,
          currentStock: stock,
          isLowStock: stock < ingredient.reorderThreshold,
          branchStock: stock,
          lastRestockAt: inventory?.lastRestockAt || null,
          lastModifiedAt: inventory?.lastModifiedAt || null,
        };
      });
    }

    return NextResponse.json({ ingredients: ingredientsWithInventory });
  } catch (error) {
    console.error('Get ingredients error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ingredients' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, unit, costPerUnit, reorderThreshold, initialStock, branchId } = body;

    if (!name || !unit || costPerUnit === undefined || reorderThreshold === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, unit, costPerUnit, reorderThreshold' },
        { status: 400 }
      );
    }

    const ingredient = await db.ingredient.create({
      data: {
        name,
        unit,
        costPerUnit: parseFloat(costPerUnit),
        reorderThreshold: parseFloat(reorderThreshold),
      },
    });

    // Handle initial stock for branch inventory
    if (initialStock !== undefined && initialStock !== '' && branchId) {
      const stockValue = parseFloat(initialStock);

      await db.branchInventory.create({
        data: {
          branchId,
          ingredientId: ingredient.id,
          currentStock: stockValue,
          lastRestockAt: new Date(),
          lastModifiedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      ingredient,
      message: 'Ingredient created successfully',
    });
  } catch (error: any) {
    console.error('Create ingredient error:', error);
    return NextResponse.json(
      { error: 'Failed to create ingredient', details: error.message },
      { status: 500 }
    );
  }
}
