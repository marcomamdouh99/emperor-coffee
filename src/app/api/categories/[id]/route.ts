import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, sortOrder, isActive, defaultVariantTypeId, imagePath } = body;

    console.log('[Category Update] Received data:', { id, name, description, sortOrder, isActive, defaultVariantTypeId, imagePath });

    // Check if category exists
    const existingCategory = await db.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if new name conflicts with another category
    if (name && name !== existingCategory.name) {
      const nameConflict = await db.category.findUnique({
        where: { name },
      });

      if (nameConflict) {
        return NextResponse.json(
          { error: 'Category with this name already exists' },
          { status: 409 }
        );
      }
    }

    const category = await db.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
        ...(defaultVariantTypeId !== undefined && { defaultVariantTypeId }),
        ...(imagePath !== undefined && { imagePath }),
      },
    });

    return NextResponse.json({
      success: true,
      category,
    });
  } catch (error: any) {
    console.error('Update category error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update category' },
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
    // Check if category exists
    const existingCategory = await db.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if category has menu items
    if (existingCategory._count.menuItems > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete category with menu items',
          itemCount: existingCategory._count.menuItems,
        },
        { status: 400 }
      );
    }

    // Delete category
    await db.category.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete category error:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
