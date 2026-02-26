'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Package, AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

interface Branch {
  id: string;
  branchName: string;
  isActive: boolean;
}

interface InventoryAlert {
  ingredientId: string;
  ingredientName: string;
  currentStock: number;
  unit: string;
  reorderThreshold: number;
  deficit: number;
  urgency: 'CRITICAL' | 'WARNING';
}

export default function InventoryManagement() {
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [wasteIngredient, setWasteIngredient] = useState('');
  const [wasteAmount, setWasteAmount] = useState('');
  const [wasteReason, setWasteReason] = useState('');
  const [restockIngredient, setRestockIngredient] = useState('');
  const [restockAmount, setRestockAmount] = useState('');
  const [restockSupplier, setRestockSupplier] = useState('');
  const [ingredients, setIngredients] = useState<any[]>([]);
  const { language, currency, t } = useI18n();

  // Load user on mount
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        // Defer setState to avoid cascading renders
        setTimeout(() => setUser(userData), 0);
      } catch (e) {
        console.error('Failed to load user:', e);
      }
    }
  }, []);

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches');
        if (response.ok) {
          const data = await response.json();
          setBranches(data.branches || []);
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      }
    };

    fetchBranches();
  }, []);

  // Set default branch based on user role
  useEffect(() => {
    if (user && branches.length > 0) {
      // Defer setState to avoid cascading renders
      setTimeout(() => {
        if (user.role === 'ADMIN') {
          setSelectedBranch(branches[0].id);
        } else if (user.branchId) {
          setSelectedBranch(user.branchId);
        }
      }, 0);
    }
  }, [user, branches]);

  // Fetch alerts when branch is selected
  useEffect(() => {
    const fetchAlerts = async () => {
      const branchId = user?.role === 'ADMIN' ? selectedBranch : user?.branchId;

      if (!branchId) {
        setAlerts([]);
        setIngredients([]);
        return;
      }

      try {
        // Fetch low stock alerts
        const alertsResponse = await fetch(`/api/inventory/low-stock?branchId=${branchId}`);
        const alertsData = await alertsResponse.json();

        // Fetch ingredients for dropdowns
        const ingredientsResponse = await fetch(`/api/ingredients?branchId=${branchId}`);
        const ingredientsData = await ingredientsResponse.json();

        if (alertsResponse.ok) {
          setAlerts(alertsData.alerts || []);
        }

        if (ingredientsResponse.ok) {
          setIngredients(ingredientsData.ingredients || []);
        }
      } catch (error) {
        console.error('Failed to fetch inventory data:', error);
      }
    };

    fetchAlerts();
  }, [selectedBranch, user?.branchId, user?.role]);

  const handleRecordWaste = async () => {
    const branchId = user?.role === 'ADMIN' ? selectedBranch : user?.branchId;

    if (!branchId || !wasteIngredient || !wasteAmount || !wasteReason) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          ingredientId: wasteIngredient,
          quantity: parseFloat(wasteAmount),
          reason: wasteReason,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(data.message);
        setWasteIngredient('');
        setWasteAmount('');
        setWasteReason('');

        // Refresh alerts
        const alertsResponse = await fetch(`/api/inventory/low-stock?branchId=${branchId}`);
        const alertsData = await alertsResponse.json();
        if (alertsResponse.ok) {
          setAlerts(alertsData.alerts || []);
        }
      }
    } catch (error) {
      console.error('Failed to record waste:', error);
      alert('Failed to record waste');
    }
  };

  const handleRestock = async () => {
    const branchId = user?.role === 'ADMIN' ? selectedBranch : user?.branchId;

    if (!branchId || !restockIngredient || !restockAmount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          ingredientId: restockIngredient,
          quantity: parseFloat(restockAmount),
          cost: parseFloat(restockAmount) * 15,
          supplier: restockSupplier || 'Manual restock',
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(data.message);
        setRestockIngredient('');
        setRestockAmount('');
        setRestockSupplier('');

        // Refresh alerts
        const alertsResponse = await fetch(`/api/inventory/low-stock?branchId=${branchId}`);
        const alertsData = await alertsResponse.json();
        if (alertsResponse.ok) {
          setAlerts(alertsData.alerts || []);
        }
      }
    } catch (error) {
      console.error('Failed to restock:', error);
      alert('Failed to process restock');
    }
  };

  if (user?.role !== 'ADMIN' && user?.role !== 'BRANCH_MANAGER') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
            {t('access.denied')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-safe">
      {/* Low Stock Alerts */}
      <Card className="lg:col-span-3">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-base">
            <AlertCircle className="h-5 w-5 text-red-500" />
            {t('reports.low.stock')}
            <Badge variant="outline" className="ml-2">
              {alerts.filter(a => a.urgency === 'CRITICAL').length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <ScrollArea className="h-[300px] sm:h-[400px] pr-4">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Package className="h-12 w-12 mb-2" />
                <p>{t('reports.inventory.status')} OK</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div 
                    key={alert.ingredientId} 
                    className={`p-4 border rounded-lg ${
                      alert.urgency === 'CRITICAL'
                        ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                        : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <span className="font-semibold text-base">{alert.ingredientName}</span>
                      <Badge 
                        variant={alert.urgency === 'CRITICAL' ? 'destructive' : 'outline'}
                        className="w-fit h-7 flex items-center justify-center px-3 text-xs sm:text-sm"
                      >
                        {alert.urgency}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex justify-between sm:flex-col sm:gap-1">
                        <span className="text-slate-600 dark:text-slate-400">{t('reports.current.stock')}:</span>
                        <span className="font-semibold text-base">{alert.currentStock} {alert.unit}</span>
                      </div>
                      <div className="flex justify-between sm:flex-col sm:gap-1">
                        <span className="text-slate-600 dark:text-slate-400">{t('reports.reorder.level')}:</span>
                        <span className="font-semibold text-base">{alert.reorderThreshold} {alert.unit}</span>
                      </div>
                      <div className="flex justify-between sm:flex-col sm:gap-1">
                        <span className="text-red-600 dark:text-red-400 font-medium">{t('reports.below.threshold')}:</span>
                        <span className="font-bold text-red-600 dark:text-red-400 text-base">{alert.deficit} {alert.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Record Waste */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-base">
            <Trash2 className="h-5 w-5 text-orange-500" />
            {t('inventory.waste')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('inventory.waste')}</label>
              <select
                value={wasteIngredient}
                onChange={(e) => setWasteIngredient(e.target.value)}
                className="w-full h-11 sm:h-10 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-base bg-white dark:bg-slate-900"
              >
                <option value="">Select ingredient...</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity Lost</label>
              <Input
                type="number"
                step="0.01"
                value={wasteAmount}
                onChange={(e) => setWasteAmount(e.target.value)}
                placeholder="0.00"
                className="h-11 sm:h-10 text-base"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={wasteReason}
                onChange={(e) => setWasteReason(e.target.value)}
                placeholder="e.g., Spilled, Expired, Broken..."
                rows={3}
                className="min-h-[88px] text-base"
              />
            </div>
            <Button
              onClick={handleRecordWaste}
              className="w-full h-12 sm:h-10 text-base font-medium"
              disabled={!wasteIngredient || !wasteAmount || !wasteReason}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Record Waste
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Restock */}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-base">
            <Package className="h-5 w-5 text-green-500" />
            {t('inventory.restock')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          {/* Branch Selector for Admin - Moved to top on mobile */}
          {user?.role === 'ADMIN' && (
            <div className="space-y-2 order-first lg:order-none">
              <label className="text-sm font-medium">{t('pos.process.sale')}</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full h-11 sm:h-10 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-base bg-white dark:bg-slate-900"
              >
                <option value="">{t('pos.select.branch')}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branchName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('inventory.restock')}</label>
              <select
                value={restockIngredient}
                onChange={(e) => setRestockIngredient(e.target.value)}
                className="w-full h-11 sm:h-10 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-base bg-white dark:bg-slate-900"
              >
                <option value="">Select ingredient...</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity to Add</label>
              <Input
                type="number"
                step="0.01"
                value={restockAmount}
                onChange={(e) => setRestockAmount(e.target.value)}
                placeholder="0.00"
                className="h-11 sm:h-10 text-base"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Supplier (Optional)</label>
              <Input
                value={restockSupplier}
                onChange={(e) => setRestockSupplier(e.target.value)}
                placeholder="e.g., Coffee Supplier Co."
                className="h-11 sm:h-10 text-base"
              />
            </div>
            <Button
              onClick={handleRestock}
              className="w-full h-12 sm:h-10 text-base font-medium"
              disabled={!restockIngredient || !restockAmount}
            >
              <Package className="h-4 w-4 mr-2" />
              Restock Inventory
            </Button>
          </div>

          {/* Branch info for non-admin users */}
          {user?.role !== 'ADMIN' && user?.branchId && (
            <div className="text-sm text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="font-medium">{t('pos.branch')}: </span>
              {branches.find(b => b.id === user.branchId)?.branchName || user.branchId}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
