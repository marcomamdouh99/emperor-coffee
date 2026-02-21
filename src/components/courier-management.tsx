'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Package, MapPin, Phone, TrendingUp, Calendar, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface Branch {
  id: string;
  branchName: string;
}

interface Courier {
  id: string;
  name: string;
  phone: string | null;
  branchId: string;
  isActive: boolean;
  createdAt: Date;
  branch?: Branch;
  _count?: {
    orders: number;
  };
}

interface CourierFormData {
  name: string;
  phone: string;
  branchId: string;
  isActive: boolean;
}

interface CourierStats {
  courierId: string;
  courierName: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
}

export default function CourierManagement() {
  const { user: currentUser } = useAuth();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(currentUser?.role === 'BRANCH_MANAGER' ? currentUser.branchId || '' : 'all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [formData, setFormData] = useState<CourierFormData>({
    name: '',
    phone: '',
    branchId: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [stats, setStats] = useState<CourierStats[]>([]);

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

  // Fetch couriers
  useEffect(() => {
    fetchCouriers();
    fetchStats();
  }, [selectedBranch]);

  const fetchCouriers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branchId', selectedBranch);
      params.append('includeStats', 'true');

      const response = await fetch(`/api/couriers?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setCouriers(data.couriers || []);
      }
    } catch (error) {
      console.error('Failed to fetch couriers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branchId', selectedBranch);

      const response = await fetch(`/api/couriers/stats?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setStats(data.stats || []);
      }
    } catch (error) {
      console.error('Failed to fetch courier stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage(null);

    try {
      const url = editingCourier ? `/api/couriers/${editingCourier.id}` : '/api/couriers';
      const method = editingCourier ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.courier) {
        setMessage({ type: 'error', text: data.error || 'Failed to save courier' });
        return;
      }

      setDialogOpen(false);
      resetForm();
      await fetchCouriers();
      await fetchStats();
      setMessage({ type: 'success', text: editingCourier ? 'Courier updated successfully!' : 'Courier added successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save courier:', error);
      setMessage({ type: 'error', text: 'Failed to save courier' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (courier: Courier) => {
    setEditingCourier(courier);
    setFormData({
      name: courier.name,
      phone: courier.phone || '',
      branchId: courier.branchId,
      isActive: courier.isActive,
    });
    setDialogOpen(true);
    setMessage(null);
  };

  const handleDelete = async (courierId: string) => {
    if (!confirm('Are you sure you want to delete this courier?')) return;

    try {
      const response = await fetch(`/api/couriers/${courierId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete courier' });
        return;
      }

      await fetchCouriers();
      await fetchStats();
      setMessage({ type: 'success', text: 'Courier deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to delete courier:', error);
      setMessage({ type: 'error', text: 'Failed to delete courier' });
    }
  };

  const toggleStatus = async (courier: Courier) => {
    try {
      const response = await fetch(`/api/couriers/${courier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !courier.isActive }),
      });

      if (response.ok) {
        await fetchCouriers();
      }
    } catch (error) {
      console.error('Failed to toggle courier status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      branchId: currentUser?.role === 'BRANCH_MANAGER' ? currentUser.branchId || '' : '',
      isActive: true,
    });
    setEditingCourier(null);
    setMessage(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const activeCouriers = couriers.filter(c => c.isActive);
  const inactiveCouriers = couriers.filter(c => !c.isActive);

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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-200 shadow-lg bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs font-medium text-emerald-700">
              Active Couriers
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-900">
              {activeCouriers.length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-blue-200 shadow-lg">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs font-medium text-blue-700">
              Total Deliveries
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-900">
              {stats.reduce((sum, s) => sum + s.totalOrders, 0)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-purple-200 shadow-lg">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs font-medium text-purple-700">
              Avg Per Courier
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-900">
              {activeCouriers.length > 0 
                ? (stats.reduce((sum, s) => sum + s.totalOrders, 0) / activeCouriers.length).toFixed(1)
                : '0'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Courier Performance */}
      {stats.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-slate-700" />
              Courier Performance (This Month)
            </CardTitle>
            <CardDescription>Orders delivered by each courier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.map((stat) => (
                <div key={stat.courierId} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{stat.courierName}</p>
                      <p className="text-xs text-slate-500">{stat.totalOrders} orders</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-slate-900">{formatCurrency(stat.totalRevenue)}</p>
                    <p className="text-xs text-slate-500">total</p>
                  </div>
                </div>
              ))}
              {stats.length === 0 && (
                <p className="text-center text-slate-500 py-4">No delivery data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Courier Management */}
      <Card className="border-[#C7A35A]/20 shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#0F3A2E] dark:text-[#FFFDF8]">
                <MapPin className="h-6 w-6" />
                Delivery Couriers
              </CardTitle>
              <CardDescription>Manage delivery team members</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {currentUser?.role === 'ADMIN' && (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-[200px]">
                    <Package className="h-4 w-4 mr-2" />
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
              )}

              <Button
                onClick={() => {
                  resetForm();
                  setDialogOpen(true);
                }}
                className="bg-gradient-to-r from-[#C7A35A] to-[#b88e3b] hover:from-[#b88e3b] hover:to-[#C7A35A] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Courier
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  fetchCouriers();
                  fetchStats();
                }}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-600">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : activeCouriers.length === 0 && inactiveCouriers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-600">
                      No couriers found. Add your first courier to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {activeCouriers.map((courier) => (
                      <TableRow key={courier.id}>
                        <TableCell className="font-medium">{courier.name}</TableCell>
                        <TableCell>
                          {courier.phone ? (
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <Phone className="h-3.5 w-3.5" />
                              {courier.phone}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>{courier.branch?.branchName || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {courier._count?.orders || 0} orders
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => toggleStatus(courier)}
                            >
                              🚫
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(courier)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(courier.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {inactiveCouriers.length > 0 && (
                      <>
                        <TableRow>
                          <TableCell colSpan={6} className="py-2">
                            <span className="text-xs text-slate-500 font-medium">INACTIVE</span>
                          </TableCell>
                        </TableRow>
                        {inactiveCouriers.map((courier) => (
                          <TableRow key={courier.id} className="bg-slate-50/50">
                            <TableCell className="font-medium text-slate-500">{courier.name}</TableCell>
                            <TableCell>
                              {courier.phone ? (
                                <div className="flex items-center gap-1 text-sm text-slate-500">
                                  <Phone className="h-3.5 w-3.5" />
                                  {courier.phone}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-500">{courier.branch?.branchName || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-slate-500">
                                {courier._count?.orders || 0} orders
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-slate-500">Inactive</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => toggleStatus(courier)}
                                >
                                  ✓
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEdit(courier)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDelete(courier.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Courier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="hidden" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCourier ? 'Edit Courier' : 'Add New Courier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter courier name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">Branch *</Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(value) => setFormData({ ...formData, branchId: value })}
                  disabled={currentUser?.role === 'BRANCH_MANAGER'}
                  required
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
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="isActive" className="text-sm cursor-pointer">
                  Active (can receive orders)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingCourier ? 'Update' : 'Add'} Courier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
