'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit, Users, Utensils, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface TableData {
  id: string;
  tableNumber: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'READY_TO_PAY' | 'RESERVED' | 'CLEANING';
  capacity: number | null;
  notes: string | null;
  totalAmount: number;
  customer?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  opener?: {
    id: string;
    name: string;
    username: string;
  } | null;
  closer?: {
    id: string;
    name: string;
    username: string;
  } | null;
  openedAt: string | null;
  closedAt: string | null;
}

interface TableManagementProps {
  branchId?: string;
}

export default function TableManagement({ branchId: propBranchId }: TableManagementProps) {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [branches, setBranches] = useState<Array<{ id: string; branchName: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(propBranchId || '');
  const [user, setUser] = useState<any>(null);

  // Form state
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [notes, setNotes] = useState('');

  // Get user from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);
      // Set branchId if user has one (Branch Manager)
      if (userData.branchId && !propBranchId) {
        setSelectedBranchId(userData.branchId);
      }
    }
  }, [propBranchId]);

  // Fetch branches for admin only
  useEffect(() => {
    if (!propBranchId && user?.role === 'ADMIN') {
      const fetchBranches = async () => {
        setBranchesLoading(true);
        try {
          console.log('[TableManagement] Fetching branches...');
          const response = await fetch('/api/branches');
          if (response.ok) {
            const data = await response.json();
            console.log('[TableManagement] Branches response:', data);
            if (data.branches && data.branches.length > 0) {
              console.log('[TableManagement] Setting branches:', data.branches);
              setBranches(data.branches);
              if (!selectedBranchId) {
                setSelectedBranchId(data.branches[0].id);
                console.log('[TableManagement] Selected branch:', data.branches[0].id);
              }
            } else {
              console.warn('[TableManagement] No branches found in response');
            }
          } else {
            console.error('[TableManagement] Failed to fetch branches, status:', response.status);
          }
        } catch (error) {
          console.error('[TableManagement] Failed to fetch branches:', error);
        } finally {
          setBranchesLoading(false);
        }
      };
      fetchBranches();
    }
  }, [propBranchId, user, selectedBranchId]);

  const currentBranchId = propBranchId || selectedBranchId;

  useEffect(() => {
    if (currentBranchId) {
      fetchTables();
    } else {
      setLoading(false);
    }
  }, [currentBranchId]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tables?branchId=${currentBranchId}`);
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentBranchId) {
      alert('Please select a branch first');
      return;
    }

    try {
      console.log('[TableManagement] Creating table for branch:', currentBranchId);
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: currentBranchId,
          tableNumber,
          capacity,
          notes,
        }),
      });

      if (response.ok) {
        await fetchTables();
        setIsDialogOpen(false);
        resetForm();
      } else {
        const data = await response.json();
        console.error('[TableManagement] Failed to create table:', data);
        alert(data.error || data.details || 'Failed to create table');
      }
    } catch (error) {
      console.error('[TableManagement] Failed to create table:', error);
      alert('Failed to create table');
    }
  };

  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingTable) return;

    try {
      const response = await fetch(`/api/tables/${editingTable.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber,
          capacity,
          notes,
          status: editingTable.status,
        }),
      });

      if (response.ok) {
        await fetchTables();
        setIsDialogOpen(false);
        setEditingTable(null);
        resetForm();
      } else {
        const data = await response.json();
        console.error('[TableManagement] Failed to update table:', data);
        alert(data.error || data.details || 'Failed to update table');
      }
    } catch (error) {
      console.error('Failed to update table:', error);
      alert('Failed to update table');
    }
  };

  const handleDeleteTable = async (tableId: string, tableNumber: number) => {
    if (!confirm(`Are you sure you want to delete Table ${tableNumber}?`)) return;

    try {
      const response = await fetch(`/api/tables/${tableId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTables();
      } else {
        const data = await response.json();
        console.error('[TableManagement] Failed to delete table:', data);
        alert(data.error || data.details || 'Failed to delete table');
      }
    } catch (error) {
      console.error('Failed to delete table:', error);
      alert('Failed to delete table');
    }
  };

  const handleEditClick = (table: TableData) => {
    setEditingTable(table);
    setTableNumber(table.tableNumber.toString());
    setCapacity(table.capacity?.toString() || '');
    setNotes(table.notes || '');
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setTableNumber('');
    setCapacity('');
    setNotes('');
    setEditingTable(null);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      AVAILABLE: {
        color: 'bg-emerald-100 text-emerald-700',
        icon: <CheckCircle className="h-3 w-3" />,
        label: 'Available',
      },
      OCCUPIED: {
        color: 'bg-blue-100 text-blue-700',
        icon: <Users className="h-3 w-3" />,
        label: 'Occupied',
      },
      READY_TO_PAY: {
        color: 'bg-orange-100 text-orange-700',
        icon: <Clock className="h-3 w-3" />,
        label: 'Ready to Pay',
      },
      RESERVED: {
        color: 'bg-purple-100 text-purple-700',
        icon: <Utensils className="h-3 w-3" />,
        label: 'Reserved',
      },
      CLEANING: {
        color: 'bg-slate-100 text-slate-700',
        icon: <AlertCircle className="h-3 w-3" />,
        label: 'Cleaning',
      },
    };

    const config = statusConfig[status] || statusConfig.AVAILABLE;
    return (
      <Badge className={config.color}>
        <span className="flex items-center gap-1">
          {config.icon}
          {config.label}
        </span>
      </Badge>
    );
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-emerald-600" />
              Table Management
            </CardTitle>
            <CardDescription>Admin: Manage restaurant tables for all branches</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Warning if no branches */}
            {user?.role === 'ADMIN' && branches.length === 0 && !branchesLoading && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>No branches available. Create branches first.</span>
              </div>
            )}
            {/* Branch Selector for Admin only */}
            {user?.role === 'ADMIN' && branchesLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading branches...</span>
              </div>
            )}
            {user?.role === 'ADMIN' && branches.length > 0 && (
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              resetForm();
              setEditingTable(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!currentBranchId || branchesLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Table
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTable ? 'Edit Table' : 'Create New Table'}</DialogTitle>
                <DialogDescription>
                  {editingTable ? 'Update table details' : 'Add a new table to your restaurant'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={editingTable ? handleUpdateTable : handleCreateTable}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Table Number *</Label>
                    <Input
                      type="number"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="e.g., 1"
                      required
                      min="1"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Capacity (seats)</Label>
                    <Input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="e.g., 4"
                      min="1"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Notes</Label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g., Near window, Outdoor, etc."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                    setEditingTable(null);
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                    {editingTable ? 'Update Table' : 'Create Table'}
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
                  <TableHead>Table #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-medium">Table {table.tableNumber}</TableCell>
                    <TableCell>{getStatusBadge(table.status)}</TableCell>
                    <TableCell>{table.capacity || '-'}</TableCell>
                    <TableCell>{table.customer?.name || '-'}</TableCell>
                    <TableCell className="font-semibold">
                      {table.totalAmount > 0 ? `EGP ${table.totalAmount.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {table.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(table)}
                          title="Edit Table"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTable(table.id, table.tableNumber)}
                          title="Delete Table"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {tables.length === 0 && currentBranchId && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="h-8 w-8 text-slate-300 mx-auto" />
                        <p className="font-medium">No tables found for this branch</p>
                        <p className="text-sm">Click "Add Table" to create your first table</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!currentBranchId && !loading && user?.role === 'ADMIN' && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-8 w-8 text-amber-300 mx-auto" />
                        <p className="font-medium text-amber-700">No branch selected</p>
                        <p className="text-sm">Please select a branch from the dropdown above</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!currentBranchId && !loading && user?.role !== 'ADMIN' && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-8 w-8 text-slate-300 mx-auto" />
                        <p className="font-medium">No branch assigned</p>
                        <p className="text-sm">Contact an administrator to assign you to a branch</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
