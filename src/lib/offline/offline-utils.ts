/**
 * Offline Utilities
 * Helper functions for offline operations and error handling
 */

import { offlineManager, OperationType } from './offline-manager';

/**
 * Error classification for better retry handling
 */
export enum ErrorType {
  TRANSIENT = 'TRANSIENT',           // Temporary network issues, retry with backoff
  PERMANENT = 'PERMANENT',           // Permanent errors, don't retry
  RETRYABLE = 'RETRYABLE',           // Retryable errors with immediate retry
  VALIDATION = 'VALIDATION',         // Validation errors, don't retry
}

/**
 * Classify an error to determine retry strategy
 */
export function classifyError(error: any): ErrorType {
  if (!error) return ErrorType.TRANSIENT;

  const message = error.message || String(error);
  const status = error.status || error.statusCode;

  // Network errors - transient
  if (
    message.includes('Failed to fetch') ||
    message.includes('ERR_NAME_NOT_RESOLVED') ||
    message.includes('Network request failed') ||
    message.includes('503') ||
    message.includes('timeout')
  ) {
    return ErrorType.TRANSIENT;
  }

  // 4xx errors (except 409, 429) - validation errors, don't retry
  if (status >= 400 && status < 500) {
    if (status === 409 || status === 429) {
      return ErrorType.RETRYABLE; // Conflict or rate limit - retryable
    }
    return ErrorType.VALIDATION;
  }

  // 5xx errors - transient server issues
  if (status >= 500) {
    return ErrorType.TRANSIENT;
  }

  // Default to transient
  return ErrorType.TRANSIENT;
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(retryCount: number, baseDelay: number = 1000): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
  const delay = baseDelay * Math.pow(2, retryCount);
  // Cap at 32 seconds
  return Math.min(delay, 32000);
}

/**
 * Check if an operation should be retried based on error type and retry count
 */
export function shouldRetry(error: any, retryCount: number, maxRetries: number = 3): boolean {
  const errorType = classifyError(error);

  // Don't retry validation or permanent errors
  if (errorType === ErrorType.VALIDATION || errorType === ErrorType.PERMANENT) {
    return false;
  }

  // Check retry count
  if (retryCount >= maxRetries) {
    return false;
  }

  // Retry transient and retryable errors
  return true;
}

/**
 * Create a user-friendly error message
 */
export function getUserErrorMessage(operationType: OperationType, error: any): string {
  const errorType = classifyError(error);

  const operationNames: Record<OperationType, string> = {
    [OperationType.CREATE_ORDER]: 'Create Order',
    [OperationType.UPDATE_ORDER]: 'Update Order',
    [OperationType.CREATE_CUSTOMER]: 'Add Customer',
    [OperationType.UPDATE_CUSTOMER]: 'Update Customer',
    [OperationType.CREATE_INGREDIENT]: 'Add Ingredient',
    [OperationType.UPDATE_INGREDIENT]: 'Update Ingredient',
    [OperationType.CREATE_MENU_ITEM]: 'Add Menu Item',
    [OperationType.UPDATE_MENU_ITEM]: 'Update Menu Item',
    [OperationType.CREATE_SHIFT]: 'Start Shift',
    [OperationType.UPDATE_SHIFT]: 'Update Shift',
    [OperationType.CLOSE_SHIFT]: 'Close Shift',
    [OperationType.CREATE_WASTE_LOG]: 'Log Waste',
    [OperationType.CREATE_TRANSFER]: 'Create Transfer',
    [OperationType.UPDATE_INVENTORY]: 'Update Inventory',
    [OperationType.CREATE_PURCHASE_ORDER]: 'Create Purchase Order',
    [OperationType.UPDATE_PURCHASE_ORDER]: 'Update Purchase Order',
    [OperationType.CREATE_RECEIPT_SETTINGS]: 'Save Receipt Settings',
    [OperationType.UPDATE_RECEIPT_SETTINGS]: 'Update Receipt Settings',
    [OperationType.CREATE_DAILY_EXPENSE]: 'Add Daily Expense',
    [OperationType.CREATE_VOIDED_ITEM]: 'Void Item',
    [OperationType.CREATE_PROMO_CODE]: 'Create Promo Code',
    [OperationType.USE_PROMO_CODE]: 'Use Promo Code',
    [OperationType.CREATE_LOYALTY_TRANSACTION]: 'Loyalty Transaction',
    [OperationType.CREATE_TABLE]: 'Open Table',
    [OperationType.UPDATE_TABLE]: 'Update Table',
    [OperationType.CLOSE_TABLE]: 'Close Table',
    [OperationType.CREATE_INVENTORY_TRANSACTION]: 'Inventory Transaction',
    [OperationType.CREATE_INVENTORY]: 'Add Inventory',
    [OperationType.CREATE_WASTE]: 'Log Waste',
    [OperationType.UPDATE_USER]: 'Update User',
  };

  const operationName = operationNames[operationType] || 'Operation';

  if (errorType === ErrorType.TRANSIENT) {
    return `${operationName} failed due to network issue. Will retry automatically.`;
  } else if (errorType === ErrorType.VALIDATION) {
    return `${operationName} failed due to invalid data. Please check and try again.`;
  } else if (errorType === ErrorType.PERMANENT) {
    return `${operationName} failed permanently. Please contact support.`;
  } else {
    return `${operationName} failed: ${error.message || 'Unknown error'}`;
  }
}

/**
 * Check if device is online with a more robust check
 */
export async function isActuallyOnline(): Promise<boolean> {
  // First check navigator.onLine
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    return false;
  }

  // Try a lightweight fetch to verify connectivity
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch('/api/health', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Queue an operation with enhanced error handling
 */
export async function queueOperationWithRetry(
  type: OperationType,
  data: any,
  branchId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await offlineManager.queueOperation(type, {
      ...data,
      branchId,
      _queuedAt: Date.now(),
    });

    return { success: true };
  } catch (error) {
    const errorMessage = getUserErrorMessage(type, error);
    console.error('[Offline Utils] Failed to queue operation:', {
      type,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get pending operations count grouped by type
 */
export async function getPendingOperationsByType(): Promise<Record<OperationType, number>> {
  const storageService = await import('../storage/indexeddb-storage').then(m => m.getIndexedDBStorage());

  const operations = await storageService.getPendingOperations();
  const grouped: Record<string, number> = {};

  operations.forEach((op: any) => {
    grouped[op.type] = (grouped[op.type] || 0) + 1;
  });

  return grouped as Record<OperationType, number>;
}

/**
 * Format timestamp to relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
