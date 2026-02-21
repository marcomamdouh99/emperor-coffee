/**
 * Offline Data Fetching Hook
 * Provides a unified way to fetch data from API when online,
 * and from IndexedDB when offline
 */

import { useState, useEffect, useCallback } from 'react';
import { getLocalStorageService } from '@/lib/storage/local-storage';

const localStorageService = getLocalStorageService();

export function useOfflineData<T>(
  apiEndpoint: string,
  options: {
    branchId?: string;
    enabled?: boolean;
    deps?: any[];
    // IndexedDB fetch function
    fetchFromDB?: () => Promise<T | T[] | null>;
  } = {}
) {
  const { branchId, enabled = true, deps = [], fetchFromDB } = options;
  const [data, setData] = useState<T | T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Skip API call if apiEndpoint is empty - use offline data only
    const shouldSkipAPI = !apiEndpoint || apiEndpoint.trim() === '';

    // Better offline detection
    const isActuallyOffline = !navigator.onLine || typeof navigator.onLine !== 'boolean';

    setLoading(true);
    setError(null);

    try {
      if (isActuallyOffline || shouldSkipAPI) {
        // Offline or no API endpoint: Try IndexedDB directly
        const reason = shouldSkipAPI ? 'no API endpoint' : 'offline mode';
        console.log(`[useOfflineData] ${reason}, fetching from IndexedDB: ${apiEndpoint || '(none)'}`);

        if (fetchFromDB) {
          const dbData = await fetchFromDB();
          if (dbData) {
            setData(dbData);
            console.log(`[useOfflineData] IndexedDB fetch successful: ${apiEndpoint || '(none)'}`);
          } else {
            console.warn(`[useOfflineData] No offline data available for: ${apiEndpoint || '(none)'}`);
          }
        } else {
          console.warn(`[useOfflineData] No offline fetch function provided for: ${apiEndpoint || '(none)'}`);
        }
      } else {
        // Online: Try API first
        console.log(`[useOfflineData] Fetching from API: ${apiEndpoint}`);

        // Add branchId to URL if provided
        const url = branchId && !apiEndpoint.includes('branchId=')
          ? `${apiEndpoint}${apiEndpoint.includes('?') ? '&' : '?'}branchId=${branchId}`
          : apiEndpoint;

        const response = await fetch(url);

        if (response.ok) {
          const result = await response.json();
          const data = result.data || result.branches || result.menuItems || result.categories || result.orders || result.shifts || result.users || result;
          setData(data);
          console.log(`[useOfflineData] API fetch successful: ${apiEndpoint}`);

          // Also save to IndexedDB for offline use (in background, don't wait)
          if (apiEndpoint.includes('/api/categories')) {
            localStorageService.batchSaveCategories(Array.isArray(data) ? data : []).catch(e =>
              console.log('[useOfflineData] Failed to cache categories:', e.message)
            );
          } else if (apiEndpoint.includes('/api/menu-items')) {
            localStorageService.batchSaveMenuItems(Array.isArray(data) ? data : []).catch(e =>
              console.log('[useOfflineData] Failed to cache menu items:', e.message)
            );
          } else if (apiEndpoint.includes('/api/branches')) {
            localStorageService.batchSaveBranches(Array.isArray(data) ? data : (data.branches || [])).catch(e =>
              console.log('[useOfflineData] Failed to cache branches:', e.message)
            );
          } else if (apiEndpoint.includes('/api/delivery-areas')) {
            localStorageService.batchSaveDeliveryAreas(Array.isArray(data) ? data : (data.areas || [])).catch(e =>
              console.log('[useOfflineData] Failed to cache delivery areas:', e.message)
            );
          } else if (apiEndpoint.includes('/api/couriers')) {
            localStorageService.batchSaveCouriers(Array.isArray(data) ? data : (data.couriers || [])).catch(e =>
              console.log('[useOfflineData] Failed to cache couriers:', e.message)
            );
          } else if (apiEndpoint.includes('/api/customers')) {
            localStorageService.batchSaveCustomers(Array.isArray(data) ? data : (data.customers || [])).catch(e =>
              console.log('[useOfflineData] Failed to cache customers:', e.message)
            );
          } else if (apiEndpoint.includes('/api/users')) {
            localStorageService.batchSaveUsers(Array.isArray(data) ? data : (data.users || [])).catch(e =>
              console.log('[useOfflineData] Failed to cache users:', e.message)
            );
          } else if (apiEndpoint.includes('/api/shifts')) {
            localStorageService.batchSaveShifts(Array.isArray(data) ? data : (data.shifts || [])).catch(e =>
              console.log('[useOfflineData] Failed to cache shifts:', e.message)
            );
          }
        } else {
          throw new Error(`API request failed: ${response.statusText}`);
        }
      }
    } catch (err) {
      // Check if this is a network/offline error
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isNetworkError = errorMessage.includes('Failed to fetch') ||
                            errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
                            errorMessage.includes('503') ||
                            errorMessage.includes('Network request failed') ||
                            errorMessage.includes('API request failed: 503');

      if (!isNetworkError) {
        // Only log non-network errors as errors
        console.error(`[useOfflineData] Fetch error for ${apiEndpoint || '(none)'}:`, err);
      } else {
        console.log(`[useOfflineData] Network error (likely offline), trying fallback: ${apiEndpoint || '(none)'}`);
      }

      // If API fails, always try offline fallback (regardless of navigator.onLine)
      if (fetchFromDB) {
        try {
          console.log(`[useOfflineData] API failed, trying IndexedDB fallback: ${apiEndpoint || '(none)'}`);
          const dbData = await fetchFromDB();
          if (dbData) {
            setData(dbData);
            console.log(`[useOfflineData] IndexedDB fallback successful: ${apiEndpoint || '(none)'}`);
          } else {
            // Only set error if it's not a network error
            if (!isNetworkError) {
              setError(errorMessage);
            }
          }
        } catch (fallbackErr) {
          // Only set error if it's not a network error
          if (!isNetworkError) {
            setError(errorMessage);
          }
        }
      } else {
        // Only set error if it's not a network error
        if (!isNetworkError) {
          setError(errorMessage);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, branchId, enabled, fetchFromDB, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for online/offline events to refetch
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      console.log('[useOfflineData] Back online, refetching data');
      fetchData();
    };

    const handleOffline = () => {
      setIsOffline(true);
      console.log('[useOfflineData] Gone offline, will use cached data');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData]);

  return { data, loading, error, isOffline, refetch: fetchData };
}

// Helper functions for fetching common data types from IndexedDB
export const offlineDataFetchers = {
  menuItems: () => localStorageService.getAllMenuItems(),
  categories: () => localStorageService.getAllCategories(),
  ingredients: () => localStorageService.getAllIngredients(),
  users: () => localStorageService.getAllUsers(),
  orders: () => localStorageService.getAllOrders(),
  shifts: () => localStorageService.getAllShifts(),
  wasteLogs: () => localStorageService.getAllWasteLogs(),
  branches: () => localStorageService.getAllBranches(),
  deliveryAreas: () => localStorageService.getAllDeliveryAreas(),
  customers: () => localStorageService.getAllCustomers(),
  couriers: () => localStorageService.getAllCouriers(),
};
