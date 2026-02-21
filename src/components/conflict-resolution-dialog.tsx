'use client';

import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, Code } from 'lucide-react';

interface ConflictData {
  id: string;
  entityType: string;
  entityId: string;
  conflictReason: string;
  branchPayload: any;
  centralPayload: any;
  detectedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  branch: {
    id: string;
    branchName: string;
  };
}

interface ConflictResolutionDialogProps {
  conflict: ConflictData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve?: () => void;
  resolvedBy?: string;
}

export function ConflictResolutionDialog({
  conflict,
  open,
  onOpenChange,
  onResolve,
  resolvedBy = 'admin'
}: ConflictResolutionDialogProps) {
  const [selectedResolution, setSelectedResolution] = useState<'ACCEPT_BRANCH' | 'ACCEPT_CENTRAL' | 'MANUAL_MERGE' | null>(null);
  const [mergedData, setMergedData] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedResolution(null);
      setMergedData('');
      setError(null);
      setSuccess(false);
    }
    onOpenChange(newOpen);
  };

  // Handle resolution
  const handleResolve = async () => {
    if (!conflict || !selectedResolution) return;

    try {
      setResolving(true);
      setError(null);

      const payload: any = {
        resolution: selectedResolution,
        resolvedBy
      };

      if (selectedResolution === 'MANUAL_MERGE') {
        if (!mergedData.trim()) {
          setError('Merged data is required for MANUAL_MERGE resolution');
          return;
        }
        try {
          payload.mergedData = JSON.parse(mergedData);
        } catch (e) {
          setError('Invalid JSON in merged data');
          return;
        }
      }

      const response = await fetch(`/api/sync/conflicts/${conflict.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        if (onResolve) onResolve();
        setTimeout(() => handleOpenChange(false), 1500);
      } else {
        setError(data.error || 'Failed to resolve conflict');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resolve conflict');
    } finally {
      setResolving(false);
    }
  };

  if (!conflict) return null;

  const isResolved = conflict.resolvedAt !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Resolve Conflict
          </DialogTitle>
          <DialogDescription>
            {isResolved
              ? `This conflict was resolved on ${new Date(conflict.resolvedAt!).toLocaleString()} by ${conflict.resolvedBy}`
              : 'Choose how to resolve this data conflict'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Conflict Info */}
            <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/50">
              <div>
                <Badge variant="outline">{conflict.entityType}</Badge>
                <div className="text-sm font-mono mt-1">{conflict.entityId}</div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{conflict.conflictReason}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Branch: {conflict.branch.branchName} | Detected: {new Date(conflict.detectedAt).toLocaleString()}
                </div>
              </div>
              {isResolved && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {conflict.resolvedBy}
                </Badge>
              )}
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Alert */}
            {success && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Conflict resolved successfully!
                </AlertDescription>
              </Alert>
            )}

            {!isResolved && (
              <>
                {/* Data Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Branch Data */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        Branch Data
                      </Badge>
                    </div>
                    <div className="p-3 rounded-lg border bg-blue-50/50">
                      <pre className="text-xs overflow-auto max-h-64">
                        {JSON.stringify(conflict.branchPayload, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Central Data */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Central Data
                      </Badge>
                    </div>
                    <div className="p-3 rounded-lg border bg-green-50/50">
                      <pre className="text-xs overflow-auto max-h-64">
                        {JSON.stringify(conflict.centralPayload, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Resolution Options */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Choose Resolution:</div>

                  <div className="space-y-2">
                    <Button
                      variant={selectedResolution === 'ACCEPT_BRANCH' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => setSelectedResolution('ACCEPT_BRANCH')}
                      disabled={resolving}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-bold">B</span>
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Accept Branch Data</div>
                          <div className="text-xs text-muted-foreground">
                            Use the branch's version of this data
                          </div>
                        </div>
                      </div>
                    </Button>

                    <Button
                      variant={selectedResolution === 'ACCEPT_CENTRAL' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => setSelectedResolution('ACCEPT_CENTRAL')}
                      disabled={resolving}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-green-600 font-bold">C</span>
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Accept Central Data</div>
                          <div className="text-xs text-muted-foreground">
                            Keep the central server's version
                          </div>
                        </div>
                      </div>
                    </Button>

                    <Button
                      variant={selectedResolution === 'MANUAL_MERGE' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => setSelectedResolution('MANUAL_MERGE')}
                      disabled={resolving}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <Code className="w-4 h-4 text-yellow-600" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Manual Merge</div>
                          <div className="text-xs text-muted-foreground">
                            Create a custom merged version
                          </div>
                        </div>
                      </div>
                    </Button>
                  </div>

                  {/* Manual Merge Editor */}
                  {selectedResolution === 'MANUAL_MERGE' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Merged Data (JSON):</label>
                      <Textarea
                        value={mergedData}
                        onChange={(e) => setMergedData(e.target.value)}
                        placeholder='{"name": "Merged Value", "price": 10.50}'
                        className="font-mono text-xs min-h-32"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the merged data as valid JSON
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {!isResolved && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={resolving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={!selectedResolution || resolving}
            >
              {resolving ? 'Resolving...' : 'Resolve Conflict'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
