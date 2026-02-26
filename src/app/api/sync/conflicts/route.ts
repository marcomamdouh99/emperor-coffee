// Sync Conflicts API
// View and manage sync conflicts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUnresolvedConflicts } from '@/lib/sync-utils';

/**
 * GET /api/sync/conflicts
 * Query params:
 * - branchId: Optional. Filter by branch
 * - resolved: Optional. "true" to get resolved conflicts, "false" for unresolved (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const resolvedParam = searchParams.get('resolved');
    const resolved = resolvedParam === 'true';

    // Build where clause
    const where: any = {};

    if (branchId) {
      where.branchId = branchId;
    }

    if (resolved) {
      where.NOT = { resolvedAt: null };
    } else {
      where.resolvedAt = null;
    }

    // Fetch conflicts
    const conflicts = await db.syncConflict.findMany({
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
        detectedAt: 'desc'
      }
    });

    // Parse JSON payloads
    const parsedConflicts = conflicts.map(conflict => ({
      id: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      conflictReason: conflict.conflictReason,
      branchPayload: conflict.branchPayload ? JSON.parse(conflict.branchPayload) : null,
      centralPayload: conflict.centralPayload ? JSON.parse(conflict.centralPayload) : null,
      detectedAt: conflict.detectedAt,
      resolvedAt: conflict.resolvedAt,
      resolvedBy: conflict.resolvedBy,
      resolution: conflict.resolution,
      branch: conflict.branch
    }));

    // Get summary statistics
    const totalCount = await db.syncConflict.count({ where });

    const summary = await db.syncConflict.groupBy({
      by: ['entityType', 'resolution'],
      where: branchId ? { branchId } : {},
      _count: true
    });

    // Format summary
    const summaryByType: Record<string, number> = {};
    const summaryByResolution: Record<string, number> = {
      ACCEPT_BRANCH: 0,
      ACCEPT_CENTRAL: 0,
      MANUAL_MERGE: 0,
      null: 0
    };

    summary.forEach(item => {
      if (item.entityType) {
        summaryByType[item.entityType] = (summaryByType[item.entityType] || 0) + item._count;
      }
      const key = item.resolution || 'null';
      summaryByResolution[key] += item._count;
    });

    return NextResponse.json({
      success: true,
      data: {
        conflicts: parsedConflicts,
        summary: {
          total: totalCount,
          byType: summaryByType,
          byResolution: summaryByResolution
        },
        filters: {
          branchId,
          resolved
        }
      }
    });
  } catch (error: any) {
    console.error('[Sync Conflicts Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get sync conflicts'
      },
      { status: 500 }
    );
  }
}
