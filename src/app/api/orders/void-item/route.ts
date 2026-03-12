import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logItemVoided } from '@/lib/audit-logger';

/**
 * Void a specific order item (not the entire order)
 * This allows voiding part of an order, e.g., void 1 of 2 coffees
 * Can only be done during an active shift
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

    // Get the order item with order and user info
    const orderItem = await db.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          include: {
            cashier: true,
            branch: true,
            shift: true,
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

    // Validate user credentials
    const user = await db.user.findFirst({
      where: {
        username,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const isValidPassword = await import('bcryptjs').then(bcrypt => bcrypt.compare(password, user.passwordHash));
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Role-based authorization: Only ADMIN and BRANCH_MANAGER can void items
    if (user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER') {
      return NextResponse.json(
        { error: 'Only Administrators and Branch Managers can void items' },
        { status: 403 }
      );
    }

    // Branch access control: ADMIN can void any branch, BRANCH_MANAGER only their own
    if (user.role === 'BRANCH_MANAGER' && orderItem.order.branchId !== user.branchId) {
      return NextResponse.json(
        { error: 'You can only void items from your own branch' },
        { status: 403 }
      );
    }

    // Validate that there's an active shift for this branch
    const shift = await db.shift.findFirst({
      where: {
        branchId: orderItem.order.branchId,
        isClosed: false,
      },
      orderBy: { startTime: 'desc' },
    });

    if (!shift) {
      return NextResponse.json(
        { error: 'Cannot void item: No active shift found for this branch' },
        { status: 400 }
      );
    }

    // Process void in transaction
    // Calculate values before transaction for return statement
    const remainingQuantity = orderItem.quantity - quantity;

    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderItem.orderId },
        include: {
          items: true,
          branch: true,
          shift: true,
        },
      });

      // Calculate voided amount
      const voidedSubtotal = orderItem.unitPrice * quantity;

      if (remainingQuantity === 0) {
        // Full void - mark item as voided
        await tx.orderItem.update({
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
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: orderItem.orderId },
        });

        const newSubtotal = orderItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        const newTotalAmount = newSubtotal + (orderItem.order.deliveryFee || 0);

        await tx.order.update({
          where: { id: orderItem.orderId },
          data: {
            subtotal: newSubtotal,
            totalAmount: newTotalAmount,
          },
        });

        // Update shift to track voided items for closing report
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            closingVoidedItems: {
              increment: 1,
            },
          },
        });

        // Log audit log for voided item
        await tx.auditLog.create({
          data: {
            userId: user.id,
            actionType: 'item_voided',
            entityType: 'OrderItem',
            entityId: orderItemId,
            oldValue: `${orderItem.quantity}x ${orderItem.menuItem?.name || orderItem.itemName}`,
            newValue: `Voided ${quantity}x - ${reason}`,
            branchId: orderItem.order.branchId,
            ipAddress: null,
            previousHash: null,
            currentHash: `void-${orderItemId}-${Date.now()}`,
          },
        });
      } else {
        // Partial void - reduce quantity and subtotal
        const newSubtotal = orderItem.unitPrice * remainingQuantity;
        const unitPrice = orderItem.unitPrice;

        // Update the order item
        await tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            quantity: remainingQuantity,
            subtotal: newSubtotal,
          },
        });

        // Create a voided item record for tracking
        await tx.voidedItem.create({
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
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: orderItem.orderId },
        });

        const newOrderSubtotal = orderItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        const newTotalAmount = newOrderSubtotal + (orderItem.order.deliveryFee || 0);

        await tx.order.update({
          where: { id: orderItem.orderId },
          data: {
            subtotal: newOrderSubtotal,
            totalAmount: newTotalAmount,
          },
        });

        // Update shift to track voided items for closing report
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            closingVoidedItems: {
              increment: 1,
            },
          },
        });

        // Log audit log for partial void
        await tx.auditLog.create({
          data: {
            userId: user.id,
            actionType: 'item_voided',
            entityType: 'OrderItem',
            entityId: orderItemId,
            oldValue: `${orderItem.quantity}x ${orderItem.menuItem?.name || orderItem.itemName}`,
            newValue: `Voided ${quantity}x - ${reason}`,
            branchId: orderItem.order.branchId,
            ipAddress: null,
            previousHash: null,
            currentHash: `void-${orderItemId}-${Date.now()}`,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `${quantity} item(s) voided successfully`,
      remainingQuantity: remainingQuantity,
      updatedSubtotal: orderItem.unitPrice * remainingQuantity,
      updatedTotalAmount: (orderItem.unitPrice * remainingQuantity) + (orderItem.order.deliveryFee || 0),
    });
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
