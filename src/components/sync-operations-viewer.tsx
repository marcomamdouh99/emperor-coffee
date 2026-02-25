'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, RefreshCw, CheckCircle, AlertCircle, AlertTriangle, Info, X, Eye } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface SyncOperation {
  id: string;
  type: string;
  data: any;
  branchId: string;
  timestamp: number;
  retryCount: number;
}

interface SyncOperationsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const operationTypeLabels: Record<string, { label: string; icon: string; color: string }> = {
  CREATE_ORDER: { label: 'Create Order', icon: 'ShoppingCart', color: 'bg-blue-500' },
  UPDATE_ORDER: { label: 'Update Order', icon: 'Edit3', color: 'bg-purple-500' },
  CREATE_CUSTOMER: { label: 'Create Customer', icon: 'UserPlus', color: 'bg-emerald-500' },
  UPDATE_CUSTOMER: { label: 'Update Customer', icon: 'User', color: 'bg-teal-500' },
  CREATE_SHIFT: { label: 'Open Shift', icon: 'Clock', color: 'bg-amber-500' },
  UPDATE_SHIFT: { label: 'Update Shift', icon: 'RefreshCw', color: 'bg-orange-500' },
  CLOSE_SHIFT: { label: 'Close Shift', icon: 'CheckCircle', color: 'bg-green-500' },
  CREATE_WASTE_LOG: { label: 'Log Waste', icon: 'Trash2', color: 'bg-red-500' },
  CREATE_DAILY_EXPENSE: { label: 'Daily Expense', icon: 'DollarSign', color: 'bg-yellow-500' },
  CREATE_VOIDED_ITEM: { label: 'Voided Item', icon: 'AlertTriangle', color: 'bg-rose-500' },
  CREATE_PROMO_CODE: { label: 'Create Promo Code', icon: 'Tag', color: 'bg-pink-500' },
  USE_PROMO_CODE: { label: 'Use Promo Code', icon: 'Gift', color: 'bg-fuchsia-500' },
  CREATE_LOYALTY_TRANSACTION: { label: 'Loyalty Points', icon: 'Star', color: 'bg-violet-500' },
  CREATE_TABLE: { label: 'Create Table', icon: 'LayoutGrid', color: 'bg-cyan-500' },
  UPDATE_TABLE: { label: 'Update Table', icon: 'Grid', color: 'bg-sky-500' },
  CLOSE_TABLE: { label: 'Close Table', icon: 'CheckCircle', color: 'bg-teal-500' },
  CREATE_INVENTORY_TRANSACTION: { label: 'Inventory Adjustment', icon: 'Package', color: 'bg-indigo-500' },
};

const icons = {
  ShoppingCart, Edit3, UserPlus, User, Clock, RefreshCw, CheckCircle, Trash2, DollarSign, AlertTriangle, Tag, Gift, Star, LayoutGrid, Grid, Package,
} as any;

