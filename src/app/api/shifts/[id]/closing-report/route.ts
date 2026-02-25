import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/shifts/[id]/closing-report
// Get detailed closing shift report with payment and item breakdowns
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shiftId } = await params;


    // Get shift with all related data
    const shift = await db.shift.findUnique({
      where: { id: shiftId },
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        branch: {
          select: {
            id: true,
            branchName: true
          }
        },
        orders: {
          include: {
            items: {
              include: {
                menuItem: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    categoryId: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!shift) {
      return NextResponse.json({
        success: false,
        error: 'Shift not found'
      }, { status: 404 });
    }

    // Calculate payment breakdown with card details
    let cashTotal = 0;
    let cardTotal = 0;
    let instapayTotal = 0;
    let walletTotal = 0;
    let otherTotal = 0;

    shift.orders.forEach(order => {
      const method = order.paymentMethod.toLowerCase();
      if (method === 'cash') {
        cashTotal += order.totalAmount;
      } else if (method === 'card') {
        // Break down card payments by detail
        const detail = order.paymentMethodDetail?.toUpperCase();
        if (detail === 'INSTAPAY') {
          instapayTotal += order.totalAmount;
        } else if (detail === 'MOBILE_WALLET') {
          walletTotal += order.totalAmount;
        } else {
          // Default to CARD for regular card payments
          cardTotal += order.totalAmount;
        }
      } else if (method.includes('visa') || method.includes('credit')) {
        cardTotal += order.totalAmount;
      } else {
        otherTotal += order.totalAmount;
      }
    });

    // Calculate order type breakdown
    const orderTypeBreakdown = {
      'take-away': { value: 0, discounts: 0, count: 0, total: 0 },
      'dine-in': { value: 0, discounts: 0, count: 0, total: 0 },
      'delivery': { value: 0, discounts: 0, count: 0, total: 0 }
    };

    let totalDiscounts = 0;
    let totalDeliveryFees = 0;
    let totalRefunds = 0;
    let totalSales = 0;

    shift.orders.forEach(order => {
      if (order.isRefunded) {
        totalRefunds += order.totalAmount;
        return; // Skip refunded orders from sales calculations
      }

      const type = order.orderType || 'dine-in';
      if (orderTypeBreakdown[type]) {
        orderTypeBreakdown[type].value += order.subtotal;
        orderTypeBreakdown[type].count += 1;
        totalSales += order.subtotal;
      }

      // Add discounts
      const orderDiscount = (order.promoDiscount || 0);
      if (orderTypeBreakdown[type]) {
        orderTypeBreakdown[type].discounts += orderDiscount;
      }
      totalDiscounts += orderDiscount;

      // Add delivery fees
      totalDeliveryFees += order.deliveryFee || 0;
    });

    // Calculate totals per order type
    Object.keys(orderTypeBreakdown).forEach(type => {
      orderTypeBreakdown[type].total = orderTypeBreakdown[type].value - orderTypeBreakdown[type].discounts;
    });

    // Normalize category name
    const normalizeCategory = (category: string | null | undefined): string => {
      if (!category) return 'Uncategorized';
      return category.trim().replace(/\s+/g, ' ');
    };

    // Get display name for item (including variant if present)
    const getItemDisplayName = (orderItem: any): string => {
      const baseName = orderItem.menuItem?.name || orderItem.itemName;
      const variant = orderItem.variantName;
      return variant ? `${baseName} - ${variant}` : baseName;
    };

    // Group items by category
    const categoryBreakdown = new Map<string, {
      categoryName: string;
      totalSales: number;
      items: Map<string, {
        itemId: string;
        itemName: string;
        quantity: number;
        totalPrice: number;
      }>;
    }>();

    shift.orders.forEach(order => {
      if (order.isRefunded) return; // Skip refunded orders

      order.items.forEach(orderItem => {
        const category = normalizeCategory(orderItem.menuItem?.category);

        if (!categoryBreakdown.has(category)) {
          categoryBreakdown.set(category, {
            categoryName: category,
            totalSales: 0,
            items: new Map()
          });
        }

        const catData = categoryBreakdown.get(category)!;
        catData.totalSales += orderItem.subtotal;

        const itemName = getItemDisplayName(orderItem);
        const itemId = orderItem.menuItemId + (orderItem.menuItemVariantId ? `_${orderItem.menuItemVariantId}` : '');

        if (!catData.items.has(itemId)) {
          catData.items.set(itemId, {
            itemId,
            itemName,
            quantity: 0,
            totalPrice: 0
          });
        }

        const itemData = catData.items.get(itemId)!;
        itemData.quantity += orderItem.quantity;
        itemData.totalPrice += orderItem.subtotal;
      });
    });

    // Convert to array and sort
    const categories = Array.from(categoryBreakdown.values())
      .filter(cat => cat.totalSales > 0)
      .map(cat => ({
        categoryName: cat.categoryName,
        totalSales: cat.totalSales,
        items: Array.from(cat.items.values()).map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: item.quantity,
          totalPrice: item.totalPrice
        }))
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    // Get daily expenses for this shift
    const dailyExpenses = await db.dailyExpense.findMany({
      where: {
        shiftId: shiftId
      }
    });
    const totalDailyExpenses = dailyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate cash balance (subtract daily expenses)
    const expectedCash = shift.openingCash + cashTotal - totalDailyExpenses;
    const overShort = shift.closingCash ? shift.closingCash - expectedCash : null;

    // Generate shift number from orders count or closing orders
    const shiftNumber = Math.max(shift.openingOrders, shift.closingOrders || 0, shift.orders.length);

    // Generate report
    const report = {
      shift: {
        id: shift.id,
        shiftNumber,
        startTime: shift.startTime,
        endTime: shift.endTime,
        cashier: shift.cashier,
        branch: shift.branch,
        openingCash: shift.openingCash,
        closingCash: shift.closingCash,
        openingOrders: shift.openingOrders,
        closingOrders: shift.closingOrders,
        openingRevenue: shift.openingRevenue,
        closingRevenue: shift.closingRevenue,
        notes: shift.notes
      },
      paymentSummary: {
        cash: cashTotal,
        card: cardTotal,
        instapay: instapayTotal,
        wallet: walletTotal,
        other: otherTotal,
        total: cashTotal + cardTotal + instapayTotal + walletTotal + otherTotal
      },
      orderTypeBreakdown,
      totals: {
        sales: totalSales,
        discounts: totalDiscounts,
        deliveryFees: totalDeliveryFees,
        refunds: totalRefunds,
        card: cardTotal,
        instapay: instapayTotal,
        wallet: walletTotal,
        cash: cashTotal,
        dailyExpenses: totalDailyExpenses,
        openingCashBalance: shift.openingCash,
        expectedCash: expectedCash,
        closingCashBalance: shift.closingCash || 0,
        overShort: overShort
      },
      categoryBreakdown: categories
    };

    return NextResponse.json({
      success: true,
      report
    });
  } catch (error: any) {
    console.error('[Shift Closing Report Error]', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate shift closing report',
      details: error.message
    }, { status: 500 });
  }
}
