import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Comprehensive KPIs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const comparePeriod = searchParams.get('comparePeriod') === 'true';

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

    // Fetch all menu items for category data
    const menuItems = await db.menuItem.findMany({
      where: { isActive: true },
      select: { id: true, category: true, name: true },
    });

    // Build a map for quick menu item lookup
    const menuItemMap = new Map<string, { category: string; name: string }>();
    menuItems.forEach(item => {
      menuItemMap.set(item.id, { category: item.category, name: item.name });
    });

    // Main period orders
    const mainOrders = await db.order.findMany({
      where: {
        ...dateFilter,
        ...branchFilter,
        isRefunded: false,
      },
      include: {
        items: true,
        cashier: {
          select: { name: true },
        },
      },
      orderBy: { orderTimestamp: 'asc' },
    });

    // Previous period orders for comparison
    let previousOrders: any[] = [];
    if (comparePeriod && startDate && endDate) {
      const currentStart = new Date(startDate);
      const currentEnd = new Date(endDate);
      const daysDiff = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
      
      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - daysDiff);
      const previousEnd = new Date(currentEnd);
      previousEnd.setDate(previousEnd.getDate() - daysDiff);

      previousOrders = await db.order.findMany({
        where: {
          orderTimestamp: {
            gte: previousStart,
            lte: previousEnd,
          },
          ...branchFilter,
          isRefunded: false,
        },
        include: {
          items: true,
        },
      });
    }

    // Fetch all recipes and ingredients for cost calculation
    const recipes = await db.recipe.findMany({
      include: {
        ingredient: true,
        variant: true,
      },
    });

    // Build a map for quick recipe lookup: menuItemId -> menuItemVariantId -> ingredientId -> quantity
    const recipeMap = new Map<string, Map<string | null, Map<string, number>>>();
    recipes.forEach(recipe => {
      if (!recipeMap.has(recipe.menuItemId)) {
        recipeMap.set(recipe.menuItemId, new Map());
      }
      const variantMap = recipeMap.get(recipe.menuItemId)!;
      if (!variantMap.has(recipe.menuItemVariantId)) {
        variantMap.set(recipe.menuItemVariantId, new Map());
      }
      const ingredientMap = variantMap.get(recipe.menuItemVariantId)!;
      ingredientMap.set(recipe.ingredientId, recipe.quantityRequired);
    });

    // Build ingredient cost map
    const ingredientCostMap = new Map<string, number>();
    recipes.forEach(recipe => {
      if (recipe.ingredient && recipe.ingredient.costPerUnit) {
        ingredientCostMap.set(recipe.ingredientId, recipe.ingredient.costPerUnit);
      }
    });

    // Calculate total product cost
    let totalProductCost = 0;
    mainOrders.forEach(order => {
      order.items.forEach(item => {
        // Get the appropriate recipe map
        const variantMap = recipeMap.get(item.menuItemId);
        if (!variantMap) return;

        // Try to find recipe for specific variant first, then fall back to base item
        let ingredientMap = variantMap.get(item.menuItemVariantId);
        if (!ingredientMap) {
          ingredientMap = variantMap.get(null);
        }
        if (!ingredientMap) return;

        // Calculate cost for this item
        let itemCost = 0;
        ingredientMap.forEach((quantity, ingredientId) => {
          const costPerUnit = ingredientCostMap.get(ingredientId) || 0;
          itemCost += quantity * costPerUnit;
        });

        totalProductCost += itemCost * item.quantity;
      });
    });

    // Calculate main period metrics
    const totalRevenue = mainOrders.reduce((sum, order) => sum + order.subtotal, 0);
    const totalOrders = mainOrders.length;
    const totalItems = mainOrders.reduce((sum, order) => sum + order.items.reduce((is, i) => is + i.quantity, 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalDeliveryFees = mainOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
    const netRevenue = totalRevenue - totalProductCost; // Net = Revenue - Product Cost

    // Calculate previous period metrics
    const previousRevenue = previousOrders.reduce((sum, order) => sum + order.subtotal, 0);
    const previousOrdersCount = previousOrders.length;
    const previousAvgOrderValue = previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0;

    // Growth calculations
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const ordersGrowth = previousOrdersCount > 0 ? ((totalOrders - previousOrdersCount) / previousOrdersCount) * 100 : 0;
    const avgOrderGrowth = previousAvgOrderValue > 0 ? ((avgOrderValue - previousAvgOrderValue) / previousAvgOrderValue) * 100 : 0;

    // Order type breakdown
    const orderTypes = mainOrders.reduce((acc: any, order) => {
      const type = order.orderType || 'dine-in';
      acc[type] = (acc[type] || 0) + 1;
      acc[`${type}_revenue`] = (acc[`${type}_revenue`] || 0) + order.subtotal;
      return acc;
    }, {});

    // Payment method breakdown
    const paymentMethods = mainOrders.reduce((acc: any, order) => {
      const method = order.paymentMethod || 'cash';
      if (!acc[method]) {
        acc[method] = { count: 0, revenue: 0 };
      }
      acc[method].count += 1;
      acc[method].revenue += order.subtotal;
      return acc;
    }, {});

    // Hourly breakdown
    const hourlySales = Array.from({ length: 24 }, (_, i) => ({ hour: i, revenue: 0, orders: 0 }));
    mainOrders.forEach(order => {
      const hour = new Date(order.orderTimestamp).getHours();
      if (hourlySales[hour]) {
        hourlySales[hour].revenue += order.subtotal;
        hourlySales[hour].orders += 1;
      }
    });

    // Find peak hour
    const peakHour = hourlySales.reduce((max, h) => h.revenue > max.revenue ? h : max, hourlySales[0]);

    // Calculate refund rate (including refunded orders in total)
    const allOrders = await db.order.findMany({
      where: { ...dateFilter, ...branchFilter },
    });
    const refundedOrders = allOrders.filter(o => o.isRefunded).length;
    const refundRate = allOrders.length > 0 ? (refundedOrders / allOrders.length) * 100 : 0;

    // Top categories
    const categorySales: any = {};
    mainOrders.forEach(order => {
      order.items.forEach(item => {
        // Look up the menu item from our map
        const menuItemData = menuItemMap.get(item.menuItemId);
        const category = menuItemData?.category || item.itemName || 'Other';
        categorySales[category] = (categorySales[category] || 0) + (item.quantity * item.unitPrice);
      });
    });

    const topCategories = Object.entries(categorySales)
      .map(([category, revenue]) => ({ category, revenue: revenue as number }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // If no categories found, return empty array instead of undefined
    const finalTopCategories = topCategories.length > 0 ? topCategories : [];

    return NextResponse.json({
      success: true,
      data: {
        revenue: {
          total: totalRevenue,
          net: netRevenue,
          productCost: totalProductCost,
          deliveryFees: totalDeliveryFees,
          growth: revenueGrowth,
        },
        orders: {
          total: totalOrders,
          items: totalItems,
          avgValue: avgOrderValue,
          growth: ordersGrowth,
          avgValueGrowth: avgOrderGrowth,
        },
        orderTypes: {
          dineIn: { count: orderTypes['dine-in'] || 0, revenue: orderTypes['dine-in_revenue'] || 0 },
          takeAway: { count: orderTypes['take-away'] || 0, revenue: orderTypes['take-away_revenue'] || 0 },
          delivery: { count: orderTypes['delivery'] || 0, revenue: orderTypes['delivery_revenue'] || 0 },
        },
        paymentMethods,
        hourlySales,
        peakHour: {
          hour: peakHour.hour,
          revenue: peakHour.revenue,
          orders: peakHour.orders,
        },
        refunds: {
          count: refundedOrders,
          rate: refundRate,
        },
        topCategories: finalTopCategories,
        comparison: comparePeriod ? {
          previousRevenue,
          previousOrders: previousOrdersCount,
          previousAvgOrder: previousAvgOrderValue,
        } : null,
      },
    });
  } catch (error) {
    console.error('KPIs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch KPIs' },
      { status: 500 }
    );
  }
}
