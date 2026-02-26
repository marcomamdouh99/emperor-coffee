import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const search = searchParams.get('search');

    if (!phone && !search) {
      return NextResponse.json({
        success: true,
        customers: [],
      });
    }

    // Search by phone or name
    const whereClause: any = {};

    if (phone) {
      whereClause.phone = { contains: phone, mode: 'insensitive' };
    } else if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const customers = await db.customer.findMany({
      where: whereClause,
      include: {
        addresses: {
          orderBy: { orderCount: 'desc' },
          include: {
            deliveryArea: true,
          },
        },
        branch: {
          select: { branchName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format response
    const formattedCustomers = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
      branchId: customer.branchId,
      branchName: customer.branch?.branchName || null,
      addresses: customer.addresses.map((addr) => ({
        id: addr.id,
        customerId: customer.id,
        customerName: customer.name,
        building: addr.building,
        streetAddress: addr.streetAddress,
        floor: addr.floor,
        apartment: addr.apartment,
        deliveryAreaId: addr.deliveryAreaId,
        deliveryAreaName: addr.deliveryArea?.name || null,
        orderCount: addr.orderCount,
        isDefault: addr.isDefault,
      })),
      createdAt: customer.createdAt,
    }));

    return NextResponse.json({
      success: true,
      customers: formattedCustomers,
    });
  } catch (error) {
    console.error('Get customers error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}
