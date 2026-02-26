/**
 * Optimistic Update Hook
 * Provides optimistic UI updates with automatic rollback on error
 * Works with both online and offline operations
 */

'use client';

import { useState, useCallback, useRef } from 'react';

export interface OptimisticUpdateOptions<T> {
  id: string | string[];
  optimisticData: Partial<T> | Partial<T>[];
  apiCall: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: Error, originalData: any[]) => void;
}

export interface OptimisticUpdateResult<T> {
  loading: boolean;
  error: Error | null;
  execute: (options: OptimisticUpdateOptions<T>) => Promise<T | null>;
  data: T[];
  dataRef: React.MutableRefObject<T[]>;
  resetData: (newData: T[]) => void;
}

export function useOptimisticUpdate<T = any>(
  initialData: T[]
): OptimisticUpdateResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const dataRef = useRef<T[]>(initialData);

  const resetData = useCallback((newData: T[]) => {
    dataRef.current = newData;
  }, []);

  const execute = useCallback(async <T>(options: OptimisticUpdateOptions<T>): Promise<T | null> => {
    const { id, optimisticData, apiCall, onSuccess, onError } = options;

    setLoading(true);
    setError(null);

    // Store original data for potential rollback
    const originalDataMap = new Map();
    const ids = Array.isArray(id) ? id : [id];

    dataRef.current.forEach(item => {
      if (ids.includes((item as any).id)) {
        originalDataMap.set((item as any).id, { ...item });
      }
    });

    try {
      // Apply optimistic update
      dataRef.current = dataRef.current.map(item => {
        if (ids.includes((item as any).id)) {
          const optData = Array.isArray(optimisticData) ? optimisticData[0] : optimisticData;
          return {
            ...item,
            ...optData,
            _optimistic: true,
          };
        }
        return item;
      });

      // Execute API call
      const result = await apiCall();

      // Remove optimistic markers
      dataRef.current = dataRef.current.map(item => ({
        ...item,
        _optimistic: false,
      }));

      if (onSuccess) {
        onSuccess(result as T);
      }

      return result as T;
    } catch (err) {
      console.error('[useOptimisticUpdate] Error:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');

      // Rollback on error
      if (originalDataMap.size > 0) {
        dataRef.current = dataRef.current.map(item => {
          const id = (item as any).id;
          if (originalDataMap.has(id)) {
            return originalDataMap.get(id);
          }
          return item;
        });
      }

      setError(error);

      if (onError) {
        onError(error, dataRef.current);
      }

      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    execute,
    data: dataRef.current,
    dataRef,
    resetData,
  };
}

/**
 * Hook for optimistic batch operations (multiple entities at once)
 */
export function useOptimisticBatchUpdate<T = any>(
  initialData: T[]
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const dataRef = useRef<T[]>(initialData);

  const executeBatch = useCallback(async (
    operations: Array<{
      id: string | string[];
      optimisticData: Partial<T> | Partial<T>[];
      apiCall: () => Promise<any>;
    }>
  ) => {
    setLoading(true);
    setError(null);

    // Store original data for all operations
    const originalDataStack: Array<{
      ids: string[];
      originalData: any[];
    }> = [];

    // Apply all optimistic updates
    operations.forEach(({ id, optimisticData }) => {
      const ids = Array.isArray(id) ? id : [id];
      const originalData = dataRef.current.filter(item =>
        ids.includes((item as any).id)
      );

      originalDataStack.push({ ids, originalData: [...originalData] });

      dataRef.current = dataRef.current.map(item => {
        if (ids.includes((item as any).id)) {
          const optData = Array.isArray(optimisticData) ? optimisticData[0] : optimisticData;
          return {
            ...item,
            ...optData,
            _optimistic: true,
          };
        }
        return item;
      });
    });

    try {
      // Execute all API calls in parallel
      const results = await Promise.all(operations.map(op => op.apiCall()));

      // Remove optimistic markers
      dataRef.current = dataRef.current.map(item => ({
        ...item,
        _optimistic: false,
      }));

      return results;
    } catch (err) {
      console.error('[useOptimisticBatchUpdate] Error:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');

      // Rollback all operations
      operations.forEach(({ id }) => {
        const ids = Array.isArray(id) ? id : [id];
        const originalData = originalDataStack.find(stack =>
          stack.ids.length === ids.length &&
          stack.ids.every((sid, idx) => sid === ids[idx])
        );

        if (originalData) {
          const originalDataMap = new Map();
          originalData.originalData.forEach(item => {
            originalDataMap.set((item as any).id, { ...item });
          });

          dataRef.current = dataRef.current.map(item => {
            const id = (item as any).id;
            if (originalDataMap.has(id)) {
              return originalDataMap.get(id);
            }
            return item;
          });
        }
      });

      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    executeBatch,
    data: dataRef.current,
    dataRef,
  };
}
