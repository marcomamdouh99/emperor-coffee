// Sync Status API
// Provides sync status information for branches

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getSyncStatus,
  getAllBranchesSyncStatus
} from '@/lib/sync-utils';

/**
 * GET /api/sync/status
 * Query params:
 * - branchId: Optional. If provided, returns status for specific branch
 * - all: Optional. If "true", returns status for all branches
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const all = searchParams.get('all') === 'true';

    if (all) {
      // Return status for all branches (admin view)
      const allStatus = await getAllBranchesSyncStatus();

      return NextResponse.json({
        success: true,
        data: allStatus,
        count: allStatus.length
      });
    } else if (branchId) {
      // Return status for specific branch
      const status = await getSyncStatus(branchId);

      return NextResponse.json({
        success: true,
        data: status
      });
    } else {
      // Return error - either branchId or all=true is required
      return NextResponse.json(
        {
          success: false,
          error: 'Either branchId or all=true query parameter is required'
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[Sync Status Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get sync status'
      },
      { status: 500 }
    );
  }
}
