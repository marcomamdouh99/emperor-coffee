/**
 * Batch Push API Endpoint
 * Handles multiple sync operations in a single request
 * Optimized for offline-first sync where branches may queue many operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SyncDirection, SyncStatus } from '@prisma/client';
import { createSyncHistory } from '@/lib/sync-utils';
import { conflictManager, ConflictType, ResolutionStrategy } from '@/lib/sync/conflict-manager';

// Operation types
const OperationType = {
  CREATE_ORDER: 'CREATE_ORDER',
  UPDATE_ORDER: 'UPDATE_ORDER',
  CREATE_INVENTORY: 'CREATE_INVENTORY',
  UPDATE_INVENTORY: 'UPDATE_INVENTORY',
  CREATE_WASTE: 'CREATE_WASTE',
  CREATE_SHIFT: 'CREATE_SHIFT',
  UPDATE_SHIFT: 'UPDATE_SHIFT',
  CLOSE_SHIFT: 'CLOSE_SHIFT',
  CREATE_CUSTOMER: 'CREATE_CUSTOMER',
  UPDATE_CUSTOMER: 'UPDATE_CUSTOMER',
  UPDATE_USER: 'UPDATE_USER',
  CREATE_DAILY_EXPENSE: 'CREATE_DAILY_EXPENSE',
  CREATE_VOIDED_ITEM: 'CREATE_VOIDED_ITEM',
  CREATE_PROMO_CODE: 'CREATE_PROMO_CODE',
  USE_PROMO_CODE: 'USE_PROMO_CODE',
  CREATE_LOYALTY_TRANSACTION: 'CREATE_LOYALTY_TRANSACTION',
  CREATE_TABLE: 'CREATE_TABLE',
  UPDATE_TABLE: 'UPDATE_TABLE',
  CLOSE_TABLE: 'CLOSE_TABLE',
  CREATE_INVENTORY_TRANSACTION: 'CREATE_INVENTORY_TRANSACTION',
  CREATE_INGREDIENT: 'CREATE_INGREDIENT',
  UPDATE_INGREDIENT: 'UPDATE_INGREDIENT',
  CREATE_MENU_ITEM: 'CREATE_MENU_ITEM',
  UPDATE_MENU_ITEM: 'UPDATE_MENU_ITEM',
  CREATE_TRANSFER: 'CREATE_TRANSFER',
  CREATE_PURCHASE_ORDER: 'CREATE_PURCHASE_ORDER',
  UPDATE_PURCHASE_ORDER: 'UPDATE_PURCHASE_ORDER',
  CREATE_RECEIPT_SETTINGS: 'CREATE_RECEIPT_SETTINGS',
  UPDATE_RECEIPT_SETTINGS: 'UPDATE_RECEIPT_SETTINGS',
} as const;

type OperationTypeType = typeof OperationType[keyof typeof OperationType];

interface SyncOperation {
  type: OperationTypeType;
  data: any;
  timestamp: number;
  idempotencyKey?: string; // Optional: for idempotency checking
}

interface BatchPushRequest {
  branchId: string;
  operations: SyncOperation[];
}

/**
 * In-memory cache for mapping temporary IDs to real IDs during batch processing.
 * This ensures that multiple operations referencing the same temp ID use the same real ID.
 */
const tempIdToRealIdMap = new Map<string, string>();

