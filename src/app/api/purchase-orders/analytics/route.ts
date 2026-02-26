import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/purchase-orders/analytics - Get overall PO analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // all, 7, 30, 90
    const supplierId = searchParams.get('supplierId');
    const branchId = searchParams.get('branchId');

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date | null = null;

    if (period !== 'all') {
      const days = parseInt(period);
      startDate = new Date();
      startDate.setDate(now.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    // Build where clause
    const where: any = {};
    if (startDate) {
      where.orderedAt = { gte: startDate };
    }
    if (supplierId) {
      where.supplierId = supplierId;
    }
    if (branchId) {
      where.branchId = branchId;
    }

    // Fetch purchase orders with items
    const purchaseOrders = await db.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        branch: true,
        items: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    });

    // Calculate summary metrics
    const totalOrders = purchaseOrders.length;
    const totalAmount = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

    // Order status breakdown
    const statusBreakdown = purchaseOrders.reduce(
      (acc, po) => {
        acc[po.status] = (acc[po.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate status amounts
    const statusAmounts = purchaseOrders.reduce(
      (acc, po) => {
        acc[po.status] = (acc[po.status] || 0) + po.totalAmount;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate daily spending (for chart)
    const dailySpending: { date: string; amount: number; orders: number }[] = [];
    const dayMap = new Map<string, { amount: number; orders: number }>();

    purchaseOrders.forEach((po) => {
      const dateKey = new Date(po.orderedAt).toISOString().split('T')[0];
      const existing = dayMap.get(dateKey) || { amount: 0, orders: 0 };
      existing.amount += po.totalAmount;
      existing.orders += 1;
      dayMap.set(dateKey, existing);
    });

    // Fill in missing days for the period
    if (period !== 'all' && startDate) {
      const currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const data = dayMap.get(dateKey) || { amount: 0, orders: 0 };
        dailySpending.push({
          date: dateKey,
          amount: data.amount,
          orders: data.orders,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // For "all" period, just use the days that have orders
      dayMap.forEach((value, key) => {
        dailySpending.push({ date: key, amount: value.amount, orders: value.orders });
      });
      dailySpending.sort((a, b) => a.date.localeCompare(b.date));
    }

    // Top suppliers by order count and amount
    const supplierStats = new Map<string, { name: string; orders: number; amount: number }>();
    purchaseOrders.forEach((po) => {
      const existing = supplierStats.get(po.supplierId) || {
        name: po.supplier.name,
        orders: 0,
        amount: 0,
      };
      existing.orders += 1;
      existing.amount += po.totalAmount;
      supplierStats.set(po.supplierId, existing);
    });

    const topSuppliers = Array.from(supplierStats.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Top ordered items by quantity
    const itemStats = new Map<string, { name: string; unit: string; quantity: number; amount: number }>();
    purchaseOrders.forEach((po) => {
      po.items.forEach((item) => {
        const existing = itemStats.get(item.ingredientId) || {
          name: item.ingredient.name,
          unit: item.unit,
          quantity: 0,
          amount: 0,
        };
        existing.quantity += item.quantity;
        existing.amount += item.quantity * item.unitPrice;
        itemStats.set(item.ingredientId, existing);
      });
    });

    const topItems = Array.from(itemStats.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Pending and overdue orders
    const pendingOrders = purchaseOrders.filter((po) => po.status === 'PENDING' || po.status === 'APPROVED');
    const overdueOrders = pendingOrders.filter((po) => {
      if (po.expectedAt && new Date(po.expectedAt) < now) {
        return true;
      }
      return false;
    });

    // Monthly trend (last 12 months)
    const monthlyTrend: { month: string; amount: number; orders: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const monthOrders = purchaseOrders.filter((po) => {
        const orderDate = new Date(po.orderedAt);
        return orderDate >= monthStart && orderDate <= monthEnd;
      });

      const monthAmount = monthOrders.reduce((sum, po) => sum + po.totalAmount, 0);

      monthlyTrend.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount: monthAmount,
        orders: monthOrders.length,
      });
    }

    return NextResponse.json({
      analytics: {
        summary: {
          totalOrders,
          totalAmount,
          averageOrderValue,
          pendingOrders: pendingOrders.length,
          overdueOrders: overdueOrders.length,
        },
        statusBreakdown: {
          PENDING: {
            count: statusBreakdown.PENDING || 0,
            amount: statusAmounts.PENDING || 0,
          },
          APPROVED: {
            count: statusBreakdown.APPROVED || 0,
            amount: statusAmounts.APPROVED || 0,
          },
          RECEIVED: {
            count: statusBreakdown.RECEIVED || 0,
            amount: statusAmounts.RECEIVED || 0,
          },
          PARTIAL: {
            count: statusBreakdown.PARTIAL || 0,
            amount: statusAmounts.PARTIAL || 0,
          },
          CANCELLED: {
            count: statusBreakdown.CANCELLED || 0,
            amount: statusAmounts.CANCELLED || 0,
          },
        },
        dailySpending,
        monthlyTrend,
        topSuppliers,
        topItems,
        pendingOrders: pendingOrders.slice(0, 10), // Last 10 pending orders
      },
    });
  } catch (error) {
    console.error('Error fetching purchase orders analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders analytics' },
      { status: 500 }
    );
  }
}
