import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const period = (searchParams.get('period') || 'daily') as 'daily' | 'monthly' | 'weekly' | 'yearly';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 });
    }

    let whereClause: any = { branchId, isRefunded: false };

    if (startDate || endDate) {
      whereClause.orderTimestamp = {};
      if (startDate) whereClause.orderTimestamp.gte = new Date(startDate);
      if (endDate) whereClause.orderTimestamp.lte = new Date(endDate);
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      whereClause.orderTimestamp = { gte: thirtyDaysAgo };
    }

    const orders = await db.order.findMany({
      where: whereClause,
      include: { items: true },
      orderBy: { orderTimestamp: 'desc' },
    });

    const groupedData = groupSalesByPeriod(orders, period);

    const totals = {
      totalRevenue: orders.reduce((sum: number, order: any) => sum + order.subtotal, 0),
      totalOrders: orders.length,
      avgOrderValue: orders.length > 0 ? orders.reduce((sum: number, order: any) => sum + order.subtotal, 0) / orders.length : 0,
      totalItemsSold: orders.reduce((sum: number, order: any) => sum + order.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0),
    };

    const paymentMethods = {
      cash: orders.filter((o: any) => o.paymentMethod === 'cash').reduce((sum: number, o: any) => sum + o.subtotal, 0),
      card: orders.filter((o: any) => o.paymentMethod === 'card').reduce((sum: number, o: any) => sum + o.subtotal, 0),
    };

    return NextResponse.json({
      success: true,
      period,
      branchId,
      startDate,
      endDate,
      totals,
      paymentMethods,
      groupedData,
    });

  } catch (error) {
    console.error('Error fetching sales reports:', error);
    return NextResponse.json({ error: 'Failed to fetch sales reports' }, { status: 500 });
  }
}

function groupSalesByPeriod(orders: any[], period: string): any[] {
  const grouped: { [key: string]: any } = {};

  orders.forEach((order) => {
    const date = new Date(order.orderTimestamp);
    let key: string;

    switch (period) {
      case 'daily':
        key = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
        key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        break;
      case 'yearly':
        key = String(date.getFullYear());
        break;
      default:
        key = date.toISOString().split('T')[0];
    }

    if (!grouped[key]) {
      grouped[key] = {
        date: key,
        orders: 0,
        revenue: 0,
        itemsSold: 0,
        avgOrderValue: 0,
        paymentMethods: { cash: 0, card: 0 },
      };
    }

    grouped[key].orders += 1;
    grouped[key].revenue += order.subtotal;
    grouped[key].itemsSold += order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

    if (order.paymentMethod === 'cash') grouped[key].paymentMethods.cash += order.subtotal;
    else if (order.paymentMethod === 'card') grouped[key].paymentMethods.card += order.subtotal;
  });

  Object.values(grouped).forEach((group: any) => {
    if (group.orders > 0) group.avgOrderValue = group.revenue / group.orders;
  });

  return Object.values(grouped).sort((a: any, b: any) => b.date.localeCompare(a.date));
}
