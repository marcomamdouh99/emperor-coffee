import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'excel';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchId = searchParams.get('branchId');

    // Build where clause using orderTimestamp (not createdAt)
    const whereClause: any = {};

    if (startDate || endDate) {
      whereClause.orderTimestamp = {};
      if (startDate) {
        whereClause.orderTimestamp.gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of the day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.orderTimestamp.lte = endDateTime;
      }
    }

    if (branchId && branchId !== 'all') {
      whereClause.branchId = branchId;
    }

    // Fetch orders with relations
    const orders = await db.order.findMany({
      where: whereClause,
      include: {
        items: true,
        branch: {
          select: {
            branchName: true,
          },
        },
        cashier: {
          select: {
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        orderTimestamp: 'desc',
      },
    });

    if (format === 'csv' || format === 'excel') {
      return generateCSV(orders);
    } else if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: orders.map(order => ({
          ...order,
          deliveryFee: order.deliveryFee || 0,
          subtotal: order.subtotal,
        })),
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Use "csv", "excel", or "json"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data', details: error.message },
      { status: 500 }
    );
  }
}

function generateCSV(orders: any[]) {
  // Create CSV header with proper column order
  const headers = [
    'Order #',
    'Date',
    'Time',
    'Cashier',
    'Branch',
    'Type',
    'Payment',
    'Subtotal',
    'Delivery Fee',
    'Total',
    'Status',
    'Items',
  ];

  // Create CSV rows
  const rows = orders.map((order) => {
    const orderDate = new Date(order.orderTimestamp);
    const dateStr = orderDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeStr = orderDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Format items as a string
    const itemsStr = order.items
      .map((item: any) => `${item.itemName} x${item.quantity}`)
      .join('; ');

    return [
      order.orderNumber,
      dateStr,
      timeStr,
      order.cashier?.name || 'N/A',
      order.branch?.branchName || 'N/A',
      order.orderType,
      order.paymentMethod,
      (order.subtotal || 0).toFixed(2),
      (order.deliveryFee || 0).toFixed(2),
      (order.totalAmount || 0).toFixed(2),
      order.isRefunded ? 'Refunded' : 'Completed',
      `"${itemsStr}"`, // Quote the items to handle commas
    ];
  });

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');

  // Add BOM for UTF-8 encoding (required for Excel to properly display Arabic)
  const BOM = '\uFEFF';

  // Return as CSV text with UTF-8 BOM
  return new NextResponse(BOM + csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-export-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}