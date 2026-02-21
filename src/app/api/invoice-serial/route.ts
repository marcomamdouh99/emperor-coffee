import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET invoice serial info for a branch
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json(
        { error: 'branchId is required' },
        { status: 400 }
      );
    }

    // Get or create branch serial record
    let branch = await db.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        serialYear: true,
        lastSerial: true,
        branchName: true,
      },
    });

    const currentYear = new Date().getFullYear();

    // Initialize if not exists
    if (!branch) {
      const newBranch = await db.branch.create({
        data: {
          id: branchId,
          serialYear: currentYear,
          lastSerial: 0,
        },
      });
      branch = newBranch;
    }

    // Check if year changed and reset if needed
    if (branch.serialYear !== currentYear) {
      branch = await db.branch.update({
        where: { id: branchId },
        data: {
          serialYear: currentYear,
          lastSerial: 0,
        },
      });
    }

    // Generate next serial number
    const nextSerial = branch.lastSerial + 1;
    const invoiceNumber = `${branch.serialYear}${String(branchId).padStart(2, '0')}${String(nextSerial).padStart(4, '0')}`;

    return NextResponse.json({
      branchId: branch.id,
      branchName: branch.branchName,
      serialYear: branch.serialYear,
      lastSerial: branch.lastSerial,
      nextSerial,
      invoiceNumber,
    });
  } catch (error) {
    console.error('Invoice serial error:', error);
    return NextResponse.json(
      { error: 'Failed to get invoice serial' },
      { status: 500 }
    );
  }
}

// POST to increment serial (called after creating an order)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId, orderId } = body;

    if (!branchId || !orderId) {
      return NextResponse.json(
        { error: 'branchId and orderId are required' },
        { status: 400 }
      );
    }

    // Get current serial info
    let branch = await db.branch.findUnique({
      where: { id: branchId },
      select: {
        serialYear: true,
        lastSerial: true,
      },
    });

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Increment serial
    branch = await db.branch.update({
      where: { id: branchId },
      data: {
        lastSerial: branch.lastSerial + 1,
      },
    });

    // Generate invoice number
    const nextSerial = branch.lastSerial + 1;
    const invoiceNumber = `${branch.serialYear}${String(branchId).padStart(2, '0')}${String(nextSerial).padStart(4, '0')}`;

    return NextResponse.json({
      invoiceNumber,
      lastSerial: branch.lastSerial,
    });
  } catch (error) {
    console.error('Increment serial error:', error);
    return NextResponse.json(
      { error: 'Failed to increment serial' },
      { status: 500 }
    );
  }
}
