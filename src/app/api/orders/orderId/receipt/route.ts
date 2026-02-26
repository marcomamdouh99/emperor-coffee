import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/orders/[orderId]/receipt
 * Generate a printable receipt for an order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // In Next.js 16, params is a Promise and must be awaited
    const { orderId } = await params;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        branch: true,
        cashier: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Generate receipt HTML
    const receiptHtml = generateReceiptHTML(order);

    return NextResponse.json({
      success: true,
      order,
      receiptHtml,
    });

  } catch (error) {
    console.error('Error generating receipt:', error);
    return NextResponse.json(
      { error: 'Failed to generate receipt' },
      { status: 500 }
    );
  }
}

function generateReceiptHTML(order: any): string {
  const branch = order.branch;
  const cashier = order.cashier;
  const date = new Date(order.orderTimestamp);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt #${order.orderNumber}</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      max-width: 80mm;
      margin: 0 auto;
      padding: 5mm;
      font-size: 12px;
      line-height: 1.4;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
      border-bottom: 2px dashed #000;
      padding-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
    }
    .info {
      margin-bottom: 15px;
      font-size: 11px;
    }
    .info div {
      margin: 3px 0;
    }
    .items {
      margin-bottom: 15px;
    }
    .item {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .item-qty {
      flex: 0 0 30px;
    text-align: left;
    font-weight: bold;
    }
    .item-name {
      flex: 1;
      text-align: left;
    }
    .item-price {
      flex: 0 0 80px;
      text-align: right;
    }
    .totals {
      border-top: 2px dashed #000;
      padding-top: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .total-row.grand-total {
      font-weight: bold;
      font-size: 14px;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 2px dashed #000;
      font-size: 10px;
    }
    .refunded {
      color: #ff0000;
      font-weight: bold;
      text-align: center;
      padding: 10px;
      border: 2px solid #ff0000;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Emperor Coffee</h1>
    <div>${branch?.branchName || 'Coffee Shop'}</div>
    <div>Receipt #${order.orderNumber}</div>
  </div>

  ${order.isRefunded ? `
  <div class="refunded">
    *** REFUNDED ***
    ${order.refundReason ? `Reason: ${order.refundReason}` : ''}
  </div>
  ` : ''}

  <div class="info">
    <div>Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</div>
    <div>Cashier: ${cashier?.name || cashier?.username}</div>
  </div>

  <div class="items">
    ${order.items.map((item: any) => `
      <div class="item">
        <span class="item-qty">${item.quantity}x</span>
        <span class="item-name">${item.itemName}</span>
        <span class="item-price">${item.subtotal.toFixed(2)}</span>
      </div>
    `).join('')}
  </div>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>${order.subtotal.toFixed(2)}</span>
    </div>
    ${order.deliveryFee && order.deliveryFee > 0 ? `
    <div class="total-row">
      <span>Delivery Fee:</span>
      <span>${order.deliveryFee.toFixed(2)}</span>
    </div>
    ` : ''}
    ${order.loyaltyDiscount && order.loyaltyDiscount > 0 ? `
    <div class="total-row" style="color: #8b5cf6;">
      <span>Loyalty Discount (${order.loyaltyPointsRedeemed} pts):</span>
      <span>-${order.loyaltyDiscount.toFixed(2)}</span>
    </div>
    ` : ''}
    ${order.promoDiscount && order.promoDiscount > 0 ? `
    <div class="total-row" style="color: #f97316;">
      <span>Promo Code${order.promoCode ? ` (${order.promoCode})` : ''}:</span>
      <span>-${order.promoDiscount.toFixed(2)}</span>
    </div>
    ` : ''}
    <div class="total-row grand-total">
      <span>TOTAL:</span>
      <span>${order.totalAmount.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Payment:</span>
      <span>${order.paymentMethod === 'card' ? 'Card' : 'Cash'}</span>
    </div>
  </div>

  <div class="footer">
    <div>Thank you for your purchase!</div>
    <div>Emperor Coffee Franchise</div>
  </div>

  <script>
    // Auto-print when loaded
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `.trim();
}
