import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      branchId,
      ingredientId,
      quantity,
      reason,
      userId,
    } = body;

    // Validate request
    if (!branchId || !ingredientId || !quantity || !reason || !userId) {
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

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory record not found' },
        { status: 404 }
      );
    }

    const stockBefore = inventory.currentStock;
    const stockAfter = stockBefore - quantity;

    // Create waste transaction
    const result = await db.$transaction(async (tx) => {
      // Update inventory
      await tx.branchInventory.update({
        where: { id: inventory.id },
        data: {
          currentStock: stockAfter,
          lastModifiedAt: new Date(),
        },
      });

      // Create inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          branchId,
          ingredientId,
          transactionType: 'WASTE',
          quantityChange: -quantity,
          stockBefore,
          stockAfter,
          reason,
          createdBy: userId,
        },
      });

      return { stockBefore, stockAfter };
    });

    return NextResponse.json({
      success: true,
      message: `Recorded waste of ${quantity} ${ingredient.unit} of ${ingredient.name}`,
      waste: {
        ingredient: ingredient.name,
        quantity,
        unit: ingredient.unit,
        reason,
        stockBefore,
        stockAfter,
      },
    });
  } catch (error: any) {
    console.error('Waste recording error:', error);
    return NextResponse.json(
      { error: 'Failed to record waste', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      );
    }

    // Get waste transactions
    const wasteTransactions = await db.inventoryTransaction.findMany({
      where: {
        branchId,
        transactionType: 'WASTE',
      },
      include: {
        ingredient: {
          select: {
            name: true,
            unit: true,
          },
        },
        creator: {
          select: {
            username: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.inventoryTransaction.count({
      where: {
        branchId,
        transactionType: 'WASTE',
      },
    });

    return NextResponse.json({
      wasteTransactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + wasteTransactions.length < total,
      },
    });
  } catch (error: any) {
    console.error('Get waste transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch waste transactions' },
      { status: 500 }
    );
  }
}
