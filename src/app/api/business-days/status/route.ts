import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/business-days/status?branchId=xxx
// Get the current business day status for a branch
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json({
        success: false,
        error: 'Branch ID is required'
      }, { status: 400 });
    }

    // Find the most recent open business day for this branch
    const openDay = await db.businessDay.findFirst({
      where: {
        branchId,
        isOpen: true
      },
      orderBy: {
        openedAt: 'desc'
      },
      include: {
        openedByUser: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true
          }
        },
        _count: {
          select: { shifts: true }
        }
      }
    });

    if (openDay) {
      return NextResponse.json({
        success: true,
        businessDay: openDay,
        status: 'OPEN'
      });
    }

    // Find the most recent closed day
    const lastClosedDay = await db.businessDay.findFirst({
      where: {
        branchId
      },
      orderBy: {
        openedAt: 'desc'
      },
      include: {
        openedByUser: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        closedByUser: {
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
      businessDay: lastClosedDay || null,
      status: 'CLOSED'
    });
  } catch (error: any) {
    console.error('[BusinessDay Status Error]', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get business day status',
      details: error.message
    }, { status: 500 });
  }
}
