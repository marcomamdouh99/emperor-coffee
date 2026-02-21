import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const userId = searchParams.get('userId');
    const actionType = searchParams.get('actionType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (userId) where.userId = userId;
    if (actionType) where.actionType = actionType;

    // Get audit logs
    const auditLogs = await db.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            username: true,
            name: true,
            role: true,
          },
        },
        branch: {
          select: {
            branchName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.auditLog.count({ where });

    return NextResponse.json({
      auditLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + auditLogs.length < total,
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
