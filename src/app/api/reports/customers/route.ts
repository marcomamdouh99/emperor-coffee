import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Customer Analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '20');

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

    // Fetch all orders
    const orders = await db.order.findMany({
      where: {
        ...dateFilter,
        ...branchFilter,
        isRefunded: false,
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: { orderTimestamp: 'asc' },
    });

    // Calculate customer statistics
    const customerStats = new Map<string, any>();

    orders.forEach(order => {
      // Use customer ID if available, otherwise use phone as identifier
      const customerId = order.customerId || 'walk-in';
      const customerName = order.customer?.name || 'Walk-in Customer';
      const customerPhone = order.customer?.phone || 'N/A';

      if (!customerStats.has(customerId)) {
        customerStats.set(customerId, {
          id: customerId,
          name: customerName,
          phone: customerPhone,
          orderCount: 0,
          totalSpent: 0,
          totalItems: 0,
          firstOrderDate: order.orderTimestamp,
          lastOrderDate: order.orderTimestamp,
        });
      }

      const stats = customerStats.get(customerId);
      stats.orderCount += 1;
      stats.totalSpent += order.subtotal;
      stats.totalItems += order.items.reduce((sum, item) => sum + item.quantity, 0);
      
      if (order.orderTimestamp < stats.firstOrderDate) {
        stats.firstOrderDate = order.orderTimestamp;
      }
      if (order.orderTimestamp > stats.lastOrderDate) {
        stats.lastOrderDate = order.orderTimestamp;
      }
    });

    // Convert to array and calculate additional metrics
    const customers = Array.from(customerStats.values()).map(c => {
      const daysSinceLastOrder = Math.floor(
        (Date.now() - new Date(c.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const customerLifetime = Math.floor(
        (new Date(c.lastOrderDate).getTime() - new Date(c.firstOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return {
        ...c,
        avgOrderValue: c.orderCount > 0 ? c.totalSpent / c.orderCount : 0,
        avgItemsPerOrder: c.orderCount > 0 ? c.totalItems / c.orderCount : 0,
        daysSinceLastOrder,
        customerLifetime,
        isRepeat: c.orderCount > 1,
      };
    });

    // Sort by total spent
    const topCustomers = [...customers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);

    // Sort by order count
    const frequentCustomers = [...customers]
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, limit);

    // Calculate customer metrics
    const totalCustomers = customers.length;
    const repeatCustomers = customers.filter(c => c.isRepeat).length;
    const customerRetentionRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    
    // Active customers (ordered in last 30 days)
    const activeCustomers = customers.filter(c => c.daysSinceLastOrder <= 30).length;
    
    // New customers (first order in last 30 days)
    const newCustomers = customers.filter(c => c.customerLifetime <= 30).length;

    // Average order value across all customers
    const avgOrderValue = orders.length > 0
      ? orders.reduce((sum, o) => sum + o.subtotal, 0) / orders.length
      : 0;

    // Calculate customer acquisition by month
    const monthlyAcquisition = new Map<string, number>();
    customers.forEach(c => {
      const monthKey = new Date(c.firstOrderDate).toISOString().slice(0, 7); // YYYY-MM
      monthlyAcquisition.set(monthKey, (monthlyAcquisition.get(monthKey) || 0) + 1);
    });

    const acquisitionTrend = Array.from(monthlyAcquisition.entries())
      .map(([month, count]) => ({ month, newCustomers: count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      success: true,
      data: {
        totalCustomers,
        repeatCustomers,
        newCustomers,
        activeCustomers,
        customerRetentionRate,
        avgOrderValue,
        topCustomers,
        frequentCustomers,
        acquisitionTrend,
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + o.subtotal, 0),
      },
    });
  } catch (error) {
    console.error('Customer analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer analytics' },
      { status: 500 }
    );
  }
}
