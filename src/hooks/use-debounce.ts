/**
 * Debounce hook for delaying function execution
 * Useful for search inputs to prevent excessive API calls
 */

import { useEffect, useState, useCallback } from 'react';

function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): T {
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const newTimer = setTimeout(() => {
        callback(...args);
      }, delay);

      setDebounceTimer(newTimer);
    },
    [callback, delay, debounceTimer]
  ) as T;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return debouncedCallback;
}

export default useDebounce;
