import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/audit-logs
 * Fetch audit logs with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const actionType = searchParams.get('actionType');
    const entityType = searchParams.get('entityType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

    if (userId && userId !== 'all') {
      where.userId = userId;
    }

    if (actionType && actionType !== 'all') {
      where.actionType = actionType;
    }

    if (entityType && entityType !== 'all') {
      where.entityType = entityType;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Fetch audit logs
    const logs = await db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Get total count
    const total = await db.auditLog.count({ where });

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error: any) {
    console.error('Get audit logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
