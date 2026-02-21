import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, sortOrder, isActive } = body;

    // Get the current variant option to check for unique constraint violations
    const currentOption = await db.variantOption.findUnique({
      where: { id },
      include: { variantType: true },
    });

    if (!currentOption) {
      return NextResponse.json(
        { error: 'Variant option not found' },
        { status: 404 }
      );
    }

    // Check if the new name already exists for the same variant type
    if (name && name !== currentOption.name) {
      const existingOption = await db.variantOption.findFirst({
        where: {
          variantTypeId: currentOption.variantTypeId,
          name: name.trim(),
          id: { not: id },
        },
      });

      if (existingOption) {
        return NextResponse.json(
          { error: `A variant option with name "${name}" already exists for this variant type` },
          { status: 409 }
        );
      }
    }

    const variantOption = await db.variantOption.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
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

    // Handle Prisma unique constraint violations
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A variant option with this name already exists for this variant type' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to update variant option', details: error.message },
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
    await db.variantOption.delete({
      where: { id },
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
