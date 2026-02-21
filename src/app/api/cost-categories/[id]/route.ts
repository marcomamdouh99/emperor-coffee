import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH - Update cost category
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { name, description, icon, sortOrder, isActive } = body;

    const costCategory = await db.costCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      success: true,
      costCategory,
      message: 'Cost category updated successfully',
    });
  } catch (error: any) {
    console.error('Update cost category error:', error);
    return NextResponse.json(
      { error: 'Failed to update cost category' },
      { status: 500 }
    );
  }
}

// DELETE - Delete cost category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if category is being used by any costs
    const costsUsingCategory = await db.branchCost.findFirst({
      where: { costCategoryId: id },
    });

    if (costsUsingCategory) {
      return NextResponse.json(
        {
          error: 'Cannot delete category',
          details: 'This category is being used by cost entries. Delete or reassign those costs first.'
        },
        { status: 400 }
      );
    }

    await db.costCategory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Cost category deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete cost category error:', error);
    return NextResponse.json(
      { error: 'Failed to delete cost category' },
      { status: 500 }
    );
  }
}

// POST workaround for gateway blocking PATCH
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if this is a PATCH override
    if (body._method !== 'PATCH') {
      return NextResponse.json(
        { error: 'Invalid method' },
        { status: 405 }
      );
    }

    const { name, description, icon, sortOrder, isActive } = body;

    const costCategory = await db.costCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      success: true,
      costCategory,
      message: 'Cost category updated successfully',
    });
  } catch (error: any) {
    console.error('Update cost category error:', error);
    return NextResponse.json(
      { error: 'Failed to update cost category' },
      { status: 500 }
    );
  }
}
