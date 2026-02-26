/**
 * Local Storage Service
 * Manages offline data storage using localStorage
 * Supports sync operations, data caching, and offline queue management
 */

// ============================================
// TYPES & INTERFACES
// ============================================

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
  CREATE_INVENTORY = 'CREATE_INVENTORY',
  CREATE_WASTE = 'CREATE_WASTE',
  UPDATE_USER = 'UPDATE_USER',
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

// Storage keys
const STORAGE_KEYS = {
  OPERATIONS_QUEUE: 'sync_operations_queue',
  SYNC_STATE: 'sync_state',
  MENU_ITEMS: 'menu_items',
  INGREDIENTS: 'ingredients',
  CATEGORIES: 'categories',
  USERS: 'users',
  ORDERS: 'orders',
  SHIFTS: 'shifts',
  WASTE_LOGS: 'waste_logs',
  BRANCHES: 'branches',
  DELIVERY_AREAS: 'delivery_areas',
  CUSTOMERS: 'customers',
  CUSTOMER_ADDRESSES: 'customer_addresses',
  COURIERS: 'couriers',
  RECEIPT_SETTINGS: 'receipt_settings',
  TABLES: 'tables',
  DAILY_EXPENSES: 'daily_expenses',
  PROMO_CODES: 'promo_codes',
  INVENTORY: 'inventory',
};

// ============================================
// LOCAL STORAGE SERVICE CLASS
// ============================================

class LocalStorageService {
  private initialized: boolean = false;

  /**
   * Initialize the storage service
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize sync state if not exists
    if (!localStorage.getItem(STORAGE_KEYS.SYNC_STATE)) {
      await this.updateSyncState({
        branchId: '',
        isOnline: true,
        lastPullTimestamp: 0,
        lastPushTimestamp: 0,
        pendingOperations: 0,
      });
    }

    // Initialize operations queue if not exists
    if (!localStorage.getItem(STORAGE_KEYS.OPERATIONS_QUEUE)) {
      localStorage.setItem(STORAGE_KEYS.OPERATIONS_QUEUE, JSON.stringify([]));
    }

    this.initialized = true;
    console.log('[LocalStorageService] Initialized');
  }

  /**
   * Get sync state
   */
  async getSyncState(): Promise<SyncState | null> {
    try {
      const stateStr = localStorage.getItem(STORAGE_KEYS.SYNC_STATE);
      if (!stateStr) return null;
      return JSON.parse(stateStr) as SyncState;
    } catch (error) {
      console.error('[LocalStorageService] Error getting sync state:', error);
      return null;
    }
  }

