'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  GitMerge,
  ArrowRightLeft,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react';
import { conflictManager, Conflict, ConflictType, ResolutionStrategy } from '@/lib/sync/conflict-manager';

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConflictsResolved?: () => void;
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  onConflictsResolved,
}: ConflictResolutionDialogProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<ResolutionStrategy>(ResolutionStrategy.LAST_WRITE_WINS);
  const [customMergeData, setCustomMergeData] = useState<string>('');
  const [isResolving, setIsResolving] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');

  // Load conflicts when dialog opens
  useEffect(() => {
    if (open) {
      loadConflicts();
    }
  }, [open]);

  // Auto-refresh conflicts every 30 seconds
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      loadConflicts();
    }, 30000);

    return () => clearInterval(interval);
  }, [open]);

  const loadConflicts = () => {
    const allConflicts = conflictManager.getAllConflicts();
    setConflicts(allConflicts);

    // Auto-select first unresolved conflict
    const unresolved = conflictManager.getUnresolvedConflicts();
    if (unresolved.length > 0 && (!selectedConflict || selectedConflict.resolved)) {
      setSelectedConflict(unresolved[0]);
    }
  };

  const getFilteredConflicts = () => {
    switch (activeTab) {
      case 'unresolved':
        return conflicts.filter(c => !c.resolved);
      case 'resolved':
        return conflicts.filter(c => c.resolved);
      default:
        return conflicts;
    }
  };

  const getConflictTypeColor = (type: ConflictType): string => {
    switch (type) {
      case ConflictType.VERSION_MISMATCH:
        return 'bg-yellow-500';
      case ConflictType.CONCURRENT_UPDATE:
        return 'bg-orange-500';
      case ConflictType.DELETED_MODIFIED:
        return 'bg-red-500';
      case ConflictType.MODIFIED_DELETED:
        return 'bg-red-500';
      case ConflictType.DUPLICATE_ENTITY:
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getConflictTypeLabel = (type: ConflictType): string => {
    switch (type) {
      case ConflictType.VERSION_MISMATCH:
        return 'Version Mismatch';
      case ConflictType.CONCURRENT_UPDATE:
        return 'Concurrent Update';
      case ConflictType.DELETED_MODIFIED:
        return 'Deleted vs Modified';
      case ConflictType.MODIFIED_DELETED:
        return 'Modified vs Deleted';
      case ConflictType.DUPLICATE_ENTITY:
        return 'Duplicate Entity';
      default:
        return 'Unknown';
    }
  };

  const getResolutionStrategyLabel = (strategy: ResolutionStrategy): string => {
    switch (strategy) {
      case ResolutionStrategy.LAST_WRITE_WINS:
        return 'Last Write Wins (Most Recent)';
      case ResolutionStrategy.KEEP_LOCAL:
        return 'Keep Local (Device) Data';
      case ResolutionStrategy.KEEP_REMOTE:
        return 'Keep Remote (Server) Data';
      case ResolutionStrategy.MERGE:
        return 'Merge Both Versions';
      case ResolutionStrategy.MANUAL:
        return 'Manual Resolution';
      default:
        return 'Unknown';
    }
  };

  const handleResolveConflict = async () => {
    if (!selectedConflict) return;

    setIsResolving(true);

    try {
      let resolvedData: any;

      switch (selectedStrategy) {
        case ResolutionStrategy.MANUAL:
          if (!customMergeData) {
            alert('Please provide merged data in JSON format');
            setIsResolving(false);
            return;
          }
          try {
            resolvedData = JSON.parse(customMergeData);
          } catch (e) {
            alert('Invalid JSON format. Please check your data.');
            setIsResolving(false);
            return;
          }
          break;
        case ResolutionStrategy.KEEP_LOCAL:
          resolvedData = selectedConflict.localData;
          break;
        case ResolutionStrategy.KEEP_REMOTE:
          resolvedData = selectedConflict.remoteData;
          break;
        case ResolutionStrategy.LAST_WRITE_WINS:
          resolvedData =
            selectedConflict.localTimestamp > selectedConflict.remoteTimestamp
              ? selectedConflict.localData
              : selectedConflict.remoteData;
          break;
        case ResolutionStrategy.MERGE:
          // Simple merge: prefer local data
          resolvedData = { ...selectedConflict.remoteData, ...selectedConflict.localData };
          resolvedData.version = Math.max(selectedConflict.localVersion, selectedConflict.remoteVersion) + 1;
          resolvedData.updatedAt = new Date().toISOString();
          break;
        default:
          throw new Error(`Unknown strategy: ${selectedStrategy}`);
      }

      // Apply the resolution
      await conflictManager.resolveConflict(
        selectedConflict.id,
        selectedStrategy,
        'manual-user'
      );

      // Update resolved data
      const conflict = conflictManager.getConflict(selectedConflict.id);
      if (conflict) {
        conflict.resolvedData = resolvedData;
      }

      // Refresh conflicts
      loadConflicts();

      // If all conflicts resolved, notify parent
      const unresolved = conflictManager.getUnresolvedConflicts();
      if (unresolved.length === 0 && onConflictsResolved) {
        onConflictsResolved();
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      alert(`Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResolving(false);
    }
  };

  const handleAutoResolveAll = async () => {
    setIsResolving(true);

    try {
      const resolved = await conflictManager.autoResolveConflicts();
      console.log(`[ConflictResolution] Auto-resolved ${resolved.length} conflicts`);
      loadConflicts();

      // If all conflicts resolved, notify parent
      const unresolved = conflictManager.getUnresolvedConflicts();
      if (unresolved.length === 0 && onConflictsResolved) {
        onConflictsResolved();
      }
    } catch (error) {
      console.error('Error auto-resolving conflicts:', error);
      alert(`Failed to auto-resolve conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResolving(false);
    }
  };

  const handleClearResolved = () => {
    conflictManager.clearResolvedConflicts();
    loadConflicts();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const stats = conflictManager.getConflictStats();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Sync Conflict Resolution
          </DialogTitle>
          <DialogDescription>
            Resolve data conflicts between offline and online data. Review and choose how to merge changes.
          </DialogDescription>
        </DialogHeader>

        {/* Conflict Statistics */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Conflicts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.unresolved}</div>
            <div className="text-xs text-muted-foreground">Unresolved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
            <div className="text-xs text-muted-foreground">Resolved</div>
          </div>
          <div className="text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoResolveAll}
              disabled={isResolving || stats.unresolved === 0}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isResolving ? 'animate-spin' : ''}`} />
              Auto-Resolve All
            </Button>
          </div>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Conflict List */}
          <div className="w-1/3 border-r pr-4 flex flex-col">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="unresolved">Unresolved ({stats.unresolved})</TabsTrigger>
                <TabsTrigger value="resolved">Resolved ({stats.resolved})</TabsTrigger>
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                <div className="space-y-2">
                  {getFilteredConflicts().map((conflict) => (
                    <Card
                      key={conflict.id}
                      className={`cursor-pointer transition-colors ${
                        selectedConflict?.id === conflict.id ? 'ring-2 ring-primary' : ''
                      } ${conflict.resolved ? 'opacity-60' : ''}`}
                      onClick={() => setSelectedConflict(conflict)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-medium">
                            {conflict.entityType}
                          </CardTitle>
                          <Badge className={getConflictTypeColor(conflict.conflictType)} variant="secondary">
                            {getConflictTypeLabel(conflict.conflictType)}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          ID: {conflict.entityId}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {conflict.resolved ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span>Resolved</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 text-orange-500" />
                              <span>Pending</span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {getFilteredConflicts().length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No conflicts found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {stats.resolved > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearResolved}
                  className="mt-2 w-full"
                >
                  Clear Resolved Conflicts
                </Button>
              )}
            </Tabs>
          </div>

          {/* Conflict Details & Resolution */}
          <div className="w-2/3 flex flex-col min-h-0">
            {selectedConflict ? (
              <>
                <ScrollArea className="flex-1 pr-4">
                  {/* Conflict Header */}
                  <div className="mb-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>
                        {selectedConflict.resolved ? 'Resolved Conflict' : 'Unresolved Conflict'}
                      </AlertTitle>
                      <AlertDescription>
                        {selectedConflict.resolved ? (
                          <>
                            This conflict was resolved using <strong>{selectedConflict.resolutionStrategy}</strong>
                            by {selectedConflict.resolvedBy} at {formatDate(selectedConflict.resolvedAt!)}
                          </>
                        ) : (
                          <>
                            {getConflictTypeLabel(selectedConflict.conflictType)} detected for{' '}
                            <strong>{selectedConflict.entityType}</strong> (
                            {selectedConflict.entityId})
                          </>
                        )}
                      </AlertDescription>
                    </Alert>
                  </div>

                  {/* Version Info */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <WifiOff className="h-4 w-4 text-blue-500" />
                          Local (Device)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Version {selectedConflict.localVersion} • {formatDate(selectedConflict.localTimestamp)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                          {JSON.stringify(selectedConflict.localData, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Wifi className="h-4 w-4 text-green-500" />
                          Remote (Server)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Version {selectedConflict.remoteVersion} • {formatDate(selectedConflict.remoteTimestamp)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                          {JSON.stringify(selectedConflict.remoteData, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Resolution Strategy */}
                  {!selectedConflict.resolved && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ArrowRightLeft className="h-4 w-4" />
                          Resolution Strategy
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <RadioGroup
                          value={selectedStrategy}
                          onValueChange={(v) => setSelectedStrategy(v as ResolutionStrategy)}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value={ResolutionStrategy.LAST_WRITE_WINS} id="last-write" />
                              <Label htmlFor="last-write" className="flex-1 cursor-pointer">
                                <div className="font-medium">{getResolutionStrategyLabel(ResolutionStrategy.LAST_WRITE_WINS)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Use the version with the most recent timestamp
                                </div>
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value={ResolutionStrategy.KEEP_LOCAL} id="keep-local" />
                              <Label htmlFor="keep-local" className="flex-1 cursor-pointer">
                                <div className="font-medium">{getResolutionStrategyLabel(ResolutionStrategy.KEEP_LOCAL)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Keep the data from your device and overwrite server
                                </div>
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value={ResolutionStrategy.KEEP_REMOTE} id="keep-remote" />
                              <Label htmlFor="keep-remote" className="flex-1 cursor-pointer">
                                <div className="font-medium">{getResolutionStrategyLabel(ResolutionStrategy.KEEP_REMOTE)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Keep the data from server and discard local changes
                                </div>
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value={ResolutionStrategy.MERGE} id="merge" />
                              <Label htmlFor="merge" className="flex-1 cursor-pointer">
                                <div className="font-medium">{getResolutionStrategyLabel(ResolutionStrategy.MERGE)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Combine both versions (local data takes precedence)
                                </div>
                              </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value={ResolutionStrategy.MANUAL} id="manual" />
                              <Label htmlFor="manual" className="flex-1 cursor-pointer">
                                <div className="font-medium">{getResolutionStrategyLabel(ResolutionStrategy.MANUAL)}</div>
                                <div className="text-xs text-muted-foreground">
                                  Manually edit and merge the data below
                                </div>
                              </Label>
                            </div>
                          </div>
                        </RadioGroup>

                        {selectedStrategy === ResolutionStrategy.MANUAL && (
                          <div className="space-y-2">
                            <Label htmlFor="manual-merge" className="text-sm font-medium">
                              Merged Data (JSON)
                            </Label>
                            <textarea
                              id="manual-merge"
                              value={customMergeData || JSON.stringify({ ...selectedConflict.remoteData, ...selectedConflict.localData }, null, 2)}
                              onChange={(e) => setCustomMergeData(e.target.value)}
                              className="w-full h-48 p-3 text-xs font-mono bg-muted rounded-md border resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Enter merged data in JSON format..."
                            />
                            <p className="text-xs text-muted-foreground">
                              Edit the JSON above to create your merged version. This will replace both local and remote data.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Resolved Data Preview */}
                  {selectedConflict.resolved && selectedConflict.resolvedData && (
                    <Card className="mt-4">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Final Merged Data
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-green-50 dark:bg-green-950 p-3 rounded overflow-auto max-h-48">
                          {JSON.stringify(selectedConflict.resolvedData, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </ScrollArea>

                {/* Footer Actions */}
                {!selectedConflict.resolved && (
                  <DialogFooter className="pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedConflict(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleResolveConflict}
                      disabled={isResolving}
                      className="gap-2"
                    >
                      {isResolving ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Resolving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Resolve Conflict
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <GitMerge className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p>Select a conflict to view details and resolve it</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
