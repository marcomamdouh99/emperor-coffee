import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/business-days/list?branchId=xxx&limit=xxx&offset=xxx
// Get list of business days for a branch
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!branchId) {
      return NextResponse.json({
        success: false,
        error: 'Branch ID is required'
      }, { status: 400 });
    }

    const whereClause: any = { branchId };
    whereClause.isOpen = false; // Only show closed days

    const [businessDays, totalCount] = await Promise.all([
      db.businessDay.findMany({
        where: whereClause,
        include: {
          openedByUser: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          closedByUser: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          branch: {
            select: {
              id: true,
              branchName: true,
            },
          },
          shifts: {
            select: {
              id: true,
              cashier: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                },
              },
              isClosed: true,
            },
          },
        },
        orderBy: {
          openedAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      db.businessDay.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      success: true,
      businessDays,
      pagination: {
        total: totalCount,
        limit,
        offset,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error('[Business Days List Error]', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch business days',
      details: error.message,
    }, { status: 500 });
  }
}
