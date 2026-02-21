import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    // Fetch inventory transactions with relations
    const transactions = await db.inventoryTransaction.findMany({
      where: {
        branchId,
      },
      include: {
        ingredient: {
          select: {
            name: true,
          },
        },
        creator: {
          select: {
            name: true,
            username: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit ? parseInt(limit) : 50,
      skip: offset ? parseInt(offset) : 0,
    });

    // Transform data for frontend
    const formattedTransactions = transactions.map(txn => ({
      id: txn.id,
      ingredientId: txn.ingredientId,
      ingredientName: txn.ingredient.name,
      transactionType: txn.transactionType,
      quantityChange: txn.quantityChange,
      stockBefore: txn.stockBefore,
      stockAfter: txn.stockAfter,
      orderId: txn.orderId,
      orderNumber: txn.order?.orderNumber,
      reason: txn.reason,
      createdAt: txn.createdAt,
      userName: txn.creator?.name || txn.creator?.username,
    }));

    return NextResponse.json({
      transactions: formattedTransactions,
      total: formattedTransactions.length,
    });
  } catch (error) {
    console.error('Get inventory transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory transactions' },
      { status: 500 }
    );
  }
}
