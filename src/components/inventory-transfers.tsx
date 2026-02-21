'use client';

import { useEffect, useState, Fragment } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, RefreshCw, ArrowRight, CheckCircle, Clock, Truck, XCircle, Package, Trash2, ChevronDown, ChevronUp, Box, Printer, FileText } from 'lucide-react';

interface User {
  id: string;
  role: 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER';
  branchId?: string;
  name?: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit?: number;
}

interface Branch {
  id: string;
  branchName: string;
}

interface TransferItem {
  ingredientId: string;
  quantity: number;
  unit: string;
  ingredient?: Ingredient;
  unitPrice?: number;
  totalPrice?: number;
}

interface InventoryTransfer {
  id: string;
  transferNumber: string;
  poNumber?: string;
  status: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  sourceBranch?: Branch;
  targetBranch: Branch;
  isPurchaseOrder: boolean;
  totalPrice?: number;
  items: TransferItem[];
  requestedAt: string;
  completedAt?: string;
  notes?: string;
}

export default function InventoryTransfers() {
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedSourceBranch, setSelectedSourceBranch] = useState<string>('');

  useEffect(() => {
    // Get user info
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [statusFilter, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('Fetching transfers data...');
      
      // Build query params based on user role
      let url = `/api/transfers?status=${statusFilter}`;
      // Branch managers should see transfers to/from their branch
      if (user?.role === 'BRANCH_MANAGER' && user.branchId) {
        url += `&targetBranchId=${user.branchId}`;
      }

      const [transfersRes, branchesRes, ingredientsRes] = await Promise.all([
        fetch(url),
        fetch('/api/branches'),
        fetch('/api/ingredients'),
      ]);

      console.log('Transfers response:', transfersRes.status);
      console.log('Branches response:', branchesRes.status);
      console.log('Ingredients response:', ingredientsRes.status);

      if (transfersRes.ok) {
        const data = await transfersRes.json();
        console.log('Transfers data:', data.transfers);
        setTransfers(data.transfers);
      } else {
        const errorText = await transfersRes.text();
        console.error('Failed to fetch transfers - Status:', transfersRes.status, 'Response:', errorText);
      }
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        console.log('Branches:', data.branches);
        setBranches(data.branches);
      } else {
        const errorText = await branchesRes.text();
        console.error('Failed to fetch branches - Status:', branchesRes.status, 'Response:', errorText);
      }
      if (ingredientsRes.ok) {
        const data = await ingredientsRes.json();
        console.log('Ingredients:', data.ingredients);
        setIngredients(data.ingredients);
      } else {
        const errorText = await ingredientsRes.text();
        console.error('Failed to fetch ingredients - Status:', ingredientsRes.status, 'Response:', errorText);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      console.log('Data fetch completed, loading:', false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4" />;
      case 'IN_TRANSIT':
        return <Truck className="h-4 w-4" />;
      case 'COMPLETED':
        return <Package className="h-4 w-4" />;
      case 'CANCELLED':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-700';
      case 'IN_TRANSIT':
        return 'bg-purple-100 text-purple-700';
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleAddItem = () => {
    setTransferItems([...transferItems, { ingredientId: '', quantity: 1, unit: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...transferItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Set unit and price based on ingredient
    if (field === 'ingredientId') {
      const ingredient = ingredients.find(i => i.id === value);
      updated[index].unit = ingredient?.unit || 'unit';
      updated[index].unitPrice = ingredient?.costPerUnit || 0;
      updated[index].totalPrice = (updated[index].quantity || 0) * (ingredient?.costPerUnit || 0);
    }
    
    // Recalculate total price when quantity changes
    if (field === 'quantity') {
      updated[index].totalPrice = value * (updated[index].unitPrice || 0);
    }
    
    setTransferItems(updated);
  };

  const createTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = new FormData(e.target as HTMLFormElement);
    const sourceBranchId = formData.get('sourceBranchId');
    const targetBranchId = formData.get('targetBranchId');
    const isPurchaseOrder = user?.role === 'BRANCH_MANAGER';

    // Calculate total price
    const totalPrice = transferItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    // For branch managers (Purchase Orders), targetBranchId should be their branch
    // For admins, sourceBranchId must be different from targetBranchId
    if (user?.role === 'ADMIN' && sourceBranchId === targetBranchId) {
      alert('Source and target branches must be different');
      return;
    }

    console.log('Creating transfer:', { sourceBranchId, targetBranchId, isPurchaseOrder, transferItems });

    const transferData: any = {
      targetBranchId,
      transferNumber: `TR-${Date.now()}`,
      notes: formData.get('notes'),
      items: transferItems
        .filter(item => item.ingredientId && item.quantity > 0)
        .map(item => ({
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit || ingredients.find(i => i.id === item.ingredientId)?.unit || 'unit',
          unitPrice: item.unitPrice || ingredients.find(i => i.id === item.ingredientId)?.costPerUnit,
          totalPrice: item.totalPrice || (item.quantity * (item.unitPrice || 0)),
        })),
    };

    // Only add sourceBranchId for regular transfers (admins)
    if (user?.role === 'ADMIN' && sourceBranchId) {
      transferData.sourceBranchId = sourceBranchId;
    }

    // Add PO-specific fields for branch managers
    if (isPurchaseOrder) {
      transferData.isPurchaseOrder = true;
      transferData.totalPrice = totalPrice;
    }

    console.log('Transfer data to send:', transferData);

    try {
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferData),
      });

      const responseData = await response.json();
      console.log('Transfer response:', { status: response.status, data: responseData });

      if (response.ok) {
        fetchData();
        setIsDialogOpen(false);
        setTransferItems([]);
      } else {
        console.error('Transfer error:', responseData);
        
        let errorMessage = 'Failed to create transfer';
        if (responseData.error) {
          errorMessage = responseData.error;
        }
        if (responseData.issues) {
          errorMessage = responseData.issues.map((i: any) => i.message).join(', ');
        }
        if (responseData.items && responseData.items.length > 0) {
          errorMessage += `\nInsufficient items:\n${responseData.items.map((i: any) => 
            `${i.ingredientId}: requested ${i.requested}, available ${i.available}`
          ).join('\n')}`;
        }
        
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Failed to create transfer:', error);
      alert('Failed to create transfer');
    }
  };

  const updateTransferStatus = async (transferId: string, status: string, sourceBranchId?: string) => {
    try {
      const body: any = { status, userId: user?.id };
      if (sourceBranchId) {
        body.sourceBranchId = sourceBranchId;
      }

      const response = await fetch(`/api/transfers/${transferId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        fetchData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update transfer');
      }
    } catch (error) {
      console.error('Failed to update transfer:', error);
    }
  };

  const printPurchaseOrder = async (transferId: string) => {
    try {
      const { getPrinter } = await import('@/lib/webusb-printer');
      const printer = getPrinter();

      // Check if connected, if not request device
      if (!printer.isConnected()) {
        await printer.requestDevice();
        await printer.connect();
      }

      // Fetch ESC/POS invoice data
      const response = await fetch(`/api/transfers/${transferId}/po-invoice`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch invoice');
      }

      // Print the invoice
      await printer.printBase64(data.escposData);
      alert('Purchase Order printed successfully!');
    } catch (error) {
      console.error('Failed to print:', error);
      alert(error instanceof Error ? error.message : 'Failed to print Purchase Order');
    }
  };

  const deleteTransfer = async (transferId: string) => {
    if (!confirm('Are you sure you want to delete this transfer?')) return;
    
    try {
      const response = await fetch(`/api/transfers/${transferId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete transfer');
      }
    } catch (error) {
      console.error('Failed to delete transfer:', error);
    }
  };

  const canManageTransfer = (transfer: InventoryTransfer) => {
    if (user?.role === 'ADMIN') return true;
    if (user?.role === 'BRANCH_MANAGER' && transfer.targetBranch.id === user.branchId) return true;
    return false;
  };

  const calculateOrderTotal = (items: TransferItem[]) => {
    return items.reduce((sum, item) => sum + (item.totalPrice || (item.unitPrice ? item.quantity * item.unitPrice : 0) || 0), 0);
  };

  const calculateItemTotal = (item: TransferItem) => {
    return item.totalPrice || (item.unitPrice ? item.quantity * item.unitPrice : 0) || 0;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-emerald-600" />
              Inventory Transfers
            </CardTitle>
            <CardDescription>
              {user?.role === 'BRANCH_MANAGER'
                ? 'Create Purchase Orders for your branch'
                : 'Manage inventory transfers and approve Purchase Orders'
              }
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Select value={statusFilter || 'all'} onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}>
              <SelectTrigger className="w-full sm:w-[150px] h-11">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={fetchData} className="h-11 flex-1 sm:flex-none">
                <RefreshCw className="h-4 w-4 mr-2" />
                <span>Refresh</span>
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 h-11 flex-1 sm:flex-none">
                    <Plus className="h-4 w-4 mr-2" />
                    <span>{user?.role === 'BRANCH_MANAGER' ? 'New Purchase Order' : 'New Transfer'}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{user?.role === 'BRANCH_MANAGER' ? 'Create Purchase Order' : 'Create Inventory Transfer'}</DialogTitle>
                    <DialogDescription>
                      {user?.role === 'BRANCH_MANAGER' 
                        ? 'Order inventory for your branch from headquarters'
                        : 'Transfer inventory between branches'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={createTransfer}>
                    <div className="grid gap-4 py-4">
                      {/* Branch Selection */}
                      {user?.role === 'BRANCH_MANAGER' ? (
                        // Branch Manager: Show target branch only (auto-selected to their branch)
                        <div className="grid gap-2">
                          <Label>Branch *</Label>
                          <input
                            type="hidden"
                            name="targetBranchId"
                            value={user.branchId}
                          />
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
                            <Package className="h-4 w-4 text-slate-500" />
                            <span className="font-medium">
                              {branches.find(b => b.id === user.branchId)?.branchName || 'Your Branch'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">Purchase Order will be sent to your branch</p>
                        </div>
                      ) : (
                        // Admin: Show both source and target branches
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Source Branch *</Label>
                            <Select name="sourceBranchId" required>
                              <SelectTrigger>
                                <SelectValue placeholder="From" />
                              </SelectTrigger>
                              <SelectContent>
                                {branches.map(b => (
                                  <SelectItem key={b.id} value={b.id}>{b.branchName}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Target Branch *</Label>
                            <Select name="targetBranchId" required>
                              <SelectTrigger>
                                <SelectValue placeholder="To" />
                              </SelectTrigger>
                              <SelectContent>
                                {branches.map(b => (
                                  <SelectItem key={b.id} value={b.id}>{b.branchName}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      <div className="grid gap-2">
                        <Label>Items *</Label>
                        <div className="space-y-2">
                          {transferItems.map((item, index) => {
                            const ingredient = ingredients.find(i => i.id === item.ingredientId);
                            const itemTotal = calculateItemTotal(item);
                            return (
                              <div key={index} className="flex items-center gap-2">
                                <Select 
                                  value={item.ingredientId} 
                                  onValueChange={(val) => handleItemChange(index, 'ingredientId', val)}
                                >
                                  <SelectTrigger className="flex-1 min-w-[150px]">
                                    <SelectValue placeholder="Select ingredient" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ingredients.map(ing => (
                                      <SelectItem key={ing.id} value={ing.id}>
                                        {ing.name}
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
                                <span className="text-sm text-slate-500 w-12">{item.unit}</span>
                                {ingredient && (
                                  <span className="text-sm text-slate-600 w-24 text-right">
                                    ${ingredient.costPerUnit?.toFixed(2) || '0.00'}/{item.unit}
                                  </span>
                                )}
                                {ingredient && (
                                  <span className="text-sm font-medium w-24 text-right">
                                    ${itemTotal.toFixed(2)}
                                  </span>
                                )}
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleRemoveItem(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                          <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Item
                          </Button>
                        </div>
                      </div>
                      {/* Order Total */}
                      {user?.role === 'BRANCH_MANAGER' && transferItems.length > 0 && (
                        <div className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                          <span className="font-semibold text-emerald-700">Order Total:</span>
                          <span className="font-bold text-emerald-700 text-lg">
                            ${calculateOrderTotal(transferItems).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Input name="notes" placeholder="Any additional notes..." />
                      </div>
                    </div>
                    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                      <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setTransferItems([]); }} className="w-full sm:w-auto h-11 min-h-[44px]">
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto h-11 min-h-[44px]">
                        {user?.role === 'BRANCH_MANAGER' ? 'Create Purchase Order' : 'Create Transfer'}
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
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Box className="h-12 w-12 mb-4 text-slate-400" />
              <p>No transfers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="min-w-[900px] md:min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Transfer #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From → To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {user?.role === 'ADMIN' && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((transfer) => (
                    <Fragment key={transfer.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRow(transfer.id)}
                            className="h-8 w-8 p-0"
                          >
                            {expandedRows.has(transfer.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{transfer.transferNumber}</span>
                            {transfer.poNumber && (
                              <span className="text-xs text-slate-500">PO: {transfer.poNumber}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {transfer.isPurchaseOrder ? (
                            <Badge className="bg-purple-100 text-purple-700">
                              <FileText className="h-3 w-3 mr-1" />
                              PO
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700">
                              Transfer
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            {transfer.sourceBranch && (
                              <>
                                <span>{transfer.sourceBranch.branchName}</span>
                                <ArrowRight className="h-3 w-3 text-slate-400" />
                              </>
                            )}
                            {!transfer.sourceBranch && transfer.isPurchaseOrder && (
                              <span className="text-slate-400 italic">HQ</span>
                            )}
                            <span>{transfer.targetBranch.branchName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(transfer.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(transfer.status)}
                              {transfer.status.replace('_', ' ')}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(transfer.requestedAt).toLocaleDateString()}
                          {transfer.completedAt && (
                            <span className="block text-xs text-slate-500">
                              Completed: {new Date(transfer.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {transfer.totalPrice !== undefined && transfer.totalPrice !== null ? (
                            <span>${transfer.totalPrice.toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        {user?.role === 'ADMIN' && (
                          <TableCell className="text-right">
                            {transfer.status === 'PENDING' && canManageTransfer(transfer) && (
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                {transfer.isPurchaseOrder ? (
                                  <>
                                    {/* Show source branch selector for PO approval */}
                                    <Select
                                      onValueChange={(value) => {
                                        setSelectedSourceBranch(value);
                                      }}
                                    >
                                      <SelectTrigger className="w-[140px] h-8">
                                        <SelectValue placeholder="Source" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {branches.map(b => (
                                          <SelectItem key={b.id} value={b.id}>{b.branchName}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (!selectedSourceBranch) {
                                          alert('Please select a source branch');
                                          return;
                                        }
                                        updateTransferStatus(transfer.id, 'APPROVED', selectedSourceBranch);
                                      }}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Approve
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateTransferStatus(transfer.id, 'APPROVED')}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteTransfer(transfer.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            {transfer.status === 'APPROVED' && canManageTransfer(transfer) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateTransferStatus(transfer.id, 'IN_TRANSIT')}
                              >
                                <Truck className="h-4 w-4 mr-1" />
                                Ship
                              </Button>
                            )}
                            {transfer.status === 'IN_TRANSIT' && canManageTransfer(transfer) && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => updateTransferStatus(transfer.id, 'COMPLETED')}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                      {expandedRows.has(transfer.id) && (
                        <TableRow>
                          <TableCell colSpan={user?.role === 'ADMIN' ? 8 : 7}>
                            <div className="p-4 bg-slate-50 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  <Package className="h-4 w-4" />
                                  Transfer Items ({(transfer.items || []).length})
                                </h4>
                                {transfer.isPurchaseOrder && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => printPurchaseOrder(transfer.id)}
                                    className="h-8"
                                  >
                                    <Printer className="h-4 w-4 mr-1" />
                                    Print PO
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-2">
                                {(transfer.items || []).map((item) => {
                                  const itemTotal = calculateItemTotal(item);
                                  const unitPrice = item.unitPrice || item.ingredient?.costPerUnit || 0;
                                  return (
                                    <div key={`${transfer.id}-${item.ingredientId}`} className="flex items-center justify-between text-sm py-2 border-b border-slate-200 last:border-0">
                                      <span className="font-medium flex-1">{item.ingredient?.name || item.ingredientId}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-slate-600">{item.quantity} {item.unit}</span>
                                        {unitPrice > 0 && (
                                          <span className="text-slate-500">
                                            @ ${unitPrice.toFixed(2)}/{item.unit}
                                          </span>
                                        )}
                                        {itemTotal > 0 && (
                                          <span className="font-semibold text-emerald-600">
                                            ${itemTotal.toFixed(2)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {transfer.totalPrice && transfer.totalPrice > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                                  <span className="font-semibold text-sm">Order Total:</span>
                                  <span className="font-bold text-lg text-emerald-600">${transfer.totalPrice.toFixed(2)}</span>
                                </div>
                              )}
                              {transfer.notes && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <p className="text-xs text-slate-500"><strong>Notes:</strong> {transfer.notes}</p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
