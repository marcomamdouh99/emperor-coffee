import { db } from '@/lib/db';
import { headers } from 'next/headers';

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: {
  userId: string;
  actionType: string;
  entityType?: string | null;
  entityId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}) {
  try {
    // Get IP address from headers
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') ||
                     headersList.get('x-real-ip') ||
                     null;

    // Generate hash for tamper detection
    const hashData = `${params.userId}-${params.actionType}-${params.entityType || ''}-${params.entityId || ''}-${params.newValue || ''}-${Date.now()}`;
    const currentHash = Buffer.from(hashData).toString('base64');

    await db.auditLog.create({
      data: {
        userId: params.userId,
        actionType: params.actionType,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        oldValue: params.oldValue || null,
        newValue: params.newValue || null,
        ipAddress,
        currentHash,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit log failures shouldn't break the main operation
    return { success: false, error };
  }
}

/**
 * Log login action
 */
export async function logLogin(userId: string) {
  return createAuditLog({
    userId,
    actionType: 'login',
  });
}

/**
 * Log logout action
 */
export async function logLogout(userId: string) {
  return createAuditLog({
    userId,
    actionType: 'logout',
  });
}

/**
 * Log order creation
 */
export async function logOrderCreated(userId: string, orderId: string, orderDetails: string) {
  return createAuditLog({
    userId,
    actionType: 'order_created',
    entityType: 'Order',
    entityId: orderId,
    newValue: orderDetails,
  });
}

/**
 * Log order refund
 */
export async function logOrderRefunded(userId: string, orderId: string, refundReason: string) {
  return createAuditLog({
    userId,
    actionType: 'order_refunded',
    entityType: 'Order',
    entityId: orderId,
    newValue: refundReason,
  });
}

/**
 * Log shift opening
 */
export async function logShiftOpened(userId: string, shiftId: string, openingCash: number) {
  return createAuditLog({
    userId,
    actionType: 'shift_opened',
    entityType: 'Shift',
    entityId: shiftId,
    newValue: `Opening Cash: ${openingCash}`,
  });
}

/**
 * Log shift closing
 */
export async function logShiftClosed(userId: string, shiftId: string, closingCash: number) {
  return createAuditLog({
    userId,
    actionType: 'shift_closed',
    entityType: 'Shift',
    entityId: shiftId,
    newValue: `Closing Cash: ${closingCash}`,
  });
}

/**
 * Log business day opening
 */
export async function logDayOpened(userId: string, dayId: string, openingCash: number) {
  return createAuditLog({
    userId,
    actionType: 'day_opened',
    entityType: 'BusinessDay',
    entityId: dayId,
    newValue: `Opening Cash: ${openingCash}`,
  });
}

/**
 * Log business day closing
 */
export async function logDayClosed(userId: string, dayId: string, totalSales: number) {
  return createAuditLog({
    userId,
    actionType: 'day_closed',
    entityType: 'BusinessDay',
    entityId: dayId,
    newValue: `Total Sales: ${totalSales}`,
  });
}

/**
 * Log inventory adjustment
 */
export async function logInventoryAdjustment(
  userId: string,
  transactionId: string,
  ingredientName: string,
  oldValue: number,
  newValue: number
) {
  return createAuditLog({
    userId,
    actionType: 'inventory_adjusted',
    entityType: 'InventoryTransaction',
    entityId: transactionId,
    oldValue: `${ingredientName}: ${oldValue}`,
    newValue: `${ingredientName}: ${newValue}`,
  });
}

/**
 * Log menu item update
 */
export async function logMenuItemUpdated(userId: string, menuItemId: string, menuItemName: string) {
  return createAuditLog({
    userId,
    actionType: 'menu_updated',
    entityType: 'MenuItem',
    entityId: menuItemId,
    newValue: `Updated: ${menuItemName}`,
  });
}

/**
 * Log user creation
 */
export async function logUserCreated(userId: string, newUserId: string, username: string) {
  return createAuditLog({
    userId,
    actionType: 'user_created',
    entityType: 'User',
    entityId: newUserId,
    newValue: `User: ${username}`,
  });
}

/**
 * Log user update
 */
export async function logUserUpdated(userId: string, targetUserId: string, username: string) {
  return createAuditLog({
    userId,
    actionType: 'user_updated',
    entityType: 'User',
    entityId: targetUserId,
    newValue: `Updated: ${username}`,
  });
}

/**
 * Log user deletion
 */
export async function logUserDeleted(userId: string, targetUserId: string, username: string) {
  return createAuditLog({
    userId,
    actionType: 'user_deleted',
    entityType: 'User',
    entityId: targetUserId,
    oldValue: `Deleted: ${username}`,
  });
}

/**
 * Log branch creation
 */
export async function logBranchCreated(userId: string, branchId: string, branchName: string) {
  return createAuditLog({
    userId,
    actionType: 'branch_created',
    entityType: 'Branch',
    entityId: branchId,
    newValue: `Branch: ${branchName}`,
  });
}

/**
 * Log branch update
 */
export async function logBranchUpdated(userId: string, branchId: string, branchName: string) {
  return createAuditLog({
    userId,
    actionType: 'branch_updated',
    entityType: 'Branch',
    entityId: branchId,
    newValue: `Updated: ${branchName}`,
  });
}

/**
 * Log customer creation
 */
export async function logCustomerCreated(userId: string, customerId: string, customerName: string) {
  return createAuditLog({
    userId,
    actionType: 'customer_created',
    entityType: 'Customer',
    entityId: customerId,
    newValue: `Customer: ${customerName}`,
  });
}

/**
 * Log customer update
 */
export async function logCustomerUpdated(userId: string, customerId: string, customerName: string) {
  return createAuditLog({
    userId,
    actionType: 'customer_updated',
    entityType: 'Customer',
    entityId: customerId,
    newValue: `Updated: ${customerName}`,
  });
}

/**
 * Log promo code application
 */
export async function logPromoCodeApplied(userId: string, promoCodeId: string, code: string, discount: number) {
  return createAuditLog({
    userId,
    actionType: 'promo_code_applied',
    entityType: 'PromotionCode',
    entityId: promoCodeId,
    newValue: `Code: ${code}, Discount: ${discount}`,
  });
}

/**
 * Log waste entry
 */
export async function logWasteLogged(userId: string, wasteLogId: string, ingredientName: string, quantity: number) {
  return createAuditLog({
    userId,
    actionType: 'waste_logged',
    entityType: 'WasteLog',
    entityId: wasteLogId,
    newValue: `${ingredientName}: ${quantity}`,
  });
}
