/**
 * Enhanced Offline Data Hook
 * Provides data access that works both online and offline for ALL entity types
 * Supports optimistic updates and better error handling
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { offlineManager, SyncStatus } from './offline-manager';
import { getIndexedDBStorage } from '../storage/indexeddb-storage';

const indexedDBStorage = getIndexedDBStorage();

export interface OfflineDataOptions {
  apiEndpoint?: string;
  entityType: string; // NEW: Entity type to determine storage method
  initialData?: any[];
  transform?: (data: any) => any;
  dependentOn?: any[];
  enableOptimisticUpdate?: boolean; // NEW: Enable optimistic updates
}

export interface OptimisticUpdateOptions<T> {
  id: string | string[];
  optimisticData: Partial<T> | Partial<T>[];
  rollbackOnError?: boolean;
}

// Entity type to storage method mapping
const ENTITY_STORAGE_MAP: Record<string, {
  getAll: () => Promise<any[]>;
  batchSave: (items: any[]) => Promise<void>;
}> = {
  menu_items: {
    getAll: () => indexedDBStorage.getAllMenuItems(),
    batchSave: (items) => indexedDBStorage.batchSaveMenuItems(items),
  },
  categories: {
    getAll: () => indexedDBStorage.getAllCategories(),
    batchSave: (items) => indexedDBStorage.batchSaveCategories(items),
  },
  ingredients: {
    getAll: () => indexedDBStorage.getAllIngredients(),
    batchSave: (items) => indexedDBStorage.batchSaveIngredients(items),
  },
  recipes: {
    getAll: () => indexedDBStorage.getAllMenuItems(), // Reuse menu items which includes recipes
    batchSave: (items) => indexedDBStorage.batchSaveMenuItems(items),
  },
  users: {
    getAll: () => indexedDBStorage.getAllUsers(),
    batchSave: (items) => indexedDBStorage.batchSaveUsers(items),
  },
  orders: {
    getAll: () => indexedDBStorage.getAllOrders(),
    batchSave: (items) => indexedDBStorage.batchSaveOrders(items),
  },
  shifts: {
    getAll: () => indexedDBStorage.getAllShifts(),
    batchSave: (items) => indexedDBStorage.batchSaveShifts(items),
  },
  waste_logs: {
    getAll: () => indexedDBStorage.getAllWasteLogs(),
    batchSave: (items) => indexedDBStorage.batchSaveWasteLogs(items),
  },
  branches: {
    getAll: () => indexedDBStorage.getAllBranches(),
    batchSave: (items) => indexedDBStorage.batchSaveBranches(items),
  },
  delivery_areas: {
    getAll: () => indexedDBStorage.getAllDeliveryAreas(),
    batchSave: (items) => indexedDBStorage.batchSaveDeliveryAreas(items),
  },
  customers: {
    getAll: () => indexedDBStorage.getAllCustomers(),
    batchSave: (items) => indexedDBStorage.batchSaveCustomers(items),
  },
  customer_addresses: {
    getAll: () => indexedDBStorage.getAllCustomerAddresses(),
    batchSave: (items) => indexedDBStorage.batchSaveCustomerAddresses(items),
  },
  couriers: {
    getAll: () => indexedDBStorage.getAllCouriers(),
    batchSave: (items) => indexedDBStorage.batchSaveCouriers(items),
  },
  tables: {
    getAll: () => indexedDBStorage.getAllTables(),
    batchSave: (items) => indexedDBStorage.batchSaveTables(items),
  },
  daily_expenses: {
    getAll: () => indexedDBStorage.getAllDailyExpenses(),
    batchSave: (items) => indexedDBStorage.batchSaveDailyExpenses(items),
  },
  promo_codes: {
    getAll: () => indexedDBStorage.getAllPromoCodes(),
    batchSave: (items) => indexedDBStorage.batchSavePromoCodes(items),
  },
  inventory: {
    getAll: () => indexedDBStorage.getAllInventory(),
    batchSave: (items) => indexedDBStorage.batchSaveInventory(items),
  },
};

export function useOfflineData<T = any>(options: OfflineDataOptions) {
  const {
    apiEndpoint,
    entityType,
    initialData = [],
    transform,
    dependentOn = [],
    enableOptimisticUpdate = true,
  } = options;

  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [optimisticData, setOptimisticData] = useState<Record<string, any>>({});

  const getStorageMethods = useCallback(() => {
    const methods = ENTITY_STORAGE_MAP[entityType];
    if (!methods) {
      console.warn(`[useOfflineData] No storage methods for entity type: ${entityType}`);
      return null;
    }
    return methods;
  }, [entityType]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const isCurrentlyOnline = offlineManager.isCurrentlyOnline();
      setIsOffline(!isCurrentlyOnline);

      const storageMethods = getStorageMethods();

      if (isCurrentlyOnline && apiEndpoint) {
        // Try to fetch from API
        const response = await fetch(apiEndpoint);
        if (response.ok) {
          const result = await response.json();
          const transformedData = transform ? transform(result) : result;
          const finalData = Array.isArray(transformedData) ? transformedData : [transformedData];
          setData(finalData);

          // Store in IndexedDB for offline use
          if (storageMethods && Array.isArray(finalData)) {
            await storageMethods.batchSave(finalData);
          }
        } else {
          throw new Error(`API error: ${response.statusText}`);
        }
      } else {
        // Offline or no API - try to get from IndexedDB
        if (storageMethods) {
          const localData = await storageMethods.getAll();
          if (localData.length > 0) {
            setData(localData);
          } else {
            setError('No cached data available offline');
          }
        } else {
          setError('Offline and no cached data available');
        }
      }
    } catch (err) {
      console.error('[useOfflineData] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // If online fetch fails, try to fall back to IndexedDB
      if (offlineManager.isCurrentlyOnline() && apiEndpoint) {
        const storageMethods = getStorageMethods();
        if (storageMethods) {
          try {
            const localData = await storageMethods.getAll();
            if (localData.length > 0) {
              setData(localData);
              setError('Using cached data (API unavailable)');
              return;
            }
          } catch (localErr) {
            console.error('[useOfflineData] Fallback error:', localErr);
          }
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, entityType, transform, getStorageMethods, offlineManager]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependentOn]);

  // Listen for online/offline status changes
  useEffect(() => {
    const handleStatusChange = (status: SyncStatus) => {
      if (status === SyncStatus.OFFLINE) {
        setIsOffline(true);
      } else if (status === SyncStatus.IDLE || status === SyncStatus.SUCCESS) {
        setIsOffline(false);
        // Refetch when back online
        if (!offlineManager.isCurrentlyOnline()) {
          fetchData();
        }
      }
    };

    offlineManager.addEventListener(handleStatusChange);

    return () => {
      offlineManager.removeEventListener(handleStatusChange);
    };
  }, [fetchData, offlineManager]);

  /**
   * Optimistically update data
   */
  const optimisticUpdate = useCallback(<T>(options: OptimisticUpdateOptions<T>) => {
    if (!enableOptimisticUpdate) {
      console.warn('[useOfflineData] Optimistic updates are disabled');
      return;
    }

    const { id, optimisticData } = options;

    // Update local data optimistically
    setData(prevData => {
      const ids = Array.isArray(id) ? id : [id];

      return prevData.map(item => {
        if (ids.includes((item as any).id)) {
          return {
            ...item,
            ...(Array.isArray(optimisticData) ? optimisticData[0] : optimisticData),
            _optimistic: true, // Mark as optimistic update
          };
        }
        return item;
      });
    });

    // Store optimistic data for rollback
    const ids = Array.isArray(id) ? id : [id];
    ids.forEach((itemId, index) => {
      const optData = Array.isArray(optimisticData) ? optimisticData[index] : optimisticData;
      const existingData = data.find(d => (d as any).id === itemId);
      setOptimisticData(prev => ({
        ...prev,
        [itemId]: existingData,
      }));
    });
  }, [data, enableOptimisticUpdate]);

  /**
   * Rollback optimistic update
   */
  const rollbackOptimisticUpdate = useCallback((id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id];

    setData(prevData => {
      return prevData.map(item => {
        if (ids.includes((item as any).id) && optimisticData[(item as any).id]) {
          return optimisticData[(item as any).id]; // Restore original data
        }
        return item;
      });
    });

    // Clear optimistic data
    setOptimisticData(prev => {
      const newOptimisticData = { ...prev };
      ids.forEach(id => delete newOptimisticData[id]);
      return newOptimisticData;
    });
  }, [optimisticData]);

  return {
    data,
    loading,
    error,
    isOffline,
    refetch: fetchData,
    optimisticUpdate,
    rollbackOptimisticUpdate,
  };
}

