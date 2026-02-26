import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH - Update customer address
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { building, streetAddress, floor, apartment, deliveryAreaId, orderCount, isDefault } = body;

    console.log('[Address Update] Received data:', { id, building, streetAddress, floor, apartment, deliveryAreaId, orderCount, isDefault });

    // Check if address exists
    const existingAddress = await db.customerAddress.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!existingAddress) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    // If this is being set as default, unset all other default addresses for this customer
    if (isDefault) {
      await db.customerAddress.updateMany({
        where: {
          customerId: existingAddress.customerId,
          id: { not: id },
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Update address
    const address = await db.customerAddress.update({
      where: { id },
      data: {
        ...(building !== undefined && { building }),
        ...(streetAddress !== undefined && { streetAddress }),
        ...(floor !== undefined && { floor }),
        ...(apartment !== undefined && { apartment }),
        ...(deliveryAreaId !== undefined && { deliveryAreaId }),
        ...(orderCount !== undefined && { orderCount }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return NextResponse.json({
      success: true,
      address,
    });
  } catch (error: any) {
    console.error('Update customer address error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update customer address' },
      { status: 500 }
    );
  }
}

// DELETE - Delete customer address
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if address exists
    const existingAddress = await db.customerAddress.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
      },
    });

    if (!existingAddress) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    // Prevent deleting default address if customer has other addresses
    if (existingAddress.isDefault) {
      const addressCount = await db.customerAddress.count({
        where: { customerId: existingAddress.customerId },
      });

      if (addressCount > 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete default address. Please set another address as default first.' },
          { status: 400 }
        );
      }
    }

    // Delete address
    await db.customerAddress.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    console.error('Delete customer address error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete customer address' },
      { status: 500 }
    );
  }
}
