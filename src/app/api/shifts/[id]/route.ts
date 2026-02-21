import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logShiftClosed } from '@/lib/audit-logger';

// Shared update logic to avoid double-reading of body
async function closeShift(id: string, body: any) {
  const { closingCash, notes } = body;

  console.log('[closeShift] Shift ID:', id, 'Closing Cash:', closingCash);

  // Allow 0 or empty string for closing cash
  if (closingCash === undefined || closingCash === null || closingCash === '') {
    return { error: 'Closing cash is required', status: 400 };
  }

  // Get the shift first
  const shift = await db.shift.findUnique({
    where: { id },
    include: {
      cashier: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
  });

  if (!shift) {
    console.log('[closeShift] Shift not found');
    return { error: 'Shift not found', status: 404 };
  }

  // Calculate actual closing figures from orders
  // Revenue = subtotal (excludes delivery fees which go to couriers, excludes loyalty discounts)
  const orderStats = await db.order.aggregate({
    where: {
      shiftId: id,
    },
    _count: true,
    _sum: {
      subtotal: true,  // Revenue = subtotal (no delivery fees, no discounts)
      deliveryFee: true,
      totalAmount: true,
    },
  });

  // Get loyalty discounts for this branch (costs tracked as "Loyalty Discounts")
  const loyaltyDiscountStats = await db.branchCost.aggregate({
    where: {
      branchId: shift.branchId,
      shiftId: shift.id, // Only get loyalty discounts for this specific shift
      costCategory: {
        name: 'Loyalty Discounts',
      },
    },
    _sum: {
      amount: true,
    },
  });

  // Calculate what the cashier actually has
  // Cashier revenue = subtotal - loyaltyDiscounts (delivery fees go to courier)
  const deliveryFees = orderStats._sum.deliveryFee || 0;
  const loyaltyDiscounts = loyaltyDiscountStats._sum.amount || 0;
  const cashierRevenue = (orderStats._sum.subtotal || 0) - loyaltyDiscounts;

  // Get payment method breakdown (excludes delivery fees)
  const paymentStats = await db.order.groupBy({
    by: ['paymentMethod'],
    where: { shiftId: id },
    _sum: { subtotal: true },
    _count: true,
  });

  const paymentBreakdown = {
    cash: 0,
    card: 0,
    other: 0,
  };

  paymentStats.forEach(stat => {
    const method = stat.paymentMethod.toLowerCase();
    if (method === 'cash') {
      paymentBreakdown.cash = stat._sum.subtotal || 0;
    } else if (method === 'card') {
      paymentBreakdown.card = stat._sum.subtotal || 0;
    } else {
      paymentBreakdown.other = (paymentBreakdown.other || 0) + (stat._sum.subtotal || 0);
    }
  });

  console.log('[closeShift] Order stats:', {
    orders: orderStats._count,
    subtotal: orderStats._sum.subtotal || 0,
    deliveryFees,
    loyaltyDiscounts,
    cashierRevenue, // What cashier actually has (subtotal - discounts, no delivery)
    paymentBreakdown,
  });

  // Update shift with calculated closing data
  const updatedShift = await db.shift.update({
    where: { id },
    data: {
      closingCash: parseFloat(closingCash),
      endTime: new Date(),
      isClosed: true,
      closingOrders: orderStats._count,
      closingRevenue: cashierRevenue, // Cashier's actual revenue (excludes delivery fees & discounts)
      closingLoyaltyDiscounts: loyaltyDiscounts,
      notes,
    },
    include: {
      cashier: true,
    },
  });

  // Log shift closing to audit logs
  await logShiftClosed(shift.cashierId, id, parseFloat(closingCash));

  console.log('[closeShift] Shift updated successfully');

  return {
    success: true,
    shift: {
      ...updatedShift,
      paymentBreakdown,
    },
    message: 'Shift closed successfully',
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[PATCH /api/shifts/[id]] Request received');

    // In Next.js 16, params is a Promise and must be awaited
    const { id } = await params;

    const body = await request.json();

    const result = await closeShift(id, body);

    if (result.status) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[PATCH /api/shifts/[id]] Error closing shift:', error);
    return NextResponse.json(
      { error: 'Failed to close shift', details: error.message },
      { status: 500 }
    );
  }
}

// Workaround for gateway that blocks PATCH requests
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[POST /api/shifts/[id]] Request received (PATCH override)');

    // In Next.js 16, params is a Promise and must be awaited
    const { id } = await params;

    const body = await request.json();

    // Check if this is a PATCH override
    if (body._method !== 'PATCH') {
      return NextResponse.json(
        { error: 'Invalid method' },
        { status: 405 }
      );
    }

    const result = await closeShift(id, body);

    if (result.status) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[POST /api/shifts/[id]] Error closing shift:', error);
    return NextResponse.json(
      { error: 'Failed to close shift', details: error.message },
      { status: 500 }
    );
  }
}
