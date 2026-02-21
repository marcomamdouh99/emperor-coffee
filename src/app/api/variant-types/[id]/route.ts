import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, isActive } = body;

    const variantType = await db.variantType.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
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
    console.error('Update variant type error:', error);
    return NextResponse.json(
      { error: 'Failed to update variant type' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.variantType.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Delete variant type error:', error);
    return NextResponse.json(
      { error: 'Failed to delete variant type' },
      { status: 500 }
    );
  }
}
