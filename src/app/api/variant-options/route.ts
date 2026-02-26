import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const variantTypeId = searchParams.get('variantTypeId');
    const active = searchParams.get('active');

    const variantOptions = await db.variantOption.findMany({
      where: {
        ...(variantTypeId ? { variantTypeId } : {}),
        ...(active !== null ? { isActive: active === 'true' } : {}),
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        variantType: true,
      },
    });

    return NextResponse.json({ variantOptions });
  } catch (error: any) {
    console.error('Get variant options error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch variant options' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { variantTypeId, name, description, sortOrder, isActive } = body;

    if (!variantTypeId || !name) {
      return NextResponse.json(
        { error: 'variantTypeId and name are required' },
        { status: 400 }
      );
    }

    const variantOption = await db.variantOption.create({
      data: {
        variantTypeId,
        name,
        description: description || null,
        sortOrder: sortOrder !== undefined ? sortOrder : 0,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        variantType: true,
      },
    });

    return NextResponse.json({
      success: true,
      variantOption,
    });
  } catch (error: any) {
    console.error('Create variant option error:', error);
    return NextResponse.json(
      { error: 'Failed to create variant option' },
      { status: 500 }
    );
  }
}
