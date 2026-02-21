import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/suppliers/[id]/analytics - Get supplier analytics
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if supplier exists
    const supplier = await db.supplier.findUnique({
      where: { id: params.id },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Get all purchase orders for this supplier
    const purchaseOrders = await db.purchaseOrder.findMany({
      where: { supplierId: params.id },
      include: {
        items: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    });

    // Calculate analytics
    const totalOrders = purchaseOrders.length;
    const totalSpent = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

    // Order status breakdown
    const statusBreakdown = purchaseOrders.reduce(
      (acc, po) => {
        acc[po.status] = (acc[po.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate monthly spending trend (last 12 months)
    const monthlySpending: { month: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const monthOrders = purchaseOrders.filter(
        (po) => {
          const orderDate = new Date(po.orderedAt);
          return orderDate >= monthStart && orderDate <= monthEnd;
        }
      );

      const monthAmount = monthOrders.reduce((sum, po) => sum + po.totalAmount, 0);

      monthlySpending.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount: monthAmount,
      });
    }

    // Find last order date
    const lastOrderDate = purchaseOrders.length > 0 
      ? purchaseOrders[0].orderedAt 
      : null;

    // Calculate top purchased items by quantity
    const ingredientPurchases = purchaseOrders.flatMap((po) =>
      po.items.map((item) => ({
        ingredientId: item.ingredientId,
        ingredientName: item.ingredient.name,
        unit: item.unit,
        totalQuantity: item.quantity,
        totalSpent: item.quantity * item.unitPrice,
        orderCount: 1,
      }))
    );

    // Aggregate by ingredient
    const topPurchasedItems = ingredientPurchases.reduce(
      (acc, item) => {
        const existing = acc.find((i) => i.ingredientId === item.ingredientId);
        if (existing) {
          existing.totalQuantity += item.totalQuantity;
          existing.totalSpent += item.totalSpent;
          existing.orderCount += 1;
        } else {
          acc.push({ ...item });
        }
        return acc;
      },
      [] as Array<{
        ingredientId: string;
        ingredientName: string;
        unit: string;
        totalQuantity: number;
        totalSpent: number;
        orderCount: number;
      }>
    );

    // Sort by total quantity
    topPurchasedItems.sort((a, b) => b.totalQuantity - a.totalQuantity);

    // Get top 10 items
    const top10Items = topPurchasedItems.slice(0, 10);

    // Calculate delivery performance (on-time vs late)
    let onTimeDeliveries = 0;
    let lateDeliveries = 0;
    let pendingOrders = 0;

    purchaseOrders.forEach((po) => {
      if (po.status === 'PENDING' || po.status === 'APPROVED') {
        pendingOrders++;
      } else if (po.expectedAt && po.receivedAt) {
        if (new Date(po.receivedAt) <= new Date(po.expectedAt)) {
          onTimeDeliveries++;
        } else {
          lateDeliveries++;
        }
      }
    });

    const totalDelivered = onTimeDeliveries + lateDeliveries;
    const onTimePercentage = totalDelivered > 0 
      ? (onTimeDeliveries / totalDelivered) * 100 
      : null;

    return NextResponse.json({
      analytics: {
        supplierId: params.id,
        supplierName: supplier.name,
        summary: {
          totalOrders,
          totalSpent,
          averageOrderValue,
          lastOrderDate,
          onTimePercentage,
        },
        statusBreakdown: {
          PENDING: statusBreakdown.PENDING || 0,
          APPROVED: statusBreakdown.APPROVED || 0,
          RECEIVED: statusBreakdown.RECEIVED || 0,
          PARTIAL: statusBreakdown.PARTIAL || 0,
          CANCELLED: statusBreakdown.CANCELLED || 0,
        },
        monthlySpending,
        topPurchasedItems: top10Items,
        deliveryPerformance: {
          onTimeDeliveries,
          lateDeliveries,
          pendingOrders,
          totalDelivered,
          onTimePercentage,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching supplier analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier analytics' },
      { status: 500 }
    );
  }
}