/**
 * Hook for offline mutations (create, update, delete) - ENHANCED
 */
export function useOfflineMutation<T = any>(
  operationType: string,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data: T): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const isOnline = offlineManager.isCurrentlyOnline();

      if (isOnline) {
        // Online - queue operation for sync (actual sync happens in background)
        await offlineManager.queueOperation(operationType as any, data);
        const result = data as T;

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } else {
        // Offline - queue operation for sync
        await offlineManager.queueOperation(operationType as any, data);
        const result = data as T;

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      }
    } catch (err) {
      console.error('[useOfflineMutation] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      if (options?.onError) {
        options.onError(err instanceof Error ? err : new Error(errorMessage));
      }

      throw err;
    } finally {
      setLoading(false);
    }
  }, [operationType, options]);

  return {
    mutate,
    loading,
    error,
  };
}

/**
 * Convenience hook for common entity types
 */
export function useMenuItems() {
  return useOfflineData({
    entityType: 'menu_items',
    apiEndpoint: '/api/menu-items',
    transform: (response: any) => response.menuItems || [],
  });
}

export function useIngredients() {
  return useOfflineData({
    entityType: 'ingredients',
    apiEndpoint: '/api/ingredients',
    transform: (response: any) => response.ingredients || [],
  });
}

export function useCategories() {
  return useOfflineData({
    entityType: 'categories',
    apiEndpoint: '/api/categories',
    transform: (response: any) => response || [],
  });
}

