'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Package,
  Store, X, AlertCircle, CheckCircle, Clock, TrendingUp, Calendar,
  MoreHorizontal, ChevronDown, ChevronUp, UserPlus, Home, User, Star, Trophy,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  totalOrders: number;
  loyaltyPoints?: number;
  totalSpent?: number;
  tier?: string;
  branchId?: string;
  branchName?: string | null;
  addresses: CustomerAddress[];
  createdAt: string;
}

interface CustomerAddress {
  id: string;
  building?: string;
  streetAddress: string;
  floor?: string;
  apartment?: string;
  deliveryAreaId?: string;
  orderCount: number;
  isDefault: boolean;
}

interface Branch {
  id: string;
  branchName: string;
}

interface DeliveryArea {
  id: string;
  name: string;
  fee: number;
}

export default function CustomerManagement() {
  const { user } = useAuth();
  const { currency, t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    branchId: '',
    notes: '',
  });
  const [addressForm, setAddressForm] = useState({
    building: '',
    streetAddress: '',
    floor: '',
    apartment: '',
    deliveryAreaId: '',
    isDefault: false,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
    fetchBranches();
    fetchDeliveryAreas();
  }, []);

  // Filter and paginate customers
  const filteredCustomers = searchQuery
    ? customers.filter(customer =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.includes(searchQuery) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : customers;

  // Calculate pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, customers]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('currentUserRole', user?.role || '');
      params.append('currentUserBranchId', user?.branchId || '');

      const response = await fetch(`/api/customers?${params.toString()}`);
      const data = await response.json();
      if (response.ok) {
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches');
      const data = await response.json();
      if (response.ok) {
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const fetchDeliveryAreas = async () => {
    try {
      const response = await fetch('/api/delivery-areas');
      const data = await response.json();
      if (response.ok) {
        setDeliveryAreas(data.areas || []);
      }
    } catch (error) {
      console.error('Failed to fetch delivery areas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          addresses: [addressForm],
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Customer created successfully!');
        setDialogOpen(false);
        resetForms();
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Create customer error:', error);
      alert('Failed to create customer');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Customer updated successfully!');
        setSelectedCustomer(null);
        resetForms();
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to update customer');
      }
    } catch (error) {
      console.error('Update customer error:', error);
      alert('Failed to update customer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Customer deleted successfully!');
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to delete customer');
      }
    } catch (error) {
      console.error('Delete customer error:', error);
      alert('Failed to delete customer');
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      branchId: customer.branchId || '',
      notes: customer.notes || '',
    });
    setDialogOpen(true);
  };

  const handleAddAddress = (customer: Customer) => {
    setSelectedCustomer(customer);
    setAddressForm({
      building: '',
      streetAddress: '',
      floor: '',
      apartment: '',
      deliveryAreaId: '',
      isDefault: false,
    });
    setEditingAddress(null);
    setAddressDialogOpen(true);
  };

  const handleEditAddress = (customer: Customer, address: CustomerAddress) => {
    setSelectedCustomer(customer);
    setEditingAddress(address);
    setAddressForm({ ...address });
    setAddressDialogOpen(true);
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      const response = await fetch(`/api/customer-addresses/${addressId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Address deleted successfully!');
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to delete address');
      }
    } catch (error) {
      console.error('Delete address error:', error);
      alert('Failed to delete address');
    }
  };

  const handleSaveAddress = async () => {
    if (!selectedCustomer) return;

    try {
      const url = editingAddress
        ? `/api/customer-addresses/${editingAddress.id}`
        : `/api/customers/${selectedCustomer.id}/addresses`;

      const method = editingAddress ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressForm),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(editingAddress ? 'Address updated successfully!' : 'Address added successfully!');
        setAddressDialogOpen(false);
        setAddressForm({
          building: '',
          streetAddress: '',
          floor: '',
          apartment: '',
          deliveryAreaId: '',
          isDefault: false,
        });
        setEditingAddress(null);
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to save address');
      }
    } catch (error) {
      console.error('Save address error:', error);
      alert('Failed to save address');
    }
  };

  const resetForms = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      branchId: '',
      notes: '',
    });
    setAddressForm({
      building: '',
      streetAddress: '',
      floor: '',
      apartment: '',
      deliveryAreaId: '',
      isDefault: false,
    });
  };

  const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);
  const activeCustomers = customers.filter(c => c.totalOrders > 0).length;

  const getTierColor = (tier?: string) => {
    const colors: Record<string, string> = {
      BRONZE: 'bg-amber-100 text-amber-700 border-amber-200',
      SILVER: 'bg-slate-100 text-slate-700 border-slate-300',
      GOLD: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      PLATINUM: 'bg-purple-100 text-purple-700 border-purple-300',
    };
    return colors[tier || 'BRONZE'] || colors['BRONZE'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
          <div className="text-slate-600">Loading customers...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-safe">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">Total Customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{customers.length}</span>
              <Users className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">Active Customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{activeCustomers}</span>
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">Total Orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{totalOrders}</span>
              <Package className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="flex flex-col flex-1 min-h-0">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Customer Database</CardTitle>
              <CardDescription>
                Manage all customer information and delivery addresses
                {user?.role === 'BRANCH_MANAGER' && ' (Your branch only)'}
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto h-11">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{selectedCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                  <DialogDescription>
                    {selectedCustomer ? 'Update customer information' : 'Enter customer details to add to the database'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={selectedCustomer ? (e) => { e.preventDefault(); handleUpdate(selectedCustomer.id); } : handleSubmit}>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="John Doe"
                          required
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="01012345678"
                          required
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@example.com"
                        className="h-11"
                      />
                    </div>

                    {user?.role === 'ADMIN' && (
                      <div className="space-y-2">
                        <Label htmlFor="branch">Branch</Label>
                        <Select value={formData.branchId} onValueChange={(value) => setFormData({ ...formData, branchId: value })}>
                          <SelectTrigger className="h-11">
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
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes about this customer..."
                        rows={3}
                        className="min-h-[88px]"
                      />
                    </div>

                    {/* Address fields only shown when adding new customer */}
                    {!selectedCustomer && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <Label>Delivery Address</Label>
                          <p className="text-sm text-slate-500">Add a default delivery address for this customer</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="deliveryArea">Default Delivery Area</Label>
                          <Select value={addressForm.deliveryAreaId} onValueChange={(value) => setAddressForm({ ...addressForm, deliveryAreaId: value })}>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select delivery area" />
                            </SelectTrigger>
                            <SelectContent>
                              {deliveryAreas.map((area) => (
                                <SelectItem key={area.id} value={area.id}>
                                  {area.name} ({currency} {area.fee})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="streetAddress">Street Address *</Label>
                          <Input
                            id="streetAddress"
                            value={addressForm.streetAddress}
                            onChange={(e) => setAddressForm({ ...addressForm, streetAddress: e.target.value })}
                            placeholder="123 Main Street"
                            required={!selectedCustomer}
                            className="h-11"
                          />
                        </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="building">Building</Label>
                        <Input
                          id="building"
                          value={addressForm.building}
                          onChange={(e) => setAddressForm({ ...addressForm, building: e.target.value })}
                          placeholder="Tower A"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="floor">Floor</Label>
                        <Input
                          id="floor"
                          value={addressForm.floor}
                          onChange={(e) => setAddressForm({ ...addressForm, floor: e.target.value })}
                          placeholder="5"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apartment">Apartment</Label>
                        <Input
                          id="apartment"
                          value={addressForm.apartment}
                          onChange={(e) => setAddressForm({ ...addressForm, apartment: e.target.value })}
                          placeholder="12"
                          className="h-11"
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="isDefault"
                              checked={addressForm.isDefault}
                              onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                              className="h-5 w-5 rounded border-gray-300 focus:ring-primary"
                            />
                            <Label htmlFor="isDefault" className="text-sm cursor-pointer">Set as default address</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                    </>
                    )}
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2 pb-safe">
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForms(); }} className="w-full sm:w-auto h-11">
                      Cancel
                    </Button>
                    <Button type="submit" className="w-full sm:w-auto h-11">
                      {selectedCustomer ? 'Update Customer' : 'Create Customer'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0 p-4 sm:p-6">
          {/* Search */}
          <div className="mb-4 flex-shrink-0">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-11 w-full"
              />
            </div>
          </div>

          {/* Customers List */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="flex-1">
              {filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Users className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-lg font-medium">No customers found</p>
                  <p className="text-sm">Add your first customer to get started</p>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {displayedCustomers.map((customer) => (
                    <Card key={customer.id} className="border hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center flex-shrink-0">
                              <User className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-semibold">{customer.name}</h3>
                                {customer.totalOrders > 0 && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 w-fit">
                                    <Package className="h-3 w-3 mr-1" />
                                    {customer.totalOrders} {customer.totalOrders === 1 ? 'order' : 'orders'}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 sm:gap-4 text-sm text-slate-600 dark:text-slate-400">
                                {customer.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="break-all">{customer.phone}</span>
                                  </div>
                                )}
                                {customer.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate break-all">{customer.email}</span>
                                  </div>
                                )}
                                {customer.branchName && (
                                  <div className="flex items-center gap-1">
                                    <Store className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>{customer.branchName}</span>
                                  </div>
                                )}
                              </div>

                              {customer.notes && (
                                <p className="text-sm text-slate-500 line-clamp-2">
                                  {customer.notes}
                                </p>
                              )}

                              {/* Loyalty Information */}
                              {(customer.loyaltyPoints !== undefined || customer.totalSpent !== undefined || customer.tier) && (
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                    {customer.loyaltyPoints !== undefined && (
                                      <div className="flex items-center gap-2">
                                        <Star className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                                        <div>
                                          <span className="text-slate-500">{customer.loyaltyPoints.toFixed(2)} pts</span>
                                        </div>
                                      </div>
                                    )}
                                    {customer.totalSpent !== undefined && (
                                      <div className="flex items-center gap-2">
                                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                                        <div>
                                          <span className="text-slate-500">{currency} {customer.totalSpent.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    )}
                                    {customer.tier && (
                                      <div className="flex items-center gap-2">
                                        <Trophy className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                                        <Badge className={getTierColor(customer.tier)}>
                                          {customer.tier}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 sm:flex-col">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditCustomer(customer)}
                            className="h-11 w-11 sm:w-auto sm:h-9 px-3"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(customer.id)}
                            className="h-11 w-11 sm:w-auto sm:h-9 px-3"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Addresses Section */}
                      {customer.addresses.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              Delivery Addresses ({customer.addresses.length})
                            </h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddAddress(customer)}
                              className="h-10 w-full sm:w-auto"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Address
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {customer.addresses.map((address) => (
                              <div
                                key={address.id}
                                className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <h5 className="font-medium text-sm">
                                      {[address.building, address.streetAddress, address.floor && `${address.floor} Floor`, address.apartment && `Apt ${address.apartment}`].filter(Boolean).join(', ')}
                                    </h5>
                                    {address.isDefault && (
                                      <Badge variant="secondary" className="text-xs w-fit">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Package className="h-3 w-3" />
                                      {address.orderCount} deliveries
                                    </span>
                                    {deliveryAreas.find(a => a.id === address.deliveryAreaId) && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {deliveryAreas.find(a => a.id === address.deliveryAreaId)?.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 sm:flex-col">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditAddress(customer, address)}
                                    className="h-9 w-9 sm:w-auto sm:h-8 px-2"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteAddress(address.id)}
                                    className="h-9 w-9 sm:w-auto sm:h-8 px-2"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {customer.addresses.length === 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-center">
                          <p className="text-sm text-slate-500 mb-2">No delivery addresses yet</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddAddress(customer)}
                            className="h-10 w-full sm:w-auto"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add First Address
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                </div>
              )}
            </ScrollArea>

            {/* Pagination Controls - Outside ScrollArea */}
            {totalPages > 1 && (
              <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {filteredCustomers.length} customer{filteredCustomers.length === 1 ? '' : 's'}
                    {searchQuery && ' matching "' + searchQuery + '"'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-9 w-9 sm:h-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-9 w-9 sm:h-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Address Dialog */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Edit Address' : 'Add Delivery Address'}
            </DialogTitle>
            <DialogDescription>
              {editingAddress ? 'Update delivery address information' : 'Add a new delivery address for this customer'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="streetAddress">Street Address *</Label>
              <Input
                id="streetAddress"
                value={addressForm.streetAddress}
                onChange={(e) => setAddressForm({ ...addressForm, streetAddress: e.target.value })}
                placeholder="123 Main Street"
                required
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="building">Building</Label>
                <Input
                  id="building"
                  value={addressForm.building}
                  onChange={(e) => setAddressForm({ ...addressForm, building: e.target.value })}
                  placeholder="Tower A"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor">Floor</Label>
                <Input
                  id="floor"
                  value={addressForm.floor}
                  onChange={(e) => setAddressForm({ ...addressForm, floor: e.target.value })}
                  placeholder="5"
                  className="h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apartment">Apartment</Label>
              <Input
                id="apartment"
                value={addressForm.apartment}
                onChange={(e) => setAddressForm({ ...addressForm, apartment: e.target.value })}
                placeholder="12"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryArea">Delivery Area</Label>
              <Select value={addressForm.deliveryAreaId} onValueChange={(value) => setAddressForm({ ...addressForm, deliveryAreaId: value })}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select delivery area" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryAreas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name} ({currency} {area.fee})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isDefault"
                checked={addressForm.isDefault}
                onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                className="h-5 w-5 rounded border-gray-300 focus:ring-primary"
              />
              <Label htmlFor="isDefault" className="text-sm cursor-pointer">Set as default address</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pb-safe">
            <Button variant="outline" onClick={() => { setAddressDialogOpen(false); setEditingAddress(null); }} className="w-full sm:w-auto h-11">
              Cancel
            </Button>
            <Button onClick={handleSaveAddress} className="w-full sm:w-auto h-11">
              {editingAddress ? 'Update Address' : 'Add Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
