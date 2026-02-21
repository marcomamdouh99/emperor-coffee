import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orderId,
      reason,
      username,
      password,
    } = body;

    // Validate request
    if (!orderId || !reason || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields (orderId, reason, username, password)' },
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
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Role-based authorization: Only ADMIN and BRANCH_MANAGER can process refunds
    if (user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER') {
      return NextResponse.json(
        { error: 'Only Administrators and Branch Managers can process refunds' },
        { status: 403 }
      );
    }

    // Get the order to refund
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        branch: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.isRefunded) {
      return NextResponse.json(
        { error: 'Order is already refunded' },
        { status: 400 }
      );
    }

    // Branch access control: ADMIN can refund any branch, BRANCH_MANAGER only their own
    if (user.role === 'BRANCH_MANAGER' && order.branchId !== user.branchId) {
      return NextResponse.json(
        { error: 'You can only refund orders from your own branch' },
        { status: 403 }
      );
    }

    // Process refund with inventory restoration
    await db.$transaction(async (tx) => {
      // Mark order as refunded
      await tx.order.update({
        where: { id: orderId },
        data: {
          isRefunded: true,
          refundReason: reason,
        },
      });

      // Restore inventory for each item in the order
      for (const orderItem of order.items) {
        // Get recipes for the menu item, filtered by variant if present
        const recipes = await tx.recipe.findMany({
          where: {
            menuItemId: orderItem.menuItemId,
            menuItemVariantId: orderItem.menuItemVariantId || null,
          },
          include: {
            ingredient: true,
          },
        });

        // Restore inventory based on recipes
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

            // Update inventory
            await tx.branchInventory.update({
              where: { id: inventory.id },
              data: {
                currentStock: stockAfter,
                lastModifiedAt: new Date(),
                lastModifiedBy: user.id,
              },
            });

            // Create refund transaction
            await tx.inventoryTransaction.create({
              data: {
                branchId: order.branchId,
                ingredientId: recipe.ingredientId,
                transactionType: 'REFUND',
                quantityChange: quantityToRestore,
                stockBefore,
                stockAfter,
                orderId: orderId,
                reason: `Refund for order: ${order.orderNumber}`,
                createdBy: user.id,
              },
            });
          }
        }
      }

      // Update customer statistics (deduct points and total spent)
      if (order.customerId) {
        // Calculate points to deduct (1 point per 1 EGP spent)
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
          // Update tier thresholds based on total spent (in EGP)
          if (updatedCustomer.totalSpent >= 1000) {
            newTier = 'PLATINUM';
          } else if (updatedCustomer.totalSpent >= 500) {
            newTier = 'GOLD';
          } else if (updatedCustomer.totalSpent >= 200) {
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
    });

    return NextResponse.json({
      success: true,
      message: `Order #${order.orderNumber} has been refunded`,
      refund: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason,
        totalAmount: order.totalAmount,
        refundAmount: order.totalAmount, // Full refund
      },
    });
  } catch (error: any) {
    console.error('Refund processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process refund', details: error.message },
      { status: 500 }
    );
  }
}
