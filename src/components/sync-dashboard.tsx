'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sync as SyncIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Database
} from 'lucide-react';

interface SyncStatus {
  branchId: string;
  branchName: string;
  lastSyncAt: Date | null;
  pendingUploads: number;
  pendingDownloads: {
    menu: boolean;
    pricing: boolean;
    recipe: boolean;
    ingredient: boolean;
    users: boolean;
  };
  currentVersions: {
    menuVersion: number;
    pricingVersion: number;
    recipeVersion: number;
    ingredientVersion: number;
    userVersion: number;
  };
  latestVersions: {
    menuVersion: number;
    pricingVersion: number;
    recipeVersion: number;
    ingredientVersion: number;
    userVersion: number;
  };
}

interface SyncHistoryItem {
  id: string;
  syncDirection: 'UP' | 'DOWN';
  syncStartedAt: Date;
  syncCompletedAt: Date | null;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  recordsAffected: number;
  errorDetails?: string;
  branch: {
    id: string;
    branchName: string;
  };
}

interface Conflict {
  id: string;
  entityType: string;
  entityId: string;
  conflictReason: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  branch: {
    id: string;
    branchName: string;
  };
}

export function SyncDashboard({ branchId, isAdmin = false }: { branchId: string; isAdmin?: boolean }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [allBranchesStatus, setAllBranchesStatus] = useState<SyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('status');
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch sync status
      const statusResponse = await fetch(`/api/sync/status?branchId=${branchId}`);
      const statusData = await statusResponse.json();

      if (statusData.success) {
        setSyncStatus(statusData.data);
      }

      // If admin, fetch all branches status
      if (isAdmin) {
        const allResponse = await fetch('/api/sync/status?all=true');
        const allData = await allResponse.json();

        if (allData.success) {
          setAllBranchesStatus(allData.data);
        }
      }

      // Fetch sync history
      const historyResponse = await fetch(`/api/sync/history?branchId=${branchId}&limit=20`);
      const historyData = await historyResponse.json();

      if (historyData.success) {
        setSyncHistory(historyData.data.history);
      }

      // Fetch conflicts
      const conflictsResponse = await fetch(`/api/sync/conflicts?branchId=${branchId}&resolved=false`);
      const conflictsData = await conflictsResponse.json();

      if (conflictsData.success) {
        setConflicts(conflictsData.data.conflicts);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching sync data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [branchId, isAdmin]);

  // Pull sync (download from central)
  const handlePullSync = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId })
      });

      const data = await response.json();

      if (data.success) {
        await fetchData(); // Refresh data
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Push sync (upload to central)
  const handlePushSync = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          dataTypes: ['orders', 'inventory', 'waste', 'shifts']
        })
      });

      const data = await response.json();

      if (data.success) {
        await fetchData(); // Refresh data
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Format date
  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleString();
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Success</Badge>;
      case 'PARTIAL':
        return <Badge variant="secondary" className="bg-yellow-500 text-white"><AlertTriangle className="w-3 h-3 mr-1" /> Partial</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get direction badge
  const getDirectionBadge = (direction: string) => {
    return direction === 'UP' ? (
      <Badge variant="outline" className="text-blue-600 border-blue-600"><ArrowUpFromLine className="w-3 h-3 mr-1" /> UP</Badge>
    ) : (
      <Badge variant="outline" className="text-green-600 border-green-600"><ArrowDownToLine className="w-3 h-3 mr-1" /> DOWN</Badge>
    );
  };

  // Calculate pending downloads count
  const getPendingDownloadsCount = (pendingDownloads: SyncStatus['pendingDownloads']) => {
    return Object.values(pendingDownloads).filter(Boolean).length;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Sync Actions */}
      <div className="flex gap-4">
        <Button
          onClick={handlePullSync}
          disabled={syncing}
          className="flex-1"
        >
          <ArrowDownToLine className="w-4 h-4 mr-2" />
          Pull from Central
        </Button>
        <Button
          onClick={handlePushSync}
          disabled={syncing}
          variant="outline"
          className="flex-1"
        >
          <ArrowUpFromLine className="w-4 h-4 mr-2" />
          Push to Central
        </Button>
        <Button
          onClick={fetchData}
          disabled={loading || syncing}
          variant="ghost"
          size="icon"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="status">
            <SyncIcon className="w-4 h-4 mr-2" />
            Status
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="conflicts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Conflicts
            {conflicts.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {conflicts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          {syncStatus && (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Database className="w-4 h-4 mr-2" />
                      Last Sync
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {syncStatus.lastSyncAt ? (
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(syncStatus.lastSyncAt).toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <ArrowUpFromLine className="w-4 h-4 mr-2" />
                      Pending Uploads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {syncStatus.pendingUploads}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Orders not synced
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <ArrowDownToLine className="w-4 h-4 mr-2" />
                      Pending Downloads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {getPendingDownloadsCount(syncStatus.pendingDownloads)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Types to update
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Version Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Version Information</CardTitle>
                  <CardDescription>Current vs. Latest versions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { key: 'menuVersion', label: 'Menu' },
                      { key: 'pricingVersion', label: 'Pricing' },
                      { key: 'recipeVersion', label: 'Recipes' },
                      { key: 'ingredientVersion', label: 'Ingredients' },
                      { key: 'userVersion', label: 'Users' }
                    ].map(({ key, label }) => {
                      const current = syncStatus.currentVersions[key as keyof typeof syncStatus.currentVersions];
                      const latest = syncStatus.latestVersions[key as keyof typeof syncStatus.latestVersions];
                      const needsUpdate = current < latest;

                      return (
                        <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Badge variant={needsUpdate ? 'secondary' : 'outline'}>
                              {label}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              v{current} → v{latest}
                            </span>
                          </div>
                          {needsUpdate && (
                            <Badge variant="outline" className="text-blue-600 border-blue-600">
                              Update Available
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* All Branches Status (Admin Only) */}
              {isAdmin && allBranchesStatus.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>All Branches Status</CardTitle>
                    <CardDescription>Sync status across all branches</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {allBranchesStatus.map((branch) => (
                          <div
                            key={branch.branchId}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div>
                              <div className="font-medium">{branch.branchName}</div>
                              <div className="text-xs text-muted-foreground">
                                Last sync: {formatDate(branch.lastSyncAt)}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={branch.pendingUploads > 0 ? 'outline' : 'secondary'}>
                                ↑ {branch.pendingUploads}
                              </Badge>
                              <Badge variant={getPendingDownloadsCount(branch.pendingDownloads) > 0 ? 'outline' : 'secondary'}>
                                ↓ {getPendingDownloadsCount(branch.pendingDownloads)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {syncHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No sync history available
                  </div>
                ) : (
                  <div className="space-y-3">
                    {syncHistory.map((item) => (
                      <div key={item.id} className="p-4 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getDirectionBadge(item.syncDirection)}
                            <span className="text-sm font-medium">
                              {item.branch.branchName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(item.status)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(item.syncStartedAt)}
                            </span>
                            <span>
                              {item.recordsAffected} records
                            </span>
                          </div>
                          {item.syncCompletedAt && (
                            <span>
                              Duration: {Math.round(
                                (new Date(item.syncCompletedAt).getTime() - new Date(item.syncStartedAt).getTime()) / 1000
                              )}s
                            </span>
                          )}
                        </div>
                        {item.errorDetails && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                              {item.errorDetails}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conflicts Tab */}
        <TabsContent value="conflicts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Sync Conflicts
                {conflicts.length > 0 && (
                  <Badge variant="destructive">{conflicts.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {conflicts.length === 0
                  ? 'No unresolved conflicts'
                  : `${conflicts.length} conflict(s) need resolution`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {conflicts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
                    No conflicts to resolve
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conflicts.map((conflict) => (
                      <div key={conflict.id} className="p-4 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{conflict.entityType}</Badge>
                            <span className="text-sm font-medium">
                              {conflict.entityId}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(conflict.detectedAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {conflict.conflictReason}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          Branch: {conflict.branch.branchName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
