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
import { Plus, Pencil, Trash2, DollarSign, TrendingDown, Building2, Zap, Wifi, Flame, Users, Wrench, Package, Megaphone, MoreHorizontal, Calendar, TrendingUp, Tag, PlusCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import NetProfitReport from '@/components/reports-net-profit';

interface Branch {
  id: string;
  branchName: string;
}

interface CostCategory {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

interface BranchCost {
  id: string;
  branchId: string;
  costCategoryId: string;
  amount: number;
  period: string;
  notes: string | null;
  createdAt: Date;
  branch: { id: string; branchName: string };
  costCategory: { id: string; name: string; icon?: string };
}

interface CostFormData {
  branchId: string;
  costCategoryId: string;
  amount: string;
  period: string;
  notes: string;
}

interface CategoryFormData {
  name: string;
  description: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
}

interface SummaryData {
  grandTotal: number;
  totalCosts: number;
  totalsByBranch: Record<string, { branchName: string; total: number; byCategory: Record<string, number> }>;
  totalsByCategory: Record<string, { total: number; icon?: string }>;
  byPeriod: Record<string, { total: number; count: number }>;
}

const iconMap: Record<string, any> = {
  Building2,
  Shield: Zap,
  Wifi,
  Flame,
  Users,
  Wrench,
  Package,
  Megaphone,
  MoreHorizontal,
};

const getIcon = (iconName?: string) => {
  if (!iconName) return DollarSign;
  return iconMap[iconName] || DollarSign;
};

export default function CostManagement() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('costs');
  const [costs, setCosts] = useState<BranchCost[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<BranchCost | null>(null);
  const [formData, setFormData] = useState<CostFormData>({
    branchId: '',
    costCategoryId: '',
    amount: '',
    period: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Add amount to cost state
  const [addAmountDialogOpen, setAddAmountDialogOpen] = useState(false);
  const [selectedCostForAdd, setSelectedCostForAdd] = useState<BranchCost | null>(null);
  const [addAmountData, setAddAmountData] = useState({
    amount: '',
    notes: '',
  });
  
  // Category management state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CostCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    icon: '',
    sortOrder: '',
    isActive: true,
  });

  // Get current period (YYYY-MM)
  const getCurrentPeriod = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Generate period options (last 12 months + next 2 months)
  const getPeriodOptions = () => {
    const periods: string[] = [];
    const now = new Date();
    
    for (let i = -2; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      periods.push({ value: period, label });
    }
    
    return periods;
  };

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches');
        const data = await response.json();
        if (response.ok && data.branches) {
          setBranches(data.branches);
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      }
    };
    fetchBranches();
  }, []);

  // Set default branch filter based on user role
  useEffect(() => {
    if (currentUser?.role === 'BRANCH_MANAGER' && currentUser.branchId) {
      setSelectedBranch(currentUser.branchId);
    }
  }, [currentUser]);

  // Fetch cost categories
  const fetchCostCategories = async () => {
    try {
      const response = await fetch('/api/cost-categories');
      const data = await response.json();
      if (response.ok && data.costCategories) {
        setCostCategories(data.costCategories);
      }
    } catch (error) {
      console.error('Failed to fetch cost categories:', error);
    }
  };

  useEffect(() => {
    fetchCostCategories();
  }, []);

  // Fetch costs
  useEffect(() => {
    fetchCosts();
  }, [selectedBranch, selectedPeriod]);

  // Fetch summary
  useEffect(() => {
    fetchSummary();
  }, [selectedBranch, selectedPeriod]);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branchId', selectedBranch);
      if (selectedPeriod !== 'all') params.append('period', selectedPeriod);

      const response = await fetch(`/api/costs?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setCosts(data.costs || []);
      }
    } catch (error) {
      console.error('Failed to fetch costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branchId', selectedBranch);
      if (selectedPeriod !== 'all') params.append('period', selectedPeriod);

      const response = await fetch(`/api/costs/summary?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage(null);

    try {
      const url = editingCost ? `/api/costs/${editingCost.id}` : '/api/costs';
      const method = editingCost ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Failed to save cost' });
        return;
      }

      setDialogOpen(false);
      resetForm();
      await fetchCosts();
      await fetchSummary();
      setMessage({ type: 'success', text: editingCost ? 'Cost updated successfully!' : 'Cost added successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save cost:', error);
      setMessage({ type: 'error', text: 'Failed to save cost' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cost: BranchCost) => {
    setEditingCost(cost);
    setFormData({
      branchId: cost.branchId,
      costCategoryId: cost.costCategoryId,
      amount: cost.amount.toString(),
      period: cost.period,
      notes: cost.notes || '',
    });
    setDialogOpen(true);
    setMessage(null);
  };

  const handleDelete = async (costId: string) => {
    if (!confirm('Are you sure you want to delete this cost entry?')) return;

    try {
      const response = await fetch(`/api/costs/${costId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete cost' });
        return;
      }

      await fetchCosts();
      await fetchSummary();
      setMessage({ type: 'success', text: 'Cost deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to delete cost:', error);
      setMessage({ type: 'error', text: 'Failed to delete cost' });
    }
  };

  const handleAddAmount = (cost: BranchCost) => {
    setSelectedCostForAdd(cost);
    setAddAmountData({ amount: '', notes: '' });
    setAddAmountDialogOpen(true);
    setMessage(null);
  };

  const handleSubmitAddAmount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCostForAdd) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/costs/${selectedCostForAdd.id}/add-amount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(addAmountData.amount),
          notes: addAmountData.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Failed to add amount' });
        return;
      }

      setAddAmountDialogOpen(false);
      setSelectedCostForAdd(null);
      setAddAmountData({ amount: '', notes: '' });
      await fetchCosts();
      await fetchSummary();
      setMessage({ type: 'success', text: `Amount added successfully! New total: ${formatCurrency(data.newTotal)}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to add amount:', error);
      setMessage({ type: 'error', text: 'Failed to add amount' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      branchId: currentUser?.branchId || '',
      costCategoryId: '',
      amount: '',
      period: getCurrentPeriod(),
      notes: '',
    });
    setEditingCost(null);
    setMessage(null);
  };

  // Category management functions
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingCategory 
        ? `/api/cost-categories/${editingCategory.id}` 
        : '/api/cost-categories';
      const method = editingCategory ? 'POST' : 'POST'; // Using POST with _method=PATCH for edit

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...categoryFormData,
          ...(editingCategory && { _method: 'PATCH' }),
          sortOrder: categoryFormData.sortOrder ? parseInt(categoryFormData.sortOrder) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Failed to save category' });
        return;
      }

      setCategoryDialogOpen(false);
      resetCategoryForm();
      await fetchCostCategories();
      setMessage({ type: 'success', text: editingCategory ? 'Category updated successfully!' : 'Category added successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save category:', error);
      setMessage({ type: 'error', text: 'Failed to save category' });
    }
  };

  const handleEditCategory = (category: CostCategory) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      sortOrder: category.sortOrder?.toString() || '',
      isActive: category.isActive !== undefined ? category.isActive : true,
    });
    setCategoryDialogOpen(true);
    setMessage(null);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const response = await fetch(`/api/cost-categories/${categoryId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete category' });
        return;
      }

      await fetchCostCategories();
      setMessage({ type: 'success', text: 'Category deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to delete category:', error);
      setMessage({ type: 'error', text: 'Failed to delete category' });
    }
  };

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      icon: '',
      sortOrder: '',
      isActive: true,
    });
    setEditingCategory(null);
    setMessage(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getPeriodLabel = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white dark:bg-slate-800 w-full md:w-auto">
          <TabsTrigger value="costs" className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700">
            <TrendingDown className="h-4 w-4 mr-2" />
            Branch Costs
          </TabsTrigger>
          <TabsTrigger value="net-profit" className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700">
            <TrendingUp className="h-4 w-4 mr-2" />
            صافي الربح/الخسارة
          </TabsTrigger>
        </TabsList>

        {/* Branch Costs Tab */}
        <TabsContent value="costs" className="space-y-6 mt-6">

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-emerald-200 shadow-lg bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs font-medium text-emerald-700">
                Total Operational Cost
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-900">
                {formatCurrency(summary.grandTotal)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-blue-200 shadow-lg">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs font-medium text-blue-700">
                Total Cost Entries
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-900">
                {summary.totalCosts}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-purple-200 shadow-lg">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs font-medium text-purple-700">
                Branches with Costs
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-purple-900">
                {Object.keys(summary.totalsByBranch).length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-amber-200 shadow-lg">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs font-medium text-amber-700">
                Cost Categories Used
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-900">
                {Object.keys(summary.totalsByCategory).length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* By Category Summary */}
      {summary && Object.keys(summary.totalsByCategory).length > 0 && (
        <Card className="border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-slate-700" />
              Costs by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(summary.totalsByCategory)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([category, data]) => {
                  const Icon = getIcon(data.icon);
                  return (
                    <div key={category} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-slate-600" />
                        <span className="text-xs font-medium text-slate-600 truncate">{category}</span>
                      </div>
                      <div className="text-lg font-bold text-slate-900">
                        {formatCurrency(data.total)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Management */}
      <Card className="border-emerald-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="h-5 w-5 text-emerald-700" />
            Cost Categories
          </CardTitle>
          <CardDescription>Manage cost categories for better organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="min-w-[800px] md:min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Icon</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCategories.map((category) => {
                  const Icon = getIcon(category.icon);
                  return (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {category.description || '-'}
                      </TableCell>
                      <TableCell>
                        {category.icon && (
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-600" />
                            <span className="text-xs text-slate-500">{category.icon}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {category.sortOrder || 0}
                      </TableCell>
                      <TableCell>
                        {category.isActive ? (
                          <Badge className="bg-emerald-600">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {costCategories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No categories found. Add your first category above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Cost Management */}
      <Card className="border-[#C7A35A]/20 shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#0F3A2E] dark:text-[#FFFDF8]">
                <DollarSign className="h-6 w-6" />
                Branch Costs
              </CardTitle>
              <CardDescription>Manage operational costs for each branch</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCategorySubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoryName">Category Name *</Label>
                    <Input
                      id="categoryName"
                      type="text"
                      placeholder="e.g., Rent, Utilities"
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoryDescription">Description</Label>
                    <Textarea
                      id="categoryDescription"
                      placeholder="Optional description..."
                      value={categoryFormData.description}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoryIcon">Icon (Optional)</Label>
                    <Input
                      id="categoryIcon"
                      type="text"
                      placeholder="e.g., Building2, Shield, Zap"
                      value={categoryFormData.icon}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sortOrder">Sort Order</Label>
                    <Input
                      id="sortOrder"
                      type="number"
                      placeholder="0"
                      value={categoryFormData.sortOrder}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, sortOrder: e.target.value })}
                      min="0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={categoryFormData.isActive}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="isActive" className="text-sm">Active</Label>
                  </div>
                </div>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)} className="w-full sm:w-auto h-11 min-h-[44px]">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-[#C7A35A] to-[#b88e3b] hover:from-[#b88e3b] hover:to-[#C7A35A] text-white w-full sm:w-auto h-11 min-h-[44px]">
                    {editingCategory ? 'Update Category' : 'Add Category'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#C7A35A] to-[#b88e3b] hover:from-[#b88e3b] hover:to-[#C7A35A] text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Cost
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingCost ? 'Edit Cost' : 'Add New Cost'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="branch">Branch *</Label>
                      {currentUser?.role === 'BRANCH_MANAGER' ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
                          <Building2 className="h-4 w-4 text-slate-500" />
                          <span className="font-medium">
                            {branches.find(b => b.id === currentUser.branchId)?.branchName || 'Your Branch'}
                          </span>
                        </div>
                      ) : (
                        <Select
                          value={formData.branchId}
                          onValueChange={(value) => setFormData({ ...formData, branchId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.branchName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="costCategory">Cost Category *</Label>
                      <Select
                        value={formData.costCategoryId}
                        onValueChange={(value) => setFormData({ ...formData, costCategoryId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {costCategories.map((category) => {
                            const Icon = getIcon(category.icon);
                            return (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  {Icon && <Icon className="h-4 w-4" />}
                                  {category.name}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="period">Period (Month) *</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Select
                          value={formData.period}
                          onValueChange={(value) => setFormData({ ...formData, period: value })}
                        >
                          <SelectTrigger className="pl-10">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent>
                            {getPeriodOptions().map((period) => (
                              <SelectItem key={period.value} value={period.value}>
                                {period.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Add any additional details..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto h-11 min-h-[44px]">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading} className="bg-gradient-to-r from-[#C7A35A] to-[#b88e3b] hover:from-[#b88e3b] hover:to-[#C7A35A] text-white w-full sm:w-auto h-11 min-h-[44px]">
                      {loading ? 'Saving...' : editingCost ? 'Update Cost' : 'Add Cost'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>

        {/* Add Amount Dialog */}
        <Dialog open={addAmountDialogOpen} onOpenChange={setAddAmountDialogOpen}>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Add Amount to Cost</DialogTitle>
            </DialogHeader>
            {selectedCostForAdd && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
                  <Building2 className="h-4 w-4" />
                  {selectedCostForAdd.branch.branchName}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-slate-600" />
                    <span className="font-medium">{selectedCostForAdd.costCategory.name}</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-600">
                    {formatCurrency(selectedCostForAdd.amount)}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {getPeriodLabel(selectedCostForAdd.period)}
                </div>
              </div>
            )}
            <form onSubmit={handleSubmitAddAmount}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="addAmount">Amount to Add *</Label>
                  <div className="relative">
                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                    <DollarSign className="absolute left-9 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="addAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={addAmountData.amount}
                      onChange={(e) => setAddAmountData({ ...addAmountData, amount: e.target.value })}
                      className="pl-16"
                      required
                    />
                  </div>
                  {selectedCostForAdd && addAmountData.amount && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      New total will be: <span className="font-bold text-emerald-600">
                        {formatCurrency(selectedCostForAdd.amount + parseFloat(addAmountData.amount || '0'))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addNotes">Notes (Optional)</Label>
                  <Textarea
                    id="addNotes"
                    placeholder="Reason for this addition..."
                    value={addAmountData.notes}
                    onChange={(e) => setAddAmountData({ ...addAmountData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setAddAmountDialogOpen(false)} className="w-full sm:w-auto h-11 min-h-[44px]">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white w-full sm:w-auto h-11 min-h-[44px]">
                  {loading ? 'Adding...' : 'Add Amount'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {currentUser?.role !== 'BRANCH_MANAGER' && (
              <div className="flex-1">
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.branchName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex-1">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="All Periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Periods</SelectItem>
                  {getPeriodOptions().map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Costs Table */}
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="min-w-[800px] md:min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading costs...
                    </TableCell>
                  </TableRow>
                ) : costs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No costs found. Add your first cost entry above.
                    </TableCell>
                  </TableRow>
                ) : (
                  costs.map((cost) => {
                    const Icon = getIcon(cost.costCategory.icon);
                    return (
                      <TableRow key={cost.id}>
                        <TableCell className="font-medium">{cost.branch.branchName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-600" />
                            {cost.costCategory.name}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-emerald-700">
                          {formatCurrency(cost.amount)}
                        </TableCell>
                        <TableCell>{getPeriodLabel(cost.period)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {cost.notes || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(cost)}
                              title="Edit Cost"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleAddAmount(cost)}
                              title="Add Amount"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(cost.id)}
                              title="Delete Cost"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Net Profit/Loss Tab */}
        <TabsContent value="net-profit" className="mt-6">
          <NetProfitReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
