import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logShiftOpened, logShiftClosed } from '@/lib/audit-logger';

/**
 * GET /api/shifts
 * Returns shifts for a branch
 * Query params:
 * - branchId: Required - Filter by branch
 * - cashierId: Optional - Filter by cashier
 * - status: 'open' | 'closed' | 'all'
 * - startDate: Optional - Filter from this date
 * - endDate: Optional - Filter to this date
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const cashierId = searchParams.get('cashierId');
    const status = searchParams.get('status') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    // Build where clause
    let whereClause: any = { branchId };

    if (cashierId) {
      whereClause.cashierId = cashierId;
    }

    if (status === 'open') {
      whereClause.isClosed = false;
    } else if (status === 'closed') {
      whereClause.isClosed = true;
    }

    if (startDate || endDate) {
      whereClause.startTime = {};
      if (startDate) {
        whereClause.startTime.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.startTime.lte = new Date(endDate);
      }
    }

    const shifts = await db.shift.findMany({
      where: whereClause,
      include: {
        cashier: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        _count: {
          select: { orders: true },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    // Calculate current revenue for open shifts
    const shiftsWithRevenue = await Promise.all(
      shifts.map(async (shift) => {
        // For closed shifts, use stored closingRevenue
        if (shift.isClosed) {
          return {
            ...shift,
            orderCount: shift._count.orders,
            _count: undefined,
          };
        }

        // For open shifts, calculate current revenue from orders
        // Revenue = subtotal (excludes delivery fees which go to couriers, excludes loyalty discounts)
        const currentOrders = await db.order.aggregate({
          where: {
            shiftId: shift.id,
          },
          _sum: {
            subtotal: true,  // Revenue = subtotal (no delivery fees, no discounts)
          },
          _count: true,
        });

        // Get loyalty discounts for THIS SHIFT (costs tracked as "Loyalty Discounts")
        const loyaltyDiscountStats = await db.branchCost.aggregate({
          where: {
            branchId,
            shiftId: shift.id, // Only get loyalty discounts for this specific shift
            costCategory: {
              name: 'Loyalty Discounts',
            },
          },
          _sum: {
            amount: true,
          },
        });

        const loyaltyDiscounts = loyaltyDiscountStats._sum.amount || 0;
        const cashierRevenue = (currentOrders._sum.subtotal || 0) - loyaltyDiscounts;

        const paymentBreakdown = {
          cash: 0,
          card: 0,
          other: 0,
        };

        // Payment breakdown also excludes delivery fees
        const orderPaymentStats = await db.order.groupBy({
          by: ['paymentMethod'],
          where: { shiftId: shift.id },
          _sum: { subtotal: true },
          _count: true,
        });

        orderPaymentStats.forEach(stat => {
          const method = stat.paymentMethod.toLowerCase();
          if (method === 'cash') {
            paymentBreakdown.cash = stat._sum.subtotal || 0;
          } else if (method === 'card') {
            paymentBreakdown.card = stat._sum.subtotal || 0;
          } else {
            paymentBreakdown.other = (paymentBreakdown.other || 0) + (stat._sum.subtotal || 0);
          }
        });

        return {
          ...shift,
          orderCount: currentOrders._count,
          currentRevenue: cashierRevenue, // What cashier actually has (subtotal - discounts, no delivery)
          currentOrders: currentOrders._count,
          loyaltyDiscounts, // For display
          paymentBreakdown,
          _count: undefined,
        };
      })
    );

    return NextResponse.json({
      success: true,
      shifts: shiftsWithRevenue,
    });
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shifts
 * Create a new shift
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, cashierId, dayId, openingCash, notes } = body;

    console.log('[Shift API] Creating shift with data:', { branchId, cashierId, dayId, openingCash, notes });

    if (!branchId || !cashierId) {
      console.error('[Shift API] Missing required fields:', { branchId, cashierId });
      return NextResponse.json(
        { error: 'Branch ID and Cashier ID are required' },
        { status: 400 }
      );
    }

    // Verify cashier exists
    console.log('[Shift API] Verifying cashier exists:', cashierId);
    const cashier = await db.user.findUnique({
      where: { id: cashierId },
      select: { id: true, username: true, role: true, isActive: true }
    });

    if (!cashier) {
      console.error('[Shift API] Cashier not found:', cashierId);
      return NextResponse.json(
        { error: `Cashier with ID ${cashierId} not found. Please try logging out and logging back in.` },
        { status: 404 }
      );
    }

    if (!cashier.isActive) {
      console.error('[Shift API] Cashier is inactive:', cashierId);
      return NextResponse.json(
        { error: 'Cashier account is inactive. Please contact your manager.' },
        { status: 403 }
      );
    }

    console.log('[Shift API] Cashier verified:', { id: cashier.id, username: cashier.username, role: cashier.role });

    // Check if there's an open shift for this cashier
    const existingOpenShift = await db.shift.findFirst({
      where: {
        cashierId,
        isClosed: false,
      },
    });

    if (existingOpenShift) {
      return NextResponse.json(
        { error: 'Cashier already has an open shift' },
        { status: 400 }
      );
    }

    // Get opening orders and revenue
    // Revenue = subtotal (excludes delivery fees to couriers, excludes loyalty discounts)
    const openingData = await db.order.aggregate({
      where: {
        cashierId,
        branchId,
      },
      _count: true,
      _sum: {
        subtotal: true,  // Revenue = subtotal (no delivery fees, no discounts)
      },
    });

    // Get loyalty discounts that were given before this shift
    const loyaltyDiscountStats = await db.branchCost.aggregate({
      where: {
        branchId,
        costCategory: {
          name: 'Loyalty Discounts',
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Note: Opening revenue doesn't subtract loyalty discounts from previous shifts
    // It just shows what orders were processed before shift opened
    const openingRevenue = openingData._sum.subtotal || 0;

    const shift = await db.shift.create({
      data: {
        branchId,
        cashierId,
        dayId,
        openingCash: openingCash || 0,
        openingOrders: openingData._count || 0,
        openingRevenue: openingRevenue,
        notes,
      },
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

    // Log shift opening to audit logs
    await logShiftOpened(cashierId, shift.id, openingCash || 0);

    return NextResponse.json({
      success: true,
      shift,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating shift:', error);
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    );
  }
}
