import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/tables/[id]/close - Close a table (customers left, table available)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { cashierId } = body;

    // Check if table exists
    const table = await db.table.findUnique({
      where: { id },
      include: {
        orders: true,
      },
    });

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Check if table is already available
    if (table.status === 'AVAILABLE') {
      return NextResponse.json(
        { error: 'Table is already available' },
        { status: 400 }
      );
    }

    // Update table status to AVAILABLE
    const updatedTable = await db.table.update({
      where: { id },
      data: {
        status: 'AVAILABLE',
        customerId: null,
        closedAt: new Date(),
        closedBy: cashierId,
      },
      include: {
        customer: true,
        opener: true,
        closer: true,
        orders: {
          orderBy: {
            orderTimestamp: 'desc',
          },
          include: {
            items: true,
          },
        },
      },
    });

    // Calculate total amount for this session
    const totalAmount = updatedTable.orders.reduce((sum, order) => sum + order.totalAmount, 0);

    return NextResponse.json({
      success: true,
      table: updatedTable,
      totalAmount,
    });
  } catch (error) {
    console.error('Error closing table:', error);
    return NextResponse.json(
      { error: 'Failed to close table' },
      { status: 500 }
    );
  }
}
