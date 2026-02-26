import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, isActive, isCustomInput } = body;

    const variantType = await db.variantType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
        ...(isCustomInput !== undefined && { isCustomInput }),
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.variantType.delete({
      where: { id },
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
