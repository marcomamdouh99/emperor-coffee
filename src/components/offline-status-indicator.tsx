/**
 * Offline Status Indicator Component
 * Displays online/offline status and sync status to users
 */

'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { offlineManager, SyncStatus } from '@/lib/offline/offline-manager';

interface OfflineStatusIndicatorProps {
  branchId: string;
}

export function OfflineStatusIndicator({ branchId }: OfflineStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncStatus.IDLE);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const initializeManager = async () => {
      try {
        await offlineManager.initialize(branchId);

        if (!mounted) return;

        // Get initial state
        const syncInfo = await offlineManager.getSyncInfo();
        setIsOnline(syncInfo.isOnline);
        setSyncStatus(syncInfo.syncStatus);
        setPendingOperations(syncInfo.pendingOperations);
        setLastSyncTime(syncInfo.lastPushTimestamp);

        // Listen for status changes
        const handleStatusChange = async (status: SyncStatus, data?: any) => {
          if (!mounted) return;

          setSyncStatus(status);
          if (data?.message) {
            setMessage(data.message);
          }

          // Update sync state
          const info = await offlineManager.getSyncInfo();
          setPendingOperations(info.pendingOperations);
          if (status === SyncStatus.SUCCESS) {
            setLastSyncTime(info.lastPushTimestamp);
          }
          setIsSyncing(status === SyncStatus.SYNCING);
        };

        offlineManager.addEventListener(handleStatusChange);

        // Poll for pending operations count
        const interval = setInterval(async () => {
          if (mounted) {
            const count = await offlineManager.getPendingOperationsCount();
            setPendingOperations(count);
          }
        }, 5000);

        return () => {
          offlineManager.removeEventListener(handleStatusChange);
          clearInterval(interval);
        };
      } catch (error) {
        console.error('[OfflineStatusIndicator] Initialization error:', error);
      }
    };

    initializeManager();

    return () => {
      mounted = false;
    };
  }, [branchId]);

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      await offlineManager.forceSync();
      const info = await offlineManager.getSyncInfo();
      setPendingOperations(info.pendingOperations);
      setLastSyncTime(info.lastPushTimestamp);
    } catch (error) {
      console.error('[OfflineStatusIndicator] Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSyncTime = (timestamp: number): string => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (syncStatus === SyncStatus.SYNCING) return 'bg-blue-500';
    if (syncStatus === SyncStatus.ERROR) return 'bg-orange-500';
    if (pendingOperations > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (syncStatus === SyncStatus.ERROR) return 'Sync Error';
    if (pendingOperations > 0) return `${pendingOperations} Pending`;
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />;
    if (isSyncing) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (syncStatus === SyncStatus.ERROR) return <AlertCircle className="h-4 w-4" />;
    if (pendingOperations > 0) return <Clock className="h-4 w-4" />;
    return <Wifi className="h-4 w-4" />;
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Status Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`${getStatusColor()} text-white border-0 gap-1.5 hover:opacity-80 transition-opacity`}
            >
              {getStatusIcon()}
              <span className="font-medium">{getStatusText()}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <div className="font-semibold">Connection Status</div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between gap-4">
                  <span>Status:</span>
                  <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Pending Sync:</span>
                  <span>{pendingOperations} operations</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Last Sync:</span>
                  <span>{formatLastSyncTime(lastSyncTime)}</span>
                </div>
              </div>
              {message && (
                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                  {message}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Force Sync Button */}
        {isOnline && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleForceSync}
                disabled={isSyncing || pendingOperations === 0}
                className="h-8 w-8"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''} ${
                    pendingOperations > 0 ? 'text-yellow-600' : ''
                  }`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div>
                <div className="font-semibold">Force Sync</div>
                <div className="text-xs text-muted-foreground">
                  {isSyncing
                    ? 'Syncing...'
                    : pendingOperations > 0
                    ? `Sync ${pendingOperations} pending operations`
                    : 'All data is up to date'}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Success Indicator */}
        {isOnline && syncStatus === SyncStatus.SUCCESS && !isSyncing && pendingOperations === 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="text-sm">All data synced successfully</div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
