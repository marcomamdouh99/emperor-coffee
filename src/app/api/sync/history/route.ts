// Sync History API
// Provides sync history logs

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSyncHistory } from '@/lib/sync-utils';

/**
 * GET /api/sync/history
 * Query params:
 * - branchId: Optional. Filter by branch
 * - limit: Optional. Number of records to return (default: 50)
 * - status: Optional. Filter by status (SUCCESS, PARTIAL, FAILED)
 * - direction: Optional. Filter by direction (UP, DOWN)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const limitParam = searchParams.get('limit');
    const status = searchParams.get('status');
    const direction = searchParams.get('direction');

    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Build where clause
    const where: any = {};

    if (branchId) {
      where.branchId = branchId;
    }

    if (status && ['SUCCESS', 'PARTIAL', 'FAILED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }

    if (direction && ['UP', 'DOWN'].includes(direction.toUpperCase())) {
      where.syncDirection = direction.toUpperCase();
    }

    // Fetch sync history with filters
    const history = await db.syncHistory.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            branchName: true
          }
        }
      },
      orderBy: {
        syncStartedAt: 'desc'
      },
      take: Math.min(limit, 200) // Max 200 records
    });

    // Get summary statistics
    const totalCount = await db.syncHistory.count({ where });

    const summary = await db.syncHistory.groupBy({
      by: ['status', 'syncDirection'],
      where: branchId ? { branchId } : {},
      _count: true
    });

    // Format summary
    const summaryByStatus = {
      SUCCESS: 0,
      PARTIAL: 0,
      FAILED: 0
    };

    const summaryByDirection = {
      UP: 0,
      DOWN: 0
    };

    summary.forEach(item => {
      if (item.status in summaryByStatus) {
        summaryByStatus[item.status as keyof typeof summaryByStatus] += item._count;
      }
      if (item.syncDirection in summaryByDirection) {
        summaryByDirection[item.syncDirection as keyof typeof summaryByDirection] += item._count;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        history,
        summary: {
          total: totalCount,
          byStatus: summaryByStatus,
          byDirection: summaryByDirection
        },
        filters: {
          branchId,
          status,
          direction,
          limit
        }
      }
    });
  } catch (error: any) {
    console.error('[Sync History Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get sync history'
      },
      { status: 500 }
    );
  }
}
