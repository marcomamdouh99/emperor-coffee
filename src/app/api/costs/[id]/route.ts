import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { branchId, costCategoryId, amount, period, notes } = body;

    // Check if cost exists
    const existingCost = await db.branchCost.findUnique({
      where: { id },
    });

    if (!existingCost) {
      return NextResponse.json(
        { error: 'Cost not found' },
        { status: 404 }
      );
    }

    // Validate period format if provided
    if (period) {
      const periodRegex = /^\d{4}-\d{2}$/;
      if (!periodRegex.test(period)) {
        return NextResponse.json(
          { error: 'Period must be in format YYYY-MM (e.g., 2025-01)' },
          { status: 400 }
        );
      }
    }

    const cost = await db.branchCost.update({
      where: { id },
      data: {
        ...(branchId && { branchId }),
        ...(costCategoryId && { costCategoryId }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(period && { period }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        branch: {
          select: { id: true, branchName: true },
        },
        costCategory: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      cost,
    });
  } catch (error: any) {
    console.error('Update cost error:', error);
    return NextResponse.json(
      { error: 'Failed to update cost' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if cost exists
    const existingCost = await db.branchCost.findUnique({
      where: { id },
    });

    if (!existingCost) {
      return NextResponse.json(
        { error: 'Cost not found' },
        { status: 404 }
      );
    }

    // Delete cost
    await db.branchCost.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Cost deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete cost error:', error);
    return NextResponse.json(
      { error: 'Failed to delete cost' },
      { status: 500 }
    );
  }
}