export function SyncOperationsViewer({ open, onOpenChange }: SyncOperationsViewerProps) {
  const { user } = useAuth();
  const [operations, setOperations] = useState<SyncOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingOperation, setViewingOperation] = useState<SyncOperation | null>(null);

  // Fetch operations when dialog opens
  useEffect(() => {
    if (open) {
      fetchOperations();
    }
  }, [open]);

  const fetchOperations = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/sync/operations');
      const data = await response.json();

      if (response.ok && data.success) {
        setOperations(data.operations || []);
      } else {
        throw new Error(data.error || 'Failed to fetch operations');
      }
    } catch (err: any) {
      console.error('[SyncOperationsViewer] Error:', err);
      setError(err.message || 'Failed to fetch operations');
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySync = async () => {
    try {
      // Trigger sync via offline manager
      const response = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Sync triggered successfully!');
        fetchOperations();
      } else {
        alert(data.error || 'Failed to trigger sync');
      }
    } catch (err) {
      console.error('[SyncOperationsViewer] Error triggering sync:', err);
      alert('Failed to trigger sync');
    }
  };

  const getOperationStatus = (op: SyncOperation) => {
    if (op.retryCount >= 3) {
      return { status: 'failed', label: 'Failed (Max retries)', color: 'bg-red-500', icon: AlertCircle };
    } else if (op.retryCount > 0) {
      return { status: 'retrying', label: `Retry ${op.retryCount}/3`, color: 'bg-yellow-500', icon: RefreshCw };
    } else {
      return { status: 'pending', label: 'Pending', color: 'bg-slate-500', icon: Clock };
    }
  };

  const getOperationTypeInfo = (type: string) => {
    return operationTypeLabels[type] || { 
      label: type, 
      icon: 'Info', 
      color: 'bg-slate-500' 
    };
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDataSummary = (op: SyncOperation) => {
    switch (op.type) {
      case 'CREATE_ORDER':
      case 'UPDATE_ORDER':
        return `Order #${op.data.orderNumber || 'N/A'} - ${op.data.orderType || 'unknown'}`;
      case 'CREATE_CUSTOMER':
        return `Customer: ${op.data.name || op.data.phone || 'Unknown'}`;
      case 'CREATE_SHIFT':
      case 'UPDATE_SHIFT':
      case 'CLOSE_SHIFT':
        return `Shift ID: ${op.data.id?.slice(0, 8)}...`;
      case 'CREATE_WASTE_LOG':
        return `Waste: ${op.data.reason || 'No reason'}`;
      case 'CREATE_DAILY_EXPENSE':
        return `Expense: ${op.data.reason || 'No reason'} (${op.data.amount || 0} EGP)`;
      default:
        return op.type;
    }
  };

  const clearFailedOperations = async () => {
    if (!confirm('Are you sure you want to clear all failed operations? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/sync/operations/clear-failed', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        alert(`Cleared ${data.cleared} failed operations`);
        fetchOperations();
      } else {
        alert(data.error || 'Failed to clear operations');
      }
    } catch (err) {
      console.error('[SyncOperationsViewer] Error clearing operations:', err);
      alert('Failed to clear operations');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Sync Operations Queue</DialogTitle>
                <DialogDescription className="mt-1">
                  {operations.length} operation{operations.length !== 1 ? 's' : ''} pending sync
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchOperations}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {error && (
            <div className="px-6 py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {loading && !error ? (
            <div className="flex items-center justify-center py-8 px-6">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mr-3" />
              <span className="text-sm text-muted-foreground">Loading operations...</span>
            </div>
          ) : operations.length === 0 && !error ? (
            <div className="flex items-center justify-center py-12 px-6">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-emerald-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">All Caught Up!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  No operations are pending sync. Your local data is fully synchronized.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-3 pb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>Operations are automatically synced when you're online</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetrySync}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Sync Now
                  </Button>
                </div>

                {operations.map((op) => {
                  const typeInfo = getOperationTypeInfo(op.type);
                  const statusInfo = getOperationStatus(op);
                  const Icon = icons[typeInfo.icon] || Info;

                  return (
                    <div
                      key={op.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 ${typeInfo.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-semibold text-sm">{typeInfo.label}</span>
                            <Badge variant="outline" className={`text-xs ${statusInfo.color} text-white border-0`}>
                              {statusInfo.label}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setViewingOperation(viewingOperation === op ? null : op)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {viewingOperation === op ? 'Hide' : 'View'}
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDataSummary(op)}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Created: {formatTimestamp(op.timestamp)}</span>
                            {op.retryCount > 0 && (
                              <span>Retries: {op.retryCount}</span>
                            )}
                          </div>

                          {viewingOperation === op && (
                            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                              <h4 className="font-semibold text-xs mb-2">Operation Details:</h4>
                              <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
                                {JSON.stringify(op.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between border-t">
          {operations.some(op => op.retryCount >= 3) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={clearFailedOperations}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Clear Failed Operations
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
