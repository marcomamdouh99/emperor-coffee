/**
 * IndexedDB Storage Service for Offline-First POS
 * Replaces localStorage with proper IndexedDB for better performance and larger storage capacity
 * Supports all POS data types with proper indexing and transaction handling
 */

// Database configuration
const DB_NAME = 'emperor-pos-db';
const DB_VERSION = 1;
const STORES = [
  'sync_operations',
  'sync_state',
  'menu_items',
  'categories',
  'ingredients',
  'recipes',
  'users',
  'orders',
  'shifts',
  'waste_logs',
  'branches',
  'delivery_areas',
  'customers',
  'customer_addresses',
  'couriers',
  'receipt_settings',
  'tables',
  'daily_expenses',
  'promo_codes',
  'inventory',
] as const;

// Operation types
export enum OperationType {
  CREATE_ORDER = 'CREATE_ORDER',
  UPDATE_ORDER = 'UPDATE_ORDER',
  CREATE_CUSTOMER = 'CREATE_CUSTOMER',
  UPDATE_CUSTOMER = 'UPDATE_CUSTOMER',
  CREATE_INGREDIENT = 'CREATE_INGREDIENT',
  UPDATE_INGREDIENT = 'UPDATE_INGREDIENT',
  CREATE_MENU_ITEM = 'CREATE_MENU_ITEM',
  UPDATE_MENU_ITEM = 'UPDATE_MENU_ITEM',
  CREATE_SHIFT = 'CREATE_SHIFT',
  UPDATE_SHIFT = 'UPDATE_SHIFT',
  CLOSE_SHIFT = 'CLOSE_SHIFT',
  CREATE_WASTE_LOG = 'CREATE_WASTE_LOG',
  CREATE_TRANSFER = 'CREATE_TRANSFER',
  UPDATE_INVENTORY = 'UPDATE_INVENTORY',
  CREATE_PURCHASE_ORDER = 'CREATE_PURCHASE_ORDER',
  UPDATE_PURCHASE_ORDER = 'UPDATE_PURCHASE_ORDER',
  CREATE_RECEIPT_SETTINGS = 'CREATE_RECEIPT_SETTINGS',
  UPDATE_RECEIPT_SETTINGS = 'UPDATE_RECEIPT_SETTINGS',
  CREATE_DAILY_EXPENSE = 'CREATE_DAILY_EXPENSE',
  CREATE_VOIDED_ITEM = 'CREATE_VOIDED_ITEM',
  CREATE_PROMO_CODE = 'CREATE_PROMO_CODE',
  USE_PROMO_CODE = 'USE_PROMO_CODE',
  CREATE_LOYALTY_TRANSACTION = 'CREATE_LOYALTY_TRANSACTION',
  CREATE_TABLE = 'CREATE_TABLE',
  UPDATE_TABLE = 'UPDATE_TABLE',
  CLOSE_TABLE = 'CLOSE_TABLE',
  CREATE_INVENTORY_TRANSACTION = 'CREATE_INVENTORY_TRANSACTION',
}

export interface SyncOperation {
  id: string;
  type: OperationType;
  data: any;
  branchId: string;
  timestamp: number;
  retryCount: number;
}

