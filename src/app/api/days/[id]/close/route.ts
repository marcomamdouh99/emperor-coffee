import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// POST /api/days/[id]/close
// Closes a business day and generates detailed report
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const dayId = (await params).id;
    const body = await request.json();
    const { closingCash, userId, notes } = body;

    if (closingCash === undefined || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: closingCash, userId' },
        { status: 400 }
      );
    }

    // Get the day
    const day = await db.day.findUnique({
      where: { id: dayId }
    });

    if (!day) {
      return NextResponse.json(
        { success: false, error: 'Day not found' },
        { status: 404 }
      );
    }

    if (!day.isOpen) {
      return NextResponse.json(
        { success: false, error: 'Day is already closed' },
        { status: 400 }
      );
    }

    // Check if all shifts are closed
    const openShifts = await db.shift.count({
      where: {
        dayId,
        isClosed: false
      }
    });

    if (openShifts > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot close day: ${openShifts} shift(s) still open`,
          openShifts
        },
        { status: 400 }
      );
    }

    // Calculate expected cash and difference
    const expectedCash = day.totalCashSales - day.totalLoyaltyDiscounts;
    const cashDifference = closingCash - expectedCash;

    // Get user who is closing
    const closingUser = await db.user.findUnique({
      where: { id: userId }
    });

    if (!closingUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate detailed statistics
    const shifts = await db.shift.findMany({
      where: { dayId },
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    // Calculate order type breakdown
    const orders = await db.order.findMany({
      where: { shiftId: { in: shifts.map(s => s.id) } }
    });

    const orderTypeStats = orders.reduce((acc: any, order: any) => {
      const type = order.orderType || 'dine-in';
      acc[type] = acc[type] || { count: 0, total: 0 };
      acc[type].count++;
      acc[type].total += order.totalAmount;
      return acc;
    }, {});

    // Calculate payment method breakdown
    const paymentStats = orders.reduce((acc: any, order: any) => {
      const method = order.paymentMethod || 'cash';
      acc[method] = acc[method] || { count: 0, total: 0 };
      acc[method].count++;
      acc[method].total += order.totalAmount;
      return acc;
    }, {});

    // Get top selling items
    const itemSales = orders.flatMap(order => 
      order.items.map((item: any) => ({
        name: item.itemName,
        quantity: item.quantity,
        total: item.subtotal
      }))
    ).reduce((acc: any, item: any) => {
      const name = item.name;
      acc[name] = acc[name] || { quantity: 0, total: 0 };
      acc[name].quantity += item.quantity;
      acc[name].total += item.total;
      return acc;
    }, {});

    const topSellingItems = Object.entries(itemSales)
      .sort(([, a]: any, [, b]: any) => b.total - a.total)
      .slice(0, 10)
      .map(([name, stats]: [string, any]) => ({ name, ...stats }));

    // Calculate loyalty points redeemed
    const loyaltyPointsUsed = day.totalLoyaltyDiscounts; // 1 point = 1 EGP

    // Close the day
    const closedDay = await db.day.update({
      where: { id: dayId },
      data: {
        isOpen: false,
        closedBy: userId,
        closedAt: new Date(),
        closingCash,
        expectedCash,
        cashDifference,
        totalShifts: shifts.length,
        notes,
        updatedAt: new Date()
      }
    });

    // Generate detailed report
    const report = {
      day: closedDay,
      shifts: shifts.map((shift: any) => ({
        id: shift.id,
        cashier: shift.cashier,
        startTime: shift.startTime,
        endTime: shift.endTime,
        openingCash: shift.openingCash,
        closingCash: shift.closingCash,
        orders: shift.openingOrders,
        revenue: shift.closingRevenue,
        isOpen: shift.isClosed
      })),
      summary: {
        totalOrders: day.totalOrders,
        totalRevenue: day.totalRevenue,
        totalDeliveryFees: day.totalDeliveryFees,
        totalCashSales: day.totalCashSales,
        totalCardSales: day.totalCardSales,
        totalLoyaltyDiscounts: day.totalLoyaltyDiscounts,
        totalRefunds: day.totalRefunds,
        cashDifference,
        loyaltyPointsUsed
      },
      orderTypes: orderTypeStats,
      paymentMethods: paymentStats,
      topSellingItems
    };

    return NextResponse.json({
      success: true,
      message: 'Business day closed successfully',
      report
    });
  } catch (error: any) {
    console.error('[Close Day API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to close day' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/days/[id]/report
// Get detailed report for a day
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const dayId = (await params).id;

    // Get the day with all related data
    const day = await db.day.findUnique({
      where: { id: dayId },
      include: {
        openedByUser: true,
        closedByUser: true,
        shifts: {
          include: {
            cashier: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },
            orders: {
              include: {
                items: true
              }
            }
          }
        }
      }
    });

    if (!day) {
      return NextResponse.json(
        { success: false, error: 'Day not found' },
        { status: 404 }
      );
    }

    // Calculate statistics
    const allOrders = day.shifts.flatMap((shift: any) => shift.orders || []);
    
    const orderTypeStats = allOrders.reduce((acc: any, order: any) => {
      const type = order.orderType || 'dine-in';
      acc[type] = acc[type] || { count: 0, total: 0 };
      acc[type].count++;
      acc[type].total += order.totalAmount;
      return acc;
    }, {});

    const paymentStats = allOrders.reduce((acc: any, order: any) => {
      const method = order.paymentMethod || 'cash';
      acc[method] = acc[method] || { count: 0, total: 0 };
      acc[method].count++;
      acc[method].total += order.totalAmount;
      return acc;
    }, {});

    const itemSales = allOrders.flatMap(order => 
      order.items.map((item: any) => ({
        name: item.itemName,
        quantity: item.quantity,
        total: item.subtotal
      }))
    ).reduce((acc: any, item: any) => {
      const name = item.name;
      acc[name] = acc[name] || { quantity: 0, total: 0 };
      acc[name].quantity += item.quantity;
      acc[name].total += item.total;
      return acc;
    }, {});

    const topSellingItems = Object.entries(itemSales)
      .sort(([, a]: any, [, b]: any) => b.total - a.total)
      .slice(0, 10)
      .map(([name, stats]: [string, any]) => ({ name, ...stats }));

    // Calculate loyalty points redeemed
    const loyaltyPointsUsed = day.totalLoyaltyDiscounts;

    const report = {
      day,
      shifts: day.shifts.map((shift: any) => ({
        id: shift.id,
        cashier: shift.cashier,
        startTime: shift.startTime,
        endTime: shift.endTime,
        openingCash: shift.openingCash,
        closingCash: shift.closingCash,
        orders: shift.openingOrders,
        revenue: shift.closingRevenue,
        isOpen: shift.isClosed
      })),
      summary: {
        totalOrders: day.totalOrders,
        totalRevenue: day.totalRevenue,
        totalDeliveryFees: day.totalDeliveryFees,
        totalCashSales: day.totalCashSales,
        totalCardSales: day.totalCardSales,
        totalLoyaltyDiscounts: day.totalLoyaltyDiscounts,
        totalRefunds: day.totalRefunds,
        cashDifference: day.cashDifference,
        loyaltyPointsUsed
      },
      orderTypes: orderTypeStats,
      paymentMethods: paymentStats,
      topSellingItems,
      isOpen: day.isOpen
    };

    return NextResponse.json({
      success: true,
      report
    });
  } catch (error: any) {
    console.error('[Get Day Report API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get day report' },
      { status: 500 }
    );
  }
}
