import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List customers with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const currentUserBranchId = searchParams.get('currentUserBranchId');
    const currentUserRole = searchParams.get('currentUserRole');

    // Build where clause based on search
    let whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // Branch Managers can only see customers from their branch
    if (currentUserRole === 'BRANCH_MANAGER' && currentUserBranchId) {
      whereClause.branchId = currentUserBranchId;
    }

    const customers = await db.customer.findMany({
      where: whereClause,
      include: {
        addresses: {
          orderBy: { orderCount: 'desc' },
        },
        orders: {
          select: { id: true },
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
      loyaltyPoints: customer.loyaltyPoints || 0,
      tier: customer.tier || 'BRONZE',
      totalSpent: customer.totalSpent || 0,
      orderCount: customer.orderCount || 0,
      totalOrders: customer.orderCount || 0,
      branchId: customer.branchId,
      branchName: customer.branch?.branchName || null,
      addresses: customer.addresses.map((addr) => ({
        id: addr.id,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        building: addr.building,
        streetAddress: addr.streetAddress,
        floor: addr.floor,
        apartment: addr.apartment,
        deliveryAreaId: addr.deliveryAreaId,
        orderCount: addr.orderCount,
        isDefault: addr.isDefault,
        loyaltyPoints: customer.loyaltyPoints || 0,
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

// POST - Create new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, branchId, addresses, notes, createdBy } = body;

    // Validate required fields
    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    // Check if customer with same phone already exists
    const existingCustomer = await db.customer.findFirst({
      where: { phone },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { success: false, error: 'Customer with this phone number already exists' },
        { status: 400 }
      );
    }

    // Create customer with addresses
    const customer = await db.customer.create({
      data: {
        name,
        phone,
        email: email || null,
        branchId,
        notes: notes || null,
        addresses: addresses?.length > 0 ? {
          create: addresses.map((addr: any) => ({
            building: addr.building,
            streetAddress: addr.streetAddress,
            floor: addr.floor,
            apartment: addr.apartment,
            deliveryAreaId: addr.deliveryAreaId,
            isDefault: addr.isDefault || false,
          })),
        } : undefined,
      },
      include: {
        addresses: true,
        branch: {
          select: { branchName: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      customer,
      message: 'Customer created successfully',
    });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
