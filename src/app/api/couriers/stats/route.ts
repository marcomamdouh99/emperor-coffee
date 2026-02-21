import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Courier statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    // Build date filter for current month
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const where: any = {
      orderTimestamp: {
        gte: startDate,
        lte: endDate,
      },
      orderType: 'delivery',
      isRefunded: false,
    };

    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    }

    // Fetch all couriers
    const couriers = await db.courier.findMany({
      where: branchId && branchId !== 'all' ? { branchId } : {},
      orderBy: { name: 'asc' },
    });

    // Fetch all delivery orders for the period
    const orders = await db.order.findMany({
      where,
      select: {
        courierId: true,
        subtotal: true,
        deliveryFee: true,
      },
    });

    // Calculate stats for each courier
    const stats = couriers.map((courier) => {
      const courierOrders = orders.filter((o) => o.courierId === courier.id);
      const totalOrders = courierOrders.length;
      const totalRevenue = courierOrders.reduce((sum, o) => sum + o.subtotal, 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        courierId: courier.id,
        courierName: courier.name,
        totalOrders,
        totalRevenue,
        avgOrderValue,
      };
    });

    // Sort by total orders descending
    stats.sort((a, b) => b.totalOrders - a.totalOrders);

    return NextResponse.json({ stats }, { status: 200 });
  } catch (error) {
    console.error('Error fetching courier stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courier stats' },
      { status: 500 }
    );
  }
}
