import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT - Update courier
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phone, isActive } = body;

    const courier = await db.courier.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        branch: {
          select: {
            id: true,
            branchName: true,
          },
        },
      },
    });

    return NextResponse.json({ courier }, { status: 200 });
  } catch (error) {
    console.error('Error updating courier:', error);
    return NextResponse.json(
      { error: 'Failed to update courier' },
      { status: 500 }
    );
  }
}

// DELETE - Delete courier
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.courier.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting courier:', error);
    return NextResponse.json(
      { error: 'Failed to delete courier' },
      { status: 500 }
    );
  }
}
