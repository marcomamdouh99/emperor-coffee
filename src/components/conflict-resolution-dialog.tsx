'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Info, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export type ConflictType = 'VERSION_MISMATCH' | 'CONCURRENT_UPDATE' | 'DELETED_MODIFIED' | 'MODIFIED_DELETED' | 'DUPLICATE_ENTITY';

export type ResolutionStrategy = 'LAST_WRITE_WINS' | 'MANUAL' | 'MERGE' | 'KEEP_LOCAL' | 'KEEP_REMOTE';

export interface Conflict {
  id: string;
  entityType: string;
  entityId: string;
  conflictType: ConflictType;
  localData: any;
  remoteData: any;
  localVersion: number;
  remoteVersion: number;
  localTimestamp: number;
  remoteTimestamp: number;
  operationType: string;
  resolved: boolean;
  resolutionStrategy?: ResolutionStrategy;
  resolvedData?: any;
  resolvedAt?: number;
  resolvedBy?: string;
  createdAt: number;
}

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: Conflict[];
  onResolve: (conflictId: string, strategy: ResolutionStrategy, resolvedData?: any) => void;
  onResolveAll?: (strategies: Record<string, ResolutionStrategy>) => void;
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  conflicts,
  onResolve,
  onResolveAll,
}: ConflictResolutionDialogProps) {
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const [selectedStrategies, setSelectedStrategies] = useState<Record<string, ResolutionStrategy>>({});
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  const unresolvedConflicts = conflicts.filter(c => !c.resolved);
  const selectedConflict = unresolvedConflicts.find(c => c.id === selectedConflictId);

  useEffect(() => {
    if (unresolvedConflicts.length > 0 && !selectedConflictId) {
      setSelectedConflictId(unresolvedConflicts[0].id);
    }
  }, [unresolvedConflicts, selectedConflictId]);

  const toggleExpand = (conflictId: string) => {
    const newExpanded = new Set(expandedConflicts);
    if (newExpanded.has(conflictId)) {
      newExpanded.delete(conflictId);
    } else {
      newExpanded.add(conflictId);
    }
    setExpandedConflicts(newExpanded);
  };

  const getConflictTypeInfo = (type: ConflictType) => {
    switch (type) {
      case 'VERSION_MISMATCH':
        return {
          title: 'Version Mismatch',
          description: 'Local and remote data have different versions',
          icon: AlertTriangle,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50 border-amber-200',
        };
      case 'CONCURRENT_UPDATE':
        return {
          title: 'Concurrent Update',
          description: 'Same version but data differs',
          icon: AlertCircle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50 border-orange-200',
        };
      case 'DELETED_MODIFIED':
        return {
          title: 'Deleted vs Modified',
          description: 'Deleted on server, modified locally',
          icon: Info,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
        };
      case 'MODIFIED_DELETED':
        return {
          title: 'Modified vs Deleted',
          description: 'Modified on server, deleted locally',
          icon: Info,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
        };
      case 'DUPLICATE_ENTITY':
        return {
          title: 'Duplicate Entity',
          description: 'Duplicate records detected',
          icon: AlertCircle,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50 border-purple-200',
        };
      default:
        return {
          title: 'Unknown Conflict',
          description: 'Unknown conflict type',
          icon: AlertTriangle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
        };
    }
  };

  const getStrategyInfo = (strategy: ResolutionStrategy) => {
    switch (strategy) {
      case 'LAST_WRITE_WINS':
        return {
          title: 'Last Write Wins',
          description: 'Use the most recently modified data',
        };
      case 'KEEP_LOCAL':
        return {
          title: 'Keep Local',
          description: 'Use your local version',
        };
      case 'KEEP_REMOTE':
        return {
          title: 'Keep Remote',
          description: 'Use the server version',
        };
      case 'MERGE':
        return {
          title: 'Merge',
          description: 'Combine local and remote data',
        };
      case 'MANUAL':
        return {
          title: 'Manual Resolution',
          description: 'Manually choose values from each version',
        };
    }
  };

  const handleResolve = () => {
    if (!selectedConflictId) return;

    const strategy = selectedStrategies[selectedConflictId];
    if (!strategy) {
      alert('Please select a resolution strategy');
      return;
    }

    onResolve(selectedConflictId, strategy);
    setSelectedStrategies((prev) => {
      const updated = { ...prev };
      delete updated[selectedConflictId];
      return updated;
    });

    // Move to next unresolved conflict
    const currentIndex = unresolvedConflicts.findIndex(c => c.id === selectedConflictId);
    if (currentIndex < unresolvedConflicts.length - 1) {
      setSelectedConflictId(unresolvedConflicts[currentIndex + 1].id);
    } else {
      setSelectedConflictId(null);
    }
  };

  const handleResolveAll = () => {
    if (!onResolveAll) return;

    // Apply same strategy to all unresolved conflicts
    const strategies: Record<string, ResolutionStrategy> = {};
    unresolvedConflicts.forEach((conflict) => {
      strategies[conflict.id] = selectedStrategies[conflict.id] || 'LAST_WRITE_WINS';
    });

    onResolveAll(strategies);
    setSelectedStrategies({});
    setSelectedConflictId(null);
  };

  if (unresolvedConflicts.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              All Conflicts Resolved
            </DialogTitle>
            <DialogDescription>
              No conflicts require resolution at this time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Resolve Conflicts
            <Badge variant="secondary" className="ml-2">
              {unresolvedConflicts.length} pending
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review and resolve data conflicts between local and server versions
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Conflict List */}
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="max-h-64">
              <div className="p-2 space-y-2">
                {unresolvedConflicts.map((conflict) => {
                  const typeInfo = getConflictTypeInfo(conflict.conflictType);
                  const Icon = typeInfo.icon;
                  const isExpanded = expandedConflicts.has(conflict.id);

                  return (
                    <div
                      key={conflict.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedConflictId === conflict.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-background hover:bg-muted'
                      }`}
                      onClick={() => setSelectedConflictId(conflict.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${typeInfo.bgColor}`}>
                          <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">
                              {conflict.entityType}:{conflict.entityId.slice(0, 8)}...
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(conflict.id);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {typeInfo.title} - {typeInfo.description}
                          </div>
                          {isExpanded && (
                            <div className="mt-2 text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Local:</span>
                                <span>
                                  v{conflict.localVersion} @{' '}
                                  {new Date(conflict.localTimestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Remote:</span>
                                <span>
                                  v{conflict.remoteVersion} @{' '}
                                  {new Date(conflict.remoteTimestamp).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Conflict Details and Resolution */}
          {selectedConflict && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <Tabs defaultValue="resolution" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="resolution">Resolution</TabsTrigger>
                  <TabsTrigger value="details">Data Details</TabsTrigger>
                </TabsList>

                <TabsContent value="resolution" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Resolution Strategy</Label>
                      <RadioGroup
                        value={selectedStrategies[selectedConflict.id] || ''}
                        onValueChange={(value) =>
                          setSelectedStrategies((prev) => ({
                            ...prev,
                            [selectedConflict.id]: value as ResolutionStrategy,
                          }))
                        }
                        className="mt-2 space-y-2"
                      >
                        {(['LAST_WRITE_WINS', 'KEEP_LOCAL', 'KEEP_REMOTE', 'MERGE', 'MANUAL'] as ResolutionStrategy[]).map((strategy) => {
                          const info = getStrategyInfo(strategy);
                          return (
                            <div key={strategy} className="flex items-start space-x-2 p-2 rounded-md hover:bg-background border">
                              <RadioGroupItem value={strategy} id={strategy}>
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{info.title}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {info.description}
                                  </div>
                                </div>
                              </RadioGroupItem>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                      >
                        Close
                      </Button>
                      {onResolveAll && (
                        <Button
                          variant="outline"
                          onClick={handleResolveAll}
                          disabled={Object.keys(selectedStrategies).length === 0}
                        >
                          Apply to All
                        </Button>
                      )}
                      <Button onClick={handleResolve}>Resolve This</Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="details" className="mt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Local Data</CardTitle>
                        <CardDescription>Changes made offline</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                          {JSON.stringify(selectedConflict.localData, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Remote Data</CardTitle>
                        <CardDescription>Current server version</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                          {JSON.stringify(selectedConflict.remoteData, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
