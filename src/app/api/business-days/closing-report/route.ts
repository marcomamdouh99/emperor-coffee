import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/business-days/closing-report?businessDayId=xxx
// Get detailed closing day report with category breakdown
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessDayId = searchParams.get('businessDayId');

    if (!businessDayId) {
      return NextResponse.json({
        success: false,
        error: 'Business Day ID is required'
      }, { status: 400 });
    }

    // Get business day with full details
    const businessDay = await db.businessDay.findUnique({
      where: { id: businessDayId },
      include: {
        openedByUser: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true
          }
        },
        closedByUser: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true
          }
        },
        shifts: {
          include: {
            cashier: {
              select: {
                id: true,
                name: true,
                username: true
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
          },
          orderBy: {
            startTime: 'asc'
          }
        }
      }
    });

    if (!businessDay) {
      return NextResponse.json({
        success: false,
        error: 'Business day not found'
      }, { status: 404 });
    }

    // Get branch information separately
    const branch = await db.branch.findUnique({
      where: { id: businessDay.branchId },
      select: {
        id: true,
        branchName: true
      }
    });

    // Get all orders for this business day
    const allOrders = await db.order.findMany({
      where: {
        shiftId: {
          in: businessDay.shifts.map(s => s.id)
        }
      },
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
      },
      orderBy: {
        orderTimestamp: 'asc'
      }
    });

    // Calculate payment breakdown (cash vs card)
    let cashTotal = 0;
    let cardTotal = 0;
    allOrders.forEach(order => {
      if (order.paymentMethod.toLowerCase() === 'cash') {
        cashTotal += order.totalAmount;
      } else if (order.paymentMethod.toLowerCase() === 'card' || order.paymentMethod.toLowerCase().includes('visa') || order.paymentMethod.toLowerCase().includes('credit')) {
        cardTotal += order.totalAmount;
      }
    });

    // Normalize category name (trim and use consistent format)
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

    // Group items by category using normalized names
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

    allOrders.forEach(order => {
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

        // Use display name that includes variant
        const itemName = getItemDisplayName(orderItem);
        // Create unique key combining menuItemId and variant
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

    // Convert Map to array and filter categories with zero sales
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

    // Get refunds
    const refunds = allOrders.filter(o => o.isRefunded);

    // Get daily expenses for all shifts in this business day
    const shiftIds = businessDay.shifts.map(s => s.id);
    const allDailyExpenses = await db.dailyExpense.findMany({
      where: {
        shiftId: {
          in: shiftIds
        }
      }
    });

    // Group expenses by shift
    const expensesByShift = new Map<string, number>();
    allDailyExpenses.forEach(expense => {
      const current = expensesByShift.get(expense.shiftId) || 0;
      expensesByShift.set(expense.shiftId, current + expense.amount);
    });

    // Calculate total daily expenses for the day
    const totalDailyExpensesDay = allDailyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate shift data for new DayClosingReceipt format
    const shiftsData = businessDay.shifts.map((shift, index) => {
      const shiftOrders = shift.orders.filter(o => !o.isRefunded);
      const shiftDailyExpenses = expensesByShift.get(shift.id) || 0;

      // Calculate order type breakdown for this shift
      const orderTypeBreakdown = {
        'take-away': { value: 0, discounts: 0, count: 0, total: 0 },
        'dine-in': { value: 0, discounts: 0, count: 0, total: 0 },
        'delivery': { value: 0, discounts: 0, count: 0, total: 0 }
      };

      let totalDiscounts = 0;
      let totalDeliveryFees = 0;
      let totalRefunds = 0;
      let totalSales = 0;
      let cashTotalShift = 0;
      let cardTotalShift = 0;

      shiftOrders.forEach(order => {
        const type = order.orderType || 'dine-in';
        if (orderTypeBreakdown[type]) {
          orderTypeBreakdown[type].value += order.subtotal;
          orderTypeBreakdown[type].count += 1;
          totalSales += order.subtotal;
        }

        const orderDiscount = (order.loyaltyDiscount || 0) + (order.promoDiscount || 0);
        if (orderTypeBreakdown[type]) {
          orderTypeBreakdown[type].discounts += orderDiscount;
        }
        totalDiscounts += orderDiscount;
        totalDeliveryFees += order.deliveryFee || 0;

        const method = order.paymentMethod.toLowerCase();
        if (method === 'cash') {
          cashTotalShift += order.totalAmount;
        } else if (method === 'card' || method.includes('visa') || method.includes('credit')) {
          cardTotalShift += order.totalAmount;
        }
      });

      // Calculate totals per order type
      Object.keys(orderTypeBreakdown).forEach(type => {
        orderTypeBreakdown[type].total = orderTypeBreakdown[type].value - orderTypeBreakdown[type].discounts;
      });

      // Calculate cash difference (subtract daily expenses)
      const closingRevenue = shift.closingRevenue || 0;
      const expectedCash = shift.openingCash + cashTotalShift - shiftDailyExpenses;
      const overShort = shift.closingCash ? shift.closingCash - expectedCash : null;

      return {
        shiftNumber: index + 1,
        startTime: shift.startTime,
        endTime: shift.endTime || new Date().toISOString(),
        orderTypeBreakdown,
        totals: {
          sales: totalSales,
          discounts: totalDiscounts,
          deliveryFees: totalDeliveryFees,
          refunds: totalRefunds,
          card: cardTotalShift,
          cash: cashTotalShift,
          dailyExpenses: shiftDailyExpenses,
          openingCashBalance: shift.openingCash,
          expectedCash,
          closingCashBalance: shift.closingCash || 0,
          overShort
        },
        cashier: {
          name: shift.cashier?.name || shift.cashier?.username || 'Unknown',
          username: shift.cashier?.username || 'unknown'
        }
      };
    });

    // Prepare report data in DayClosingReceipt format
    const reportData = {
      storeName: 'Emperor Coffee',
      branchName: branch?.branchName || 'Unknown Branch',
      date: businessDay.openedAt,
      shifts: shiftsData,
      categoryBreakdown: categories,
      notes: businessDay.notes,
      fontSize: 'medium' as const,
      dailyExpenses: {
        total: totalDailyExpensesDay,
        breakdown: allDailyExpenses.map(exp => ({
          amount: exp.amount,
          reason: exp.reason,
          shiftId: exp.shiftId
        }))
      }
    };

    // Legacy report data for backward compatibility
    const legacyReport = {
      businessDay: {
        id: businessDay.id,
        openedAt: businessDay.openedAt,
        closedAt: businessDay.closedAt,
        isOpen: businessDay.isOpen,
        openingCash: businessDay.openingCash,
        closingCash: businessDay.closingCash,
        expectedCash: businessDay.expectedCash,
        cashDifference: businessDay.cashDifference,
        notes: businessDay.notes,
        branch: branch,
        openedBy: businessDay.openedByUser,
        closedBy: businessDay.closedByUser
      },
      summary: {
        totalOrders: businessDay.totalOrders,
        totalSales: businessDay.totalSales,
        subtotal: businessDay.subtotal,
        taxAmount: businessDay.taxAmount,
        deliveryFees: businessDay.deliveryFees,
        loyaltyDiscounts: businessDay.loyaltyDiscounts,
        cashSales: cashTotal,
        cardSales: cardTotal,
        totalShifts: businessDay.shifts.length,
        dailyExpenses: totalDailyExpensesDay
      },
      categoryBreakdown: categories,
      shifts: businessDay.shifts.map(shift => ({
        id: shift.id,
        cashier: shift.cashier,
        startTime: shift.startTime,
        endTime: shift.endTime,
        isClosed: shift.isClosed,
        openingCash: shift.openingCash,
        closingCash: shift.closingCash,
        openingOrders: shift.openingOrders,
        closingOrders: shift.closingOrders || 0,
        openingRevenue: shift.openingRevenue,
        closingRevenue: shift.closingRevenue || 0,
        ordersCount: shift.orders.length,
        cashDifference: shift.closingCash
          ? shift.closingCash - shift.openingCash - (shift.closingRevenue || 0)
          : null
      })),
      refunds
    };

    return NextResponse.json({
      success: true,
      report: reportData,
      legacyReport
    });
  } catch (error: any) {
    console.error('[Closing Day Report Error]', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate closing day report',
      details: error.message
    }, { status: 500 });
  }
}
