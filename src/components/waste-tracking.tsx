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
import { Plus, RefreshCw, AlertTriangle, Trash2, TrendingDown, Calendar, Building2 } from 'lucide-react';

interface User {
  id: string;
  role: 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER';
  branchId?: string;
  name?: string;
}

interface Branch {
  id: string;
  branchName: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

interface WasteLog {
  id: string;
  branch: Branch;
  ingredient: Ingredient;
  quantity: number;
  unit: string;
  reason: 'EXPIRED' | 'SPOILED' | 'DAMAGED' | 'PREPARATION' | 'MISTAKE' | 'THEFT' | 'OTHER';
  notes?: string;
  lossValue: number;
  createdAt: string;
}

interface WasteStats {
  summary: {
    totalLogs: number;
    totalLoss: number;
    recentLoss: number;
    recentLogs: number;
  };
}

export default function WasteTracking() {
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stats, setStats] = useState({ totalLogs: 0, totalLoss: 0, recentLoss: 0, recentLogs: 0 });

  // Calculate recent logs from wasteLogs
  useEffect(() => {
    const recentLogsCount = wasteLogs.filter(log => {
      const logDate = new Date(log.createdAt);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return logDate >= sevenDaysAgo;
    }).length;
    setStats(prev => ({ ...prev, recentLogs: recentLogsCount }));
  }, [wasteLogs]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    ingredientId: '',
    quantity: 0,
    reason: 'EXPIRED' as const,
    notes: '',
  });

  useEffect(() => {
    // Get user info
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);
      // For branch managers, set their branch as selected
      if (userData.role !== 'ADMIN' && userData.branchId) {
        setSelectedBranchId(userData.branchId);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('Fetching waste data...');
      
      // If user is not ADMIN and has branchId, fetch only their branch data
      if (user?.role === 'BRANCH_MANAGER' && user.branchId) {
        setSelectedBranchId(user.branchId);
      }

      // Build query params
      let wasteUrl = '/api/waste-logs';
      let statsUrl = '/api/waste-logs/stats';
      if (selectedBranchId) {
        wasteUrl += `?branchId=${selectedBranchId}`;
        statsUrl += `?branchId=${selectedBranchId}`;
      }

      const [wasteRes, branchesRes, ingredientsRes, statsRes] = await Promise.all([
        fetch(wasteUrl),
        fetch('/api/branches'),
        fetch('/api/ingredients'),
        fetch(statsUrl),
      ]);

      console.log('Waste response:', wasteRes.status);
      console.log('Branches response:', branchesRes.status);
      console.log('Ingredients response:', ingredientsRes.status);
      console.log('Stats response:', statsRes.status);

      if (wasteRes.ok) {
        const data = await wasteRes.json();
        console.log('Waste logs:', data.wasteLogs);
        setWasteLogs(data.wasteLogs);
      } else {
        const errorText = await wasteRes.text();
        console.error('Failed to fetch waste logs - Status:', wasteRes.status, 'Response:', errorText);
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
      if (statsRes.ok) {
        const data = await statsRes.json();
        console.log('Stats:', data);
        // Ensure stats has all required properties with default values
        setStats({
          totalLogs: data.summary?.totalLogs ?? 0,
          totalLoss: data.summary?.totalLossValue ?? 0,
          recentLoss: data.trends?.recent7Days ?? 0,
          recentLogs: 0, // Will be calculated from wasteLogs
        });
      } else {
        const errorText = await statsRes.text();
        console.error('Failed to fetch stats - Status:', statsRes.status, 'Response:', errorText);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      console.log('Data fetch completed, loading:', false);
    }
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'EXPIRED':
        return 'bg-red-100 text-red-700';
      case 'SPOILED':
        return 'bg-orange-100 text-orange-700';
      case 'DAMAGED':
        return 'bg-yellow-100 text-yellow-700';
      case 'PREPARATION':
        return 'bg-blue-100 text-blue-700';
      case 'MISTAKE':
        return 'bg-purple-100 text-purple-700';
      case 'THEFT':
        return 'bg-red-200 text-red-800';
      case 'OTHER':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Determine branch ID - use selected branch for admin, user's branch for managers
    let branchId = selectedBranchId;
    if (!branchId && user?.branchId) {
      branchId = user.branchId;
    }

    if (!branchId) {
      alert('No branch selected. Please select a branch.');
      return;
    }

    const ingredient = ingredients.find(i => i.id === formData.ingredientId);
    if (!ingredient) {
      alert('Please select an ingredient');
      return;
    }

    try {
      const response = await fetch('/api/waste-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          ingredientId: formData.ingredientId,
          quantity: formData.quantity,
          unit: ingredient.unit,
          reason: formData.reason,
          notes: formData.notes,
          userId: user?.id,
        }),
      });

      if (response.ok) {
        fetchData();
        setIsDialogOpen(false);
        setFormData({ ingredientId: '', quantity: 0, reason: 'EXPIRED', notes: '' });
      } else {
        const data = await response.json();
        console.error('Waste log error:', data);
        let errorMsg = data.error || 'Failed to record waste';
        if (data.issues) {
          errorMsg = data.issues.map((i: any) => i.message).join(', ');
        }
        alert(errorMsg);
      }
    } catch (error) {
      console.error('Failed to record waste:', error);
      alert('Failed to record waste');
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const branchManagerHasBranch = user?.role === 'BRANCH_MANAGER' && user.branchId;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Waste Logs</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalLogs}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-full">
                <Trash2 className="h-6 w-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Loss Value</p>
                <p className="text-2xl font-bold text-red-600">${(stats.totalLoss || 0).toFixed(2)}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Recent Loss (7d)</p>
                <p className="text-2xl font-bold text-orange-600">${(stats.recentLoss || 0).toFixed(2)}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-emerald-600" />
              Waste & Loss Tracking
            </CardTitle>
            <CardDescription>
              {isAdmin 
                ? 'Track and manage inventory waste across all branches'
                : branchManagerHasBranch
                ? 'Track waste and loss for your branch'
                : 'Select a branch to view waste logs'
              }
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {isAdmin && (
              <Select value={selectedBranchId || 'all'} onValueChange={(val) => setSelectedBranchId(val === 'all' ? '' : val)}>
                <SelectTrigger className="w-full sm:w-[200px] h-11">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={fetchData} className="h-11 flex-1 sm:flex-none">
                <RefreshCw className="h-4 w-4 mr-2" />
                <span>Refresh</span>
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 h-11 flex-1 sm:flex-none">
                    <Plus className="h-4 w-4 mr-2" />
                    <span>Record Waste</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Record Waste</DialogTitle>
                    <DialogDescription>Document inventory waste or loss</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                      {isAdmin && (
                        <div className="grid gap-2">
                          <Label>Branch *</Label>
                          <Select 
                            value={selectedBranchId} 
                            onValueChange={(val) => setSelectedBranchId(val)}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches?.map(b => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.branchName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="grid gap-2">
                        <Label>Ingredient *</Label>
                        <Select 
                          value={formData.ingredientId} 
                          onValueChange={(val) => setFormData({ ...formData, ingredientId: val })}
                          required
                          disabled={!selectedBranchId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select ingredient" />
                          </SelectTrigger>
                          <SelectContent>
                            {(ingredients || []).map(ing => (
                              <SelectItem key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                          required
                          disabled={!selectedBranchId}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Reason *</Label>
                        <Select
                          value={formData.reason}
                          onValueChange={(val: any) => setFormData({ ...formData, reason: val })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EXPIRED">Expired</SelectItem>
                            <SelectItem value="SPOILED">Spoiled</SelectItem>
                            <SelectItem value="DAMAGED">Damaged</SelectItem>
                            <SelectItem value="PREPARATION">Preparation</SelectItem>
                            <SelectItem value="MISTAKE">Mistake</SelectItem>
                            <SelectItem value="THEFT">Theft</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Input
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Additional details..."
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                      <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); }} className="w-full sm:w-auto h-11 min-h-[44px]">
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto h-11 min-h-[44px]" disabled={!selectedBranchId}>
                        Record Waste
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
          ) : !selectedBranchId && !isAdmin ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Building2 className="h-12 w-12 mb-4 text-slate-400" />
              <p>Please select a branch to view waste logs</p>
            </div>
          ) : wasteLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Trash2 className="h-12 w-12 mb-4 text-slate-400" />
              <p>No waste logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="min-w-[800px] md:min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Total Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wasteLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="font-medium">{log.ingredient?.name || 'Unknown'}</span>
                            <span className="text-slate-600 ml-2">
                              {log.quantity} {log.unit}
                            </span>
                          </div>
                          {log.notes && (
                            <p className="text-xs text-slate-500">{log.notes}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getReasonColor(log.reason)}>
                          {log.reason.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        ${(log.lossValue || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
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