  /**
   * Update sync state
   */
  async updateSyncState(updates: Partial<SyncState>): Promise<void> {
    try {
      const currentState = await this.getSyncState();
      const newState = { ...currentState, ...updates } as SyncState;
      localStorage.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify(newState));
    } catch (error) {
      console.error('[LocalStorageService] Error updating sync state:', error);
    }
  }

  /**
   * Add operation to queue
   */
  async addOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      const queue = await this.getPendingOperations();
      const newOperation: SyncOperation = {
        ...operation,
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };
      queue.push(newOperation);
      localStorage.setItem(STORAGE_KEYS.OPERATIONS_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('[LocalStorageService] Error adding operation:', error);
    }
  }

  /**
   * Get all pending operations
   */
  async getPendingOperations(): Promise<SyncOperation[]> {
    try {
      const queueStr = localStorage.getItem(STORAGE_KEYS.OPERATIONS_QUEUE);
      if (!queueStr) return [];
      return JSON.parse(queueStr) as SyncOperation[];
    } catch (error) {
      console.error('[LocalStorageService] Error getting pending operations:', error);
      return [];
    }
  }

  /**
   * Get all operations (alias for getPendingOperations)
   */
  async getAllOperations(): Promise<SyncOperation[]> {
    return this.getPendingOperations();
  }

  /**
   * Get pending operations count
   */
  async getPendingOperationsCount(): Promise<number> {
    const operations = await this.getPendingOperations();
    return operations.length;
  }

  /**
   * Remove operation from queue
   */
  async removeOperation(operationId: string): Promise<void> {
    try {
      const queue = await this.getPendingOperations();
      const filtered = queue.filter(op => op.id !== operationId);
      localStorage.setItem(STORAGE_KEYS.OPERATIONS_QUEUE, JSON.stringify(filtered));
    } catch (error) {
      console.error('[LocalStorageService] Error removing operation:', error);
    }
  }

  /**
   * Delete operation (alias for removeOperation)
   */
  async deleteOperation(operationId: string): Promise<void> {
    return this.removeOperation(operationId);
  }

  /**
   * Update operation
   */
  async updateOperation(operation: SyncOperation): Promise<void> {
    try {
      const queue = await this.getPendingOperations();
      const index = queue.findIndex(op => op.id === operation.id);
      if (index !== -1) {
        queue[index] = operation;
        localStorage.setItem(STORAGE_KEYS.OPERATIONS_QUEUE, JSON.stringify(queue));
      }
    } catch (error) {
      console.error('[LocalStorageService] Error updating operation:', error);
    }
  }

  // ============================================
  // DATA CACHING METHODS
  // ============================================

  /**
   * Save menu items
   */
  async batchSaveMenuItems(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(items));
      console.log('[LocalStorageService] Saved', items.length, 'menu items');
    } catch (error) {
      console.error('[LocalStorageService] Error saving menu items:', error);
    }
  }

  /**
   * Get menu items
   */
  async getMenuItems(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.MENU_ITEMS);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting menu items:', error);
      return [];
    }
  }

  /**
   * Save ingredients
   */
  async batchSaveIngredients(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving ingredients:', error);
    }
  }

  /**
   * Get ingredients
   */
  async getIngredients(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.INGREDIENTS);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting ingredients:', error);
      return [];
    }
  }

  /**
   * Save categories
   */
  async batchSaveCategories(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving categories:', error);
    }
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting categories:', error);
      return [];
    }
  }

  /**
   * Save users
   */
  async batchSaveUsers(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving users:', error);
    }
  }

  /**
   * Get users
   */
  async getUsers(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.USERS);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting users:', error);
      return [];
    }
  }

  /**
   * Save orders
   */
  async batchSaveOrders(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving orders:', error);
    }
  }

  /**
   * Get orders
   */
  async getOrders(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting orders:', error);
      return [];
    }
  }

  /**
   * Save shifts
   */
  async batchSaveShifts(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving shifts:', error);
    }
  }

  /**
   * Get shifts
   */
  async getShifts(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting shifts:', error);
      return [];
    }
  }

  /**
   * Save waste logs
   */
  async batchSaveWasteLogs(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.WASTE_LOGS, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving waste logs:', error);
    }
  }

  /**
   * Get waste logs
   */
  async getWasteLogs(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.WASTE_LOGS);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting waste logs:', error);
      return [];
    }
  }

  /**
   * Save branches
   */
  async batchSaveBranches(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.BRANCHES, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving branches:', error);
    }
  }

  /**
   * Get branches
   */
  async getBranches(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.BRANCHES);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting branches:', error);
      return [];
    }
  }

  /**
   * Save delivery areas
   */
  async batchSaveDeliveryAreas(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.DELIVERY_AREAS, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving delivery areas:', error);
    }
  }

  /**
   * Get delivery areas
   */
  async getDeliveryAreas(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.DELIVERY_AREAS);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting delivery areas:', error);
      return [];
    }
  }

  /**
   * Save customers
   */
  async batchSaveCustomers(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving customers:', error);
    }
  }

  /**
   * Get customers
   */
  async getCustomers(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting customers:', error);
      return [];
    }
  }

  /**
   * Save customer addresses
   */
  async batchSaveCustomerAddresses(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMER_ADDRESSES, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving customer addresses:', error);
    }
  }

  /**
   * Get customer addresses
   */
  async getCustomerAddresses(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.CUSTOMER_ADDRESSES);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting customer addresses:', error);
      return [];
    }
  }

  /**
   * Save couriers
   */
  async batchSaveCouriers(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.COURIERS, JSON.stringify(items));
    } catch (error) {
      console.error('[LocalStorageService] Error saving couriers:', error);
    }
  }

  /**
   * Get couriers
   */
  async getCouriers(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.COURIERS);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting couriers:', error);
      return [];
    }
  }

  /**
   * Save receipt settings
   */
  async saveReceiptSettings(settings: any): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.RECEIPT_SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('[LocalStorageService] Error saving receipt settings:', error);
    }
  }

  /**
   * Get receipt settings
   */
  async getReceiptSettings(): Promise<any | null> {
    try {
      const settingsStr = localStorage.getItem(STORAGE_KEYS.RECEIPT_SETTINGS);
      return settingsStr ? JSON.parse(settingsStr) : null;
    } catch (error) {
      console.error('[LocalStorageService] Error getting receipt settings:', error);
      return null;
    }
  }

  /**
   * Clear all cached data
   */
  async clearAllData(): Promise<void> {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('[LocalStorageService] All data cleared');
    } catch (error) {
      console.error('[LocalStorageService] Error clearing data:', error);
    }
  }

  // ============================================
  // ADDITIONAL METHODS FOR POS INTERFACE
  // ============================================

  /**
   * Save a single order (used by POS interface for offline orders)
   */
  async saveOrder(order: any): Promise<void> {
    try {
      const orders = await this.getOrders();
      const index = orders.findIndex((o: any) => o.id === order.id);
      if (index >= 0) {
        orders[index] = order;
      } else {
        orders.push(order);
      }
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      console.log('[LocalStorageService] Saved order:', order.id);
    } catch (error) {
      console.error('[LocalStorageService] Error saving order:', error);
    }
  }

  /**
   * Save a single shift (used by POS interface for offline shifts)
   */
  async saveShift(shift: any): Promise<void> {
    try {
      const shifts = await this.getShifts();
      const index = shifts.findIndex((s: any) => s.id === shift.id);
      if (index >= 0) {
        shifts[index] = shift;
      } else {
        shifts.push(shift);
      }
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
      console.log('[LocalStorageService] Saved shift:', shift.id);
    } catch (error) {
      console.error('[LocalStorageService] Error saving shift:', error);
    }
  }

  /**
   * Get all menu items (alias for getMenuItems)
   */
  async getAllMenuItems(): Promise<any[]> {
    return this.getMenuItems();
  }

  /**
   * Get all shifts (alias for getShifts)
   */
  async getAllShifts(): Promise<any[]> {
    return this.getShifts();
  }

  /**
   * Get all orders (alias for getOrders)
   */
  async getAllOrders(): Promise<any[]> {
    return this.getOrders();
  }

  /**
   * Get all waste logs (alias for getWasteLogs)
   */
  async getAllWasteLogs(): Promise<any[]> {
    return this.getWasteLogs();
  }

  /**
   * Get all branches (alias for getBranches)
   */
  async getAllBranches(): Promise<any[]> {
    return this.getBranches();
  }

  /**
   * Get all delivery areas (alias for getDeliveryAreas)
   */
  async getAllDeliveryAreas(): Promise<any[]> {
    return this.getDeliveryAreas();
  }

  /**
   * Get all customers (alias for getCustomers)
   */
  async getAllCustomers(): Promise<any[]> {
    return this.getCustomers();
  }

  /**
   * Get all customer addresses (alias for getCustomerAddresses)
   */
  async getAllCustomerAddresses(): Promise<any[]> {
    return this.getCustomerAddresses();
  }

  /**
   * Get all couriers (alias for getCouriers)
   */
  async getAllCouriers(): Promise<any[]> {
    return this.getCouriers();
  }

  /**
   * Batch save tables
   */
  async batchSaveTables(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(items));
      console.log('[LocalStorageService] Saved', items.length, 'tables');
    } catch (error) {
      console.error('[LocalStorageService] Error saving tables:', error);
    }
  }

  /**
   * Get all tables
   */
  async getAllTables(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.TABLES);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting tables:', error);
      return [];
    }
  }

  /**
   * Batch save daily expenses
   */
  async batchSaveDailyExpenses(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.DAILY_EXPENSES, JSON.stringify(items));
      console.log('[LocalStorageService] Saved', items.length, 'daily expenses');
    } catch (error) {
      console.error('[LocalStorageService] Error saving daily expenses:', error);
    }
  }

  /**
   * Get all daily expenses
   */
  async getAllDailyExpenses(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.DAILY_EXPENSES);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting daily expenses:', error);
      return [];
    }
  }

  /**
   * Batch save inventory
   */
  async batchSaveInventory(items: any[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(items));
      console.log('[LocalStorageService] Saved', items.length, 'inventory records');
    } catch (error) {
      console.error('[LocalStorageService] Error saving inventory:', error);
    }
  }

  /**
   * Get all inventory
   */
  async getAllInventory(): Promise<any[]> {
    try {
      const itemsStr = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      return itemsStr ? JSON.parse(itemsStr) : [];
    } catch (error) {
      console.error('[LocalStorageService] Error getting inventory:', error);
      return [];
    }
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================

const localStorageService = new LocalStorageService();

export function getLocalStorageService(): LocalStorageService {
  return localStorageService;
}

export { LocalStorageService };
export default localStorageService;
