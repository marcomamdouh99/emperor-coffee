import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema for creating/updating cost category
const costCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  icon: z.string().max(50, 'Icon name too long').optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');

    const costCategories = await db.costCategory.findMany({
      where: {
        ...(active !== null ? { isActive: active === 'true' } : {}),
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ costCategories });
  } catch (error: any) {
    console.error('Get cost categories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost categories' },
      { status: 500 }
    );
  }
}

// POST - Create new cost category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = costCategorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: result.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { name, description, icon, sortOrder, isActive } = result.data;

    // Get max sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const maxOrder = await db.costCategory.findFirst({
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      finalSortOrder = (maxOrder?.sortOrder || 0) + 1;
    }

    const costCategory = await db.costCategory.create({
      data: {
        name,
        description,
        icon: icon || null,
        sortOrder: finalSortOrder,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      success: true,
      costCategory,
      message: 'Cost category created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create cost category error:', error);
    return NextResponse.json(
      { error: 'Failed to create cost category' },
      { status: 500 }
    );
  }
}

// PATCH - Update cost category
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = costCategorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: result.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { name, description, icon, sortOrder, isActive } = result.data;

    const costCategory = await db.costCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
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
