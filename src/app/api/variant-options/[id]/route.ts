import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, sortOrder, isActive } = body;

    const variantOption = await db.variantOption.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
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
    console.error('Update variant option error:', error);
    return NextResponse.json(
      { error: 'Failed to update variant option' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.variantOption.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Delete variant option error:', error);
    return NextResponse.json(
      { error: 'Failed to delete variant option' },
      { status: 500 }
    );
  }
}
