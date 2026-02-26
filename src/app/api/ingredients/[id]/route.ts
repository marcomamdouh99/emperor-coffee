import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Shared update logic to avoid double-reading body
async function updateIngredient(id: string, body: any) {
  const { name, unit, costPerUnit, reorderThreshold, initialStock, branchId } = body;

  console.log('[updateIngredient] ID:', id, 'Data:', body);

  // Check if ingredient exists
  const existingIngredient = await db.ingredient.findUnique({
    where: { id },
  });

  if (!existingIngredient) {
    console.log('[updateIngredient] Ingredient not found');
    return { error: 'Ingredient not found', status: 404 };
  }

  // Build update data
  const updateData: any = {};
  if (name && name.trim() !== '') updateData.name = name.trim();
  if (unit && unit.trim() !== '') updateData.unit = unit.trim();
  if (costPerUnit !== undefined && costPerUnit !== '' && !isNaN(parseFloat(costPerUnit))) {
    updateData.costPerUnit = parseFloat(costPerUnit);
  }
  if (reorderThreshold !== undefined && reorderThreshold !== '' && !isNaN(parseFloat(reorderThreshold))) {
    updateData.reorderThreshold = parseFloat(reorderThreshold);
  }

  console.log('[updateIngredient] Update data:', updateData);

  const ingredient = await db.ingredient.update({
    where: { id },
    data: updateData,
  });

  // Handle initial stock update for branch inventory
  if (initialStock !== undefined && initialStock !== '' && branchId) {
    const stockValue = parseFloat(initialStock);

    console.log('[updateIngredient] Updating branch inventory:', { ingredientId: id, branchId, stockValue });

    // Check if branch inventory record exists
    const existingInventory = await db.branchInventory.findUnique({
      where: {
        branchId_ingredientId: {
          branchId,
          ingredientId: id,
        },
      },
    });

    if (existingInventory) {
      // Update existing inventory
      await db.branchInventory.update({
        where: {
          branchId_ingredientId: {
            branchId,
            ingredientId: id,
          },
        },
        data: {
          currentStock: stockValue,
          lastRestockAt: new Date(),
          lastModifiedAt: new Date(),
        },
      });
      console.log('[updateIngredient] Branch inventory updated');
    } else {
      // Create new inventory record
      await db.branchInventory.create({
        data: {
          branchId,
          ingredientId: id,
          currentStock: stockValue,
          lastRestockAt: new Date(),
          lastModifiedAt: new Date(),
        },
      });
      console.log('[updateIngredient] Branch inventory created');
    }
  }

  // Fetch updated ingredient with inventory data
  const updatedIngredient = await db.ingredient.findUnique({
    where: { id },
  });

  let ingredientWithInventory = updatedIngredient;

  if (branchId) {
    const inventory = await db.branchInventory.findUnique({
      where: {
        branchId_ingredientId: {
          branchId,
          ingredientId: id,
        },
      },
    });

    const stock = inventory?.currentStock || 0;
    ingredientWithInventory = {
      ...updatedIngredient,
      currentStock: stock,
      isLowStock: stock < updatedIngredient.reorderThreshold,
      lastRestockAt: inventory?.lastRestockAt || null,
      lastModifiedAt: inventory?.lastModifiedAt || null,
    };
  }

  console.log('[updateIngredient] Ingredient updated successfully');

  return {
    success: true,
    ingredient: ingredientWithInventory,
    message: 'Ingredient updated successfully',
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[PATCH /api/ingredients/[id]] Request received');

    // In Next.js 16, params is a Promise and must be awaited
    const { id } = await params;

    const body = await request.json();

    const result = await updateIngredient(id, body);

    if (result.status) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PATCH /api/ingredients/[id]] Update ingredient error:', error);
    return NextResponse.json(
      { error: 'Failed to update ingredient', details: String(error) },
      { status: 500 }
    );
  }
}

// Workaround for gateway that blocks PATCH requests
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[POST /api/ingredients/[id]] Request received (PATCH override)');

    // In Next.js 16, params is a Promise and must be awaited
    const { id } = await params;

    const body = await request.json();

    // Check if this is a PATCH override
    if (body._method !== 'PATCH') {
      return NextResponse.json(
        { error: 'Invalid method' },
        { status: 405 }
      );
    }

    const result = await updateIngredient(id, body);

    if (result.status) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/ingredients/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update ingredient', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 16, params is a Promise and must be awaited
    const { id } = await params;

    // Check if ingredient exists
    const existingIngredient = await db.ingredient.findUnique({
      where: { id },
    });

    if (!existingIngredient) {
      return NextResponse.json(
        { error: 'Ingredient not found' },
        { status: 404 }
      );
    }

    // Delete ingredient (will cascade to recipes and branch inventory)
    await db.ingredient.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Ingredient deleted successfully',
    });
  } catch (error) {
    console.error('Delete ingredient error:', error);
    return NextResponse.json(
      { error: 'Failed to delete ingredient' },
      { status: 500 }
    );
  }
}
