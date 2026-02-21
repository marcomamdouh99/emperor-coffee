import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { priceModifier, sortOrder, isActive } = body;

    const variant = await db.menuItemVariant.update({
      where: { id },
      data: {
        ...(priceModifier !== undefined && { priceModifier: parseFloat(priceModifier) }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        variantType: true,
        variantOption: true,
      },
    });

    return NextResponse.json({
      success: true,
      variant,
    });
  } catch (error: any) {
    console.error('Update menu item variant error:', error);
    return NextResponse.json(
      { error: 'Failed to update menu item variant' },
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
    const variant = await db.menuItemVariant.findUnique({
      where: { id },
      include: { menuItem: true },
    });

    if (!variant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      );
    }

    const menuItemId = variant.menuItemId;

    await db.menuItemVariant.delete({
      where: { id },
    });

    const remainingVariants = await db.menuItemVariant.findMany({
      where: { menuItemId, isActive: true },
    });

    if (remainingVariants.length === 0) {
      await db.menuItem.update({
        where: { id: menuItemId },
        data: { hasVariants: false },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Variant deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete menu item variant error:', error);
    return NextResponse.json(
      { error: 'Failed to delete menu item variant' },
      { status: 500 }
    );
  }
}
