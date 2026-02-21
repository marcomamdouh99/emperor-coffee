'use client';

import { useEffect, useRef } from 'react';

export function useAutoSync(branchId?: string | null) {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!branchId) return;

    const syncPendingOperations = async () => {
      if (syncingRef.current) {
        console.log('[AutoSync] Sync already in progress, skipping');
        return;
      }

      syncingRef.current = true;

      try {
        console.log('[AutoSync] Checking for pending operations...');

        const { getLocalStorageService } = await import('@/lib/storage/local-storage');
        const localStorageService = getLocalStorageService();
        await localStorageService.init();

        const operations = await localStorageService.getAllOperations();

        if (operations.length === 0) {
          console.log('[AutoSync] No pending operations to sync');
          return;
        }

        console.log(`[AutoSync] Found ${operations.length} pending operations, syncing...`);
        console.log('[AutoSync] Operations to sync:', operations.map((op: any) => ({
          type: op.type,
          id: op.id,
          branchId: op.branchId,
        })));

        // Group operations by branch
        const operationsByBranch = new Map<string, any[]>();
        operations.forEach((op: any) => {
          const bId = op.branchId || branchId;
          if (!operationsByBranch.has(bId)) {
            operationsByBranch.set(bId, []);
          }
          operationsByBranch.get(bId)!.push(op);
        });

        // Sync operations for each branch
        let totalSynced = 0;
        let totalFailed = 0;

        for (const [bId, branchOps] of operationsByBranch.entries()) {
          console.log(`[AutoSync] Syncing ${branchOps.length} operations for branch ${bId}`);
          console.log('[AutoSync] Sending data:', branchOps.map((op: any) => ({
            type: op.type,
            timestamp: op.timestamp,
            dataKeys: Object.keys(op.data),
          })));

          try {
            const response = await fetch('/api/sync/batch-push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                branchId: bId,
                operations: branchOps,
              }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
              console.log(`[AutoSync] Synced ${data.processed} operations for branch ${bId}`);
              totalSynced += data.processed;

              // Delete synced operations
              for (const op of branchOps) {
                await localStorageService.deleteOperation(op.id);
              }

              if (data.failed > 0) {
                console.warn(`[AutoSync] ${data.failed} operations failed for branch ${bId}:`, data.errors);
                totalFailed += data.failed;
              }
            } else {
              console.error(`[AutoSync] Sync failed for branch ${bId}:`, data);
              console.error(`[AutoSync] Errors:`, data.errors);
              totalFailed += branchOps.length;
            }
          } catch (error) {
            console.error(`[AutoSync] Error syncing operations for branch ${bId}:`, error);
            totalFailed += branchOps.length;
          }
        }

        console.log(`[AutoSync] Sync complete: ${totalSynced} succeeded, ${totalFailed} failed`);

        // Show notification if there were failures
        if (totalFailed > 0) {
          console.warn(`[AutoSync] ${totalFailed} operations failed to sync`);
        }

        // Refresh the page to show synced data
        if (totalSynced > 0) {
          console.log('[AutoSync] Data synced successfully, refreshing page...');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (error) {
        console.error('[AutoSync] Error during sync:', error);
      } finally {
        syncingRef.current = false;
      }
    };

    const handleOnline = () => {
      console.log('[AutoSync] Connection restored, starting sync...');
      // Wait a bit to ensure stable connection
      setTimeout(syncPendingOperations, 2000);
    };

    // Listen for online event
    window.addEventListener('online', handleOnline);

    // Also check on mount if already online (in case operations were created while offline and then browser was refreshed)
    if (navigator.onLine) {
      console.log('[AutoSync] Already online, checking for pending operations...');
      setTimeout(syncPendingOperations, 1000);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [branchId]);
}
