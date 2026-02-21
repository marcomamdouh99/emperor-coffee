import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/tables - Get all tables for a branch
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const status = searchParams.get('status');

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      );
    }

    const where: any = { branchId };
    if (status) {
      where.status = status;
    }

    const tables = await db.table.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        opener: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        closer: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        tableNumber: 'asc',
      },
    });

    // Calculate total amount for each open/occupied table
    const tableIds = tables.map(t => t.id);
    const orders = await db.order.findMany({
      where: {
        tableId: { in: tableIds },
      },
      select: {
        tableId: true,
        totalAmount: true,
      },
    });

    // Map table ID to total amount
    const tableTotals = orders.reduce((acc, order) => {
      acc[order.tableId] = (acc[order.tableId] || 0) + order.totalAmount;
      return acc;
    }, {} as Record<string, number>);

    // Add total amount to each table
    const tablesWithTotals = tables.map(table => ({
      ...table,
      totalAmount: tableTotals[table.id] || 0,
    }));

    return NextResponse.json({ tables: tablesWithTotals });
  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    );
  }
}

// POST /api/tables - Create a new table
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, tableNumber, capacity, notes } = body;

    console.log('[Tables POST] Request body:', { branchId, tableNumber, capacity, notes });

    if (!branchId || !tableNumber) {
      console.log('[Tables POST] Missing required fields:', { branchId, tableNumber });
      return NextResponse.json(
        { error: 'branchId and tableNumber are required' },
        { status: 400 }
      );
    }

    // Check if table number already exists for this branch
    const existingTable = await db.table.findUnique({
      where: {
        branchId_tableNumber: {
          branchId,
          tableNumber: parseInt(tableNumber),
        },
      },
    });

    if (existingTable) {
      console.log('[Tables POST] Table already exists:', tableNumber);
      return NextResponse.json(
        { error: `Table ${tableNumber} already exists for this branch` },
        { status: 400 }
      );
    }

    console.log('[Tables POST] Creating table...');
    const table = await db.table.create({
      data: {
        branchId,
        tableNumber: parseInt(tableNumber),
        capacity: capacity ? parseInt(capacity) : null,
        notes: notes || null,
        status: 'AVAILABLE',
      },
      include: {
        customer: true,
        opener: true,
        closer: true,
      },
    });

    console.log('[Tables POST] Table created successfully:', table);
    return NextResponse.json({ success: true, table }, { status: 201 });
  } catch (error) {
    console.error('[Tables POST] Error creating table:', error);
    return NextResponse.json(
      { error: 'Failed to create table', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
