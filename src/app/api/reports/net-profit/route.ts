import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Net Profit/Loss Calculation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const period = searchParams.get('period'); // Format: "YYYY-MM"

    // Parse period to get start and end dates
    let startDate: Date;
    let endDate: Date;

    if (period) {
      const [year, month] = period.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Build date filter
    const dateFilter: any = {
      orderTimestamp: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Build branch filter
    const branchFilter: any = {};
    if (branchId && branchId !== 'all') {
      branchFilter.branchId = branchId;
    }

    // Fetch orders for the period
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
      orderBy: { orderTimestamp: 'asc' },
    });

    // Fetch all recipes and ingredients for cost calculation
    const recipes = await db.recipe.findMany({
      include: {
        ingredient: true,
        variant: true,
      },
    });

    // Build recipe map: menuItemId -> menuItemVariantId -> ingredientId -> quantity
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

    // Calculate total revenue and product cost by category
    let totalRevenue = 0;
    let totalProductCost = 0;
    let totalItemsSold = 0;

    // Category breakdown data
    const categoryBreakdown: Map<string, {
      revenue: number;
      orders: number;
      itemsSold: number;
      productCost: number;
    }> = new Map();

    const processedOrders = new Set<string>();

    orders.forEach(order => {
      totalRevenue += order.subtotal;

      if (!processedOrders.has(order.id)) {
        processedOrders.add(order.id);
      }

      order.items.forEach(item => {
        totalItemsSold += item.quantity;

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

    // Build category breakdown from order items
    orders.forEach(order => {
      order.items.forEach(item => {
        const categoryName = item.menuItem?.category || 'Uncategorized';

        if (!categoryBreakdown.has(categoryName)) {
          categoryBreakdown.set(categoryName, {
            revenue: 0,
            orders: 0,
            itemsSold: 0,
            productCost: 0,
          });
        }

        const category = categoryBreakdown.get(categoryName)!;

        // Add revenue and items for this item
        category.revenue += item.subtotal;
        category.itemsSold += item.quantity;

        // Calculate product cost for this item
        const variantMap = recipeMap.get(item.menuItemId);
        if (variantMap) {
          let ingredientMap = variantMap.get(item.menuItemVariantId);
          if (!ingredientMap) {
            ingredientMap = variantMap.get(null);
          }
          if (ingredientMap) {
            let itemCost = 0;
            ingredientMap.forEach((quantity, ingredientId) => {
              const costPerUnit = ingredientCostMap.get(ingredientId) || 0;
              itemCost += quantity * costPerUnit;
            });
            category.productCost += itemCost * item.quantity;
          }
        }
      });

      // Count orders for categories
      const uniqueCategoriesInOrder = new Set(
        order.items.map(item => item.menuItem?.category || 'Uncategorized')
      );
      uniqueCategoriesInOrder.forEach(categoryName => {
        const category = categoryBreakdown.get(categoryName);
        if (category) {
          category.orders += 1;
        }
      });
    });

    // Net profit from operations (Sales - Product Cost)
    const netProfitFromOperations = totalRevenue - totalProductCost;

    // Fetch operational costs for the same period
    const costs = await db.branchCost.findMany({
      where: {
        ...branchFilter,
        period: period || `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
      },
      include: {
        costCategory: true,
        branch: true,
      },
    });

    const totalOperationalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);

    // Final net profit/loss after all expenses
    const finalNetProfit = netProfitFromOperations - totalOperationalCosts;

    // Calculate margin percentages
    const grossMargin = totalRevenue > 0 ? (netProfitFromOperations / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (finalNetProfit / totalRevenue) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        period: period || `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
        sales: {
          revenue: totalRevenue,
          productCost: totalProductCost,
          netProfitFromOperations,
          grossMargin,
        },
        costs: {
          operational: totalOperationalCosts,
          entries: costs.length,
          byCategory: costs.reduce((acc: any, cost) => {
            const categoryName = cost.costCategory.name;
            acc[categoryName] = (acc[categoryName] || 0) + cost.amount;
            return acc;
          }, {}),
        },
        netProfit: {
          amount: finalNetProfit,
          margin: netMargin,
          isProfitable: finalNetProfit >= 0,
        },
        items: {
          sold: totalItemsSold,
          orders: orders.length,
        },
        costsBreakdown: costs.map(cost => ({
          id: cost.id,
          category: cost.costCategory.name,
          amount: cost.amount,
          branch: cost.branch.branchName,
          notes: cost.notes,
          date: cost.createdAt,
        })),
        categoryBreakdown: Array.from(categoryBreakdown.entries()).map(([categoryName, data]) => ({
          category: categoryName,
          revenue: data.revenue,
          orders: data.orders,
          itemsSold: data.itemsSold,
          productCost: data.productCost,
          netFromOperations: data.revenue - data.productCost,
          grossMargin: data.revenue > 0 ? ((data.revenue - data.productCost) / data.revenue) * 100 : 0,
        })).sort((a, b) => b.revenue - a.revenue),
      },
    });
  } catch (error) {
    console.error('Net Profit calculation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate net profit' },
      { status: 500 }
    );
  }
}