export function useUsers() {
  return useOfflineData({
    entityType: 'users',
    apiEndpoint: '/api/users',
    transform: (response: any) => response || [],
  });
}

export function useOrders() {
  return useOfflineData({
    entityType: 'orders',
    apiEndpoint: '/api/orders',
    transform: (response: any) => response || [],
  });
}

export function useShifts() {
  return useOfflineData({
    entityType: 'shifts',
    apiEndpoint: '/api/shifts',
    transform: (response: any) => response || [],
  });
}

export function useCustomers() {
  return useOfflineData({
    entityType: 'customers',
    apiEndpoint: '/api/customers',
    transform: (response: any) => response || [],
  });
}

export function useTables() {
  return useOfflineData({
    entityType: 'tables',
    apiEndpoint: '/api/tables',
    transform: (response: any) => response || [],
  });
}

export function useDeliveryAreas() {
  return useOfflineData({
    entityType: 'delivery_areas',
    apiEndpoint: '/api/delivery-areas',
    transform: (response: any) => response || [],
  });
}

export function useCouriers() {
  return useOfflineData({
    entityType: 'couriers',
    apiEndpoint: '/api/couriers',
    transform: (response: any) => response || [],
  });
}

export function useWasteLogs() {
  return useOfflineData({
    entityType: 'waste_logs',
    apiEndpoint: '/api/waste-logs',
    transform: (response: any) => response || [],
  });
}

export function useDailyExpenses() {
  return useOfflineData({
    entityType: 'daily_expenses',
    apiEndpoint: '/api/daily-expenses',
    transform: (response: any) => response || [],
  });
}

export function usePromoCodes() {
  return useOfflineData({
    entityType: 'promo_codes',
    apiEndpoint: '/api/promo-codes',
    transform: (response: any) => response || [],
  });
}

export function useInventory() {
  return useOfflineData({
    entityType: 'inventory',
    apiEndpoint: '/api/inventory',
    transform: (response: any) => response || [],
  });
}
