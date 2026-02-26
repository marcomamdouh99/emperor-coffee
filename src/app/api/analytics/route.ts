import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/analytics
 * Returns advanced analytics including trends and forecasts
 * Query params:
 * - branchId: Required - Filter by branch
 * - period: 'daily' | 'weekly' | 'monthly' | 'yearly'
 * - forecastDays: Optional - Number of days to forecast (default: 7)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const period = (searchParams.get('period') || 'daily') as 'daily' | 'weekly' | 'monthly' | 'yearly';
    const forecastDays = parseInt(searchParams.get('forecastDays') || '7', 10);

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    // Get historical data based on period
    const historicalData = await getHistoricalData(branchId, period);

    // Calculate trends
    const trends = calculateTrends(historicalData);

    // Generate forecast
    const forecast = generateForecast(trends, forecastDays);

    // Get top-selling items
    const topItems = await getTopSellingItems(branchId, 10);

    // Get performance metrics
    const performance = await getPerformanceMetrics(branchId);

    return NextResponse.json({
      success: true,
      branchId,
      period,
      forecastDays,
      historicalData,
      trends,
      forecast,
      topItems,
      performance,
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

async function getHistoricalData(branchId: string, period: string) {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'daily':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
      break;
    case 'weekly':
      startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks
      break;
    case 'monthly':
      startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
      break;
    case 'yearly':
      startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const orders = await db.order.findMany({
    where: {
      branchId,
      isRefunded: false,
      orderTimestamp: {
        gte: startDate,
      },
    },
    orderBy: {
      orderTimestamp: 'asc',
    },
  });

  // Group by period
  const grouped: any[] = [];
  const grouping = getGroupingFunction(period);

  orders.forEach((order) => {
    const key = grouping(order.orderTimestamp);
    const existing = grouped.find((g) => g.date === key);

    if (existing) {
      existing.revenue += order.totalAmount;
      existing.orders += 1;
      existing.items += order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    } else {
      grouped.push({
        date: key,
        revenue: order.totalAmount,
        orders: 1,
        items: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      });
    }
  });

  return grouped;
}

function getGroupingFunction(period: string) {
  return (date: Date) => {
    switch (period) {
      case 'daily':
        return date.toISOString().split('T')[0];
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'yearly':
        return String(date.getFullYear());
      default:
        return date.toISOString().split('T')[0];
    }
  };
}

function calculateTrends(data: any[]) {
  if (data.length < 2) {
    return {
      revenueGrowth: 0,
      orderGrowth: 0,
      trendDirection: 'stable',
    };
  }

  const recent = data.slice(-7).reduce((sum: number, d: any) => sum + d.revenue, 0);
  const previous = data.slice(-14, -7).reduce((sum: number, d: any) => sum + d.revenue, 0);

  const revenueGrowth = previous > 0 ? ((recent - previous) / previous) * 100 : 0;

  const recentOrders = data.slice(-7).reduce((sum: number, d: any) => sum + d.orders, 0);
  const previousOrders = data.slice(-14, -7).reduce((sum: number, d: any) => sum + d.orders, 0);
  const orderGrowth = previousOrders > 0 ? ((recentOrders - previousOrders) / previousOrders) * 100 : 0;

  let trendDirection = 'stable';
  if (revenueGrowth > 5) {
    trendDirection = 'up';
  } else if (revenueGrowth < -5) {
    trendDirection = 'down';
  }

  // Calculate moving average
  const movingAverage = calculateMovingAverage(data.map((d: any) => d.revenue), 7);

  return {
    revenueGrowth,
    orderGrowth,
    trendDirection,
    movingAverage,
    recentAverage: recent / 7,
    previousAverage: previous / 7,
  };
}

function calculateMovingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = window - 1; i < data.length; i++) {
    const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / window);
  }
  return result;
}

function generateForecast(trends: any, days: number) {
  const forecast: any[] = [];
  const { revenueGrowth, trendDirection, movingAverage } = trends;

  const lastDataPoint = movingAverage.length > 0 ? movingAverage[movingAverage.length - 1] : 100;
  const growthRate = trendDirection === 'up' ? (1 + revenueGrowth / 100) :
                    trendDirection === 'down' ? (1 + revenueGrowth / 100) : 1;

  const today = new Date();

  for (let i = 1; i <= days; i++) {
    const forecastDate = new Date(today);
    forecastDate.setDate(today.getDate() + i);

    // Simple linear forecast with growth adjustment
    const baseValue = lastDataPoint * growthRate;
    const randomFactor = 0.95 + Math.random() * 0.1; // Add slight randomness for realism
    const forecastValue = baseValue * Math.pow(randomFactor, i);

    forecast.push({
      date: forecastDate.toISOString().split('T')[0],
      forecastRevenue: Math.max(0, forecastValue),
      confidence: Math.max(0.1, 0.9 - (i * 0.1)), // Confidence decreases over time
    });
  }

  return forecast;
}

async function getTopSellingItems(branchId: string, limit: number) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const items = await db.orderItem.groupBy({
    by: ['menuItemId', 'itemName'],
    where: {
      order: {
        branchId,
        isRefunded: false,
        orderTimestamp: {
          gte: thirtyDaysAgo,
        },
      },
    },
    _sum: {
      quantity: true,
      subtotal: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        subtotal: 'desc',
      },
    },
    take: limit,
  });

  return items.map((item: any) => ({
    menuItemId: item.menuItemId,
    itemName: item.itemName,
    totalQuantity: item._sum.quantity,
    totalRevenue: item._sum.subtotal,
    orderCount: item._count,
  }));
}

async function getPerformanceMetrics(branchId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const orders = await db.order.findMany({
    where: {
      branchId,
      isRefunded: false,
      orderTimestamp: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      totalAmount: true,
      orderTimestamp: true,
      paymentMethod: true,
    },
  });

  if (orders.length === 0) {
    return {
      avgOrderValue: 0,
      peakHours: [],
      paymentDistribution: {},
    };
  }

  const avgOrderValue = orders.reduce((sum: number, o: any) => sum + o.totalAmount, 0) / orders.length;

  // Find peak hours
  const hourCounts: { [hour: number]: number } = {};
  orders.forEach((order: any) => {
    const hour = new Date(order.orderTimestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }));

  // Payment distribution
  const paymentDistribution = {
    cash: orders.filter((o: any) => o.paymentMethod === 'cash').length,
    card: orders.filter((o: any) => o.paymentMethod === 'card').length,
  };

  return {
    avgOrderValue,
    peakHours,
    paymentDistribution,
    totalOrders: orders.length,
  };
}
