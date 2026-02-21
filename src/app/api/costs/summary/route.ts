import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const period = searchParams.get('period');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    let whereClause: any = {};

    if (branchId) {
      whereClause.branchId = branchId;
    }

    if (period) {
      whereClause.period = period;
    } else if (startDate && endDate) {
      whereClause.period = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Get all costs matching the criteria
    const costs = await db.branchCost.findMany({
      where: whereClause,
      include: {
        branch: {
          select: { id: true, branchName: true },
        },
        costCategory: {
          select: { id: true, name: true, icon: true },
        },
      },
      orderBy: [
        { period: 'desc' },
        { branch: { branchName: 'asc' } },
      ],
    });

    // Calculate totals by branch
    const totalsByBranch: Record<string, { branchName: string; total: number; byCategory: Record<string, number> }> = {};

    for (const cost of costs) {
      if (!totalsByBranch[cost.branchId]) {
        totalsByBranch[cost.branchId] = {
          branchName: cost.branch.branchName,
          total: 0,
          byCategory: {},
        };
      }

      totalsByBranch[cost.branchId].total += cost.amount;

      if (!totalsByBranch[cost.branchId].byCategory[cost.costCategory.name]) {
        totalsByBranch[cost.branchId].byCategory[cost.costCategory.name] = 0;
      }
      totalsByBranch[cost.branchId].byCategory[cost.costCategory.name] += cost.amount;
    }

    // Calculate totals by category
    const totalsByCategory: Record<string, { total: number; icon?: string }> = {};

    for (const cost of costs) {
      if (!totalsByCategory[cost.costCategory.name]) {
        totalsByCategory[cost.costCategory.name] = {
          total: 0,
          icon: cost.costCategory.icon,
        };
      }
      totalsByCategory[cost.costCategory.name].total += cost.amount;
    }

    // Grand total
    const grandTotal = costs.reduce((sum, cost) => sum + cost.amount, 0);

    // Group by period
    const byPeriod: Record<string, { total: number; count: number }> = {};

    for (const cost of costs) {
      if (!byPeriod[cost.period]) {
        byPeriod[cost.period] = {
          total: 0,
          count: 0,
        };
      }
      byPeriod[cost.period].total += cost.amount;
      byPeriod[cost.period].count += 1;
    }

    return NextResponse.json({
      summary: {
        grandTotal,
        totalCosts: costs.length,
        totalsByBranch,
        totalsByCategory,
        byPeriod,
      },
      costs,
    });
  } catch (error: any) {
    console.error('Get costs summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs summary' },
      { status: 500 }
    );
  }
}
