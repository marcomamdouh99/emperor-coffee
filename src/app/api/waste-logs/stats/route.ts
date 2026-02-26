import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/waste-logs/stats - Get waste statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    if (branchId) where.branchId = branchId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Get all waste logs
    const wasteLogs = await db.wasteLog.findMany({
      where,
      include: {
        ingredient: true,
      },
    });

    // Calculate total loss value
    const totalLossValue = wasteLogs.reduce((sum, log) => sum + log.lossValue, 0);

    // Group by reason
    const byReason = wasteLogs.reduce((acc, log) => {
      acc[log.reason] = (acc[log.reason] || 0) + log.lossValue;
      return acc;
    }, {} as Record<string, number>);

    // Group by ingredient
    const byIngredient = wasteLogs.reduce((acc, log) => {
      if (!acc[log.ingredientId]) {
        acc[log.ingredientId] = {
          name: log.ingredient.name,
          totalLoss: 0,
          quantity: 0,
        };
      }
      acc[log.ingredientId].totalLoss += log.lossValue;
      acc[log.ingredientId].quantity += log.quantity;
      return acc;
    }, {} as Record<string, any>);

    // Sort ingredients by loss value
    const sortedIngredients = Object.values(byIngredient).sort(
      (a, b) => b.totalLoss - a.totalLoss
    );

    // Calculate trends (last 7 days vs previous 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentWaste = wasteLogs.filter(
      (log) => log.createdAt >= sevenDaysAgo
    );
    const previousWaste = wasteLogs.filter(
      (log) => log.createdAt >= fourteenDaysAgo && log.createdAt < sevenDaysAgo
    );

    const recentLoss = recentWaste.reduce((sum, log) => sum + log.lossValue, 0);
    const previousLoss = previousWaste.reduce((sum, log) => sum + log.lossValue, 0);

    const trendPercent = previousLoss > 0
      ? ((recentLoss - previousLoss) / previousLoss) * 100
      : 0;

    return NextResponse.json({
      summary: {
        totalLogs: wasteLogs.length,
        totalLossValue,
        avgLossPerLog: wasteLogs.length > 0 ? totalLossValue / wasteLogs.length : 0,
      },
      byReason,
      byIngredient: sortedIngredients,
      trends: {
        recent7Days: recentLoss,
        previous7Days: previousLoss,
        changePercent: trendPercent,
        isIncreasing: trendPercent > 0,
      },
      topWasteReasons: Object.entries(byReason)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, value]) => ({ reason, value })),
    });
  } catch (error) {
    console.error('Error fetching waste stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch waste statistics' },
      { status: 500 }
    );
  }
}