export async function POST(request: NextRequest) {
  // Clear the temp ID mapping at the start of each request
  tempIdToRealIdMap.clear();

  try {
    const body: BatchPushRequest = await request.json();
    const { branchId, operations } = body;

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    if (!operations || !Array.isArray(operations)) {
      return NextResponse.json(
        { error: 'Operations array is required' },
        { status: 400 }
      );
    }

    // Verify branch exists
    const branch = await db.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    const results = {
      processed: 0,
      failed: 0,
      failedIds: [] as string[],
      errors: [] as string[],
      conflictsDetected: 0,
      conflictsResolved: 0,
    };

    // Process operations
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      try {
        await processOperation(operation, branchId);

        // Record idempotency key after successful processing
        if (operation.idempotencyKey) {
          await recordIdempotencyKey(operation.idempotencyKey, branchId);
        }

        results.processed++;
      } catch (error) {
        results.failed++;
        results.failedIds.push(`op-${i}`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${operation.type}: ${errorMessage}`);
        console.error(`[BatchPush] Failed to process operation ${i}:`, error);
      }
    }

    // Auto-resolve any conflicts that were detected
    const autoResolvedConflicts = await conflictManager.autoResolveConflicts();
    results.conflictsResolved = autoResolvedConflicts.length;
    results.conflictsDetected = conflictManager.getAllConflicts().length;

    // Record sync history if any operations were processed
    if (results.processed > 0) {
      const syncHistoryId = await createSyncHistory(
        branchId,
        SyncDirection.UP,
        results.processed
      );

      // Update sync history with completion details
      if (results.failed > 0 || results.conflictsDetected > 0) {
        await db.syncHistory.update({
          where: { id: syncHistoryId },
          data: {
            syncCompletedAt: new Date(),
            status: results.failed === results.processed ? SyncStatus.FAILED : SyncStatus.PARTIAL,
            errorDetails: results.errors.join('; ') + (results.conflictsDetected > 0 ? ` | ${results.conflictsDetected} conflicts detected, ${results.conflictsResolved} resolved` : '')
          }
        });
      }
    }

    return NextResponse.json({
      success: results.failed === 0,
      processed: results.processed,
      failed: results.failed,
      failedIds: results.failedIds,
      errors: results.errors,
      conflictsDetected: results.conflictsDetected,
      conflictsResolved: results.conflictsResolved,
      conflictStats: conflictManager.getConflictStats(),
    });
  } catch (error) {
    console.error('[BatchPush] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    // Clear the temp ID mapping after request completes
    tempIdToRealIdMap.clear();
  }
}

/**
 * Check if an operation with this idempotency key has already been processed
 * This prevents duplicate operations from being executed multiple times
 */
async function checkIdempotencyKey(idempotencyKey: string, branchId: string): Promise<boolean> {
  try {
    const existing = await db.idempotencyKey.findUnique({
      where: { key: idempotencyKey }
    });
    return !!existing;
  } catch (error) {
    // If the table doesn't exist yet (schema not pushed), return false
    console.warn('[Idempotency] Could not check idempotency key:', error);
    return false;
  }
}

/**
 * Record that an operation with this idempotency key has been processed
 */
async function recordIdempotencyKey(idempotencyKey: string, branchId: string): Promise<void> {
  try {
    await db.idempotencyKey.create({
      data: { key: idempotencyKey, branchId }
    });
    console.log(`[Idempotency] Recorded idempotency key: ${idempotencyKey}`);
  } catch (error) {
    // If the table doesn't exist yet (schema not pushed), log and continue
    console.warn('[Idempotency] Could not record idempotency key:', error);
  }
}

/**
 * Process individual sync operation
 */
async function processOperation(operation: SyncOperation, branchId: string): Promise<void> {
  // Check idempotency key to prevent duplicate processing
  if (operation.idempotencyKey) {
    const alreadyProcessed = await checkIdempotencyKey(operation.idempotencyKey, branchId);
    if (alreadyProcessed) {
      console.log(`[Idempotency] Skipping already processed operation: ${operation.idempotencyKey}`);
      return;
    }
  }

  switch (operation.type) {
    case OperationType.CREATE_ORDER:
      await createOrder(operation.data, branchId);
      break;

    case OperationType.UPDATE_ORDER:
      await updateOrder(operation.data, branchId);
      break;

    case OperationType.CREATE_INVENTORY:
      await createInventory(operation.data, branchId);
      break;

    case OperationType.UPDATE_INVENTORY:
      await updateInventory(operation.data, branchId);
      break;

    case OperationType.CREATE_WASTE:
      await createWaste(operation.data, branchId);
      break;

    case OperationType.CREATE_SHIFT:
      await createShift(operation.data, branchId);
      break;

    case OperationType.UPDATE_SHIFT:
      await updateShift(operation.data, branchId);
      break;

    case OperationType.CLOSE_SHIFT:
      await closeShift(operation.data, branchId);
      break;

    case OperationType.CREATE_CUSTOMER:
      await createCustomer(operation.data, branchId);
      break;

    case OperationType.UPDATE_USER:
      await updateUser(operation.data);
      break;

    case OperationType.CREATE_DAILY_EXPENSE:
      await createDailyExpense(operation.data, branchId);
      break;

    case OperationType.CREATE_VOIDED_ITEM:
      await createVoidedItem(operation.data, branchId);
      break;

    case OperationType.CREATE_PROMO_CODE:
      await createPromoCode(operation.data, branchId);
      break;

    case OperationType.USE_PROMO_CODE:
      await handleUsePromoCode(operation.data, branchId);
      break;

    case OperationType.CREATE_LOYALTY_TRANSACTION:
      await createLoyaltyTransaction(operation.data);
      break;

    case OperationType.CREATE_TABLE:
      await createTable(operation.data, branchId);
      break;

    case OperationType.UPDATE_TABLE:
      await updateTable(operation.data, branchId);
      break;

    case OperationType.CLOSE_TABLE:
      await closeTable(operation.data, branchId);
      break;

    case OperationType.CREATE_INVENTORY_TRANSACTION:
      await createInventoryTransaction(operation.data, branchId);
      break;

    case OperationType.UPDATE_CUSTOMER:
      await updateCustomer(operation.data, branchId);
      break;

    case OperationType.CREATE_INGREDIENT:
      await createIngredient(operation.data, branchId);
      break;

    case OperationType.UPDATE_INGREDIENT:
      await updateIngredient(operation.data, branchId);
      break;

    case OperationType.CREATE_MENU_ITEM:
      await createMenuItem(operation.data, branchId);
      break;

    case OperationType.UPDATE_MENU_ITEM:
      await updateMenuItem(operation.data, branchId);
      break;

    case OperationType.CREATE_TRANSFER:
      await createTransfer(operation.data, branchId);
      break;

    case OperationType.CREATE_PURCHASE_ORDER:
      await createPurchaseOrder(operation.data, branchId);
      break;

    case OperationType.UPDATE_PURCHASE_ORDER:
      await updatePurchaseOrder(operation.data, branchId);
      break;

    case OperationType.CREATE_RECEIPT_SETTINGS:
      await createReceiptSettings(operation.data);
      break;

    case OperationType.UPDATE_RECEIPT_SETTINGS:
      await updateReceiptSettings(operation.data);
      break;

    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

/**
 * Create order
 */
async function createOrder(data: any, branchId: string): Promise<void> {
  console.log('[BatchPush] Creating order with data:', JSON.stringify(data, null, 2));

  // Extract items - check multiple possible locations
  let orderItems: any[] | undefined;

  if (data._offlineData?.items && Array.isArray(data._offlineData.items)) {
    // Offline orders have items in _offlineData.items
    orderItems = data._offlineData.items;
    console.log('[BatchPush] Extracted items from _offlineData.items:', orderItems.length, 'items');
  } else if (data.items && Array.isArray(data.items)) {
    // Online orders have items directly in data.items
    orderItems = data.items;
    console.log('[BatchPush] Extracted items from data.items:', orderItems.length, 'items');
  }

  // Validate that we have items
  if (!orderItems || orderItems.length === 0) {
    throw new Error(`No items found in order data. Order number: ${data.orderNumber}`);
  }

  // Extract subtotal from either _offlineData or data directly
  const subtotal = data._offlineData?.subtotal !== undefined ? data._offlineData.subtotal :
                   data.subtotal !== undefined ? data.subtotal : undefined;

  // Handle shiftId - check if it's a temp ID and map to real ID
  let shiftId = data.shiftId || null;
  if (shiftId && shiftId.startsWith('temp-')) {
    const realShiftId = tempIdToRealIdMap.get(shiftId);
    if (realShiftId) {
      shiftId = realShiftId;
      console.log(`[BatchPush] Mapped temp shift ID ${data.shiftId} to real ID ${realShiftId} for order`);
    } else {
      // Temp shift ID not mapped yet, don't set shiftId for now
      console.warn(`[BatchPush] Temp shift ID ${shiftId} not mapped yet, not linking order to shift`);
      shiftId = null;
    }
  }

  // Handle customerId - check if it's a temp ID and map to real ID
  let customerId = data.customerId || null;
  if (customerId && customerId.startsWith('temp-')) {
    const realCustomerId = tempIdToRealIdMap.get(customerId);
    if (realCustomerId) {
      customerId = realCustomerId;
      console.log(`[BatchPush] Mapped temp customer ID ${data.customerId} to real ID ${realCustomerId} for order`);
    } else {
      // Temp customer ID not mapped yet, don't set customerId for now
      console.warn(`[BatchPush] Temp customer ID ${customerId} not mapped yet, not linking order to customer`);
      customerId = null;
    }
  }

  // Prepare order data - only include fields that exist in the Order model
  const orderData: any = {
    branchId,
    orderNumber: data.orderNumber,
    cashierId: data.cashierId, // cashierId is required
    customerId: customerId, // Use mapped customerId (or null if temp ID not mapped yet)
    orderType: data.orderType,
    totalAmount: data.totalAmount,
    paymentMethod: data.paymentMethod || null,
    shiftId: shiftId, // Use mapped shiftId (or null if temp ID not mapped yet)
    isRefunded: data.isRefunded || false,
    refundReason: data.refundReason || null,
    transactionHash: data.transactionHash || generateTransactionHash(data, branchId, data.orderNumber, data.totalAmount, data.cashierId, data.createdAt),
    orderTimestamp: data.orderTimestamp ? new Date(data.orderTimestamp) : new Date(data.createdAt),
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };

  // Add subtotal if available
  if (subtotal !== undefined) {
    orderData.subtotal = subtotal;
  }

  // Add delivery-specific fields if available
  if (data.deliveryAddress) {
    orderData.deliveryAddress = data.deliveryAddress;
  }
  if (data.deliveryAreaId) {
    orderData.deliveryAreaId = data.deliveryAreaId;
  }
  if (data.deliveryFee !== undefined) {
    orderData.deliveryFee = data.deliveryFee;
  }
  if (data.courierId) {
    orderData.courierId = data.courierId;
  }

  // Helper function to generate transaction hash if not provided
  function generateTransactionHash(data: any, branchId: string, orderNumber: number, totalAmount: number, cashierId: string, createdAt: string) {
    return Buffer.from(
      `${branchId}-${orderNumber}-${totalAmount}-${cashierId || 'unknown'}-${Date.now()}`
    ).toString('base64');
  }

  // Only use provided ID if it's not a temporary ID
  if (!data.id || !data.id.startsWith('temp-')) {
    orderData.id = data.id;
  }

  console.log('[BatchPush] Creating order with items:', orderItems);

  const createdOrder = await db.order.create({
    data: {
      ...orderData,
      items: {
        create: orderItems.map((item: any) => ({
          menuItemId: item.menuItemId,
          itemName: item.itemName || item.name || 'Unknown',
          quantity: item.quantity,
          menuItemVariantId: item.menuItemVariantId || null,
          variantName: item.variantName || null,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal || (item.quantity * item.unitPrice),
          recipeVersion: item.recipeVersion || 1,
        })),
      },
    },
  });

  console.log('[BatchPush] Order created successfully with order number:', data.orderNumber, 'ID:', createdOrder.id);

  // Award loyalty points if customer is linked
  // Points should be based on subtotal (not including delivery fees)
  if (customerId && customerId !== null && !customerId.startsWith('temp-')) {
    try {
      // Use subtotal for loyalty points (excludes delivery fees)
      const pointsAmount = subtotal || data.subtotal || 0;

      console.log('[BatchPush] Checking loyalty points award:', {
        customerId,
        hasCustomerId: !!customerId,
        isTempId: customerId?.startsWith('temp-'),
        pointsAmount,
        orderNumber: data.orderNumber,
        orderId: createdOrder.id,
      });

      if (pointsAmount > 0) {
        console.log(`[BatchPush] Awarding loyalty points for customer ${customerId} from order ${createdOrder.id}, amount: ${pointsAmount}`);

        // Import loyalty logic
        const { awardLoyaltyPoints } = await import('@/lib/loyalty-utils');
        const loyaltyResult = await awardLoyaltyPoints(customerId, createdOrder.id, pointsAmount);

        console.log('[BatchPush] Loyalty points awarded successfully:', {
          pointsEarned: loyaltyResult.pointsEarned,
          totalPoints: loyaltyResult.totalPoints,
          tier: loyaltyResult.tier,
          transactionId: loyaltyResult.transaction?.id,
        });
      } else {
        console.log('[BatchPush] Points amount is 0 or negative, skipping loyalty points');
      }
    } catch (loyaltyError) {
      console.error('[BatchPush] Error awarding loyalty points:', loyaltyError);
      // Don't fail the order if loyalty fails
    }
  } else {
    console.log('[BatchPush] No customer linked to order or customer has temp ID, skipping loyalty points');
  }
}

/**
 * Update order
 */
async function updateOrder(data: any, branchId: string): Promise<void> {
  // Update order basic info - only include fields that exist in the Order model
  const updateData: any = {
    paymentMethod: data.paymentMethod,
    isRefunded: data.isRefunded || false,
    refundReason: data.refundReason || null,
    updatedAt: new Date(data.updatedAt),
  };

  // Only update shiftId if it's provided
  if (data.shiftId !== undefined) {
    let shiftId = data.shiftId;
    // Map temp shift ID to real ID if needed
    if (shiftId && shiftId.startsWith('temp-')) {
      const realShiftId = tempIdToRealIdMap.get(shiftId);
      if (realShiftId) {
        shiftId = realShiftId;
        console.log(`[BatchPush] Mapped temp shift ID ${data.shiftId} to real ID ${realShiftId} for order update`);
      } else {
        // Temp shift ID not mapped, set to null
        console.warn(`[BatchPush] Temp shift ID ${shiftId} not mapped yet, not updating shiftId`);
        shiftId = null;
      }
    }
    updateData.shiftId = shiftId;
  }

  // Update order if customerId is provided
  if (data.customerId !== undefined) {
    updateData.customerId = data.customerId;
  }
  
  // Update order if customerAddressId is provided
  if (data.customerAddressId !== undefined) {
    updateData.customerAddressId = data.customerAddressId;
  }
  
  // Update order if courierId is provided
  if (data.courierId !== undefined) {
    updateData.courierId = data.courierId;
  }
  
  // Update order if deliveryAddress is provided
  if (data.deliveryAddress !== undefined) {
    updateData.deliveryAddress = data.deliveryAddress;
  }
  
  // Update order if deliveryAreaId is provided
  if (data.deliveryAreaId !== undefined) {
    updateData.deliveryAreaId = data.deliveryAreaId;
  }
  
  // Update order if deliveryFee is provided
  if (data.deliveryFee !== undefined) {
    updateData.deliveryFee = data.deliveryFee;
  }

  await db.order.update({
    where: { id: data.id },
    data: updateData,
  });

  // Update order items if provided
  if (data.items && Array.isArray(data.items)) {
    // Delete existing items
    await db.orderItem.deleteMany({
      where: { orderId: data.id },
    });

    // Create new items
    await db.orderItem.createMany({
      data: data.items.map((item: any) => ({
        orderId: data.id,
        menuItemId: item.menuItemId,
        itemName: item.itemName || item.name || 'Unknown',
        quantity: item.quantity,
        menuItemVariantId: item.menuItemVariantId || null,
        variantName: item.variantName || null,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal || (item.quantity * item.unitPrice),
        recipeVersion: item.recipeVersion || 1,
      })),
    });
  }
}

/**
 * Create inventory
 */
async function createInventory(data: any, branchId: string): Promise<void> {
  await db.inventory.create({
    data: {
      id: data.id,
      branchId,
      ingredientId: data.ingredientId,
      quantity: data.quantity,
      unit: data.unit,
      reorderLevel: data.reorderLevel,
      lastRestockedAt: data.lastRestockedAt ? new Date(data.lastRestockedAt) : null,
      version: data.version || 1,
    },
  });
}

/**
 * Update inventory
 */
async function updateInventory(data: any, branchId: string): Promise<void> {
  await db.inventory.update({
    where: { id: data.id },
    data: {
      quantity: data.quantity,
      lastRestockedAt: data.lastRestockedAt ? new Date(data.lastRestockedAt) : null,
      version: (data.version || 0) + 1,
    },
  });
}

/**
 * Create waste log
 */
async function createWaste(data: any, branchId: string): Promise<void> {
  await db.wasteLog.create({
    data: {
      id: data.id,
      branchId,
      menuItemId: data.menuItemId || null,
      ingredientId: data.ingredientId || null,
      quantity: data.quantity,
      reason: data.reason,
      cost: data.cost || 0,
      notes: data.notes || null,
      recordedBy: data.recordedBy,
      createdAt: new Date(data.createdAt),
    },
  });
}

/**
 * Create customer
 */
async function createCustomer(data: any, branchId: string): Promise<void> {
  console.log('[BatchPush] Creating customer with data:', JSON.stringify(data, null, 2));

  // Check if this is a temp ID that's already mapped
  if (data.id && data.id.startsWith('temp-')) {
    const existingRealId = tempIdToRealIdMap.get(data.id);
    if (existingRealId) {
      console.log(`[BatchPush] Temp customer ID ${data.id} already mapped to ${existingRealId}, skipping creation`);
      return;
    }
  }

  // Check if customer already exists by phone number
  const existingCustomer = await db.customer.findFirst({
    where: {
      phone: data.phone,
    },
  });

  let customerId: string;

  if (existingCustomer) {
    // Customer exists, use their ID
    customerId = existingCustomer.id;
    console.log(`[BatchPush] Customer with phone ${data.phone} already exists: ${customerId}`);

    // Create addresses if they don't exist
    if (data.addresses && Array.isArray(data.addresses)) {
      for (const addr of data.addresses) {
        // Check if address already exists for this customer
        const existingAddress = await db.customerAddress.findFirst({
          where: {
            customerId,
            streetAddress: addr.streetAddress,
          },
        });

        if (!existingAddress) {
          await db.customerAddress.create({
            data: {
              customerId,
              building: addr.building || null,
              streetAddress: addr.streetAddress,
              floor: addr.floor || null,
              apartment: addr.apartment || null,
              deliveryAreaId: addr.deliveryAreaId || null,
              isDefault: addr.isDefault || false,
            },
          });
          console.log(`[BatchPush] Created address for existing customer ${customerId}`);
        }
      }
    }
  } else {
    // Create new customer
    const customerData: any = {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      branchId: data.branchId || branchId,
      notes: data.notes || null,
    };

    // Only use provided ID if it's not a temporary ID
    if (data.id && !data.id.startsWith('temp-')) {
      customerData.id = data.id;
    }

    const createdCustomer = await db.customer.create({
      data: {
        ...customerData,
        addresses: data.addresses ? {
          create: data.addresses.map((addr: any) => ({
            building: addr.building || null,
            streetAddress: addr.streetAddress,
            floor: addr.floor || null,
            apartment: addr.apartment || null,
            deliveryAreaId: addr.deliveryAreaId || null,
            isDefault: addr.isDefault || false,
          })),
        } : undefined,
      },
      include: {
        addresses: true,
      },
    });

    customerId = createdCustomer.id;
    console.log('[BatchPush] Customer created successfully:', createdCustomer);
  }

  // Map temp ID to real ID for future operations
  if (data.id && data.id.startsWith('temp-')) {
    tempIdToRealIdMap.set(data.id, customerId);
    console.log(`[BatchPush] Mapped temp customer ID ${data.id} to real ID ${customerId}`);
  }
}

/**
 * Create shift
 * Includes deduplication logic to prevent duplicate shifts when syncing offline data multiple times
 */
async function createShift(data: any, branchId: string): Promise<void> {
  // Validate required fields
  if (!data.cashierId || data.cashierId === 'all') {
    throw new Error('Invalid cashierId: cannot be empty or "all"');
  }

  // Validate and parse startTime
  let startTime: Date;
  if (!data.startTime) {
    throw new Error('Missing startTime');
  }

  const parsedStartTime = new Date(data.startTime);
  if (isNaN(parsedStartTime.getTime())) {
    throw new Error(`Invalid startTime: ${data.startTime}`);
  }
  startTime = parsedStartTime;

  // Parse endTime if provided
  let endTime: Date | null = null;
  if (data.endTime) {
    const parsedEndTime = new Date(data.endTime);
    if (!isNaN(parsedEndTime.getTime())) {
      endTime = parsedEndTime;
    }
  }

  // If this has a temporary ID, check if we already mapped it
  if (data.id && data.id.startsWith('temp-')) {
    const existingRealId = tempIdToRealIdMap.get(data.id);
    if (existingRealId) {
      console.log(`[BatchPush] Temp ID ${data.id} already mapped to ${existingRealId}, skipping creation`);
      return;
    }
  }

  // Check for duplicate shift by matching branchId, cashierId, and startTime (within 60 seconds)
  // This prevents creating duplicate shifts when the same offline shift syncs multiple times
  const timeWindowStart = new Date(startTime.getTime() - 60000); // 60 seconds before
  const timeWindowEnd = new Date(startTime.getTime() + 60000);   // 60 seconds after

  console.log(`[BatchPush] Checking for duplicate shift with branchId=${branchId}, cashierId=${data.cashierId}, startTime=${startTime.toISOString()}, window=[${timeWindowStart.toISOString()}, ${timeWindowEnd.toISOString()}]`);

  const existingShift = await db.shift.findFirst({
    where: {
      branchId,
      cashierId: data.cashierId,
      startTime: {
        gte: timeWindowStart,
        lte: timeWindowEnd,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingShift) {
    console.log(`[BatchPush] Found existing shift ${existingShift.id} matching criteria, skipping creation`);
    // Map the temp ID to the existing real ID for future operations
    if (data.id && data.id.startsWith('temp-')) {
      tempIdToRealIdMap.set(data.id, existingShift.id);
    }
    return;
  }

  // If this is an offline-created shift with tempId, don't specify id - let Prisma generate one
  const shiftData: any = {
    branchId,
    cashierId: data.cashierId,
    startTime,
    endTime,
    isClosed: data.isClosed || false,
    openingCash: data.openingCash || 0,
    closingCash: data.closingCash || 0,
    notes: data.notes || null,
  };

  // Only use provided ID if it's not a temporary ID
  if (!data.id || !data.id.startsWith('temp-')) {
    shiftData.id = data.id;
  }

  // Create the shift
  const newShift = await db.shift.create({ data: shiftData });

  // Map the temp ID to the new real ID for future operations (like closeShift)
  if (data.id && data.id.startsWith('temp-')) {
    tempIdToRealIdMap.set(data.id, newShift.id);
    console.log(`[BatchPush] Mapped temp ID ${data.id} to real ID ${newShift.id}`);
  }
}

/**
 * Update shift
 */
async function updateShift(data: any, branchId: string): Promise<void> {
  await db.shift.update({
    where: { id: data.id },
    data: {
      endTime: data.endTime ? new Date(data.endTime) : null,
      closingCash: data.closingCash,
      notes: data.notes,
    },
  });
}

/**
 * Close shift
 * Similar to updateShift but specifically for closing a shift
 * Improved to handle temporary IDs and prevent duplicate shifts
 */
async function closeShift(data: any, branchId: string): Promise<void> {
  // If the shift has a temporary ID, we need to find the real shift ID
  let shiftId = data.id;

  if (data.id && data.id.startsWith('temp-')) {
    // First, check if we have a mapping for this temp ID
    const mappedId = tempIdToRealIdMap.get(data.id);
    if (mappedId) {
      shiftId = mappedId;
      console.log(`[BatchPush] Found mapped real ID ${shiftId} for temp ID ${data.id}`);
    } else {
      // Parse startTime - handle both Date objects and ISO strings
      let startTime: Date | undefined;
      if (data.startTime) {
        if (data.startTime instanceof Date) {
          startTime = data.startTime;
        } else if (typeof data.startTime === 'string') {
          startTime = new Date(data.startTime);
          if (isNaN(startTime.getTime())) {
            console.warn(`[BatchPush] Invalid startTime string: ${data.startTime}, will use fallback`);
            startTime = undefined;
          }
        }
      }

      // Try to find the shift by matching temporary shift properties
      // Expanded time variance from 5 seconds to 30 seconds for better matching
      if (startTime) {
        console.log(`[BatchPush] Looking for shift with startTime:`, startTime.toISOString());
        const timeWindowStart = new Date(startTime.getTime() - 30000); // 30 seconds before
        const timeWindowEnd = new Date(startTime.getTime() + 30000);   // 30 seconds after

        const tempShift = await db.shift.findFirst({
          where: {
            branchId,
            cashierId: data.cashierId,
            startTime: {
              gte: timeWindowStart,
              lte: timeWindowEnd,
            },
            isClosed: false,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (tempShift) {
          shiftId = tempShift.id;
          console.log(`[BatchPush] Found real shift ID ${shiftId} for temp shift ${data.id}`);
          // Store the mapping for future operations
          tempIdToRealIdMap.set(data.id, shiftId);
        } else {
          console.warn(`[BatchPush] No open shift found with matching startTime, trying fallback`);
        }
      }

      // If we still don't have the shift ID, use fallback: find most recent open shift for this cashier
      if (shiftId.startsWith('temp-')) {
        console.log(`[BatchPush] Using fallback: finding most recent open shift for cashier ${data.cashierId}`);
        const recentShift = await db.shift.findFirst({
          where: {
            branchId,
            cashierId: data.cashierId,
            isClosed: false,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (recentShift) {
          shiftId = recentShift.id;
          console.log(`[BatchPush] Using most recent open shift ID ${shiftId} for temp shift ${data.id}`);
          tempIdToRealIdMap.set(data.id, shiftId);
        } else {
          // Final fallback: find the most recent shift (open or closed) for this cashier + branch
          console.log(`[BatchPush] No open shift found, checking all shifts for cashier ${data.cashierId}`);
          const anyShift = await db.shift.findFirst({
            where: {
              branchId,
              cashierId: data.cashierId,
            },
            orderBy: { createdAt: 'desc' },
          });

          if (anyShift) {
            // Check if this shift's startTime is within a reasonable time window (5 minutes)
            const shiftTime = anyShift.startTime.getTime();
            const dataTime = data.startTime ? new Date(data.startTime).getTime() : Date.now();
            const timeDiff = Math.abs(shiftTime - dataTime);

            if (timeDiff <= 300000) { // 5 minutes
              shiftId = anyShift.id;
              console.log(`[BatchPush] Using recent shift ID ${shiftId} (within 5 min window) for temp shift ${data.id}, isClosed: ${anyShift.isClosed}`);
              
              // If the shift is already closed, skip the close operation
              if (anyShift.isClosed) {
                console.log(`[BatchPush] Shift ${shiftId} is already closed, skipping close operation`);
                tempIdToRealIdMap.set(data.id, shiftId);
                return;
              }
              
              tempIdToRealIdMap.set(data.id, shiftId);
            } else {
              throw new Error(`Could not find real shift for temp ID: ${data.id}. Recent shift is too old (${Math.floor(timeDiff / 1000)}s difference)`);
            }
          } else {
            throw new Error(`Could not find real shift for temp ID: ${data.id}. No shift found for cashier ${data.cashierId} in branch ${branchId}`);
          }
        }
      }
    }
  }

  // Parse endTime - handle both Date objects and ISO strings
  let endTime: Date | undefined;
  if (data.endTime) {
    if (data.endTime instanceof Date) {
      endTime = data.endTime;
    } else if (typeof data.endTime === 'string') {
      endTime = new Date(data.endTime);
      if (isNaN(endTime.getTime())) {
        console.warn(`[BatchPush] Invalid endTime string: ${data.endTime}, using current time`);
        endTime = new Date();
      }
    }
  } else {
    endTime = new Date();
  }

  // Get the shift to access its branchId
  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    select: { branchId: true },
  });

  if (!shift) {
    throw new Error(`Shift ${shiftId} not found`);
  }

  // Calculate actual closing figures from orders
  // Revenue = subtotal (excludes delivery fees which go to couriers, excludes loyalty discounts)
  const orderStats = await db.order.aggregate({
    where: {
      shiftId: shiftId,
    },
    _count: true,
    _sum: {
      subtotal: true,  // Revenue = subtotal (no delivery fees, no discounts)
      deliveryFee: true,
      totalAmount: true,
    },
  });

  // Get loyalty discounts for this branch (costs tracked as "Loyalty Discounts")
  const loyaltyDiscountStats = await db.branchCost.aggregate({
    where: {
      branchId: shift.branchId,
      shiftId: shiftId, // Only get loyalty discounts for this specific shift
      costCategory: {
        name: 'Loyalty Discounts',
      },
    },
    _sum: {
      amount: true,
    },
  });

  // Calculate what the cashier actually has
  // Cashier revenue = subtotal - loyaltyDiscounts (delivery fees go to courier)
  const deliveryFees = orderStats._sum.deliveryFee || 0;
  const loyaltyDiscounts = loyaltyDiscountStats._sum.amount || 0;
  const cashierRevenue = (orderStats._sum.subtotal || 0) - loyaltyDiscounts;

  console.log(`[BatchPush] Closing shift ${shiftId} with calculated stats:`, {
    orders: orderStats._count,
    subtotal: orderStats._sum.subtotal || 0,
    deliveryFees,
    loyaltyDiscounts,
    cashierRevenue,
  });

  await db.shift.update({
    where: { id: shiftId },
    data: {
      endTime,
      closingCash: data.closingCash || 0,
      isClosed: true,
      closingOrders: orderStats._count,
      closingRevenue: cashierRevenue, // Cashier's actual revenue (excludes delivery fees & discounts)
      closingLoyaltyDiscounts: loyaltyDiscounts,
      notes: data.notes || null,
    },
  });

  console.log(`[BatchPush] Shift ${shiftId} closed successfully`);
}

/**
 * Update user (for local changes like password updates)
 */
async function updateUser(data: any): Promise<void> {
  await db.user.update({
    where: { id: data.id },
    data: {
      username: data.username,
      fullName: data.fullName,
      email: data.email || null,
      role: data.role,
      branchId: data.branchId || null,
      isActive: data.isActive,
      updatedAt: new Date(),
    },
  });
}

/**
 * Create daily expense
 */
async function createDailyExpense(data: any, branchId: string): Promise<void> {
  await db.dailyExpense.create({
    data: {
      id: data.id,
      branchId,
      shiftId: data.shiftId,
      amount: data.amount,
      reason: data.reason,
      recordedBy: data.recordedBy,
      createdAt: new Date(data.createdAt),
    },
  });
}

/**
 * Create voided item
 */
async function createVoidedItem(data: any, branchId: string): Promise<void> {
  await db.voidedItem.create({
    data: {
      id: data.id,
      orderItemId: data.orderItemId,
      orderQuantity: data.orderQuantity,
      voidedQuantity: data.voidedQuantity,
      remainingQuantity: data.remainingQuantity,
      unitPrice: data.unitPrice,
      voidedSubtotal: data.voidedSubtotal,
      reason: data.reason,
      voidedBy: data.voidedBy,
      voidedAt: new Date(data.voidedAt),
      createdAt: new Date(data.createdAt),
    },
  });
}

/**
 * Create promo code
 */
async function createPromoCode(data: any, branchId: string): Promise<void> {
  // Check if promo code already exists
  const existing = await db.promotionCode.findUnique({
    where: { code: data.code }
  });

  if (existing) {
    console.log(`[BatchPush] Promo code ${data.code} already exists, skipping`);
    return;
  }

  await db.promotionCode.create({
    data: {
      id: data.id,
      promotionId: data.promotionId,
      code: data.code,
      isActive: data.isActive,
      usageCount: data.usageCount || 0,
      maxUses: data.maxUses || null,
      isSingleUse: data.isSingleUse || false,
      campaignName: data.campaignName || null,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    },
  });
}

/**
 * Use promo code (increment usage count)
 */
async function handleUsePromoCode(data: any, branchId: string): Promise<void> {
  await db.promotionCode.update({
    where: { code: data.code },
    data: {
      usageCount: {
        increment: 1,
      },
      updatedAt: new Date(),
    },
  });
}

/**
 * Create loyalty transaction
 */
async function createLoyaltyTransaction(data: any): Promise<void> {
  await db.loyaltyTransaction.create({
    data: {
      id: data.id,
      customerId: data.customerId,
      points: data.points,
      type: data.type,
      orderId: data.orderId || null,
      amount: data.amount || null,
      notes: data.notes || null,
      createdAt: new Date(data.createdAt),
    },
  });
}

/**
 * Create table
 */
async function createTable(data: any, branchId: string): Promise<void> {
  await db.table.create({
    data: {
      id: data.id,
      branchId,
      tableNumber: data.tableNumber,
      status: data.status || 'AVAILABLE',
      customerId: data.customerId || null,
      capacity: data.capacity || null,
      openedAt: data.openedAt ? new Date(data.openedAt) : null,
      closedAt: data.closedAt ? new Date(data.closedAt) : null,
      openedBy: data.openedBy || null,
      closedBy: data.closedBy || null,
      notes: data.notes || null,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    },
  });
}

/**
 * Update table
 */
async function updateTable(data: any, branchId: string): Promise<void> {
  await db.table.update({
    where: { id: data.id },
    data: {
      status: data.status,
      customerId: data.customerId || null,
      openedAt: data.openedAt ? new Date(data.openedAt) : null,
      closedAt: data.closedAt ? new Date(data.closedAt) : null,
      openedBy: data.openedBy || null,
      closedBy: data.closedBy || null,
      notes: data.notes || null,
      updatedAt: new Date(data.updatedAt),
    },
  });
}

/**
 * Close table
 */
async function closeTable(data: any, branchId: string): Promise<void> {
  await db.table.update({
    where: { id: data.id },
    data: {
      status: 'AVAILABLE',
      closedAt: new Date(data.closedAt || Date.now()),
      closedBy: data.closedBy,
      updatedAt: new Date(),
    },
  });
}

/**
 * Create inventory transaction
 */
async function createInventoryTransaction(data: any, branchId: string): Promise<void> {
  await db.inventoryTransaction.create({
    data: {
      id: data.id,
      branchId,
      ingredientId: data.ingredientId,
      transactionType: data.transactionType,
      quantityChange: data.quantityChange,
      stockBefore: data.stockBefore,
      stockAfter: data.stockAfter,
      orderId: data.orderId || null,
      reason: data.reason || null,
      createdBy: data.createdBy,
      createdAt: new Date(data.createdAt),
    },
  });
}

/**
 * Update customer
 */
async function updateCustomer(data: any, branchId: string): Promise<void> {
  // Get existing customer for conflict detection
  const existingCustomer = await db.customer.findUnique({
    where: { id: data.id },
  });

  if (existingCustomer) {
    // Check for conflicts
    const conflict = await conflictManager.detectConflict(
      'Customer',
      data.id,
      data,
      existingCustomer,
      'UPDATE_CUSTOMER'
    );

    if (conflict) {
      // Auto-resolve using default strategy (LAST_WRITE_WINS for updates)
      const resolved = await conflictManager.resolveConflict(
        conflict.id,
        ResolutionStrategy.LAST_WRITE_WINS,
        'auto-resolver'
      );

      console.log(`[BatchPush] Resolved conflict for customer ${data.id} using LAST_WRITE_WINS`);

      // Use resolved data for the update
      if (resolved.resolvedData) {
        data = { ...data, ...resolved.resolvedData };
      }
    }
  }

  await db.customer.update({
    where: { id: data.id },
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone,
      notes: data.notes || null,
      updatedAt: new Date(),
    },
  });

  // Update addresses if provided
  if (data.addresses && Array.isArray(data.addresses)) {
    for (const addr of data.addresses) {
      if (addr.id) {
        // Update existing address
        await db.customerAddress.update({
          where: { id: addr.id },
          data: {
            building: addr.building || null,
            streetAddress: addr.streetAddress,
            floor: addr.floor || null,
            apartment: addr.apartment || null,
            deliveryAreaId: addr.deliveryAreaId || null,
            isDefault: addr.isDefault || false,
          },
        });
      } else {
        // Create new address
        await db.customerAddress.create({
          data: {
            customerId: data.id,
            building: addr.building || null,
            streetAddress: addr.streetAddress,
            floor: addr.floor || null,
            apartment: addr.apartment || null,
            deliveryAreaId: addr.deliveryAreaId || null,
            isDefault: addr.isDefault || false,
          },
        });
      }
    }
  }
}

/**
 * Create ingredient
 */
async function createIngredient(data: any, branchId: string): Promise<void> {
  // Check if ingredient already exists by name
  const existingIngredient = await db.ingredient.findFirst({
    where: {
      name: data.name,
    },
  });

  let ingredientId: string;

  if (existingIngredient) {
    // Ingredient exists, use their ID
    ingredientId = existingIngredient.id;
    console.log(`[BatchPush] Ingredient with name ${data.name} already exists: ${ingredientId}`);

    // Update branch inventory if provided
    if (data.initialStock !== undefined && branchId) {
      const existingInventory = await db.branchInventory.findFirst({
        where: {
          branchId,
          ingredientId,
        },
      });

      if (existingInventory) {
        await db.branchInventory.update({
          where: { id: existingInventory.id },
          data: {
            currentStock: parseFloat(data.initialStock),
            lastRestockAt: new Date(),
            lastModifiedAt: new Date(),
          },
        });
      } else {
        await db.branchInventory.create({
          data: {
            branchId,
            ingredientId,
            currentStock: parseFloat(data.initialStock),
            lastRestockAt: new Date(),
            lastModifiedAt: new Date(),
          },
        });
      }
    }
  } else {
    // Create new ingredient
    const ingredientData: any = {
      name: data.name,
      unit: data.unit,
      costPerUnit: parseFloat(data.costPerUnit),
      reorderThreshold: parseFloat(data.reorderThreshold),
      isActive: data.isActive !== undefined ? data.isActive : true,
      categoryId: data.categoryId || null,
    };

    // Only use provided ID if it's not a temporary ID
    if (data.id && !data.id.startsWith('temp-')) {
      ingredientData.id = data.id;
    }

    const createdIngredient = await db.ingredient.create({
      data: ingredientData,
    });

    ingredientId = createdIngredient.id;
    console.log('[BatchPush] Ingredient created successfully:', createdIngredient);

    // Handle initial stock for branch inventory
    if (data.initialStock !== undefined && branchId) {
      const stockValue = parseFloat(data.initialStock);

      await db.branchInventory.create({
        data: {
          branchId,
          ingredientId,
          currentStock: stockValue,
          lastRestockAt: new Date(),
          lastModifiedAt: new Date(),
        },
      });
    }
  }

  // Map temp ID to real ID for future operations
  if (data.id && data.id.startsWith('temp-')) {
    tempIdToRealIdMap.set(data.id, ingredientId);
    console.log(`[BatchPush] Mapped temp ingredient ID ${data.id} to real ID ${ingredientId}`);
  }
}

/**
 * Update ingredient
 */
async function updateIngredient(data: any, branchId: string): Promise<void> {
  await db.ingredient.update({
    where: { id: data.id },
    data: {
      name: data.name,
      unit: data.unit,
      costPerUnit: parseFloat(data.costPerUnit),
      reorderThreshold: parseFloat(data.reorderThreshold),
      categoryId: data.categoryId || null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Create menu item
 */
async function createMenuItem(data: any, branchId: string): Promise<void> {
  // Check if menu item already exists by name
  const existingItem = await db.menuItem.findFirst({
    where: {
      name: data.name,
    },
  });

  let menuItemId: string;

  if (existingItem) {
    // Menu item exists, use their ID
    menuItemId = existingItem.id;
    console.log(`[BatchPush] Menu item with name ${data.name} already exists: ${menuItemId}`);
  } else {
    // Create new menu item
    const menuItemData: any = {
      name: data.name,
      category: data.category || 'Other',
      categoryId: data.categoryId || null,
      price: parseFloat(data.price),
      taxRate: data.taxRate !== undefined ? parseFloat(data.taxRate) : 0.14,
      isActive: data.isActive !== undefined ? data.isActive : true,
      sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder) : null,
      hasVariants: data.hasVariants || false,
    };

    // Only use provided ID if it's not a temporary ID
    if (data.id && !data.id.startsWith('temp-')) {
      menuItemData.id = data.id;
    }

    const createdMenuItem = await db.menuItem.create({
      data: menuItemData,
    });

    menuItemId = createdMenuItem.id;
    console.log('[BatchPush] Menu item created successfully:', createdMenuItem);
  }

  // Map temp ID to real ID for future operations
  if (data.id && data.id.startsWith('temp-')) {
    tempIdToRealIdMap.set(data.id, menuItemId);
    console.log(`[BatchPush] Mapped temp menu item ID ${data.id} to real ID ${menuItemId}`);
  }
}

/**
 * Update menu item
 */
async function updateMenuItem(data: any, branchId: string): Promise<void> {
  await db.menuItem.update({
    where: { id: data.id },
    data: {
      name: data.name,
      category: data.category,
      categoryId: data.categoryId || null,
      price: parseFloat(data.price),
      taxRate: data.taxRate !== undefined ? parseFloat(data.taxRate) : 0.14,
      isActive: data.isActive !== undefined ? data.isActive : true,
      sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder) : null,
      hasVariants: data.hasVariants || false,
      updatedAt: new Date(),
    },
  });
}

/**
 * Create transfer
 */
async function createTransfer(data: any, branchId: string): Promise<void> {
  // Handle fromBranchId and toBranchId - check if they're temp IDs
  let fromBranchId = data.fromBranchId;
  let toBranchId = data.toBranchId;

  if (fromBranchId && fromBranchId.startsWith('temp-')) {
    const realId = tempIdToRealIdMap.get(fromBranchId);
    if (realId) {
      fromBranchId = realId;
    }
  }

  if (toBranchId && toBranchId.startsWith('temp-')) {
    const realId = tempIdToRealIdMap.get(toBranchId);
    if (realId) {
      toBranchId = realId;
    }
  }

  await db.transfer.create({
    data: {
      id: data.id,
      fromBranchId,
      toBranchId,
      ingredientId: data.ingredientId,
      quantity: parseFloat(data.quantity),
      requestedBy: data.requestedBy,
      approvedBy: data.approvedBy || null,
      status: data.status || 'PENDING',
      requestedAt: new Date(data.requestedAt || data.createdAt),
      approvedAt: data.approvedAt ? new Date(data.approvedAt) : null,
      notes: data.notes || null,
      createdAt: new Date(data.createdAt),
    },
  });
}

/**
 * Create purchase order
 */
async function createPurchaseOrder(data: any, branchId: string): Promise<void> {
  // Handle supplierId - check if it's a temp ID
  let supplierId = data.supplierId;
  if (supplierId && supplierId.startsWith('temp-')) {
    const realId = tempIdToRealIdMap.get(supplierId);
    if (realId) {
      supplierId = realId;
    }
  }

  const purchaseOrderData: any = {
    id: data.id,
    branchId,
    supplierId: supplierId || null,
    orderNumber: data.orderNumber,
    status: data.status || 'PENDING',
    totalAmount: data.totalAmount ? parseFloat(data.totalAmount) : 0,
    expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
    notes: data.notes || null,
    createdAt: new Date(data.createdAt),
  };

  const purchaseOrder = await db.purchaseOrder.create({
    data: purchaseOrderData,
  });

  // Create purchase order items if provided
  if (data.items && Array.isArray(data.items)) {
    await db.purchaseOrderItem.createMany({
      data: data.items.map((item: any) => ({
        purchaseOrderId: purchaseOrder.id,
        ingredientId: item.ingredientId,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        receivedQuantity: item.receivedQuantity ? parseFloat(item.receivedQuantity) : 0,
      })),
    });
  }
}

/**
 * Update purchase order
 */
async function updatePurchaseOrder(data: any, branchId: string): Promise<void> {
  await db.purchaseOrder.update({
    where: { id: data.id },
    data: {
      status: data.status,
      totalAmount: data.totalAmount ? parseFloat(data.totalAmount) : undefined,
      expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
      actualDeliveryDate: data.actualDeliveryDate ? new Date(data.actualDeliveryDate) : undefined,
      notes: data.notes || undefined,
      updatedAt: new Date(),
    },
  });
}

/**
 * Create receipt settings
 */
async function createReceiptSettings(data: any): Promise<void> {
  await db.receiptSettings.create({
    data: {
      id: data.id || undefined,
      storeName: data.storeName,
      branchName: data.branchName,
      headerText: data.headerText || null,
      footerText: data.footerText || null,
      thankYouMessage: data.thankYouMessage || null,
      fontSize: data.fontSize || 'medium',
      showLogo: data.showLogo || false,
      showCashier: data.showCashier || false,
      showDateTime: data.showDateTime || false,
      showOrderType: data.showOrderType || false,
      showCustomerInfo: data.showCustomerInfo || false,
      openCashDrawer: data.openCashDrawer || false,
      cutPaper: data.cutPaper || false,
      cutType: data.cutType || 'full',
      paperWidth: data.paperWidth || 80,
    },
  });
}

/**
 * Update receipt settings
 */
async function updateReceiptSettings(data: any): Promise<void> {
  await db.receiptSettings.update({
    where: { id: data.id },
    data: {
      storeName: data.storeName,
      branchName: data.branchName,
      headerText: data.headerText || null,
      footerText: data.footerText || null,
      thankYouMessage: data.thankYouMessage || null,
      fontSize: data.fontSize || 'medium',
      showLogo: data.showLogo || false,
      showCashier: data.showCashier || false,
      showDateTime: data.showDateTime || false,
      showOrderType: data.showOrderType || false,
      showCustomerInfo: data.showCustomerInfo || false,
      openCashDrawer: data.openCashDrawer || false,
      cutPaper: data.cutPaper || false,
      cutType: data.cutType || 'full',
      paperWidth: data.paperWidth || 80,
      updatedAt: new Date(),
    },
  });
}

