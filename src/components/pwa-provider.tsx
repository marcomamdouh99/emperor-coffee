/**
 * PWA Provider Component
 * Registers service worker and provides PWA context
 */

'use client';

import { useEffect } from 'react';
import { useServiceWorker } from '@/lib/pwa/use-service-worker';

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const { isSupported, updateAvailable, isOffline, update } = useServiceWorker();

  useEffect(() => {
    // Log PWA status
    if (isSupported) {
      console.log('[PWA] Service Worker support detected');
    } else {
      console.warn('[PWA] Service Worker not supported');
    }

    if (isOffline) {
      console.log('[PWA] Currently offline - using cached resources');
    }

    // Show update notification
    if (updateAvailable) {
      console.log('[PWA] Update available - user can update');
      // You could show a toast notification here
    }
  }, [isSupported, updateAvailable, isOffline]);

  return <>{children}</>;
}
