import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logDayOpened } from '@/lib/audit-logger';

// POST /api/business-days/open
// Open a new business day
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, userId, openingNotes } = body;

    if (!branchId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Branch ID and User ID are required'
      }, { status: 400 });
    }

    // Check if there's already an open business day
    const existingOpenDay = await db.businessDay.findFirst({
      where: {
        branchId,
        isOpen: true
      }
    });

    if (existingOpenDay) {
      return NextResponse.json({
        success: false,
        error: 'There is already an open business day. Please close it before opening a new one.',
        existingDay: existingOpenDay
      }, { status: 400 });
    }

    // Create new business day
    const businessDay = await db.businessDay.create({
      data: {
        branchId,
        openedBy: userId,
        openingCash: 0, // Opening cash is per shift, not per day
        notes: openingNotes || null,
        isOpen: true,
        totalOrders: 0,
        totalSales: 0,
        subtotal: 0,
        taxAmount: 0,
        deliveryFees: 0,
        loyaltyDiscounts: 0,
        cashSales: 0,
        cardSales: 0,
        dineInOrders: 0,
        dineInSales: 0,
        takeAwayOrders: 0,
        takeAwaySales: 0,
        deliveryOrders: 0,
        deliverySales: 0,
        totalShifts: 0
      }
    });

    // Log business day opening to audit logs
    await logDayOpened(userId, businessDay.id, 0);

    return NextResponse.json({
      success: true,
      businessDay,
      message: 'Business day opened successfully'
    });
  } catch (error: any) {
    console.error('[BusinessDay Open Error]', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to open business day',
      details: error.message
    }, { status: 500 });
  }
}
