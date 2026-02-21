import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/purchase-orders/export - Export POs as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period'); // 7, 30, 90, all

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (supplierId) {
      where.supplierId = supplierId;
    }
    if (branchId) {
      where.branchId = branchId;
    }

    // Handle date filtering
    if (period && period !== 'all') {
      const days = parseInt(period);
      const now = new Date();
      const start = new Date();
      start.setDate(now.getDate() - days);
      start.setHours(0, 0, 0, 0);
      where.orderedAt = { gte: start };
    } else if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.orderedAt = dateFilter;
    }

    // Fetch purchase orders
    const purchaseOrders = await db.purchaseOrder.findMany({
      where,
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
      orderBy: { orderedAt: 'desc' },
    });

    // Generate CSV content
    const headers = [
      'Order Number',
      'Supplier',
      'Branch',
      'Status',
      'Total Amount',
      'Ordered Date',
      'Expected Date',
      'Received Date',
      'Created By',
      'Approved By',
      'Notes',
      'Items',
    ];

    const rows = purchaseOrders.map((po) => {
      const itemsText = po.items
        .map(
          (item) =>
            `${item.ingredient.name} (${item.quantity} ${item.unit} x $${item.unitPrice.toFixed(2)})`
        )
        .join('; ');

      return [
        po.orderNumber,
        po.supplier.name,
        po.branch.branchName,
        po.status,
        po.totalAmount.toFixed(2),
        new Date(po.orderedAt).toLocaleDateString(),
        po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : '',
        po.receivedAt ? new Date(po.receivedAt).toLocaleDateString() : '',
        po.creator.name || po.creator.username,
        po.approver?.name || po.approver?.username || '',
        po.notes || '',
        `"${itemsText.replace(/"/g, '""')}"`, // Escape quotes
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Set headers for CSV download
    const headersObj = new Headers();
    headersObj.set('Content-Type', 'text/csv');
    headersObj.set(
      'Content-Disposition',
      `attachment; filename="purchase-orders-${new Date().toISOString().split('T')[0]}.csv"`
    );

    return new NextResponse(csvContent, { headers: headersObj });
  } catch (error) {
    console.error('Error exporting purchase orders:', error);
    return NextResponse.json(
      { error: 'Failed to export purchase orders' },
      { status: 500 }
    );
  }
}
