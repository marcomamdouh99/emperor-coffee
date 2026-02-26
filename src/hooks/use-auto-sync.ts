'use client';

import { useEffect, useRef } from 'react';
import { offlineManager } from '@/lib/offline/offline-manager';

export function useAutoSync(branchId?: string | null) {
  const initializedRef = useRef(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!branchId || initializedRef.current) return;

    const initializeSync = async () => {
      try {
        // Initialize the offline manager
        await offlineManager.initialize(branchId);
        initializedRef.current = true;

        console.log('[AutoSync] Offline manager initialized for branch:', branchId);
      } catch (error) {
        console.error('[AutoSync] Failed to initialize offline manager:', error);
      }
    };

    initializeSync();
  }, [branchId]);

  // The offline manager handles automatic syncing internally
  // It listens to online/offline events and syncs automatically
  // This hook is just for initialization
}
