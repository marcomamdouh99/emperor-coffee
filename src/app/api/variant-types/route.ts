import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const includeOptions = searchParams.get('includeOptions') === 'true';

    const variantTypes = await db.variantType.findMany({
      where: {
        ...(active !== null ? { isActive: active === 'true' } : {}),
      },
      orderBy: [
        { name: 'asc' },
      ],
      include: {
        ...(includeOptions ? {
          options: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        } : {}),
        _count: {
          select: { menuItemVariants: true },
        },
      },
    });

    return NextResponse.json({ variantTypes });
  } catch (error: any) {
    console.error('Get variant types error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch variant types' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, isActive } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Variant type name is required' },
        { status: 400 }
      );
    }

    const variantType = await db.variantType.create({
      data: {
        name,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        options: true,
      },
    });

    return NextResponse.json({
      success: true,
      variantType,
    });
  } catch (error: any) {
    console.error('Create variant type error:', error);
    return NextResponse.json(
      { error: 'Failed to create variant type' },
      { status: 500 }
    );
  }
}