export interface SyncState {
  branchId: string;
  isOnline: boolean;
  lastPullTimestamp: number;
  lastPushTimestamp: number;
  pendingOperations: number;
  lastPullFailed?: boolean;
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB database
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      if (this.db) {
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.error('[IndexedDBStorage] Failed to open database:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          console.log('[IndexedDBStorage] Database initialized successfully');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object stores with proper indexes
          STORES.forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { keyPath: 'id' });

              // Add indexes based on store type
              if (storeName === 'sync_operations') {
                store.createIndex('branchId', 'branchId', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('type', 'type', { unique: false });
              } else if (storeName === 'orders') {
                store.createIndex('branchId', 'branchId', { unique: false });
                store.createIndex('orderNumber', 'orderNumber', { unique: false });
                store.createIndex('orderTimestamp', 'orderTimestamp', { unique: false });
                store.createIndex('shiftId', 'shiftId', { unique: false });
              } else if (storeName === 'shifts') {
                store.createIndex('branchId', 'branchId', { unique: false });
                store.createIndex('cashierId', 'cashierId', { unique: false });
                store.createIndex('isClosed', 'isClosed', { unique: false });
              } else if (storeName === 'customers') {
                store.createIndex('phone', 'phone', { unique: true });
                store.createIndex('branchId', 'branchId', { unique: false });
              } else if (storeName === 'tables') {
                store.createIndex('branchId', 'branchId', { unique: false });
                store.createIndex('tableNumber', 'tableNumber', { unique: false });
                store.createIndex('status', 'status', { unique: false });
              }
            }
          });
        };
      });
    })();

    return this.initPromise;
  }

  /**
   * Get or create a store transaction
   */
  private getTransaction(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBTransaction {
    if (!this.db) {
      throw new Error('[IndexedDBStorage] Database not initialized. Call init() first.');
    }
    return this.db.transaction([storeName], mode);
  }

  /**
   * Generic get operation
   */
  async get(storeName: string, id: string): Promise<any> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic get all operation
   */
  async getAll(storeName: string): Promise<any[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic put operation (insert or update)
   */
  async put(storeName: string, data: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic batch put operation
   */
  async batchPut(storeName: string, items: any[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      let completed = 0;
      let errorOccurred = false;

      items.forEach(item => {
        const request = store.put(item);
        request.onsuccess = () => {
          completed++;
          if (completed === items.length && !errorOccurred) {
            resolve();
          }
        };
        request.onerror = () => {
          errorOccurred = true;
          reject(request.error);
        };
      });
    });
  }

  /**
   * Generic delete operation
   */
  async delete(storeName: string, id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic clear store operation
   */
  async clearStore(storeName: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Query by index
   */
  async getByIndex(storeName: string, indexName: string, value: any): Promise<any[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // SYNC OPERATIONS QUEUE
  // ============================================

  async addOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const newOperation: SyncOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    await this.put('sync_operations', newOperation);
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    const operations = await this.getAll('sync_operations');
    return operations.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getAllOperations(): Promise<SyncOperation[]> {
    return this.getPendingOperations();
  }

  async getPendingOperationsCount(): Promise<number> {
    const operations = await this.getPendingOperations();
    return operations.length;
  }

  async removeOperation(operationId: string): Promise<void> {
    await this.delete('sync_operations', operationId);
  }

  async deleteOperation(operationId: string): Promise<void> {
    return this.removeOperation(operationId);
  }

  async updateOperation(operation: SyncOperation): Promise<void> {
    await this.put('sync_operations', operation);
  }

  // ============================================
  // SYNC STATE
  // ============================================

  async getSyncState(): Promise<SyncState | null> {
    const state = await this.get('sync_state', 'current');
    return state || null;
  }

  async updateSyncState(updates: Partial<SyncState>): Promise<void> {
    const currentState = await this.getSyncState();
    const newState = { ...currentState, ...updates } as SyncState;
    newState.id = 'current';
    await this.put('sync_state', newState);
  }

  // ============================================
  // DATA CACHING METHODS
  // ============================================

  async batchSaveMenuItems(items: any[]): Promise<void> {
    await this.batchPut('menu_items', items);
  }

  async getAllMenuItems(): Promise<any[]> {
    return this.getAll('menu_items');
  }

  async batchSaveIngredients(items: any[]): Promise<void> {
    await this.batchPut('ingredients', items);
  }

  async getAllIngredients(): Promise<any[]> {
    return this.getAll('ingredients');
  }

  async batchSaveCategories(items: any[]): Promise<void> {
    await this.batchPut('categories', items);
  }

  async getAllCategories(): Promise<any[]> {
    return this.getAll('categories');
  }

  async batchSaveUsers(items: any[]): Promise<void> {
    await this.batchPut('users', items);
  }

  async getAllUsers(): Promise<any[]> {
    return this.getAll('users');
  }

  async batchSaveOrders(items: any[]): Promise<void> {
    await this.batchPut('orders', items);
  }

  async getAllOrders(): Promise<any[]> {
    return this.getAll('orders');
  }

  async batchSaveShifts(items: any[]): Promise<void> {
    await this.batchPut('shifts', items);
  }

  async getAllShifts(): Promise<any[]> {
    return this.getAll('shifts');
  }

  async batchSaveWasteLogs(items: any[]): Promise<void> {
    await this.batchPut('waste_logs', items);
  }

  async getAllWasteLogs(): Promise<any[]> {
    return this.getAll('waste_logs');
  }

  async batchSaveBranches(items: any[]): Promise<void> {
    await this.batchPut('branches', items);
  }

  async getAllBranches(): Promise<any[]> {
    return this.getAll('branches');
  }

  async batchSaveDeliveryAreas(items: any[]): Promise<void> {
    await this.batchPut('delivery_areas', items);
  }

  async getAllDeliveryAreas(): Promise<any[]> {
    return this.getAll('delivery_areas');
  }

  async batchSaveCustomers(items: any[]): Promise<void> {
    await this.batchPut('customers', items);
  }

  async getAllCustomers(): Promise<any[]> {
    return this.getAll('customers');
  }

  async batchSaveCustomerAddresses(items: any[]): Promise<void> {
    await this.batchPut('customer_addresses', items);
  }

  async getAllCustomerAddresses(): Promise<any[]> {
    return this.getAll('customer_addresses');
  }

  async batchSaveCouriers(items: any[]): Promise<void> {
    await this.batchPut('couriers', items);
  }

  async getAllCouriers(): Promise<any[]> {
    return this.getAll('couriers');
  }

  async saveReceiptSettings(settings: any): Promise<void> {
    settings.id = 'current';
    await this.put('receipt_settings', settings);
  }

  async getReceiptSettings(): Promise<any | null> {
    return this.get('receipt_settings', 'current');
  }

  async batchSaveTables(items: any[]): Promise<void> {
    await this.batchPut('tables', items);
  }

  async getAllTables(): Promise<any[]> {
    return this.getAll('tables');
  }

  async batchSaveDailyExpenses(items: any[]): Promise<void> {
    await this.batchPut('daily_expenses', items);
  }

  async getAllDailyExpenses(): Promise<any[]> {
    return this.getAll('daily_expenses');
  }

  async batchSaveInventory(items: any[]): Promise<void> {
    await this.batchPut('inventory', items);
  }

  async getAllInventory(): Promise<any[]> {
    return this.getAll('inventory');
  }

  // ============================================
  // CLEAR ALL DATA
  // ============================================

  async clearAllData(): Promise<void> {
    await this.init();
    for (const storeName of STORES) {
      await this.clearStore(storeName);
    }

    // Reinitialize sync state
    await this.updateSyncState({
      branchId: '',
      isOnline: true,
      lastPullTimestamp: 0,
      lastPushTimestamp: 0,
      pendingOperations: 0,
    });

    console.log('[IndexedDBStorage] All data cleared');
  }

  /**
   * Get database size estimate
   */
  async getStorageSize(): Promise<number> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return 0;
  }

  /**
   * Clear database completely (uninstall)
   */
  async destroy(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);

      request.onsuccess = () => {
        console.log('[IndexedDBStorage] Database destroyed');
        this.initPromise = null;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
const indexedDBStorage = new IndexedDBStorage();

export function getIndexedDBStorage(): IndexedDBStorage {
  return indexedDBStorage;
}

export { IndexedDBStorage };
export default indexedDBStorage;
