'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Search, Phone, Mail, Building, RefreshCw, Package, TrendingUp, DollarSign, Calendar, BarChart3, FileText, Printer, ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  address?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  _count?: {
    purchaseOrders: number;
  };
  totalSpent?: number;
  lastOrderDate?: string;
}

interface SupplierAnalytics {
  supplierId: string;
  supplierName: string;
  summary: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate: string | null;
    onTimePercentage: number | null;
  };
  statusBreakdown: {
    PENDING: number;
    APPROVED: number;
    RECEIVED: number;
    PARTIAL: number;
    CANCELLED: number;
  };
  monthlySpending: { month: string; amount: number }[];
  topPurchasedItems: Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    totalQuantity: number;
    totalSpent: number;
    orderCount: number;
  }>;
  deliveryPerformance: {
    onTimeDeliveries: number;
    lateDeliveries: number;
    pendingOrders: number;
    totalDelivered: number;
    onTimePercentage: number | null;
  };
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'APPROVED' | 'RECEIVED' | 'PARTIAL' | 'CANCELLED';
  totalAmount: number;
  orderedAt: string;
  expectedAt?: string;
  receivedAt?: string;
}

export default function SuppliersManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierAnalytics, setSupplierAnalytics] = useState<SupplierAnalytics | null>(null);
  const [supplierOrders, setSupplierOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  // Stats
  const [stats, setStats] = useState({
    totalSuppliers: 0,
    activeSuppliers: 0,
    totalPOValue: 0,
    recentOrders: 0,
  });

  useEffect(() => {
    fetchSuppliers();
  }, [search, statusFilter]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('isActive', statusFilter === 'active' ? 'true' : 'false');

      const response = await fetch(`/api/suppliers?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const suppliersWithStats = await Promise.all(
          data.suppliers.map(async (supplier: Supplier) => {
            // Fetch analytics for each supplier to get total spent and last order date
            try {
              const analyticsRes = await fetch(`/api/suppliers/${supplier.id}/analytics`);
              if (analyticsRes.ok) {
                const analyticsData = await analyticsRes.json();
                return {
                  ...supplier,
                  totalSpent: analyticsData.analytics.summary.totalSpent,
                  lastOrderDate: analyticsData.analytics.summary.lastOrderDate,
                };
              }
            } catch (error) {
              console.error('Failed to fetch supplier analytics:', error);
            }
            return supplier;
          })
        );
        setSuppliers(suppliersWithStats);

        // Calculate stats
        const totalPOValue = suppliersWithStats.reduce(
          (sum: number, s: any) => sum + (s.totalSpent || 0),
          0
        );
        const recentOrders = suppliersWithStats.filter((s: any) => {
          if (!s.lastOrderDate) return false;
          const lastOrder = new Date(s.lastOrderDate);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return lastOrder >= thirtyDaysAgo;
        }).length;

        setStats({
          totalSuppliers: suppliersWithStats.length,
          activeSuppliers: suppliersWithStats.filter((s: Supplier) => s.isActive).length,
          totalPOValue,
          recentOrders,
        });
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierAnalytics = async (supplierId: string) => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/analytics`);
      if (response.ok) {
        const data = await response.json();
        setSupplierAnalytics(data.analytics);
        setSupplierOrders(data.analytics.topPurchasedItems.map((item: any) => ({
          id: item.ingredientId,
          orderNumber: 'N/A',
          status: 'RECEIVED' as const,
          totalAmount: item.totalSpent,
          orderedAt: new Date().toISOString(),
        })));
      }
    } catch (error) {
      console.error('Failed to fetch supplier analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    fetchSupplierAnalytics(supplier.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const method = editingSupplier ? 'PATCH' : 'POST';
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        fetchSuppliers();
        setIsDialogOpen(false);
        resetForm();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save supplier');
      }
    } catch (error) {
      console.error('Failed to save supplier:', error);
      alert('Failed to save supplier');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone,
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setDeletingSupplier(supplier);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingSupplier) return;

    try {
      const response = await fetch(`/api/suppliers/${deletingSupplier.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchSuppliers();
        setIsDeleteDialogOpen(false);
        setDeletingSupplier(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to deactivate supplier');
      }
    } catch (error) {
      console.error('Failed to deactivate supplier:', error);
      alert('Failed to deactivate supplier');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
    });
    setEditingSupplier(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      APPROVED: 'bg-blue-100 text-blue-700',
      RECEIVED: 'bg-emerald-100 text-emerald-700',
      PARTIAL: 'bg-orange-100 text-orange-700',
      CANCELLED: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  if (selectedSupplier) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="outline"
          onClick={() => {
            setSelectedSupplier(null);
            setSupplierAnalytics(null);
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Suppliers
        </Button>

        {/* Supplier Details Card */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Building className="h-6 w-6 text-emerald-600" />
                  {selectedSupplier.name}
                </CardTitle>
                <CardDescription className="mt-2">
                  {selectedSupplier.contactPerson && (
                    <span className="block">Contact: {selectedSupplier.contactPerson}</span>
                  )}
                  {selectedSupplier.email && (
                    <span className="block flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {selectedSupplier.email}
                    </span>
                  )}
                  <span className="block flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {selectedSupplier.phone}
                  </span>
                  {selectedSupplier.address && (
                    <span className="block">{selectedSupplier.address}</span>
                  )}
                </CardDescription>
              </div>
              <Badge className={selectedSupplier.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                {selectedSupplier.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {selectedSupplier.notes && (
              <div className="mb-4">
                <Label>Notes</Label>
                <p className="text-sm text-slate-600 mt-1">{selectedSupplier.notes}</p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Orders</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {supplierAnalytics?.summary.totalOrders || 0}
                      </p>
                    </div>
                    <Package className="h-8 w-8 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Spent</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(supplierAnalytics?.summary.totalSpent || 0)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Avg Order Value</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(supplierAnalytics?.summary.averageOrderValue || 0)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">On-Time Delivery</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {supplierAnalytics?.summary.onTimePercentage
                          ? `${supplierAnalytics.summary.onTimePercentage.toFixed(1)}%`
                          : 'N/A'}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Tabs */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              Analytics & Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
              </div>
            ) : supplierAnalytics ? (
              <Tabs defaultValue="spending">
                <TabsList className="mb-4">
                  <TabsTrigger value="spending">Spending Trends</TabsTrigger>
                  <TabsTrigger value="items">Top Items</TabsTrigger>
                  <TabsTrigger value="status">Order Status</TabsTrigger>
                  <TabsTrigger value="delivery">Delivery Performance</TabsTrigger>
                </TabsList>

                <TabsContent value="spending">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Monthly Spending (Last 12 Months)</h3>
                    <div className="space-y-2">
                      {supplierAnalytics.monthlySpending.map((month) => {
                        const maxValue = Math.max(...supplierAnalytics.monthlySpending.map((m) => m.amount));
                        const percentage = maxValue > 0 ? (month.amount / maxValue) * 100 : 0;
                        return (
                          <div key={month.month} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{month.month}</span>
                              <span className="font-medium">{formatCurrency(month.amount)}</span>
                            </div>
                            <div className="h-8 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="items">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Top Purchased Items</h3>
                    <div className="space-y-2">
                      {supplierAnalytics.topPurchasedItems.map((item, index) => (
                        <div key={item.ingredientId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                              {index + 1}
                            </Badge>
                            <div>
                              <p className="font-medium">{item.ingredientName}</p>
                              <p className="text-sm text-slate-600">
                                {item.totalQuantity.toFixed(2)} {item.unit} × {item.orderCount} orders
                              </p>
                            </div>
                          </div>
                          <p className="font-semibold text-emerald-600">{formatCurrency(item.totalSpent)}</p>
                        </div>
                      ))}
                      {supplierAnalytics.topPurchasedItems.length === 0 && (
                        <p className="text-slate-500 text-center py-4">No purchase data available</p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="status">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Order Status Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(supplierAnalytics.statusBreakdown).map(([status, count]) => (
                        <Card key={status}>
                          <CardContent className="pt-4">
                            <div className="text-center">
                              <Badge className={getStatusBadge(status)}>{status}</Badge>
                              <p className="text-3xl font-bold mt-2">{count}</p>
                              <p className="text-sm text-slate-600">orders</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="delivery">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Delivery Performance</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-3xl font-bold text-emerald-600">
                              {supplierAnalytics.deliveryPerformance.onTimeDeliveries}
                            </p>
                            <p className="text-sm text-slate-600">On-Time</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                            <p className="text-3xl font-bold text-red-600">
                              {supplierAnalytics.deliveryPerformance.lateDeliveries}
                            </p>
                            <p className="text-sm text-slate-600">Late</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Clock className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                            <p className="text-3xl font-bold text-yellow-600">
                              {supplierAnalytics.deliveryPerformance.pendingOrders}
                            </p>
                            <p className="text-sm text-slate-600">Pending</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <TrendingUp className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                            <p className="text-3xl font-bold text-blue-600">
                              {supplierAnalytics.deliveryPerformance.onTimePercentage
                                ? `${supplierAnalytics.deliveryPerformance.onTimePercentage.toFixed(1)}%`
                                : 'N/A'}
                            </p>
                            <p className="text-sm text-slate-600">On-Time Rate</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-slate-500 text-center py-8">No analytics data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">Total Suppliers</p>
                <p className="text-3xl font-bold">{stats.totalSuppliers}</p>
              </div>
              <Building className="h-10 w-10 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">Active Suppliers</p>
                <p className="text-3xl font-bold">{stats.activeSuppliers}</p>
              </div>
              <CheckCircle className="h-10 w-10 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">Total PO Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalPOValue)}</p>
              </div>
              <DollarSign className="h-10 w-10 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-90">Recent Orders</p>
                <p className="text-3xl font-bold">{stats.recentOrders}</p>
                <p className="text-xs opacity-75">(last 30 days)</p>
              </div>
              <Calendar className="h-10 w-10 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers Table */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-emerald-600" />
                Supplier Management
              </CardTitle>
              <CardDescription>Manage your ingredient suppliers and track performance</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchSuppliers}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Supplier
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                    <DialogDescription>
                      {editingSupplier ? 'Update supplier information' : 'Enter details for the new supplier'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Supplier Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="contactPerson">Contact Person</Label>
                          <Input
                            id="contactPerson"
                            value={formData.contactPerson}
                            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="phone">Phone *</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Input
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                      <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="w-full sm:w-auto h-11 min-h-[44px]">
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto h-11 min-h-[44px]">
                        {editingSupplier ? 'Update' : 'Create'} Supplier
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search suppliers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Suppliers Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="min-w-[1000px] md:min-w-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Orders</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Last Order</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow
                        key={supplier.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => handleSelectSupplier(supplier)}
                      >
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contactPerson || '-'}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </span>
                        </TableCell>
                        <TableCell>
                          {supplier.email ? (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {supplier.email}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={supplier.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                            {supplier.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Package className="h-3 w-3" />
                            {supplier._count?.purchaseOrders || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(supplier.totalSpent || 0)}
                        </TableCell>
                        <TableCell>
                          {supplier.lastOrderDate
                            ? new Date(supplier.lastOrderDate).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(supplier);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(supplier);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {suppliers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                          No suppliers found. Add your first supplier to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate "{deletingSupplier?.name}"? This will mark the supplier as inactive
              but will preserve all historical data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingSupplier(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
