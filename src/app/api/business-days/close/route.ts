import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logDayClosed } from '@/lib/audit-logger';

// POST /api/business-days/close
// Close the current business day and calculate aggregates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessDayId, userId, closingCash, closingNotes } = body;

    if (!businessDayId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Business Day ID and User ID are required'
      }, { status: 400 });
    }

    // Get the business day with all shifts and orders
    const businessDay = await db.businessDay.findUnique({
      where: { id: businessDayId },
      include: {
        shifts: {
          include: {
            orders: true
          }
        }
      }
    });

    if (!businessDay) {
      return NextResponse.json({
        success: false,
        error: 'Business day not found'
      }, { status: 404 });
    }

    if (!businessDay.isOpen) {
      return NextResponse.json({
        success: false,
        error: 'This business day is already closed'
      }, { status: 400 });
    }

    // Get all orders for this business day (from all shifts)
    const allOrders = businessDay.shifts.flatMap(shift => shift.orders);

    // Calculate totals from actual orders
    let totalOrders = allOrders.length;
    let totalSales = 0;
    let subtotal = 0;
    let taxAmount = 0;
    let deliveryFees = 0;
    let loyaltyDiscounts = 0;
    let cashSales = 0;
    let cardSales = 0;
    let dineInOrders = 0;
    let dineInSales = 0;
    let takeAwayOrders = 0;
    let takeAwaySales = 0;
    let deliveryOrders = 0;
    let deliverySales = 0;

    allOrders.forEach(order => {
      totalSales += order.totalAmount;
      subtotal += order.subtotal;
      taxAmount += (order.totalAmount - order.subtotal - order.deliveryFee);
      deliveryFees += order.deliveryFee || 0;

      // Payment breakdown
      if (order.paymentMethod.toLowerCase() === 'cash') {
        cashSales += order.totalAmount;
      } else if (order.paymentMethod.toLowerCase() === 'card' || order.paymentMethod.toLowerCase().includes('visa') || order.paymentMethod.toLowerCase().includes('credit')) {
        cardSales += order.totalAmount;
      }

      // Order type breakdown
      if (order.orderType === 'dine-in') {
        dineInOrders++;
        dineInSales += order.totalAmount;
      } else if (order.orderType === 'take-away') {
        takeAwayOrders++;
        takeAwaySales += order.totalAmount;
      } else if (order.orderType === 'delivery') {
        deliveryOrders++;
        deliverySales += order.totalAmount;
      }
    });

    // Calculate expected cash from cash sales
    const expectedCash = cashSales + businessDay.openingCash;

    // Calculate cash difference
    const cashDiff = (parseFloat(closingCash) || 0) - expectedCash;

    // Update business day with closing data and calculated aggregates
    const updatedDay = await db.businessDay.update({
      where: { id: businessDayId },
      data: {
        isOpen: false,
        closedBy: userId,
        closedAt: new Date(),
        closingCash: parseFloat(closingCash) || 0,
        expectedCash,
        cashDifference: cashDiff,
        notes: closingNotes || businessDay.notes,
        // Update aggregates
        totalOrders,
        totalSales,
        subtotal,
        taxAmount,
        deliveryFees,
        loyaltyDiscounts,
        cashSales,
        cardSales,
        dineInOrders,
        dineInSales,
        takeAwayOrders,
        takeAwaySales,
        deliveryOrders,
        deliverySales,
        totalShifts: businessDay.shifts.length
      }
    });

    // Close any open shifts for this business day
    const openShifts = await db.shift.findMany({
      where: {
        dayId: businessDayId,
        isClosed: false
      }
    });

    for (const shift of openShifts) {
      // Get orders for this shift
      const shiftOrders = await db.order.findMany({
        where: { shiftId: shift.id }
      });

      // Calculate shift closing data
      const shiftClosingOrders = shiftOrders.length;
      const shiftSubtotal = shiftOrders.reduce((sum, order) => sum + order.subtotal, 0);
      const shiftClosingRevenue = shiftSubtotal; // Revenue excludes delivery fees

      await db.shift.update({
        where: { id: shift.id },
        data: {
          isClosed: true,
          endTime: new Date(),
          closingCash: parseFloat(closingCash) || shift.openingCash, // Use provided or default to opening
          closingOrders: shiftClosingOrders,
          closingRevenue: shiftClosingRevenue
        }
      });
    }

    // Log business day closing to audit logs
    await logDayClosed(userId, businessDayId, updatedDay.totalSales);

    return NextResponse.json({
      success: true,
      businessDay: updatedDay,
      closedShiftsCount: openShifts.length,
      message: 'Business day closed successfully'
    });
  } catch (error: any) {
    console.error('[BusinessDay Close Error]', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to close business day',
      details: error.message
    }, { status: 500 });
  }
}
