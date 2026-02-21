/**
 * Throttle hook for limiting function execution frequency
 * Useful for scroll events to prevent excessive API calls
 */

import { useEffect, useState, useCallback, useRef } from 'react';

function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const lastRun = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRun.current;

      if (timeSinceLastRun >= delay) {
        lastRun.current = now;
        callback(...args);
      } else {
        // Schedule a call if one isn't already scheduled
        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            lastRun.current = Date.now();
            callback(...args);
            timeoutRef.current = null;
          }, delay - timeSinceLastRun);
        }
      }
    },
    [callback, delay]
  ) as T;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

export default useThrottle;
