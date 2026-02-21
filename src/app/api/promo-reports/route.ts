import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/promo-reports - Get promo usage analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchId = searchParams.get('branchId');
    const promotionId = searchParams.get('promotionId');

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    const where: any = {};
    if (Object.keys(dateFilter).length > 0) {
      where.usedAt = dateFilter;
    }
    if (branchId) {
      where.branchId = branchId;
    }
    if (promotionId) {
      where.promotionId = promotionId;
    }

    // Fetch usage logs
    const usageLogs = await db.promotionUsageLog.findMany({
      where,
      include: {
        promotion: true,
        codeEntity: true,
      },
      orderBy: {
        usedAt: 'desc',
      },
    });

    // Calculate analytics
    const totalUsage = usageLogs.length;
    const totalDiscountAmount = usageLogs.reduce((sum, log) => sum + log.discountAmount, 0);
    const totalOrderValue = usageLogs.reduce((sum, log) => sum + log.orderSubtotal, 0);

    // Group by promotion
    const byPromotion = usageLogs.reduce((acc, log) => {
      const key = log.promotion.id;
      if (!acc[key]) {
        acc[key] = {
          promotionId: log.promotion.id,
          promotionName: log.promotion.name,
          discountType: log.promotion.discountType,
          discountValue: log.promotion.discountValue,
          usageCount: 0,
          totalDiscount: 0,
          totalOrderValue: 0,
        };
      }
      acc[key].usageCount++;
      acc[key].totalDiscount += log.discountAmount;
      acc[key].totalOrderValue += log.orderSubtotal;
      return acc;
    }, {} as any);

    // Group by branch
    const byBranch = usageLogs.reduce((acc, log) => {
      const key = log.branchId;
      if (!acc[key]) {
        acc[key] = {
          branchId: log.branchId,
          usageCount: 0,
          totalDiscount: 0,
          totalOrderValue: 0,
        };
      }
      acc[key].usageCount++;
      acc[key].totalDiscount += log.discountAmount;
      acc[key].totalOrderValue += log.orderSubtotal;
      return acc;
    }, {} as any);

    // Get branch names
    const branchIds = Object.keys(byBranch);
    const branches = await db.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, branchName: true },
    });
    const branchMap = new Map(branches.map((b) => [b.id, b.branchName]));

    // Group by date
    const byDate = usageLogs.reduce((acc, log) => {
      const date = log.usedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          usageCount: 0,
          totalDiscount: 0,
          totalOrderValue: 0,
        };
      }
      acc[date].usageCount++;
      acc[date].totalDiscount += log.discountAmount;
      acc[date].totalOrderValue += log.orderSubtotal;
      return acc;
    }, {} as any);

    // Top performing codes
    const byCode = usageLogs.reduce((acc, log) => {
      const key = log.code;
      if (!acc[key]) {
        acc[key] = {
          code: log.code,
          usageCount: 0,
          totalDiscount: 0,
        };
      }
      acc[key].usageCount++;
      acc[key].totalDiscount += log.discountAmount;
      return acc;
    }, {} as any);

    const topCodes = Object.values(byCode)
      .sort((a: any, b: any) => b.usageCount - a.usageCount)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      analytics: {
        summary: {
          totalUsage,
          totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
          totalOrderValue: Math.round(totalOrderValue * 100) / 100,
          averageDiscount: totalUsage > 0
            ? Math.round((totalDiscountAmount / totalUsage) * 100) / 100
            : 0,
          discountRate: totalOrderValue > 0
            ? Math.round((totalDiscountAmount / totalOrderValue) * 10000) / 100
            : 0,
        },
        byPromotion: Object.values(byPromotion).sort((a: any, b: any) => b.usageCount - a.usageCount),
        byBranch: Object.values(byBranch).map((b: any) => ({
          ...b,
          branchName: branchMap.get(b.branchId) || 'Unknown',
        })).sort((a: any, b: any) => b.usageCount - a.usageCount),
        byDate: Object.values(byDate).sort((a: any, b: any) => b.date.localeCompare(a.date)),
        topCodes,
        recentUsage: usageLogs.slice(0, 50),
      },
    });
  } catch (error) {
    console.error('Error generating promo reports:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate promo reports' },
      { status: 500 }
    );
  }
}
