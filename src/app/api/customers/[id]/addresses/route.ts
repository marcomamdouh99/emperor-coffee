import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const body = await request.json();
    const { building, streetAddress, floor, apartment, deliveryAreaId, isDefault } = body;

    // Validate required fields
    if (!streetAddress) {
      return NextResponse.json(
        { success: false, error: 'Street address is required' },
        { status: 400 }
      );
    }

    // Check if customer exists
    const customer = await db.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // If setting as default, unset all other default addresses
    if (isDefault) {
      await db.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create address
    const address = await db.customerAddress.create({
      data: {
        customerId,
        building,
        streetAddress,
        floor,
        apartment,
        deliveryAreaId,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({
      success: true,
      address,
      message: 'Address added successfully',
    });
  } catch (error) {
    console.error('Create address error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create address' },
      { status: 500 }
    );
  }
}
