import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for transfer request
const transferItemsSchema = z.object({
  toOrderId: z.string().min(1, 'Target order ID is required'),
  itemIds: z.array(z.string()).min(1, 'At least one item must be selected'),
  quantities: z.array(z.number()).min(1, 'Quantities must be provided'),
  transferredBy: z.string().min(1, 'Transferer user ID is required'),
});

// POST /api/orders/[id]/transfer-items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fromOrderId } = await params;
    const body = await request.json();

    // Validate request body
    const validationResult = transferItemsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { toOrderId, itemIds, quantities, transferredBy } = validationResult.data;

    if (itemIds.length !== quantities.length) {
      return NextResponse.json(
        { error: 'Item IDs and quantities arrays must have the same length' },
        { status: 400 }
      );
    }

    // Fetch source and target orders
    const [fromOrder, toOrder] = await Promise.all([
      db.order.findUnique({
        where: { id: fromOrderId },
        include: { items: true, table: true },
      }),
      db.order.findUnique({
        where: { id: toOrderId },
        include: { items: true, table: true },
      }),
    ]);

    if (!fromOrder) {
      return NextResponse.json(
        { error: 'Source order not found' },
        { status: 404 }
      );
    }

    if (!toOrder) {
      return NextResponse.json(
        { error: 'Target order not found' },
        { status: 404 }
      );
    }

    // Validate both orders are Dine In
    if (fromOrder.orderType !== 'dine-in' || toOrder.orderType !== 'dine-in') {
      return NextResponse.json(
        { error: 'Both orders must be Dine In type for item transfer' },
        { status: 400 }
      );
    }

    // Validate both orders belong to the same branch
    if (fromOrder.branchId !== toOrder.branchId) {
      return NextResponse.json(
        { error: 'Orders must belong to the same branch' },
        { status: 400 }
      );
    }

    // Validate items exist in source order
    const validItems = [];
    for (let i = 0; i < itemIds.length; i++) {
      const itemId = itemIds[i];
      const quantity = quantities[i];

      if (quantity <= 0) {
        return NextResponse.json(
          { error: 'Quantities must be greater than 0' },
          { status: 400 }
        );
      }

      const sourceItem = fromOrder.items.find((item: any) => item.id === itemId);
      if (!sourceItem) {
        return NextResponse.json(
          { error: `Item ${itemId} not found in source order` },
          { status: 404 }
        );
      }

      if (sourceItem.quantity < quantity) {
        return NextResponse.json(
          { error: `Insufficient quantity for item: ${sourceItem.itemName}. Available: ${sourceItem.quantity}, Requested: ${quantity}` },
          { status: 400 }
        );
      }

      validItems.push({
        itemId,
        itemName: sourceItem.itemName,
        quantity,
        sourceItem,
      });
    }

    // Perform transfer in a transaction
    const result = await db.$transaction(async (tx) => {
      // Update or create items in target order
      for (const validItem of validItems) {
        const { itemId, itemName, quantity, sourceItem } = validItem;

        // Check if item already exists in target order
        const targetItem = toOrder.items.find(
          (item: any) =>
            item.menuItemId === sourceItem.menuItemId &&
            item.menuItemVariantId === sourceItem.menuItemVariantId &&
            item.customVariantValue === sourceItem.customVariantValue &&
            !item.isVoided
        );

        if (targetItem) {
          // Update existing item quantity
          const newQuantity = targetItem.quantity + quantity;
          const newSubtotal = newQuantity * targetItem.unitPrice;

          await tx.orderItem.update({
            where: { id: targetItem.id },
            data: {
              quantity: newQuantity,
              subtotal: newSubtotal,
            },
          });
        } else {
          // Create new item in target order
          const newSubtotal = quantity * sourceItem.unitPrice;

          await tx.orderItem.create({
            data: {
              orderId: toOrderId,
              menuItemId: sourceItem.menuItemId,
              itemName: sourceItem.itemName,
              quantity,
              unitPrice: sourceItem.unitPrice,
              subtotal: newSubtotal,
              recipeVersion: sourceItem.recipeVersion,
              menuItemVariantId: sourceItem.menuItemVariantId,
              variantName: sourceItem.variantName,
              customVariantValue: sourceItem.customVariantValue,
              specialInstructions: sourceItem.specialInstructions,
            },
          });
        }

        // Update or remove item from source order
        if (sourceItem.quantity === quantity) {
          // Remove item completely
          await tx.orderItem.delete({
            where: { id: itemId },
          });
        } else {
          // Update quantity
          const newQuantity = sourceItem.quantity - quantity;
          const newSubtotal = newQuantity * sourceItem.unitPrice;

          await tx.orderItem.update({
            where: { id: itemId },
            data: {
              quantity: newQuantity,
              subtotal: newSubtotal,
            },
          });
        }

        // Create transfer record
        await tx.orderItemTransfer.create({
          data: {
            fromOrderId,
            toOrderId,
            itemId,
            itemName,
            quantity,
            transferredBy,
          },
        });
      }

      // Recalculate and update source order totals
      const updatedFromOrderItems = await tx.orderItem.findMany({
        where: { orderId: fromOrderId, isVoided: false },
      });

      const fromSubtotal = updatedFromOrderItems.reduce((sum, item) => sum + item.subtotal, 0);
      const fromTotal = fromSubtotal; // No delivery fee for dine-in

      await tx.order.update({
        where: { id: fromOrderId },
        data: {
          subtotal: fromSubtotal,
          totalAmount: fromTotal,
        },
      });

      // Recalculate and update target order totals
      const updatedToOrderItems = await tx.orderItem.findMany({
        where: { orderId: toOrderId, isVoided: false },
      });

      const toSubtotal = updatedToOrderItems.reduce((sum, item) => sum + item.subtotal, 0);
      const toTotal = toSubtotal;

      await tx.order.update({
        where: { id: toOrderId },
        data: {
          subtotal: toSubtotal,
          totalAmount: toTotal,
        },
      });

      // Fetch updated orders with all relations
      const [finalFromOrder, finalToOrder] = await Promise.all([
        tx.order.findUnique({
          where: { id: fromOrderId },
          include: {
            items: {
              where: { isVoided: false },
            },
            table: true,
            cashier: true,
          },
        }),
        tx.order.findUnique({
          where: { id: toOrderId },
          include: {
            items: {
              where: { isVoided: false },
            },
            table: true,
            cashier: true,
          },
        }),
      ]);

      return { fromOrder: finalFromOrder, toOrder: finalToOrder };
    });

    return NextResponse.json({
      success: true,
      message: 'Items transferred successfully',
      fromOrder: result.fromOrder,
      toOrder: result.toOrder,
    });
  } catch (error) {
    console.error('Error transferring items:', error);
    return NextResponse.json(
      {
        error: 'Failed to transfer items',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
