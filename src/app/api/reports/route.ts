import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/reports - Get comprehensive reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const reportType = searchParams.get('type') || 'summary';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate);
    }

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    switch (reportType) {
      case 'sales':
        return await getSalesReport(branchId, dateFilter);
      case 'inventory':
        return await getInventoryReport(branchId);
      case 'waste':
        return await getWasteReport(branchId, dateFilter);
      case 'products':
        return await getProductsReport(branchId, dateFilter);
      case 'hourly':
        return await getHourlyReport(branchId, dateFilter);
      case 'summary':
      default:
        return await getSummaryReport(branchId, dateFilter);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

async function getSummaryReport(branchId: string, dateFilter: any) {
  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get this week's date range
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get this month's date range
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [
    todayOrders,
    weekOrders,
    monthOrders,
    totalOrders,
    inventoryValue,
    lowStockItems,
    expiringItems,
    recentWaste,
  ] = await Promise.all([
    // Today's orders
    db.order.findMany({
      where: {
        branchId,
        orderTimestamp: { gte: today, lt: tomorrow },
      },
    }),
    // This week's orders
    db.order.findMany({
      where: {
        branchId,
        orderTimestamp: { gte: weekStart, lt: weekEnd },
      },
    }),
    // This month's orders
    db.order.findMany({
      where: {
        branchId,
        orderTimestamp: { gte: monthStart, lt: monthEnd },
      },
    }),
    // Total orders count
    db.order.count({ where: { branchId } }),
    // Inventory value
    db.branchInventory.findMany({
      where: { branchId },
      include: { ingredient: true },
    }),
    // Low stock items
    db.branchInventory.findMany({
      where: {
        branchId,
        currentStock: { lte: 0 },
      },
      include: { ingredient: true },
    }),
    // Expiring items (within 7 days)
    db.branchInventory.findMany({
      where: {
        branchId,
        expiryDate: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
      include: { ingredient: true },
    }),
    // Recent waste
    db.wasteLog.findMany({
      where: {
        branchId,
        createdAt: { gte: weekStart },
      },
    }),
  ]);

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const weekRevenue = weekOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const monthRevenue = monthOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const totalInventoryValue = inventoryValue.reduce(
    (sum, inv) => sum + inv.currentStock * inv.ingredient.costPerUnit,
    0
  );
  const weekWasteValue = recentWaste.reduce((sum, w) => sum + w.lossValue, 0);

  return NextResponse.json({
    summary: {
      today: {
        orders: todayOrders.length,
        revenue: todayRevenue,
      },
      week: {
        orders: weekOrders.length,
        revenue: weekRevenue,
      },
      month: {
        orders: monthOrders.length,
        revenue: monthRevenue,
      },
      totalOrders,
      inventoryValue: totalInventoryValue,
      lowStockCount: lowStockItems.length,
      expiringCount: expiringItems.length,
      weekWasteValue,
    },
    alerts: {
      lowStock: lowStockItems.map((inv) => ({
        name: inv.ingredient.name,
        currentStock: inv.currentStock,
        unit: inv.ingredient.unit,
      })),
      expiring: expiringItems.map((inv) => ({
        name: inv.ingredient.name,
        expiryDate: inv.expiryDate,
        currentStock: inv.currentStock,
        unit: inv.ingredient.unit,
      })),
    },
  });
}

async function getSalesReport(branchId: string, dateFilter: any) {
  const orders = await db.order.findMany({
    where: {
      branchId,
      ...dateFilter,
    },
    include: {
      items: true,
      customer: true,
    },
    orderBy: { orderTimestamp: 'asc' },
  });

  // Group by date
  const byDate = orders.reduce((acc, order) => {
    const date = order.orderTimestamp.toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { orders: 0, revenue: 0, items: 0 };
    }
    acc[date].orders++;
    acc[date].revenue += order.subtotal;
    acc[date].items += order.items.length;
    return acc;
  }, {} as Record<string, any>);

  // Group by payment method
  const byPayment = orders.reduce((acc, order) => {
    acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group by order type
  const byOrderType = orders.reduce((acc, order) => {
    acc[order.orderType] = (acc[order.orderType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate totals
  const totalRevenue = orders.reduce((sum, o) => sum + o.subtotal, 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return NextResponse.json({
    overview: {
      totalRevenue,
      totalOrders,
      avgOrderValue,
    },
    byDate: Object.entries(byDate).map(([date, data]) => ({
      date,
      ...data,
    })),
    byPayment,
    byOrderType,
    orders: orders.slice(0, 50), // Last 50 orders
  });
}

async function getInventoryReport(branchId: string) {
  const inventory = await db.branchInventory.findMany({
    where: { branchId },
    include: {
      ingredient: true,
    },
    orderBy: { currentStock: 'asc' },
  });

  const transactions = await db.inventoryTransaction.findMany({
    where: {
      branchId,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      ingredient: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const totalValue = inventory.reduce(
    (sum, inv) => sum + inv.currentStock * inv.ingredient.costPerUnit,
    0
  );

  const lowStock = inventory.filter(
    (inv) => inv.currentStock <= (inv.ingredient.alertThreshold || inv.ingredient.reorderThreshold)
  );

  const expiring = inventory.filter(
    (inv) => inv.expiryDate && inv.expiryDate <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );

  return NextResponse.json({
    overview: {
      totalItems: inventory.length,
      totalValue,
      lowStockCount: lowStock.length,
      expiringCount: expiring.length,
    },
    inventory: inventory.map((inv) => ({
      id: inv.id,
      ingredientId: inv.ingredientId,
      name: inv.ingredient.name,
      unit: inv.ingredient.unit,
      currentStock: inv.currentStock,
      reservedStock: inv.reservedStock,
      availableStock: inv.currentStock - inv.reservedStock,
      costPerUnit: inv.ingredient.costPerUnit,
      totalValue: inv.currentStock * inv.ingredient.costPerUnit,
      threshold: inv.ingredient.alertThreshold || inv.ingredient.reorderThreshold,
      isLow: inv.currentStock <= (inv.ingredient.alertThreshold || inv.ingredient.reorderThreshold),
      expiryDate: inv.expiryDate,
      lastRestockAt: inv.lastRestockAt,
    })),
    lowStock: lowStock.map((inv) => ({
      name: inv.ingredient.name,
      currentStock: inv.currentStock,
      threshold: inv.ingredient.alertThreshold || inv.ingredient.reorderThreshold,
      unit: inv.ingredient.unit,
    })),
    expiring: expiring.map((inv) => ({
      name: inv.ingredient.name,
      currentStock: inv.currentStock,
      expiryDate: inv.expiryDate,
      unit: inv.ingredient.unit,
    })),
    recentTransactions: transactions.slice(0, 20),
  });
}

async function getWasteReport(branchId: string, dateFilter: any) {
  const wasteLogs = await db.wasteLog.findMany({
    where: {
      branchId,
      ...dateFilter,
    },
    include: {
      ingredient: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalLoss = wasteLogs.reduce((sum, w) => sum + w.lossValue, 0);

  const byReason = wasteLogs.reduce((acc, log) => {
    if (!acc[log.reason]) {
      acc[log.reason] = { count: 0, totalLoss: 0 };
    }
    acc[log.reason].count++;
    acc[log.reason].totalLoss += log.lossValue;
    return acc;
  }, {} as Record<string, any>);

  const byIngredient = wasteLogs.reduce((acc, log) => {
    if (!acc[log.ingredientId]) {
      acc[log.ingredientId] = {
        name: log.ingredient.name,
        count: 0,
        totalLoss: 0,
        totalQuantity: 0,
      };
    }
    acc[log.ingredientId].count++;
    acc[log.ingredientId].totalLoss += log.lossValue;
    acc[log.ingredientId].totalQuantity += log.quantity;
    return acc;
  }, {} as Record<string, any>);

  return NextResponse.json({
    overview: {
      totalWaste: wasteLogs.length,
      totalLoss,
      avgLossPerLog: wasteLogs.length > 0 ? totalLoss / wasteLogs.length : 0,
    },
    byReason: Object.entries(byReason).map(([reason, data]) => ({
      reason,
      ...data,
    })),
    byIngredient: Object.values(byIngredient).sort((a: any, b: any) => b.totalLoss - a.totalLoss),
    recentLogs: wasteLogs.slice(0, 20),
  });
}

async function getProductsReport(branchId: string, dateFilter: any) {
  const orders = await db.order.findMany({
    where: {
      branchId,
      ...dateFilter,
    },
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
    },
  });

  const productSales = orders.reduce((acc, order) => {
    order.items.forEach((item) => {
      if (!acc[item.menuItemId]) {
        acc[item.menuItemId] = {
          name: item.itemName,
          quantity: 0,
          revenue: 0,
          orders: 0,
        };
      }
      acc[item.menuItemId].quantity += item.quantity;
      acc[item.menuItemId].revenue += item.subtotal;
      acc[item.menuItemId].orders++;
    });
    return acc;
  }, {} as Record<string, any>);

  const sortedProducts = Object.values(productSales).sort(
    (a: any, b: any) => b.revenue - a.revenue
  );

  return NextResponse.json({
    topProducts: sortedProducts.slice(0, 10),
    allProducts: sortedProducts,
  });
}

async function getHourlyReport(branchId: string, dateFilter: any) {
  const orders = await db.order.findMany({
    where: {
      branchId,
      ...dateFilter,
    },
    orderBy: { orderTimestamp: 'asc' },
  });

  const hourlyData = orders.reduce((acc, order) => {
    const hour = new Date(order.orderTimestamp).getHours();
    if (!acc[hour]) {
      acc[hour] = { orders: 0, revenue: 0 };
    }
    acc[hour].orders++;
    acc[hour].revenue += order.subtotal;
    return acc;
  }, {} as Record<number, any>);

  // Fill in missing hours
  for (let i = 0; i < 24; i++) {
    if (!hourlyData[i]) {
      hourlyData[i] = { orders: 0, revenue: 0 };
    }
  }

  return NextResponse.json({
    hourly: Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        ...data,
      }))
      .sort((a: any, b: any) => a.hour - b.hour),
  });
}
