import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/tables/[id] - Get a specific table
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const table = await db.table.findUnique({
      where: { id },
      include: {
        customer: true,
        opener: true,
        closer: true,
        branch: {
          select: {
            branchName: true,
          },
        },
        orders: {
          orderBy: {
            orderTimestamp: 'desc',
          },
          include: {
            items: true,
            cashier: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Calculate total amount for this table
    const totalAmount = table.orders.reduce((sum, order) => sum + order.totalAmount, 0);

    return NextResponse.json({
      ...table,
      totalAmount,
    });
  } catch (error) {
    console.error('Error fetching table:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table' },
      { status: 500 }
    );
  }
}

// PUT /api/tables/[id] - Update a table
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tableNumber, capacity, notes, status } = body;

    // Check if table exists
    const existingTable = await db.table.findUnique({
      where: { id },
    });

    if (!existingTable) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // If changing table number, check if new number already exists
    if (tableNumber && tableNumber !== existingTable.tableNumber) {
      const duplicateTable = await db.table.findUnique({
        where: {
          branchId_tableNumber: {
            branchId: existingTable.branchId,
            tableNumber: parseInt(tableNumber),
          },
        },
      });

      if (duplicateTable && duplicateTable.id !== id) {
        return NextResponse.json(
          { error: `Table ${tableNumber} already exists` },
          { status: 400 }
        );
      }
    }

    const table = await db.table.update({
      where: { id },
      data: {
        ...(tableNumber && { tableNumber: parseInt(tableNumber) }),
        ...(capacity !== undefined && { capacity: capacity ? parseInt(capacity) : null }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
      },
      include: {
        customer: true,
        opener: true,
        closer: true,
      },
    });

    return NextResponse.json({ success: true, table });
  } catch (error) {
    console.error('Error updating table:', error);
    return NextResponse.json(
      { error: 'Failed to update table' },
      { status: 500 }
    );
  }
}

// DELETE /api/tables/[id] - Delete a table
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Check if table has orders
    if (table.orders.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete table with existing orders' },
        { status: 400 }
      );
    }

    await db.table.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting table:', error);
    return NextResponse.json(
      { error: 'Failed to delete table' },
      { status: 500 }
    );
  }
}
