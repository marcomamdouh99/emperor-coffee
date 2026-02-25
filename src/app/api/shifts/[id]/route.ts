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

  // Check for active Dine In orders before allowing shift close
  const activeDineInOrders = await db.order.findMany({
    where: {
      shiftId: id,
      orderType: 'dine-in',
      isRefunded: false,
    },
    include: {
      table: {
        select: {
          id: true,
          tableNumber: true,
          status: true,
        },
      },
    },
  });

  console.log('[closeShift] Active dine-in orders:', JSON.stringify(activeDineInOrders.map(o => ({
    orderId: o.id,
    tableNumber: o.table?.tableNumber,
    tableStatus: o.table?.status,
    totalAmount: o.totalAmount,
    isRefunded: o.isRefunded,
  })), null, 2));

  // Filter out orders that are fully refunded or don't have active tables
  const activeOrders = activeDineInOrders.filter(order => {
    // Check if the table is still occupied
    if (order.table) {
      const tableOrders = activeDineInOrders.filter(o => o.tableId === order.tableId);
      // Only consider table active if there are non-refunded orders AND table is OCCUPIED
      return tableOrders.length > 0 && order.table.status === 'OCCUPIED';
    }
    return false;
  });

  console.log('[closeShift] Filtered active orders:', JSON.stringify(activeOrders.map(o => ({
    orderId: o.id,
    tableNumber: o.table?.tableNumber,
    tableStatus: o.table?.status,
  })), null, 2));

  // Also check for tables with OCCUPIED status that have orders in this shift
  const occupiedTables = await db.table.findMany({
    where: {
      branchId: shift.branchId,
      status: 'OCCUPIED',
      openedBy: shift.cashierId,
    },
  });

  console.log('[closeShift] Occupied tables from DB:', JSON.stringify(occupiedTables.map(t => ({
    tableNumber: t.tableNumber,
    status: t.status,
    openedBy: t.openedBy,
  })), null, 2));

  // Combine both checks
  const openTables = new Set();
  activeOrders.forEach(order => {
    if (order.table) {
      openTables.add(order.table.tableNumber);
    }
  });
  occupiedTables.forEach(table => {
    openTables.add(table.tableNumber);
  });

  console.log('[closeShift] Combined openTables set:', Array.from(openTables));

  if (openTables.size > 0) {
    const tableNumbers = Array.from(openTables).sort((a, b) => a - b).join(', ');
    console.log('[closeShift] Cannot close shift - Tables still occupied:', tableNumbers);
    return {
      error: `Cannot close shift. The following tables are still occupied: ${tableNumbers}. Please close all tables before ending your shift.`,
      status: 400,
    };
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

  // Get daily expenses for this shift
  const dailyExpensesStats = await db.dailyExpense.aggregate({
    where: {
      shiftId: shift.id,
    },
    _sum: {
      amount: true,
    },
  });

  // Calculate what the cashier actually has
  // Cashier revenue = subtotal - loyaltyDiscounts (delivery fees go to courier)
  const deliveryFees = orderStats._sum.deliveryFee || 0;
  const loyaltyDiscounts = loyaltyDiscountStats._sum.amount || 0;
  const dailyExpenses = dailyExpensesStats._sum.amount || 0;
  const cashierRevenue = (orderStats._sum.subtotal || 0) - loyaltyDiscounts - dailyExpenses;

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
    dailyExpenses,
    cashierRevenue, // What cashier actually has (subtotal - discounts - expenses, no delivery)
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
      closingRevenue: cashierRevenue, // Cashier's actual revenue (excludes delivery fees, discounts & expenses)
      closingLoyaltyDiscounts: loyaltyDiscounts,
      closingDailyExpenses: dailyExpenses,
      notes,
      paymentBreakdown, // Save payment breakdown to database
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
