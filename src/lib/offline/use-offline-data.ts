/**
 * Offline Data Hook
 * Provides data access that works both online and offline
 * Falls back to local storage when offline
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { offlineManager, SyncStatus } from './offline-manager';
import { getLocalStorageService } from '../storage/local-storage';

const localStorageService = getLocalStorageService();

export interface OfflineDataOptions {
  apiEndpoint: string;
  storageKey?: string;
  initialData?: any[];
  transform?: (data: any) => any;
  dependentOn?: any[];
}

export function useOfflineData<T = any>(options: OfflineDataOptions) {
  const {
    apiEndpoint,
    storageKey,
    initialData = [],
    transform,
    dependentOn = [],
  } = options;

  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const isCurrentlyOnline = offlineManager.isCurrentlyOnline();
      setIsOffline(!isCurrentlyOnline);

      if (isCurrentlyOnline) {
        // Try to fetch from API
        const response = await fetch(apiEndpoint);
        if (response.ok) {
          const result = await response.json();
          const transformedData = transform ? transform(result) : result;
          setData(Array.isArray(transformedData) ? transformedData : [transformedData]);

          // Store in local storage for offline use
          if (storageKey && Array.isArray(transformedData)) {
            if (apiEndpoint.includes('menu')) {
              await localStorageService.batchSaveMenuItems(transformedData);
            } else if (apiEndpoint.includes('ingredient')) {
              await localStorageService.batchSaveIngredients(transformedData);
            } else if (apiEndpoint.includes('category')) {
              await localStorageService.batchSaveCategories(transformedData);
            } else if (apiEndpoint.includes('user')) {
              await localStorageService.batchSaveUsers(transformedData);
            }
          }
        } else {
          throw new Error(`API error: ${response.statusText}`);
        }
      } else {
        // Offline - try to get from local storage
        if (storageKey) {
          let localData: any[] = [];
          if (apiEndpoint.includes('menu')) {
            localData = await localStorageService.getAllMenuItems();
          } else if (apiEndpoint.includes('ingredient')) {
            localData = await localStorageService.getAllIngredients();
          } else if (apiEndpoint.includes('category')) {
            localData = await localStorageService.getAllCategories();
          } else if (apiEndpoint.includes('user')) {
            localData = await localStorageService.getAllUsers();
          }

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

      // If online fetch fails, try to fall back to local storage
      if (offlineManager.isCurrentlyOnline() && storageKey) {
        try {
          let localData: any[] = [];
          if (apiEndpoint.includes('menu')) {
            localData = await localStorageService.getAllMenuItems();
          } else if (apiEndpoint.includes('ingredient')) {
            localData = await localStorageService.getAllIngredients();
          } else if (apiEndpoint.includes('category')) {
            localData = await localStorageService.getAllCategories();
          } else if (apiEndpoint.includes('user')) {
            localData = await localStorageService.getAllUsers();
          }

          if (localData.length > 0) {
            setData(localData);
            setError('Using cached data (API unavailable)');
            return;
          }
        } catch (localErr) {
          console.error('[useOfflineData] Fallback error:', localErr);
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, storageKey, transform]);

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
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isOffline,
    refetch: fetchData,
  };
}

/**
 * Hook for offline mutations (create, update, delete)
 */
export function useOfflineMutation<T = any>(
  apiEndpoint: string,
  operationType: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data: T): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const isOnline = offlineManager.isCurrentlyOnline();

      if (isOnline) {
        // Online - send to API
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          const result = await response.json();
          return result;
        } else {
          throw new Error(`API error: ${response.statusText}`);
        }
      } else {
        // Offline - queue operation
        // The operation type needs to match the OperationType enum
        await offlineManager.queueOperation(operationType as any, data);
        return data as T;
      }
    } catch (err) {
      console.error('[useOfflineMutation] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // If online request fails, queue for retry
      if (offlineManager.isCurrentlyOnline()) {
        await offlineManager.queueOperation(operationType as any, data);
        setError('Operation queued for sync (request failed)');
      } else {
        setError(errorMessage);
        throw err;
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, operationType]);

  return {
    mutate,
    loading,
    error,
  };
}
