import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// POST /api/days/open
// Opens a new business day for a branch
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, userId, openingCash } = body;

    if (!branchId || !userId || openingCash === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: branchId, userId, openingCash' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if branch exists
    const branch = await db.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Check if there's already an open day for this branch today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingOpenDay = await db.day.findFirst({
      where: {
        branchId,
        isOpen: true,
        date: today
      }
    });

    if (existingOpenDay) {
      return NextResponse.json(
        {
          success: false,
          error: 'A day is already open for this branch today',
          day: existingOpenDay
        },
        { status: 400 }
      );
    }

    // Create new day
    const day = await db.day.create({
      data: {
        branchId,
        openedBy: userId,
        openingCash,
        date: today,
        isOpen: true,
        openedAt: new Date(),
        totalShifts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalCashSales: 0,
        totalCardSales: 0,
        totalDeliveryFees: 0,
        totalLoyaltyDiscounts: 0,
        totalRefunds: 0,
        totalRefundCount: 0
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Business day opened successfully',
      day
    });
  } catch (error: any) {
    console.error('[Open Day API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to open day' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/days/status
// Get current day status for a branch
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'branchId is required' },
        { status: 400 }
      );
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's day for the branch
    const day = await db.day.findFirst({
      where: {
        branchId,
        date: today
      },
      include: {
        openedByUser: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      day
    });
  } catch (error: any) {
    console.error('[Get Day Status API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get day status' },
      { status: 500 }
    );
  }
}
