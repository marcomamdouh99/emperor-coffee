import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH - Update customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phone, email, notes, branchId } = body;

    console.log('[Customer Update] Received data:', { id, name, phone, email, notes, branchId });

    // Check if customer exists
    const existingCustomer = await db.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // If phone is being changed, check if it's already taken
    if (phone && phone !== existingCustomer.phone) {
      const duplicatePhone = await db.customer.findFirst({
        where: { phone },
      });

      if (duplicatePhone) {
        return NextResponse.json(
          { success: false, error: 'Phone number already in use by another customer' },
          { status: 400 }
        );
      }
    }

    // Update customer
    const customer = await db.customer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(email !== undefined && { email }),
        ...(notes !== undefined && { notes }),
        ...(branchId !== undefined && branchId !== '' && { branchId }),
      },
      include: {
        addresses: {
          orderBy: { orderCount: 'desc' },
        },
        branch: {
          select: { branchName: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      customer,
      message: 'Customer updated successfully',
    });
  } catch (error: any) {
    console.error('Update customer error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update customer' },
      { status: 500 }
    );
  }
}

// DELETE - Delete customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if customer exists
    const existingCustomer = await db.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    if (existingCustomer._count.orders > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete customer with existing orders' },
        { status: 400 }
      );
    }

    // Delete customer (addresses will cascade)
    await db.customer.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
