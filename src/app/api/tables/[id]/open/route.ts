import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/tables/[id]/open - Open a table (for customers to sit)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { customerId, cashierId } = body;

    // Check if table exists
    const table = await db.table.findUnique({
      where: { id },
    });

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Check if table is already occupied
    if (table.status === 'OCCUPIED' || table.status === 'READY_TO_PAY') {
      return NextResponse.json(
        { error: 'Table is already occupied' },
        { status: 400 }
      );
    }

    // Update table status to OCCUPIED
    const updatedTable = await db.table.update({
      where: { id },
      data: {
        status: 'OCCUPIED',
        customerId: customerId || null,
        openedAt: new Date(),
        openedBy: cashierId,
        closedAt: null,
        closedBy: null,
      },
      include: {
        customer: true,
        opener: true,
        closer: true,
      },
    });

    return NextResponse.json({ success: true, table: updatedTable });
  } catch (error) {
    console.error('Error opening table:', error);
    return NextResponse.json(
      { error: 'Failed to open table' },
      { status: 500 }
    );
  }
}
