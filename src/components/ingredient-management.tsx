'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Package, DollarSign, Search, AlertTriangle, Store, TrendingUp, ArrowDownCircle, ArrowUpCircle, History, RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/utils';

interface Branch {
  id: string;
  branchName: string;
  isActive: boolean;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  reorderThreshold: number;
  version: number;
  currentStock?: number;
  isLowStock?: boolean;
  lastModifiedAt?: Date;
}

interface InventoryTransaction {
  id: string;
  ingredientId: string;
  ingredientName: string;
  transactionType: string;
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  orderId?: string | null;
  reason?: string | null;
  createdAt: Date;
  userName?: string;
}

const units = ['kg', 'g', 'L', 'ml', 'units'];

export default function IngredientManagement() {
  const { currency } = useI18n();
  const [activeTab, setActiveTab] = useState('inventory');
  
  // Inventory State
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [restockItem, setRestockItem] = useState<Ingredient | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    costPerUnit: '',
    reorderThreshold: '10',
    initialStock: '',
  });
  
  const [restockData, setRestockData] = useState({
    quantity: '',
    reason: '',
  });
  
  // Transaction History State
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // Load user on mount
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
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
          setBranches((await response.json()).branches || []);
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
      if (user.role === 'ADMIN') {
        setSelectedBranch(branches[0].id);
      } else if (user.branchId) {
        setSelectedBranch(user.branchId);
      }
    }
  }, [user, branches]);

  // Fetch inventory data
  useEffect(() => {
    if (selectedBranch) {
      fetchIngredients();
      fetchTransactions();
    }
  }, [selectedBranch]);

  const fetchIngredients = async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/ingredients?branchId=${selectedBranch}`);
      if (response.ok) {
        setIngredients((await response.json()).ingredients || []);
      }
    } catch (error) {
      console.error('Failed to fetch ingredients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!selectedBranch) return;
    try {
      const response = await fetch(`/api/inventory/transactions?branchId=${selectedBranch}&limit=50`);
      if (response.ok) {
        setTransactions((await response.json()).transactions || []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (editingItem) {
        const payload: any = {
          _method: 'PATCH',
          name: formData.name,
          unit: formData.unit,
          branchId: selectedBranch,
        };

        if (formData.costPerUnit) payload.costPerUnit = parseFloat(formData.costPerUnit);
        if (formData.reorderThreshold) payload.reorderThreshold = parseFloat(formData.reorderThreshold);
        if (formData.initialStock?.trim()) payload.initialStock = formData.initialStock;

        const response = await fetch(`/api/ingredients/${editingItem.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          setMessage({ type: 'error', text: data.error || 'Failed to update ingredient' });
          return;
        }
      } else {
        const payload: any = {
          name: formData.name,
          unit: formData.unit,
          costPerUnit: formData.costPerUnit,
          reorderThreshold: formData.reorderThreshold,
        };

        if (formData.initialStock?.trim()) {
          payload.branchId = selectedBranch;
          payload.initialStock = formData.initialStock;
        }

        const response = await fetch('/api/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          setMessage({ type: 'error', text: data.error || 'Failed to create ingredient' });
          return;
        }
      }

      setDialogOpen(false);
      resetForm();
      await fetchIngredients();
      setMessage({ type: 'success', text: editingItem ? 'Ingredient updated!' : 'Ingredient created!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save ingredient' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranch,
          ingredientId: restockItem.id,
          quantity: parseFloat(restockData.quantity),
          reason: restockData.reason || 'Manual restock',
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Failed to restock' });
        return;
      }

      setRestockDialogOpen(false);
      setRestockData({ quantity: '', reason: '' });
      setRestockItem(null);
      await fetchIngredients();
      await fetchTransactions();
      setMessage({ type: 'success', text: 'Stock restocked successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to restock' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Ingredient) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      unit: item.unit,
      costPerUnit: item.costPerUnit.toString(),
      reorderThreshold: item.reorderThreshold.toString(),
      initialStock: item.currentStock?.toString() || '',
    });
    setDialogOpen(true);
    setMessage(null);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this ingredient? This will affect all recipes and inventory records.')) return;
    
    try {
      const response = await fetch(`/api/ingredients/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchIngredients();
        setMessage({ type: 'success', text: 'Ingredient deleted!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to delete ingredient' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete ingredient' });
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      unit: 'kg',
      costPerUnit: '',
      reorderThreshold: '10',
      initialStock: '',
    });
    setMessage(null);
  };

  const filteredIngredients = ingredients.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStock = 
      stockFilter === 'all' || 
      (stockFilter === 'low' && item.isLowStock) ||
      (stockFilter === 'ok' && !item.isLowStock);
    return matchesSearch && matchesStock;
  });

  const lowStockCount = ingredients.filter(i => i.isLowStock).length;
  const totalStockValue = ingredients.reduce((sum, i) => sum + (i.currentStock || 0) * i.costPerUnit, 0);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'SALE': return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
      case 'RESTOCK': return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
      case 'WASTE': return <Trash2 className="h-4 w-4 text-orange-600" />;
      case 'ADJUSTMENT': return <RefreshCw className="h-4 w-4 text-blue-600" />;
      case 'REFUND': return <TrendingUp className="h-4 w-4 text-purple-600" />;
      default: return <History className="h-4 w-4" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'SALE': return <Badge variant="destructive">Sale</Badge>;
      case 'RESTOCK': return <Badge className="bg-green-600">Restock</Badge>;
      case 'WASTE': return <Badge className="bg-orange-600">Waste</Badge>;
      case 'ADJUSTMENT': return <Badge className="bg-blue-600">Adjustment</Badge>;
      case 'REFUND': return <Badge className="bg-purple-600">Refund</Badge>;
      default: return <Badge>{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs font-medium text-emerald-700">Total Inventory Value</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-900">
              {formatCurrency(totalStockValue, currency)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs font-medium text-amber-700">Low Stock Items</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-900">
              {lowStockCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs font-medium text-blue-700">Total Ingredients</CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-900">
              {ingredients.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-6 w-6" />
              Inventory Management
            </CardTitle>
            <CardDescription>
              Manage ingredients, track stock levels, and monitor inventory movements
            </CardDescription>
          </div>

          {/* Branch Selector */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200">
            <Store className="h-5 w-5 text-emerald-600" />
            <div className="flex-1 space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                {user?.role === 'ADMIN' ? 'View Inventory for Branch:' : 'Your Branch Inventory:'}
              </label>
              {user?.role === 'ADMIN' ? (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="border-emerald-300 focus:border-emerald-500">
                    <SelectValue placeholder="Select branch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.branchName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="font-medium">
                  {branches.find(b => b.id === selectedBranch)?.branchName || 'Loading...'}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="history">Transaction History</TabsTrigger>
            </TabsList>

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="space-y-4 mt-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search ingredients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={stockFilter} onValueChange={(v: any) => setStockFilter(v)}>
                  <SelectTrigger className="md:w-[180px]">
                    <SelectValue placeholder="All Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="ok">In Stock</SelectItem>
                  </SelectContent>
                </Select>
                {user?.role === 'ADMIN' && (
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetForm}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Ingredient
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <form onSubmit={handleSubmit}>
                        <DialogHeader>
                          <DialogTitle>{editingItem ? 'Edit Ingredient' : 'Add Ingredient'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Ingredient Name *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="e.g., Coffee Beans"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="unit">Unit *</Label>
                              <Select
                                value={formData.unit}
                                onValueChange={(value) => setFormData({ ...formData, unit: value })}
                              >
                                <SelectTrigger id="unit">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {units.map((unit) => (
                                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="costPerUnit">Cost/Unit ({currency}) *</Label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                  id="costPerUnit"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.costPerUnit}
                                  onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                                  placeholder="0.00"
                                  className="pl-10"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="reorderThreshold">Reorder Threshold *</Label>
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <Input
                                  id="reorderThreshold"
                                  type="number"
                                  min="0"
                                  value={formData.reorderThreshold}
                                  onChange={(e) => setFormData({ ...formData, reorderThreshold: e.target.value })}
                                  placeholder="10"
                                  required
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="initialStock">Initial Stock ({formData.unit})</Label>
                              <Input
                                id="initialStock"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.initialStock}
                                onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : editingItem ? 'Update' : 'Add'} Ingredient
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <div className="min-w-[800px] md:min-w-0">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Cost/Unit</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reorder Level</TableHead>
                      <TableHead>Stock Value</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                      </TableRow>
                    ) : filteredIngredients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          No ingredients found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredIngredients.map((item) => (
                        <TableRow key={item.id} className={item.isLowStock ? 'bg-red-50 dark:bg-red-950/10' : ''}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>{formatCurrency(item.costPerUnit, currency)}</TableCell>
                          <TableCell>
                            <span className={item.isLowStock ? 'text-red-600 font-semibold' : ''}>
                              {item.currentStock?.toFixed(2) || '-'} {item.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.isLowStock ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600">In Stock</Badge>
                            )}
                          </TableCell>
                          <TableCell>{item.reorderThreshold} {item.unit}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency((item.currentStock || 0) * item.costPerUnit, currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                onClick={() => {
                                  setRestockItem(item);
                                  setRestockDialogOpen(true);
                                }}
                                title="Quick Restock"
                              >
                                <ArrowUpCircle className="h-4 w-4" />
                              </Button>
                              {user?.role === 'ADMIN' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEdit(item)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700"
                                    onClick={() => handleDelete(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </TabsContent>

            {/* Transaction History Tab */}
            <TabsContent value="history" className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Inventory Transaction History</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTransactions}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <div className="min-w-[800px] md:min-w-0">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-sm">
                            {new Date(txn.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">{txn.ingredientName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTransactionIcon(txn.transactionType)}
                              {getTransactionBadge(txn.transactionType)}
                            </div>
                          </TableCell>
                          <TableCell className={txn.quantityChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {txn.quantityChange >= 0 ? '+' : ''}{txn.quantityChange}
                          </TableCell>
                          <TableCell>{txn.stockBefore}</TableCell>
                          <TableCell>{txn.stockAfter}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-slate-500">
                            {txn.reason || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Restock Dialog */}
      <Dialog open={restockDialogOpen} onOpenChange={setRestockDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Restock {restockItem?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRestock}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="restockQuantity">Quantity to Add ({restockItem?.unit}) *</Label>
                <Input
                  id="restockQuantity"
                  type="number"
                  step="0.01"
                  min="0"
                  value={restockData.quantity}
                  onChange={(e) => setRestockData({ ...restockData, quantity: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restockReason">Reason (Optional)</Label>
                <Input
                  id="restockReason"
                  value={restockData.reason}
                  onChange={(e) => setRestockData({ ...restockData, reason: e.target.value })}
                  placeholder="e.g., Supplier delivery"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRestockDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Restocking...' : 'Restock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
