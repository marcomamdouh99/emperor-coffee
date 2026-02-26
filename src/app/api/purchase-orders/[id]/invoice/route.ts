import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';
const FF = '\x0C';

// Helper function to center text
const centerText = (text: string, width: number = 32): string => {
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, padding)) + text;
};

// Helper function to right align text
const rightAlignText = (text: string, width: number = 32): string => {
  return ' '.repeat(Math.max(0, width - text.length)) + text;
};

// Helper function to create a divider line
const dividerLine = (char: string = '-', width: number = 32): string => {
  return char.repeat(width);
};

// GET /api/purchase-orders/[id]/invoice - Generate ESC/POS invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Fetch purchase order with all related data
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        branch: true,
        items: {
          include: {
            ingredient: true,
          },
        },
        creator: {
          select: { name: true, username: true },
        },
        approver: {
          select: { name: true, username: true },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Build ESC/POS content
    let content = '';

    // Initialize printer
    content += ESC + '@'; // Initialize

    // Set text alignment to center
    content += ESC + 'a' + '\x01';

    // Header - Company/Branch Name
    content += purchaseOrder.branch.branchName + LF;
    content += LF;

    // Invoice Title
    content += centerText('PURCHASE ORDER', 32) + LF;
    content += centerText('='.repeat(16), 32) + LF;
    content += LF;

    // Set text alignment to left
    content += ESC + 'a' + '\x00';

    // Order Information
    content += 'PO Number: ' + purchaseOrder.orderNumber + LF;
    content += 'Date: ' + new Date(purchaseOrder.orderedAt).toLocaleDateString() + LF;
    content += 'Status: ' + purchaseOrder.status + LF;
    content += LF;

    // Supplier Information
    content += 'SUPPLIER:' + LF;
    content += purchaseOrder.supplier.name + LF;
    if (purchaseOrder.supplier.contactPerson) {
      content += 'Contact: ' + purchaseOrder.supplier.contactPerson + LF;
    }
    if (purchaseOrder.supplier.phone) {
      content += 'Phone: ' + purchaseOrder.supplier.phone + LF;
    }
    if (purchaseOrder.supplier.email) {
      content += 'Email: ' + purchaseOrder.supplier.email + LF;
    }
    content += LF;

    // Branch Information
    content += 'DELIVER TO:' + LF;
    content += purchaseOrder.branch.branchName + LF;
    if (purchaseOrder.branchId) {
      content += 'Branch ID: ' + purchaseOrder.branchId + LF;
    }
    content += LF;

    // Expected Delivery Date
    if (purchaseOrder.expectedAt) {
      content += 'Expected: ' + new Date(purchaseOrder.expectedAt).toLocaleDateString() + LF;
    }
    if (purchaseOrder.receivedAt) {
      content += 'Received: ' + new Date(purchaseOrder.receivedAt).toLocaleDateString() + LF;
    }
    content += LF;

    // Items Header
    content += dividerLine('-', 32) + LF;
    content += 'Item                Qty  Unit   Price' + LF;
    content += dividerLine('-', 32) + LF;

    // Items
    purchaseOrder.items.forEach((item) => {
      const itemName = item.ingredient.name.substring(0, 18).padEnd(18);
      const qty = item.quantity.toString().padStart(6);
      const unit = item.unit.padStart(5);
      const price = '$' + (item.quantity * item.unitPrice).toFixed(2).padStart(8);

      content += itemName + qty + unit + price + LF;
    });

    content += dividerLine('-', 32) + LF;
    content += LF;

    // Set text alignment to right
    content += ESC + 'a' + '\x02';

    // Totals
    content += rightAlignText('TOTAL: $' + purchaseOrder.totalAmount.toFixed(2), 32) + LF;

    // Set text alignment to left
    content += ESC + 'a' + '\x00';

    content += LF;

    // Notes
    if (purchaseOrder.notes) {
      content += 'NOTES:' + LF;
      content += purchaseOrder.notes + LF;
      content += LF;
    }

    // Approval/Creation Info
    content += 'Created by: ' + (purchaseOrder.creator.name || purchaseOrder.creator.username) + LF;
    if (purchaseOrder.approver) {
      content += 'Approved by: ' + (purchaseOrder.approver.name || purchaseOrder.approver.username) + LF;
      if (purchaseOrder.approvedAt) {
        content += 'Approved: ' + new Date(purchaseOrder.approvedAt).toLocaleDateString() + LF;
      }
    }
    content += LF;

    // Footer
    content += dividerLine('=', 32) + LF;
    content += centerText('Thank you for your business!', 32) + LF;
    content += LF;
    content += LF;
    content += LF;

    // Cut paper (partial cut)
    content += GS + 'V' + '\x01';

    // Return as text/plain with proper headers
    const headers = new Headers();
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename="PO-${purchaseOrder.orderNumber}.txt"`);

    return new NextResponse(content, { headers });
  } catch (error) {
    console.error('Error generating purchase order invoice:', error);
    return NextResponse.json(
      { error: 'Failed to generate purchase order invoice' },
      { status: 500 }
    );
  }
}
