'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  HardDrive,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Database,
  Trash2,
  X,
} from 'lucide-react';
import { storageQuotaMonitor, StorageAlert, StorageUsage, StoreUsage } from '@/lib/offline/storage-quota-monitor';
import { getIndexedDBStorage } from '@/lib/storage/indexeddb-storage';

interface StorageQuotaMonitorProps {
  trigger?: React.ReactNode;
}

export function StorageQuotaMonitor({ trigger }: StorageQuotaMonitorProps) {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [alerts, setAlerts] = useState<StorageAlert[]>([]);
  const [storeUsage, setStoreUsage] = useState<StoreUsage[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Start monitoring on mount
  useEffect(() => {
    storageQuotaMonitor.startMonitoring();

    // Add listener for updates
    const handleUpdate = (newUsage: StorageUsage) => {
      setUsage(newUsage);
      updateAlerts();
    };

    storageQuotaMonitor.addListener(handleUpdate);

    // Initial load
    loadStorageData();

    return () => {
      storageQuotaMonitor.removeListener(handleUpdate);
    };
  }, []);

  // Update alerts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateAlerts();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Load storage data when dialog opens
  useEffect(() => {
    if (open) {
      loadStorageData();
    }
  }, [open]);

  const loadStorageData = async () => {
    setIsLoading(true);
    try {
      const summary = await storageQuotaMonitor.getSummary();
      setUsage(summary.usage);
      setAlerts(summary.alerts);
      setStoreUsage(summary.storeUsage);
      setRecommendations(summary.recommendations);
    } catch (error) {
      console.error('[StorageQuotaMonitor] Error loading storage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAlerts = () => {
    setAlerts(storageQuotaMonitor.getAlerts());
  };

  const handleRefresh = async () => {
    await loadStorageData();
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear all offline data? This cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      const storage = getIndexedDBStorage();
      await storage.clearAllData();

      // Clear alerts
      storageQuotaMonitor.acknowledgeAllAlerts();

      // Reload data
      await loadStorageData();

      alert('Cache cleared successfully');
    } catch (error) {
      console.error('[StorageQuotaMonitor] Error clearing cache:', error);
      alert('Failed to clear cache. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    storageQuotaMonitor.acknowledgeAlert(alertId);
    updateAlerts();
  };

  const handleAcknowledgeAllAlerts = () => {
    storageQuotaMonitor.acknowledgeAllAlerts();
    updateAlerts();
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const formatBytes = (bytes: number): string => {
    return storageQuotaMonitor.formatBytes(bytes);
  };

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);
  const criticalAlerts = unacknowledgedAlerts.filter((a) => a.level === 'critical');

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <HardDrive className="h-4 w-4" />
      {criticalAlerts.length > 0 && (
        <Badge variant="destructive" className="h-5 px-1">
          {criticalAlerts.length}
        </Badge>
      )}
      Storage
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Quota Monitor
          </DialogTitle>
          <DialogDescription>
            Monitor offline storage usage, view alerts, and manage cache
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Left Column - Usage & Alerts */}
          <div className="w-1/2 flex flex-col gap-4 min-h-0">
            {/* Storage Usage Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Storage Usage</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {usage ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Used</span>
                        <span className="font-medium">{formatBytes(usage.used)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Available</span>
                        <span className="font-medium">{formatBytes(usage.available)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-medium">{formatBytes(usage.totalQuota)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Progress
                        value={usage.usagePercentage}
                        className="h-3"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0%</span>
                        <span className="font-semibold text-base">{usage.usagePercentage}%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {usage.usagePercentage >= 90 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Critical Storage Level</AlertTitle>
                        <AlertDescription>
                          Storage is critically low. Clear old data immediately.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <HardDrive className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Loading storage information...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alerts Card */}
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Alerts</CardTitle>
                  {unacknowledgedAlerts.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAcknowledgeAllAlerts}
                    >
                      Acknowledge All
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {unacknowledgedAlerts.length} unacknowledged alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0">
                <ScrollArea className="h-full px-6 pb-6">
                  <div className="space-y-3">
                    {alerts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No alerts</p>
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <Alert
                          key={alert.id}
                          variant={alert.level === 'critical' ? 'destructive' : 'default'}
                          className={alert.acknowledged ? 'opacity-50' : ''}
                        >
                          {getAlertIcon(alert.level)}
                          <AlertTitle className="flex items-center justify-between">
                            <span className="capitalize">{alert.level}</span>
                            {!alert.acknowledged && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleAcknowledgeAlert(alert.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </AlertTitle>
                          <AlertDescription className="mt-2">
                            <p>{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </AlertDescription>
                        </Alert>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Store Usage & Recommendations */}
          <div className="w-1/2 flex flex-col gap-4 min-h-0 overflow-hidden">
            {/* Store Usage Card */}
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Store Usage Breakdown
                </CardTitle>
                <CardDescription>
                  Estimated size and count per data store
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0">
                <ScrollArea className="h-full px-6 pb-6">
                  <div className="space-y-2">
                    {storeUsage.map((store) => (
                      <div
                        key={store.storeName}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{store.storeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {store.count} records
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-sm">
                            {formatBytes(store.estimatedSize)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recommendations Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                {recommendations.length > 0 ? (
                  <div className="space-y-2">
                    {recommendations.map((rec, index) => (
                      <div key={index} className="text-sm flex items-start gap-2">
                        <span className="mt-0.5">{rec.split(' ')[0]}</span>
                        <span className="flex-1">{rec.split(' ').slice(1).join(' ')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recommendations at this time.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Button
              variant="destructive"
              onClick={handleClearCache}
              disabled={isClearing}
              className="gap-2"
            >
              {isClearing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Clear All Cache
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for check icon
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
