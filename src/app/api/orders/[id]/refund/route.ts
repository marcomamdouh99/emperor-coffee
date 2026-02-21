import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Handle params as Promise for Next.js 15
    const orderId = params?.id || request.url.split('/').filter(Boolean).slice(-2)[0];

    const body = await request.json();
    const { username, password, reason } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Fetch the order
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        branch: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.isRefunded) {
      return NextResponse.json(
        { success: false, error: 'Order has already been refunded' },
        { status: 400 }
      );
    }

    // Find user by username first
    const user = await db.user.findFirst({
      where: {
        username: username,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Role-based authorization: Only ADMIN and BRANCH_MANAGER can process refunds
    if (user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Only Administrators and Branch Managers can process refunds' },
        { status: 403 }
      );
    }

    // Branch access control: ADMIN can refund any branch, BRANCH_MANAGER only their own
    if (user.role === 'BRANCH_MANAGER' && order.branchId !== user.branchId) {
      return NextResponse.json(
        { success: false, error: 'You can only refund orders from your own branch' },
        { status: 403 }
      );
    }

    // Process refund with inventory restoration
    const refundedOrder = await db.$transaction(async (tx) => {
      // Update order as refunded
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          isRefunded: true,
          refundReason: reason || 'No reason provided',
        },
      });

      // Restore inventory for each item
      for (const orderItem of order.items) {
        // Get recipe for the menu item, filtered by variant if present
        const recipes = await tx.recipe.findMany({
          where: {
            menuItemId: orderItem.menuItemId,
            menuItemVariantId: orderItem.menuItemVariantId || null,
          },
        });

        // Restore ingredients
        for (const recipe of recipes) {
          const quantityToRestore = recipe.quantityRequired * orderItem.quantity;

          // Get current inventory
          const inventory = await tx.branchInventory.findUnique({
            where: {
              branchId_ingredientId: {
                branchId: order.branchId,
                ingredientId: recipe.ingredientId,
              },
            },
          });

          if (inventory) {
            const stockBefore = inventory.currentStock;
            const stockAfter = stockBefore + quantityToRestore;

            await tx.branchInventory.update({
              where: { id: inventory.id },
              data: {
                currentStock: stockAfter,
                lastModifiedAt: new Date(),
                lastModifiedBy: user.id,
              },
            });

            // Create inventory transaction record
            await tx.inventoryTransaction.create({
              data: {
                branchId: order.branchId,
                ingredientId: recipe.ingredientId,
                transactionType: 'REFUND',
                quantityChange: quantityToRestore,
                stockBefore,
                stockAfter,
                orderId: orderId,
                reason: `Refund for order #${order.orderNumber}`,
                createdBy: user.id,
              },
            });
          }
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          actionType: 'ORDER_REFUND',
          entityType: 'ORDER',
          entityId: orderId,
          oldValue: order.isRefunded.toString(),
          newValue: 'true',
          currentHash: `refund-${orderId}-${Date.now()}`,
        },
      });

      // Update customer statistics (deduct points and total spent)
      if (order.customerId) {
        const pointsToDeduct = Math.floor(order.subtotal);

        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            totalSpent: {
              decrement: order.subtotal,
            },
            orderCount: {
              decrement: 1,
            },
            loyaltyPoints: {
              decrement: pointsToDeduct,
            },
          },
        });

        // Create loyalty transaction for refund
        await tx.loyaltyTransaction.create({
          data: {
            customerId: order.customerId,
            points: -pointsToDeduct,
            type: 'REDEEMED',
            orderId: order.id,
            amount: order.subtotal,
            notes: `Refund for order #${order.orderNumber}`,
          },
        });

        // Update customer tier based on new total spent
        const updatedCustomer = await tx.customer.findUnique({
          where: { id: order.customerId },
        });

        if (updatedCustomer) {
          let newTier = 'BRONZE';
          // Update tier thresholds based on total spent (in EGP) - must match order creation
          if (updatedCustomer.totalSpent >= 10000) {
            newTier = 'PLATINUM';
          } else if (updatedCustomer.totalSpent >= 5000) {
            newTier = 'GOLD';
          } else if (updatedCustomer.totalSpent >= 2000) {
            newTier = 'SILVER';
          }

          if (updatedCustomer.tier !== newTier) {
            await tx.customer.update({
              where: { id: order.customerId },
              data: { tier: newTier },
            });
          }
        }
      }

      return updatedOrder;
    });

    return NextResponse.json({
      success: true,
      order: refundedOrder,
      message: `Order #${order.orderNumber} refunded successfully`,
    });
  } catch (error) {
    console.error('Refund error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process refund' },
      { status: 500 }
    );
  }
}
