import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      branchId,
      ingredientId,
      quantity,
      cost,
      supplier,
      userId,
    } = body;

    // Validate request
    if (!branchId || !ingredientId || !quantity || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be positive' },
        { status: 400 }
      );
    }

    // Get ingredient info
    const ingredient = await db.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) {
      return NextResponse.json(
        { error: 'Ingredient not found' },
        { status: 404 }
      );
    }

    // Get current inventory
    const inventory = await db.branchInventory.findUnique({
      where: {
        branchId_ingredientId: {
          branchId,
          ingredientId,
        },
      },
    });

    const stockBefore = inventory?.currentStock || 0;
    const stockAfter = stockBefore + quantity;

    // Create restock transaction
    const result = await db.$transaction(async (tx) => {
      // Update or create inventory
      if (inventory) {
        await tx.branchInventory.update({
          where: { id: inventory.id },
          data: {
            currentStock: stockAfter,
            lastRestockAt: new Date(),
            lastModifiedAt: new Date(),
          },
        });
      } else {
        await tx.branchInventory.create({
          data: {
            branchId,
            ingredientId,
            currentStock: stockAfter,
            lastRestockAt: new Date(),
            lastModifiedAt: new Date(),
          },
        });
      }

      // Create inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          branchId,
          ingredientId,
          transactionType: 'RESTOCK',
          quantityChange: quantity,
          stockBefore,
          stockAfter,
          reason: supplier ? `Supplier: ${supplier}` : 'Manual restock',
          createdBy: userId,
        },
      });

      return { stockBefore, stockAfter };
    });

    return NextResponse.json({
      success: true,
      message: `Restocked ${quantity} ${ingredient.unit} of ${ingredient.name}`,
      restock: {
        ingredient: ingredient.name,
        quantity,
        unit: ingredient.unit,
        supplier,
        cost,
        stockBefore,
        stockAfter,
      },
    });
  } catch (error: any) {
    console.error('Restock error:', error);
    return NextResponse.json(
      { error: 'Failed to process restock', details: error.message },
      { status: 500 }
    );
  }
}
