import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ESCPOSEncoder } from '@/lib/escpos-encoder';

// GET /api/business-days/closing-report-escpos?businessDayId=xxx
// Generate ESC/POS data for closing day report for thermal printer
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
          },
        },
        closedByUser: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        shifts: {
          include: {
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
            startTime: 'asc',
          },
        },
      },
    });

    if (!businessDay) {
      return NextResponse.json({
        success: false,
        error: 'Business day not found',
      }, { status: 404 });
    }

    // Get branch information
    const branch = await db.branch.findUnique({
      where: { id: businessDay.branchId },
      select: { id: true, branchName: true }
    });

    // Get all orders for this business day
    const allOrders = await db.order.findMany({
      where: {
        shiftId: {
          in: businessDay.shifts.map((s) => s.id),
        },
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
        orderTimestamp: 'asc',
      },
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
      }));

    // Generate ESC/POS data - Simple receipt format
    const encoder = new ESCPOSEncoder();
    encoder.reset();

    // Store Name (centered, no bold)
    encoder.align('center').text(branch?.branchName || 'Emperor Coffee').newLines(2);

    // Date & Time Header
    encoder.text('Date & Time').newLine();
    encoder.text(`Date ${new Date(businessDay.openedAt).toLocaleDateString()}`).newLine();
    encoder.text(`From ${new Date(businessDay.openedAt).toLocaleTimeString()}`).newLine();
    if (businessDay.closedAt) {
      encoder.text(`To ${new Date(businessDay.closedAt).toLocaleTimeString()}`).newLine();
    }
    encoder.newLine();

    // Total Sales (simple format)
    encoder.text('Total Sales').newLine();
    encoder.text(`${formatMoney(businessDay.totalSales)}`).newLine();
    encoder.text(`${businessDay.totalOrders} orders`).newLine();
    encoder.newLine();

    // Payment Breakdown (simple format)
    encoder.text('Payment Breakdown').newLine();
    encoder.text(`Cash                ${formatMoney(cashTotal)}`).newLine();
    encoder.text(`Card / Visa         ${formatMoney(cardTotal)}`).newLine();
    encoder.newLine();

    // Categories with Items (simple format, grouped properly)
    categories.forEach((category) => {
      // Category header with total
      encoder.text(`${formatMoney(category.totalSales)} EGP ${category.categoryName}`).newLine();
      
      // Column headers
      encoder.text('Item Name Qty Total Price').newLine();
      
      // Items under this category
      category.items.forEach((item) => {
        const itemName = item.itemName;
        const qty = item.quantity.toString();
        const price = formatMoney(item.totalPrice);
        encoder.text(`${price} EGP ${qty} ${itemName}`).newLine();
      });
      
      encoder.newLine();
    });

    // Footer
    encoder.text('Emperor Coffee POS System').newLine();
    encoder.text(`Generated: ${new Date().toLocaleString()}`).newLines(2);

    // Cut ONLY at the very end
    encoder.cut('full');

    // Convert to base64
    const uint8Array = encoder.encode();
    const binaryString = uint8Array.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
    const base64Data = btoa(binaryString);

    return NextResponse.json({
      success: true,
      escposData: base64Data,
    });
  } catch (error: any) {
    console.error('[Closing Report ESC/POS Error]', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate closing report ESC/POS data',
      details: error.message,
    }, { status: 500 });
  }
}

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}
