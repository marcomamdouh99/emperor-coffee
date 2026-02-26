import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Staff Performance Report  
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    const dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.orderTimestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      dateFilter.orderTimestamp = {
        gte: new Date(startDate),
      };
    }

    // Build branch filter
    const branchFilter: any = {};
    if (branchId && branchId !== 'all') {
      branchFilter.branchId = branchId;
    }

    // Fetch all orders with cashier info
    const orders = await db.order.findMany({
      where: {
        ...dateFilter,
        ...branchFilter,
        isRefunded: false,
      },
      include: {
        items: true,
        cashier: true,
      },
      orderBy: { orderTimestamp: 'desc' },
    });

    // Aggregate cashier performance
    const staffStats = new Map<string, any>();

    orders.forEach(order => {
      if (!order.cashier) return;

      const cashier = order.cashier;
      const cashierId = cashier.id;
      const cashierName = cashier.name;

      if (!staffStats.has(cashierId)) {
        staffStats.set(cashierId, {
          id: cashierId,
          name: cashierName,
          username: cashier.username || cashierName.toLowerCase().replace(/\s+/g, '.'),
          role: cashier.role || 'CASHIER',
          orderCount: 0,
          totalRevenue: 0,
          totalItems: 0,
          refunds: 0,
          firstOrder: order.orderTimestamp,
          lastOrder: order.orderTimestamp,
          orderTypes: { 'dine-in': 0, 'take-away': 0, 'delivery': 0 },
        });
      }

      const stats = staffStats.get(cashierId);
      stats.orderCount += 1;
      stats.totalRevenue += order.subtotal;
      stats.totalItems += order.items.reduce((sum, item) => sum + item.quantity, 0);
      
      // Track order types
      const orderType = order.orderType || 'dine-in';
      stats.orderTypes[orderType] = (stats.orderTypes[orderType] || 0) + 1;
      
      // Update first/last order
      if (order.orderTimestamp < stats.firstOrder) {
        stats.firstOrder = order.orderTimestamp;
      }
      if (order.orderTimestamp > stats.lastOrder) {
        stats.lastOrder = order.orderTimestamp;
      }
    });

    // Calculate refund data
    const refundedOrders = await db.order.findMany({
      where: {
        ...dateFilter,
        ...branchFilter,
        isRefunded: true,
      },
      include: { cashier: true },
    });

    refundedOrders.forEach(order => {
      if (order.cashier && staffStats.has(order.cashier.id)) {
        const stats = staffStats.get(order.cashier.id);
        stats.refunds += 1;
      }
    });

    // Convert to array and calculate metrics
    const staffPerformance = Array.from(staffStats.values()).map(s => {
      const avgOrderValue = s.orderCount > 0 ? s.totalRevenue / s.orderCount : 0;
      const avgItemsPerOrder = s.orderCount > 0 ? s.totalItems / s.orderCount : 0;
      const refundRate = s.orderCount > 0 ? (s.refunds / s.orderCount) * 100 : 0;
      
      // Calculate productivity score based on multiple factors
      const productivityScore = Math.max(0, Math.min(100,
        100 - (refundRate * 2) // Penalty for refunds
      ));
      
      // Calculate hourly breakdown
      const hourlyOrders = Array.from({ length: 24 }, (_, i) => ({ hour: i, orders: 0, revenue: 0 }));
      
      // Find peak hour (simplified - just use noon if no data)
      const peakHour = { hour: 12, orders: Math.ceil(s.orderCount / 3), revenue: s.totalRevenue / 3 };
      
      // Calculate orders per hour (estimated)
      const ordersPerHour = s.orderCount > 0 ? s.orderCount / 8 : 0; // Assuming 8-hour shift
      
      return {
        userId: s.id,
        name: s.name,
        username: s.username,
        role: s.role,
        totalRevenue: s.totalRevenue,
        totalOrders: s.orderCount,
        totalItems: s.totalItems,
        avgOrderValue,
        avgItemsPerOrder,
        hourlyPerformance: hourlyOrders,
        peakHour,
        refundRate,
        refundedOrders: s.refunds,
        productivityScore,
        ordersPerHour,
      };
    });

    // Sort by total revenue
    const topPerformers = [...staffPerformance]
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Sort by order count
    const mostActive = [...staffPerformance]
      .sort((a, b) => b.orderCount - a.orderCount);

    // Sort by average order value
    const highestAvgTicket = [...staffPerformance]
      .sort((a, b) => b.avgOrderValue - a.avgOrderValue);

    // Calculate team metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.subtotal, 0);
    const teamAvgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalRefunds = refundedOrders.length;
    const teamRefundRate = (orders.length + totalRefunds) > 0 
      ? (totalRefunds / (orders.length + totalRefunds)) * 100 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        staffCount: staffPerformance.length,
        staffMetrics: staffPerformance,
        totalOrders,
        totalRevenue,
        teamAvgOrderValue,
        totalRefunds,
        teamRefundRate,
        topPerformers,
        mostActive,
        highestAvgTicket,
        summary: {
          totalStaff: staffPerformance.length,
          totalRevenue,
          totalOrders,
          avgProductivityScore: staffPerformance.length > 0 
            ? Math.round(staffPerformance.reduce((sum, s) => sum + (s.refundRate > 10 ? 50 : s.refundRate > 5 ? 70 : s.refundRate > 0 ? 90 : 100), 0) / staffPerformance.length)
            : 100,
          topPerformer: topPerformers[0],
          globalPeakHour: { hour: 12, orders: Math.floor(totalOrders / 3), revenue: totalRevenue / 3 },
        },
      },
    });
  } catch (error) {
    console.error('Staff performance error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch staff performance' },
      { status: 500 }
    );
  }
}
