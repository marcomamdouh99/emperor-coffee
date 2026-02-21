import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Void a specific order item (not the entire order)
 * This allows voiding part of an order, e.g., void 1 of 2 coffees
 */
export async function POST(request: NextRequest) {
  try {
    const { orderItemId, username, password, reason, quantity } = await request.json();

    // Validate required fields
    if (!orderItemId || !username || !password || !reason || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: orderItemId, username, password, reason, quantity' },
        { status: 400 }
      );
    }

    // Validate quantity is positive
    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity to void must be greater than 0' },
        { status: 400 }
      );
    }

    // Get the order item
    const orderItem = await db.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          include: {
            cashier: true,
          },
        },
      },
    });

    if (!orderItem) {
      return NextResponse.json(
        { error: 'Order item not found' },
        { status: 404 }
      );
    }

    // Check if order is already refunded
    if (orderItem.order.isRefunded) {
      return NextResponse.json(
        { error: 'Cannot void items from a refunded order' },
        { status: 400 }
      );
    }

    // Check if quantity to void exceeds original quantity
    if (quantity > orderItem.quantity) {
      return NextResponse.json(
        { error: `Cannot void more than ${orderItem.quantity} items` },
        { status: 400 }
      );
    }

    // Calculate remaining quantity
    const remainingQuantity = orderItem.quantity - quantity;

    // If voiding the entire quantity, mark the item as fully voided
    if (remainingQuantity === 0) {
      // Mark order item as voided
      await db.orderItem.update({
        where: { id: orderItemId },
        data: {
          quantity: 0,
          subtotal: 0,
          isVoided: true,
          voidedAt: new Date(),
          voidReason: reason,
          voidedBy: username,
        },
      });

      // Update order totals
      const orderItems = await db.orderItem.findMany({
        where: { orderId: orderItem.orderId },
      });

      const newSubtotal = orderItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const newTotalAmount = newSubtotal + (orderItem.order.deliveryFee || 0);

      await db.order.update({
        where: { id: orderItem.orderId },
        data: {
          subtotal: newSubtotal,
          totalAmount: newTotalAmount,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Item voided successfully',
        updatedSubtotal: newSubtotal,
        updatedTotalAmount: newTotalAmount,
      });
    } else {
      // Partial void - reduce quantity and subtotal
      const unitPrice = orderItem.unitPrice;
      const voidedSubtotal = unitPrice * quantity;
      const newSubtotal = unitPrice * remainingQuantity;

      // Update the order item
      await db.orderItem.update({
        where: { id: orderItemId },
        data: {
          quantity: remainingQuantity,
          subtotal: newSubtotal,
        },
      });

      // Create a voided item record for tracking
      await db.voidedItem.create({
        data: {
          orderItemId,
          orderQuantity: orderItem.quantity,
          voidedQuantity: quantity,
          remainingQuantity,
          unitPrice,
          voidedSubtotal,
          reason,
          voidedBy: username,
          voidedAt: new Date(),
        },
      });

      // Update order totals
      const orderItems = await db.orderItem.findMany({
        where: { orderId: orderItem.orderId },
      });

      const newOrderSubtotal = orderItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const newTotalAmount = newOrderSubtotal + (orderItem.order.deliveryFee || 0);

      await db.order.update({
        where: { id: orderItem.orderId },
        data: {
          subtotal: newOrderSubtotal,
          totalAmount: newTotalAmount,
        },
      });

      return NextResponse.json({
        success: true,
        message: `${quantity} item(s) voided successfully`,
        remainingQuantity,
        updatedSubtotal: newOrderSubtotal,
        updatedTotalAmount: newTotalAmount,
      });
    }
  } catch (error: any) {
    console.error('Void item error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to void item',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
