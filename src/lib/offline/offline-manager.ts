/**
 * Offline Manager Service
 * Manages online/offline detection, operation queuing, and automatic sync
 * Allows branches to work offline for weeks and sync when back online
 * Uses IndexedDB for reliable offline storage
 */

import { getIndexedDBStorage, OperationType, SyncOperation, SyncState } from '../storage/indexeddb-storage';
import { dataExpirationService } from './data-expiration';

const storageService = getIndexedDBStorage();

// Sync status for UI
export enum SyncStatus {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

// Sync result interface
export interface SyncResult {
  success: boolean;
  operationsProcessed: number;
  operationsFailed: number;
  errors: string[];
  timestamp: number;
}

// Configuration
const CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  SYNC_INTERVAL: 30000, // 30 seconds
  RETRY_DELAY: 5000, // 5 seconds
  BATCH_SIZE: 50, // Process 50 operations at a time
};

// Event listeners type
type OfflineEventListener = (status: SyncStatus, data?: any) => void;

class OfflineManager {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncStatus: SyncStatus = SyncStatus.IDLE;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;
  private listeners: OfflineEventListener[] = [];
  private branchId: string = '';
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private skipFirstAutoSync: boolean = false;

  /**
   * Initialize offline manager
   */
  async initialize(branchId: string): Promise<void> {
    // Return existing promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // If already initialized with same branch, return
    if (this.initialized && this.branchId === branchId) {
      console.log('[OfflineManager] Already initialized for branch:', branchId);
      return Promise.resolve();
    }

    this.initializationPromise = (async () => {
      this.branchId = branchId;

      // Initialize local storage
      await storageService.init();

      // Check actual network connectivity
      await this.checkActualConnectivity();

      // Set up online/offline event listeners
      if (typeof window !== 'undefined') {
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
      }

      // Load sync state
      const syncState = await storageService.getSyncState();
      if (!syncState) {
        await storageService.updateSyncState({
          branchId: this.branchId,
          isOnline: this.isOnline,
          lastPullTimestamp: 0,
          lastPushTimestamp: 0,
          pendingOperations: 0,
        });
      }

      // Update online status in sync state
      await storageService.updateSyncState({ isOnline: this.isOnline });

      this.initialized = true;

      console.log('[OfflineManager] Initialized - Online:', this.isOnline, 'Branch:', branchId);

      // If online, start auto-sync (but skip the first interval to avoid race with manual sync)
      if (this.isOnline) {
        this.skipFirstAutoSync = true; // Skip first auto-sync interval
        this.startAutoSync();
      } else {
        this.notifyListeners(SyncStatus.OFFLINE, { message: 'You are offline' });
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Check actual network connectivity
   */
  async checkActualConnectivity(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch('/api/branches', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      this.isOnline = true;
      await storageService.updateSyncState({ isOnline: true });
    } catch (err) {
      console.log('[OfflineManager] Network check failed, setting offline');
      this.isOnline = false;
      await storageService.updateSyncState({ isOnline: false });
    }
  }

  /**
   * Handle online event
   */
  private handleOnline = async (): Promise<void> => {
    console.log('[OfflineManager] Browser says online, verifying...');
    await this.checkActualConnectivity();

    if (this.isOnline) {
      console.log('[OfflineManager] Connection restored');
      await storageService.updateSyncState({ isOnline: true });
      this.notifyListeners(SyncStatus.IDLE, { message: 'Back online' });

      // Start auto-sync
      this.startAutoSync();

      // Trigger immediate sync (with small delay to ensure everything is ready)
      setTimeout(() => this.syncAll(), 1000);
    } else {
      console.log('[OfflineManager] Still offline despite browser event');
    }
  };

  /**
   * Handle offline event
   */
  private handleOffline = async (): Promise<void> => {
    console.log('[OfflineManager] Connection lost');
    this.isOnline = false;
    await storageService.updateSyncState({ isOnline: false });
    this.stopAutoSync();
    this.notifyListeners(SyncStatus.OFFLINE, { message: 'You are offline' });
  };

  /**
   * Start auto-sync interval
   */
  private startAutoSync(): void {
    if (this.syncInterval) {
      return;
    }

    this.syncInterval = setInterval(async () => {
      // Skip first auto-sync if flag is set (to avoid race with manual sync)
      if (this.skipFirstAutoSync) {
        this.skipFirstAutoSync = false;
        console.log('[OfflineManager] Skipping first auto-sync interval');
        return;
      }

      if (this.isOnline && !this.isSyncing) {
        await this.syncAll();
      }
    }, CONFIG.SYNC_INTERVAL);
  }

  /**
   * Stop auto-sync interval
   */
  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(status: SyncStatus, data?: any): void {
    this.syncStatus = status;
    this.listeners.forEach(listener => listener(status, data));
  }

  /**
   * Add event listener
   */
  addEventListener(listener: OfflineEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: OfflineEventListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.syncStatus;
  }

  /**
   * Check if online
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get pending operations count
   */
  async getPendingOperationsCount(): Promise<number> {
    return storageService.getPendingOperationsCount();
  }

  /**
   * Queue an operation for sync
   */
  async queueOperation(type: OperationType, data: any): Promise<void> {
    // Store operation locally
    await storageService.addOperation({
      type,
      data,
      branchId: this.branchId,
    });

    // Update pending count
    const count = await this.getPendingOperationsCount();
    await storageService.updateSyncState({ pendingOperations: count });

    // If online, trigger sync
    if (this.isOnline && !this.isSyncing) {
      this.syncAll();
    }
  }

  /**
   * Sync all pending operations
   */
  async syncAll(): Promise<SyncResult> {
    // Check if sync is already in progress
    if (this.isSyncing) {
      console.log('[OfflineManager] Sync already in progress, skipping');
      return {
        success: false,
        operationsProcessed: 0,
        operationsFailed: 0,
        errors: ['Sync already in progress'],
        timestamp: Date.now(),
      };
    }

    if (!this.isOnline) {
      console.log('[OfflineManager] Currently offline - cannot sync');
      return {
        success: false,
        operationsProcessed: 0,
        operationsFailed: 0,
        errors: ['Offline - cannot sync'],
        timestamp: Date.now(),
      };
    }

    this.isSyncing = true;
    this.notifyListeners(SyncStatus.SYNCING, { message: 'Syncing...' });

    // Safety timeout to clear lock if sync gets stuck (60 seconds)
    const timeoutId = setTimeout(() => {
      if (this.isSyncing) {
        console.warn('[OfflineManager] Sync timeout, clearing lock');
        this.isSyncing = false;
      }
    }, 60000);

    try {
      console.log('[OfflineManager] Starting sync...');

      // First, try to pull latest data from server (non-blocking on failure)
      await this.pullData();

      // Then, push pending operations
      const result = await this.pushOperations();

      // Update sync state
      await storageService.updateSyncState({
        lastPushTimestamp: Date.now(),
        pendingOperations: await this.getPendingOperationsCount(),
      });

      // Consider sync successful if no critical errors
      const hasCriticalErrors = result.errors.some(e =>
        e.includes('offline') || e.includes('network')
      );

      if (result.operationsFailed > 0 && !hasCriticalErrors) {
        // Some operations failed but not critical
        this.notifyListeners(SyncStatus.SUCCESS, {
          message: 'Sync completed with some warnings'
        });
      } else if (result.success || result.operationsProcessed > 0) {
        this.notifyListeners(SyncStatus.SUCCESS, { message: 'Sync completed' });
      } else {
        this.notifyListeners(SyncStatus.ERROR, { message: 'Sync completed with errors', errors: result.errors });
      }

      console.log('[OfflineManager] Sync completed:', result);
      return result;
    } catch (error) {
      console.error('[OfflineManager] Sync error:', error);
      this.notifyListeners(SyncStatus.ERROR, { message: 'Sync failed', error });
      return {
        success: false,
        operationsProcessed: 0,
        operationsFailed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        timestamp: Date.now(),
      };
    } finally {
      clearTimeout(timeoutId);
      this.isSyncing = false;
    }
  }

  /**
   * Pull latest data from server
   */
  private async pullData(): Promise<void> {
    // Skip pull if already tried recently or if offline
    const syncState = await storageService.getSyncState();
    const lastPull = syncState?.lastPullTimestamp || 0;
    const timeSinceLastPull = Date.now() - lastPull;
    
    // Don't pull if less than 5 minutes ago and pull failed last time
    if (timeSinceLastPull < 300000 && syncState?.lastPullFailed) {
      console.log('[OfflineManager] Skipping pull - tried recently and failed');
      return;
    }

    try {
      const response = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: this.branchId,
          force: false,
        }),
      });

      if (!response.ok) {
        console.log('[OfflineManager] Pull API not available:', response.status);
        await storageService.updateSyncState({ 
          lastPullFailed: true,
          lastPullTimestamp: Date.now()
        });
        // Don't throw - this is expected on Vercel old deployment
        return;
      }

      const result = await response.json();

      // Store pulled data locally
      if (result.data) {
        if (result.data.menuItems && Array.isArray(result.data.menuItems)) {
          await storageService.batchSaveMenuItems(result.data.menuItems);
          console.log('[OfflineManager] Saved', result.data.menuItems.length, 'menu items');
        }
        if (result.data.ingredients && Array.isArray(result.data.ingredients)) {
          await storageService.batchSaveIngredients(result.data.ingredients);
          console.log('[OfflineManager] Saved', result.data.ingredients.length, 'ingredients');
        }
        if (result.data.categories && Array.isArray(result.data.categories)) {
          await storageService.batchSaveCategories(result.data.categories);
          console.log('[OfflineManager] Saved', result.data.categories.length, 'categories');
        }
        if (result.data.users && Array.isArray(result.data.users)) {
          await storageService.batchSaveUsers(result.data.users);
          console.log('[OfflineManager] Saved', result.data.users.length, 'users');
        }
        if (result.data.orders && Array.isArray(result.data.orders)) {
          await storageService.batchSaveOrders(result.data.orders);
          console.log('[OfflineManager] Saved', result.data.orders.length, 'orders');
        }
        if (result.data.shifts && Array.isArray(result.data.shifts)) {
          await storageService.batchSaveShifts(result.data.shifts);
          console.log('[OfflineManager] Saved', result.data.shifts.length, 'shifts');
        }
        if (result.data.wasteLogs && Array.isArray(result.data.wasteLogs)) {
          await storageService.batchSaveWasteLogs(result.data.wasteLogs);
          console.log('[OfflineManager] Saved', result.data.wasteLogs.length, 'waste logs');
        }
        if (result.data.branches && Array.isArray(result.data.branches)) {
          await storageService.batchSaveBranches(result.data.branches);
          console.log('[OfflineManager] Saved', result.data.branches.length, 'branches');
        }
        if (result.data.deliveryAreas && Array.isArray(result.data.deliveryAreas)) {
          await storageService.batchSaveDeliveryAreas(result.data.deliveryAreas);
          console.log('[OfflineManager] Saved', result.data.deliveryAreas.length, 'delivery areas');
        }
        if (result.data.customers && Array.isArray(result.data.customers)) {
          await storageService.batchSaveCustomers(result.data.customers);
          console.log('[OfflineManager] Saved', result.data.customers.length, 'customers');
        }
        if (result.data.customerAddresses && Array.isArray(result.data.customerAddresses)) {
          await storageService.batchSaveCustomerAddresses(result.data.customerAddresses);
          console.log('[OfflineManager] Saved', result.data.customerAddresses.length, 'customer addresses');
        }
        if (result.data.couriers && Array.isArray(result.data.couriers)) {
          await storageService.batchSaveCouriers(result.data.couriers);
          console.log('[OfflineManager] Saved', result.data.couriers.length, 'couriers');
        }
        if (result.data.receiptSettings) {
          await storageService.saveReceiptSettings(result.data.receiptSettings);
          console.log('[OfflineManager] Saved receipt settings');
        }
        if (result.data.tables && Array.isArray(result.data.tables)) {
          await storageService.batchSaveTables(result.data.tables);
          console.log('[OfflineManager] Saved', result.data.tables.length, 'tables');
        }
        if (result.data.inventory && Array.isArray(result.data.inventory)) {
          await storageService.batchSaveInventory(result.data.inventory);
          console.log('[OfflineManager] Saved', result.data.inventory.length, 'inventory records');
        }

        await storageService.updateSyncState({
          lastPullFailed: false,
          lastPullTimestamp: Date.now()
        });
      }

      console.log('[OfflineManager] Data pulled successfully');
    } catch (error) {
      // Silent fail - sync errors shouldn't spam console
      await storageService.updateSyncState({ 
        lastPullFailed: true,
        lastPullTimestamp: Date.now()
      });
    }
  }

