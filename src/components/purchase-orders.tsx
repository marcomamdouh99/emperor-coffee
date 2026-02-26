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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, RefreshCw, Package, ShoppingCart, CheckCircle, XCircle, Clock, Truck, FileText, Trash2 } from 'lucide-react';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

interface Supplier {
  id: string;
  name: string;
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
  items: PurchaseOrderItem[];
  creator: { name?: string };
  approver?: { name?: string };
}

interface PurchaseOrderItem {
  id: string;
  ingredient: Ingredient;
  quantity: number;
  unit: string;
  unitPrice: number;
  receivedQty: number;
}

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [orderItems, setOrderItems] = useState<{ ingredientId: string; quantity: number; unitPrice: number }[]>([]);

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, ingredientsRes, suppliersRes] = await Promise.all([
        fetch(`/api/purchase-orders?status=${statusFilter}`),
        fetch('/api/ingredients'),
        fetch('/api/suppliers'),
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
      orderNumber: `PO-${Date.now()}`,
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

  const approveOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to approve order:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                Purchase Orders
              </CardTitle>
              <CardDescription>Manage ingredient orders from suppliers</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter || 'all'} onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Order
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Purchase Order</DialogTitle>
                    <DialogDescription>Create a new purchase order from supplier</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={createOrder}>
                    <div className="grid gap-4 py-4">
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
                            <SelectItem value="cmhphh1x20002zv5e6zq068y4">Main Branch</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Expected Delivery Date</Label>
                        <Input type="date" name="expectedAt" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Order Items *</Label>
                        <div className="space-y-2">
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
                                className="w-24"
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
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.supplier.name}</TableCell>
                      <TableCell>{order.items.length} items</TableCell>
                      <TableCell>${order.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(order.status)}
                            {order.status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(order.orderedAt).toLocaleDateString()}
                        {order.expectedAt && (
                          <span className="block text-xs text-slate-500">
                            Exp: {new Date(order.expectedAt).toLocaleDateString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveOrder(order.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
