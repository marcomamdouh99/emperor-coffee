'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw, Package, ShoppingCart, CheckCircle, XCircle, Clock, Truck, FileText, Trash2, Printer, Download, Eye, Edit, Calendar, Filter, TrendingUp, AlertCircle, DollarSign, BarChart3 } from 'lucide-react';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  reorderThreshold: number;
}

interface Supplier {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  branchName: string;
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'APPROVED' | 'RECEIVED' | 'PARTIAL' | 'CANCELLED';
  totalAmount: number;
  orderedAt: string;
  expectedAt?: string;
  receivedAt?: string;
  notes?: string;
  supplier: Supplier;
  branch: Branch;
  items: PurchaseOrderItem[];
  creator: { name?: string; username?: string };
  approver?: { name?: string; username?: string };
}

interface PurchaseOrderItem {
  id: string;
  ingredient: Ingredient;
  quantity: number;
  unit: string;
  unitPrice: number;
  receivedQty: number;
}

export default function PurchaseOrdersManagement() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form data
  const [orderItems, setOrderItems] = useState<{ ingredientId: string; quantity: number; unitPrice: number }[]>([]);
  const [receiveItems, setReceiveItems] = useState<{ itemId: string; receivedQty: number }[]>([]);

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [statusFilter, periodFilter, startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (periodFilter !== 'all') params.append('period', periodFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const [ordersRes, ingredientsRes, suppliersRes, branchesRes, analyticsRes] = await Promise.all([
        fetch(`/api/purchase-orders?${params.toString()}`),
        fetch('/api/ingredients'),
        fetch('/api/suppliers'),
        fetch('/api/branches'),
        fetch(`/api/purchase-orders/analytics?period=${periodFilter}${statusFilter ? '&status=' + statusFilter : ''}`),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.purchaseOrders);
      }
      if (ingredientsRes.ok) {
        const data = await ingredientsRes.json();
        setIngredients(data.ingredients);
      }
      if (suppliersRes.ok) {
        const data = await suppliersRes.json();
        setSuppliers(data.suppliers);
      }
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(data.branches);
      }
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4" />;
      case 'RECEIVED':
        return <Package className="h-4 w-4" />;
      case 'PARTIAL':
        return <Truck className="h-4 w-4" />;
      case 'CANCELLED':
        return <XCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-700';
      case 'RECEIVED':
        return 'bg-emerald-100 text-emerald-700';
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const handleAddItem = () => {
    setOrderItems([...orderItems, { ingredientId: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    setOrderItems(updated);
  };

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const orderData = {
      supplierId: formData.get('supplierId'),
      branchId: formData.get('branchId'),
      orderNumber: `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Date.now().toString().slice(-4)}`,
      expectedAt: formData.get('expectedAt'),
      notes: formData.get('notes'),
      items: orderItems.filter(item => item.ingredientId && item.quantity > 0).map(item => {
        const ingredient = ingredients.find(i => i.id === item.ingredientId);
        return {
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: ingredient?.unit || 'unit',
          unitPrice: item.unitPrice || ingredient?.costPerUnit || 0,
        };
      }),
    };

    if (orderData.items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        fetchData();
        setIsDialogOpen(false);
        setOrderItems([]);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order');
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update order');
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      alert('Failed to update order');
    }
  };

  const handleCancelOrder = async () => {
    if (!cancellingOrderId) return;

    try {
      const response = await fetch(`/api/purchase-orders/${cancellingOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });

      if (response.ok) {
        fetchData();
        setIsCancelDialogOpen(false);
        setCancellingOrderId(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Failed to cancel order:', error);
      alert('Failed to cancel order');
    }
  };

  const handleReceiveOrder = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setReceiveItems(order.items.map(item => ({
      itemId: item.id,
      receivedQty: item.quantity - item.receivedQty,
    })));
    setIsReceiveDialogOpen(true);
  };

  const submitReceive = async () => {
    if (!selectedOrder) return;

    try {
      const response = await fetch(`/api/purchase-orders/${selectedOrder.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'receive',
          items: receiveItems,
        }),
      });

      if (response.ok) {
        fetchData();
        setIsReceiveDialogOpen(false);
        setSelectedOrder(null);
        setReceiveItems([]);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to receive items');
      }
    } catch (error) {
      console.error('Failed to receive items:', error);
      alert('Failed to receive items');
    }
  };

  const handleViewOrder = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsViewDialogOpen(true);
  };

  const handlePrintInvoice = async (orderId: string) => {
    try {
      // Fetch the full order details with all related data
      const response = await fetch(`/api/purchase-orders/${orderId}`);
      if (!response.ok) {
        alert('Failed to fetch order details');
        return;
      }

      const data = await response.json();
      const order = data.purchaseOrder;

      if (!order) {
        alert('Order not found');
        return;
      }

      // Generate printable HTML invoice
      const invoiceHTML = generateInvoiceHTML(order);

      // Open in new window and print
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();

        // Wait for content to load, then print
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (error) {
      console.error('Failed to print invoice:', error);
      alert('Failed to print invoice');
    }
  };

  const generateInvoiceHTML = (order: PurchaseOrder): string => {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Purchase Order - ${order.orderNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
      padding: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @media print {
      @page {
        margin: 0;
        padding: 0;
        size: A4;
      }

      body {
        margin: 0;
        padding: 0;
      }
    }

    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      background: white;
      padding: 20mm;
      max-width: 210mm;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
    }

    .header h1 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
      color: #000;
    }

    .header .subtitle {
      font-size: 16px;
      margin-bottom: 5px;
      color: #000;
    }

    .order-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 20px;
      padding: 15px;
      background: #f5f5f5;
      border: 1px solid #ddd;
    }

    .order-info div {
      color: #000;
    }

    .info-label {
      font-weight: bold;
      color: #000;
    }

    .section {
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #000;
      border-bottom: 1px solid #000;
      padding-bottom: 5px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }

    .items-table th {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
      background: #f5f5f5;
      font-weight: bold;
      color: #000;
    }

    .items-table td {
      border: 1px solid #000;
      padding: 8px;
      color: #000;
    }

    .items-table .text-right {
      text-align: right;
    }

    .items-table .text-center {
      text-align: center;
    }

    .totals {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      width: 200px;
      margin: 5px 0;
      color: #000;
    }

    .total-row.grand-total {
      font-size: 16px;
      font-weight: bold;
      border-top: 2px solid #000;
      padding-top: 5px;
      margin-top: 10px;
    }

    .notes {
      padding: 15px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      margin-bottom: 20px;
      color: #000;
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #000;
      color: #000;
    }

    .status {
      display: inline-block;
      padding: 4px 12px;
      font-weight: bold;
      border-radius: 4px;
      color: #000;
      border: 2px solid #000;
    }

    .received-qty {
      color: ${order.status === 'RECEIVED' ? 'green' : '#000'};
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${order.branch.branchName}</h1>
    <div class="subtitle">PURCHASE ORDER</div>
    <div class="subtitle" style="border: 2px solid #000; display: inline-block; padding: 5px 20px;">${order.orderNumber}</div>
  </div>

  <div class="order-info">
    <div><span class="info-label">Status:</span> <span class="status">${order.status}</span></div>
    <div><span class="info-label">Order Date:</span> ${formatDate(order.orderedAt)}</div>
    <div><span class="info-label">Expected:</span> ${order.expectedAt ? formatDate(order.expectedAt) : '-'}</div>
    ${order.receivedAt ? `<div><span class="info-label">Received:</span> ${formatDate(order.receivedAt)}</div>` : ''}
    <div><span class="info-label">Created By:</span> ${order.creator.name || order.creator.username}</div>
    ${order.approver ? `<div><span class="info-label">Approved By:</span> ${order.approver.name || order.approver.username}</div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">SUPPLIER INFORMATION</div>
    <div><span class="info-label">Name:</span> ${order.supplier.name}</div>
    ${order.supplier.contactPerson ? `<div><span class="info-label">Contact:</span> ${order.supplier.contactPerson}</div>` : ''}
    ${order.supplier.phone ? `<div><span class="info-label">Phone:</span> ${order.supplier.phone}</div>` : ''}
    ${order.supplier.email ? `<div><span class="info-label">Email:</span> ${order.supplier.email}</div>` : ''}
    ${order.supplier.address ? `<div><span class="info-label">Address:</span> ${order.supplier.address}</div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">DELIVER TO</div>
    <div>${order.branch.branchName}</div>
    ${order.branch.address ? `<div>${order.branch.address}</div>` : ''}
    ${order.branch.phone ? `<div>Phone: ${order.branch.phone}</div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">ORDER ITEMS</div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40%">Item</th>
          <th class="text-center" style="width: 10%">Qty</th>
          <th class="text-center" style="width: 10%">Unit</th>
          <th class="text-right" style="width: 20%">Unit Price</th>
          <th class="text-right" style="width: 20%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map(item => `
          <tr>
            <td>${item.ingredient.name}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-center">${item.unit}</td>
            <td class="text-right">${formatCurrency(item.unitPrice)}</td>
            <td class="text-right font-bold">${formatCurrency(item.quantity * item.unitPrice)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div>
        <div class="total-row grand-total">
          <span>TOTAL:</span>
          <span>${formatCurrency(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  </div>

  ${order.notes ? `
  <div class="section">
    <div class="section-title">NOTES</div>
    <div class="notes">${order.notes}</div>
  </div>
  ` : ''}

  <div class="footer">
    <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">Thank you for your business!</div>
    <div>Generated: ${new Date().toLocaleString()}</div>
    <div>${order.branch.branchName} - Purchase Order System</div>
  </div>

  <script>
    // Auto-print when loaded
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `.trim();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (periodFilter !== 'all') params.append('period', periodFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/purchase-orders/export?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `purchase-orders-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('Failed to export orders');
      }
    } catch (error) {
      console.error('Failed to export orders:', error);
      alert('Failed to export orders');
    }
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => {
      const ingredient = ingredients.find(i => i.id === item.ingredientId);
      const price = item.unitPrice || ingredient?.costPerUnit || 0;
      return sum + (item.quantity * price);
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-emerald-600" />
                    Purchase Orders
                  </CardTitle>
                  <CardDescription>Manage ingredient orders from suppliers</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={statusFilter || 'all'} onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="RECEIVED">Received</SelectItem>
                      <SelectItem value="PARTIAL">Partial</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7">Last 7 Days</SelectItem>
                      <SelectItem value="30">Last 30 Days</SelectItem>
                      <SelectItem value="90">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>

                  {periodFilter === 'all' && (
                    <>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-[140px]"
                      />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-[140px]"
                      />
                    </>
                  )}

                  <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>

                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>

                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="h-4 w-4 mr-2" />
                        New Order
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create Purchase Order</DialogTitle>
                        <DialogDescription>Create a new purchase order from supplier</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={createOrder}>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label>Supplier *</Label>
                              <Select name="supplierId" required>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                  {suppliers.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Branch *</Label>
                              <Select name="branchId" required>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                                <SelectContent>
                                  {branches.map(b => (
                                    <SelectItem key={b.id} value={b.id}>{b.branchName}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label>Expected Delivery Date</Label>
                            <Input type="date" name="expectedAt" />
                          </div>
                          <div className="grid gap-2">
                            <Label>Order Items *</Label>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {orderItems.map((item, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Select
                                    value={item.ingredientId}
                                    onValueChange={(val) => handleItemChange(index, 'ingredientId', val)}
                                  >
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Select ingredient" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ingredients.map(ing => (
                                        <SelectItem key={ing.id} value={ing.id}>
                                          {ing.name} ({ing.unit})
                                          {ing.reorderThreshold > 0 && (
                                            <span className="ml-2 text-xs text-orange-600">
                                              (Reorder: {ing.reorderThreshold})
                                            </span>
                                          )}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Qty"
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                                    className="w-20"
                                  />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Price"
                                    value={item.unitPrice}
                                    onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value))}
                                    className="w-24"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Item
                              </Button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="font-semibold">Total:</span>
                            <span className="text-2xl font-bold text-emerald-600">{formatCurrency(calculateTotal())}</span>
                          </div>
                          <div className="grid gap-2">
                            <Label>Notes</Label>
                            <Input name="notes" placeholder="Any additional notes..." />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setOrderItems([]); }}>
                            Cancel
                          </Button>
                          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                            Create Order
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO #</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ordered</TableHead>
                        <TableHead>Expected</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{order.supplier.name}</TableCell>
                          <TableCell>{order.branch.branchName}</TableCell>
                          <TableCell>{order.items.length} items</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(order.totalAmount)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status)}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(order.status)}
                                {order.status}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(order.orderedAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {order.expectedAt ? new Date(order.expectedAt).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewOrder(order)}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(order.status === 'PENDING' || order.status === 'APPROVED') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReceiveOrder(order)}
                                  title="Receive Items"
                                >
                                  <Package className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintInvoice(order.id)}
                                title="Print Invoice"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              {order.status === 'PENDING' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setCancellingOrderId(order.id);
                                    setIsCancelDialogOpen(true);
                                  }}
                                  title="Cancel Order"
                                  className="text-red-600"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {orders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                            No purchase orders found. Create your first order to get started.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          {analytics ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-90">Total Orders</p>
                        <p className="text-3xl font-bold">{analytics.summary.totalOrders}</p>
                      </div>
                      <ShoppingCart className="h-10 w-10 opacity-20" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-90">Total Amount</p>
                        <p className="text-2xl font-bold">{formatCurrency(analytics.summary.totalAmount)}</p>
                      </div>
                      <DollarSign className="h-10 w-10 opacity-20" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-90">Pending</p>
                        <p className="text-3xl font-bold">{analytics.summary.pendingOrders}</p>
                      </div>
                      <Clock className="h-10 w-10 opacity-20" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-90">Overdue</p>
                        <p className="text-3xl font-bold">{analytics.summary.overdueOrders}</p>
                      </div>
                      <AlertCircle className="h-10 w-10 opacity-20" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Status Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    Status Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(analytics.statusBreakdown).map(([status, data]: [string, any]) => (
                      <Card key={status}>
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Badge className={getStatusColor(status)}>{status}</Badge>
                            <p className="text-3xl font-bold mt-2">{data.count}</p>
                            <p className="text-sm text-slate-600">{formatCurrency(data.amount)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Suppliers */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Suppliers by Spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.topSuppliers.map((supplier: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <span className="font-medium">{supplier.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-emerald-600">{formatCurrency(supplier.amount)}</p>
                          <p className="text-sm text-slate-600">{supplier.orders} orders</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-slate-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No analytics data available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>Full details of the purchase order</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Supplier</Label>
                  <p className="font-medium">{selectedOrder.supplier.name}</p>
                </div>
                <div>
                  <Label>Branch</Label>
                  <p className="font-medium">{selectedOrder.branch.branchName}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={getStatusColor(selectedOrder.status)}>{selectedOrder.status}</Badge>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <p className="font-semibold text-emerald-600">{formatCurrency(selectedOrder.totalAmount)}</p>
                </div>
                <div>
                  <Label>Ordered Date</Label>
                  <p>{new Date(selectedOrder.orderedAt).toLocaleString()}</p>
                </div>
                <div>
                  <Label>Expected Date</Label>
                  <p>{selectedOrder.expectedAt ? new Date(selectedOrder.expectedAt).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <Label>Created By</Label>
                  <p>{selectedOrder.creator.name || selectedOrder.creator.username}</p>
                </div>
                <div>
                  <Label>Approved By</Label>
                  <p>{selectedOrder.approver?.name || selectedOrder.approver?.username || '-'}</p>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm text-slate-600 mt-1">{selectedOrder.notes}</p>
                </div>
              )}

              <div>
                <Label className="mb-2 block">Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.ingredient.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.unit}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.receivedQty >= item.quantity ? 'default' : 'secondary'}>
                            {item.receivedQty} / {item.quantity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => handlePrintInvoice(selectedOrder?.id || '')}>
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
            </Button>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Items Dialog */}
      <Dialog open={isReceiveDialogOpen} onOpenChange={setIsReceiveDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive Items - {selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>Enter received quantities for each item</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Already Received</TableHead>
                    <TableHead className="text-right">Receiving</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.items.map((item) => {
                    const remaining = item.quantity - item.receivedQty;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.ingredient.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.receivedQty}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={remaining}
                            value={receiveItems.find(r => r.itemId === item.id)?.receivedQty || 0}
                            onChange={(e) => {
                              const updated = receiveItems.map(r =>
                                r.itemId === item.id
                                  ? { ...r, receivedQty: parseFloat(e.target.value) || 0 }
                                  : r
                              );
                              setReceiveItems(updated);
                            }}
                            className="w-24"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitReceive}>
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this purchase order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancellingOrderId(null)}>No, keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} className="bg-red-600 hover:bg-red-700">
              Yes, cancel it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
