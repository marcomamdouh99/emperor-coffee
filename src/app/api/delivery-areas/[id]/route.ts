import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * PATCH /api/delivery-areas/[id]
 * Update a delivery area
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, fee, isActive } = body;

    console.log('[Delivery Area Update] Received data:', { id, name, fee, isActive });

    if (!name && fee === undefined && isActive === undefined) {
      return NextResponse.json(
        { error: 'At least one field to update is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (fee !== undefined && fee !== null) updateData.fee = parseFloat(fee);
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedArea = await db.deliveryArea.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      area: updatedArea,
      message: 'Delivery area updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating delivery area:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update delivery area' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/delivery-areas/[id]
 * Delete a delivery area
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.deliveryArea.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Delivery area deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting delivery area:', error);
    return NextResponse.json(
      { error: 'Failed to delete delivery area' },
      { status: 500 }
    );
  }
}
