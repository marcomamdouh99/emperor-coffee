import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { getSession } from '@/lib/session-manager';

// Schema for updating a purchase order
const updatePurchaseOrderSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'RECEIVED', 'PARTIAL', 'CANCELLED']).optional(),
  expectedAt: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  notes: z.string().optional(),
});

// Schema for receiving items
const receiveItemsSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      receivedQty: z.number().min(0),
    })
  ),
});

// GET /api/purchase-orders/[id] - Get a single purchase order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
        approver: {
          select: { id: true, name: true, username: true },
        },
        creator: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    );
  }
}

// PATCH /api/purchase-orders/[id] - Partially update a purchase order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updatePurchaseOrderSchema.parse(body);

    // Check if purchase order exists
    const existingOrder = await db.purchaseOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // If approving, set approvedBy and approvedAt
    const session = await getSession();
    let updateData: any = { ...validatedData };
    if (validatedData.status === 'APPROVED' && !existingOrder.approvedBy) {
      updateData.approvedBy = session?.userId;
      updateData.approvedAt = new Date();
    }

    const purchaseOrder = await db.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        branch: true,
        items: {
          include: {
            ingredient: true,
          },
        },
        approver: {
          select: { id: true, name: true, username: true },
        },
        creator: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}

// PUT /api/purchase-orders/[id] - Update a purchase order (deprecated, use PATCH)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(request, { params });
}

// POST /api/purchase-orders/[id]/receive - Receive items from purchase order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action;

    if (action === 'receive') {
      const validatedData = receiveItemsSchema.parse(body);

      // Check if purchase order exists
      const purchaseOrder = await db.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!purchaseOrder) {
        return NextResponse.json(
          { error: 'Purchase order not found' },
          { status: 404 }
        );
      }

      if (purchaseOrder.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'Cannot receive items from cancelled purchase order' },
          { status: 400 }
        );
      }

      let allReceived = true;
      let someReceived = false;

      // Update each item with received quantity
      for (const receivedItem of validatedData.items) {
        const item = purchaseOrder.items.find((i) => i.id === receivedItem.itemId);
        if (!item) continue;

        // Find or create branch inventory
        let inventory = await db.branchInventory.findUnique({
          where: {
            branchId_ingredientId: {
              branchId: purchaseOrder.branchId,
              ingredientId: item.ingredientId,
            },
          },
        });

        if (!inventory) {
          inventory = await db.branchInventory.create({
            data: {
              branchId: purchaseOrder.branchId,
              ingredientId: item.ingredientId,
              currentStock: receivedItem.receivedQty,
              lastRestockAt: new Date(),
            },
          });
        } else {
          inventory = await db.branchInventory.update({
            where: { id: inventory.id },
            data: {
              currentStock: {
                increment: receivedItem.receivedQty,
              },
              lastRestockAt: new Date(),
            },
          });
        }

        // Create inventory transaction for restock
        const session = await getSession();
        await db.inventoryTransaction.create({
          data: {
            branchId: purchaseOrder.branchId,
            ingredientId: item.ingredientId,
            transactionType: 'RESTOCK',
            quantityChange: receivedItem.receivedQty,
            stockBefore: inventory.currentStock - receivedItem.receivedQty,
            stockAfter: inventory.currentStock,
            reason: `Purchase order ${purchaseOrder.orderNumber}`,
            createdBy: session?.userId,
          },
        });

        // Update purchase order item
        await db.purchaseOrderItem.update({
          where: { id: receivedItem.itemId },
          data: { receivedQty: receivedItem.receivedQty + item.receivedQty },
        });

        if (receivedItem.receivedQty > 0) {
          someReceived = true;
        }

        if (item.receivedQty + receivedItem.receivedQty < item.quantity) {
          allReceived = false;
        }
      }

      // Update purchase order status
      let status = purchaseOrder.status;
      if (allReceived && purchaseOrder.status !== 'RECEIVED') {
        status = 'RECEIVED';
      } else if (someReceived && purchaseOrder.status === 'PENDING') {
        status = 'PARTIAL';
      }

      if (status !== purchaseOrder.status) {
        await db.purchaseOrder.update({
          where: { id },
          data: {
            status,
            receivedAt: status === 'RECEIVED' ? new Date() : undefined,
          },
        });
      }

      const updatedOrder = await db.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          branch: true,
          items: {
            include: {
              ingredient: true,
            },
          },
        },
      });

      return NextResponse.json({ purchaseOrder: updatedOrder });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error receiving purchase order items:', error);
    return NextResponse.json(
      { error: 'Failed to receive purchase order items' },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase-orders/[id] - Delete a purchase order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    if (purchaseOrder.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only delete pending purchase orders' },
        { status: 400 }
      );
    }

    await db.purchaseOrder.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Purchase order deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    );
  }
}