  /**
   * Push pending operations to server
   */
  private async pushOperations(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      operationsProcessed: 0,
      operationsFailed: 0,
      errors: [],
      timestamp: Date.now(),
    };

    try {
      // Get pending operations in batches
      let operations = await storageService.getPendingOperations();

      while (operations.length > 0) {
        // Process batch
        const batch = operations.slice(0, CONFIG.BATCH_SIZE);
        const batchResult = await this.pushBatch(batch);

        result.operationsProcessed += batchResult.processed;
        result.operationsFailed += batchResult.failed;
        result.errors.push(...batchResult.errors);

        if (batchResult.errors.length > 0) {
          result.success = false;
        }

        // Remove successful operations
        for (const op of batch) {
          if (!batchResult.failedIds.includes(op.id)) {
            await storageService.removeOperation(op.id);
          } else {
            // Increment retry count and check if max retries exceeded
            op.retryCount += 1;

            // Check if max retries exceeded
            if (op.retryCount >= CONFIG.MAX_RETRY_ATTEMPTS) {
              console.error(`[OfflineManager] Operation ${op.id} exceeded max retries (${CONFIG.MAX_RETRY_ATTEMPTS}), will be marked as failed permanently`);
              // Operation will stay in queue but won't be retried
              // TODO: Implement failed operation cleanup
            }

            await storageService.updateOperation(op);
          }
        }

        // Get next batch
        operations = await storageService.getPendingOperations();

        // Small delay between batches
        if (operations.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return result;
    } catch (error) {
      console.error('[OfflineManager] Push error:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Push a batch of operations
   */
  private async pushBatch(operations: SyncOperation[]): Promise<{
    processed: number;
    failed: number;
    failedIds: string[];
    errors: string[];
  }> {
    const result = {
      processed: 0,
      failed: 0,
      failedIds: [] as string[],
      errors: [] as string[],
    };

    try {
      const response = await fetch('/api/sync/batch-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: this.branchId,
          operations: operations.map(op => ({
            type: op.type,
            data: op.data,
            timestamp: op.timestamp,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Batch push failed: ${response.statusText}`);
      }

      const batchResult = await response.json();

      result.processed = batchResult.processed || operations.length;
      result.failed = batchResult.failed || 0;
      result.failedIds = batchResult.failedIds || [];
      result.errors = batchResult.errors || [];

      return result;
    } catch (error) {
      console.error('[OfflineManager] Batch push error:', error);
      // Mark all as failed
      result.failed = operations.length;
      result.failedIds = operations.map(op => op.id);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Force sync (manual trigger)
   */
  async forceSync(): Promise<SyncResult> {
    console.log('[OfflineManager] Force sync triggered');
    return this.syncAll();
  }

  /**
   * Get sync state info
   */
  async getSyncInfo(): Promise<{
    isOnline: boolean;
    lastPullTimestamp: number;
    lastPushTimestamp: number;
    pendingOperations: number;
    syncStatus: SyncStatus;
  }> {
    const state = await storageService.getSyncState();
    const pendingOps = await this.getPendingOperationsCount();

    return {
      isOnline: this.isOnline,
      lastPullTimestamp: state?.lastPullTimestamp || 0,
      lastPushTimestamp: state?.lastPushTimestamp || 0,
      pendingOperations: pendingOps,
      syncStatus: this.syncStatus,
    };
  }

  /**
   * Clear all local data (reset)
   */
  async clearAllData(): Promise<void> {
    await storageService.clearAllData();
    await dataExpirationService.clearAll();
    await storageService.updateSyncState({
      branchId: this.branchId,
      isOnline: this.isOnline,
      lastPullTimestamp: 0,
      lastPushTimestamp: 0,
      pendingOperations: 0,
    });
    console.log('[OfflineManager] All data cached');
  }

  /**
   * Perform cleanup of expired data
   */
  async performCleanup(): Promise<{
    expiredRemoved: number;
    totalEntries: number;
    totalSize: number;
  }> {
    console.log('[OfflineManager] Performing data cleanup...');
    const cleanupResult = await dataExpirationService.cleanup();
    console.log('[OfflineManager] Cleanup completed:', cleanupResult);
    return cleanupResult;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return dataExpirationService.getStats();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.stopAutoSync();
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    dataExpirationService.stopCleanupInterval();
    this.listeners = [];
    this.initialized = false;
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager();
