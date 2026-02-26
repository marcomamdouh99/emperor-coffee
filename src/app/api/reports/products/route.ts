import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Product Performance Report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'quantity'; // 'quantity', 'revenue', 'growth'

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

    // Fetch all orders with items
    const orders = await db.order.findMany({
      where: {
        ...dateFilter,
        ...branchFilter,
        isRefunded: false,
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // Aggregate product data
    const productStats = new Map<string, any>();

    orders.forEach(order => {
      order.items.forEach(item => {
        const menuItem = (item as any).menuItem;
        if (!menuItem) return;

        const key = menuItem.id;
        if (!productStats.has(key)) {
          productStats.set(key, {
            id: menuItem.id,
            name: menuItem.name,
            category: menuItem.category,
            price: menuItem.price,
            quantity: 0,
            revenue: 0,
            orders: 0,
          });
        }

        const stats = productStats.get(key);
        stats.quantity += item.quantity;
        stats.revenue += item.quantity * item.unitPrice;
        stats.orders += 1;
      });
    });

    // Convert to array and calculate averages
    const products = Array.from(productStats.values()).map(p => ({
      ...p,
      avgPerOrder: p.orders > 0 ? p.revenue / p.orders : 0,
      avgQuantityPerOrder: p.orders > 0 ? p.quantity / p.orders : 0,
    }));

    // Sort products
    let sortedProducts = [...products];
    if (sortBy === 'quantity') {
      sortedProducts.sort((a, b) => b.quantity - a.quantity);
    } else if (sortBy === 'revenue') {
      sortedProducts.sort((a, b) => b.revenue - a.revenue);
    } else if (sortBy === 'avgOrder') {
      sortedProducts.sort((a, b) => b.avgPerOrder - a.avgPerOrder);
    }

    // Calculate category breakdown
    const categoryStats = new Map<string, { count: number; quantity: number; revenue: number }>();
    products.forEach(p => {
      if (!categoryStats.has(p.category)) {
        categoryStats.set(p.category, { count: 0, quantity: 0, revenue: 0 });
      }
      const stats = categoryStats.get(p.category)!;
      stats.count += 1;
      stats.quantity += p.quantity;
      stats.revenue += p.revenue;
    });

    const categories = Array.from(categoryStats.entries()).map(([category, stats]) => ({
      category,
      productCount: stats.count,
      totalQuantity: stats.quantity,
      totalRevenue: stats.revenue,
    }));

    // Identify slow-moving products (bottom 20% by quantity)
    const slowMovers = [...products]
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, Math.max(1, Math.floor(products.length * 0.2)));

    return NextResponse.json({
      success: true,
      data: {
        topProducts: sortedProducts.slice(0, limit),
        slowMovers: slowMovers.slice(0, limit),
        categories: categories.sort((a, b) => b.totalRevenue - a.totalRevenue),
        totalProducts: products.length,
        totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
        totalRevenue: products.reduce((sum, p) => sum + p.revenue, 0),
      },
    });
  } catch (error) {
    console.error('Product performance error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product performance' },
      { status: 500 }
    );
  }
}
