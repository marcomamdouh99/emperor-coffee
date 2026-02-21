import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const menuItemId = searchParams.get('menuItemId');
    const active = searchParams.get('active');

    const variants = await db.menuItemVariant.findMany({
      where: {
        ...(menuItemId ? { menuItemId } : {}),
        ...(active !== null ? { isActive: active === 'true' } : {}),
      },
      orderBy: [
        { sortOrder: 'asc' },
      ],
      include: {
        variantType: true,
        variantOption: true,
      },
    });

    return NextResponse.json({ variants });
  } catch (error: any) {
    console.error('Get menu item variants error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu item variants' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { menuItemId, variantTypeId, variantOptionId, priceModifier, sortOrder, isActive } = body;

    if (!menuItemId || !variantTypeId || !variantOptionId) {
      return NextResponse.json(
        { error: 'menuItemId, variantTypeId, and variantOptionId are required' },
        { status: 400 }
      );
    }

    const variant = await db.menuItemVariant.create({
      data: {
        menuItemId,
        variantTypeId,
        variantOptionId,
        priceModifier: priceModifier !== undefined ? parseFloat(priceModifier) : 0,
        sortOrder: sortOrder !== undefined ? sortOrder : 0,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        variantType: true,
        variantOption: true,
      },
    });

    // Update the menu item to indicate it has variants
    await db.menuItem.update({
      where: { id: menuItemId },
      data: { hasVariants: true },
    });

    return NextResponse.json({
      success: true,
      variant,
    });
  } catch (error: any) {
    console.error('Create menu item variant error:', error);
    return NextResponse.json(
      { error: 'Failed to create menu item variant' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
        { status: 400 }
      );
    }

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

    // Check if menu item still has variants
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
