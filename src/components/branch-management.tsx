'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, LayoutDashboard, Key, AlertTriangle, CheckCircle, Clock, Search, Settings } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

interface Branch {
  id: string;
  branchName: string;
  licenseKey: string;
  licenseExpiresAt: Date;
  isActive: boolean;
  lastSyncAt?: Date;
  menuVersion: number;
  createdAt: Date;
}

interface BranchFormData {
  branchName: string;
  licenseKey: string;
  expirationDays: string;
}

export default function BranchManagement() {
  const { getBranchTax, setBranchTax } = useI18n();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<BranchFormData>({
    branchName: '',
    licenseKey: '',
    expirationDays: '365',
  });
  const [loading, setLoading] = useState(false);

  // Fetch branches from database
  const fetchBranches = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/branches');
      const data = await response.json();

      if (response.ok && data.branches) {
        const branchesList = data.branches.map((branch: any) => ({
          id: branch.id,
          branchName: branch.branchName,
          licenseKey: branch.licenseKey,
          licenseExpiresAt: new Date(branch.licenseExpiresAt),
          isActive: branch.isActive,
          lastSyncAt: branch.lastSyncAt ? new Date(branch.lastSyncAt) : undefined,
          menuVersion: branch.menuVersion || 1,
          createdAt: new Date(branch.createdAt),
        }));
        setBranches(branchesList);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + parseInt(formData.expirationDays));

      if (editingBranch) {
        // Update existing branch
        const response = await fetch('/api/branches', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingBranch.id,
            branchName: formData.branchName,
            licenseKey: formData.licenseKey,
            licenseExpiresAt: expirationDate.toISOString(),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update branch');
        }

        await fetchBranches(); // Refresh the list
      } else {
        // Create new branch
        const response = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchName: formData.branchName,
            licenseKey: formData.licenseKey,
            licenseExpiresAt: expirationDate.toISOString(),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create branch');
        }

        await fetchBranches(); // Refresh the list
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save branch:', error);
      alert(error instanceof Error ? error.message : 'Failed to save branch');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    const daysUntilExpiry = Math.ceil(
      (branch.licenseExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    setFormData({
      branchName: branch.branchName,
      licenseKey: branch.licenseKey,
      expirationDays: daysUntilExpiry.toString(),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (branchId: string) => {
    if (!confirm('Are you sure you want to delete this branch? This will revoke the license.')) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/branches?id=${branchId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete branch');
      }

      await fetchBranches(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete branch:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete branch');
    } finally {
      setLoading(false);
    }
  };

  const toggleBranchStatus = async (branchId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this branch?`)) return;
    setLoading(true);
    try {
      const response = await fetch('/api/branches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: branchId,
          isActive: !currentStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update branch status');
      }

      await fetchBranches(); // Refresh the list
    } catch (error) {
      console.error('Failed to toggle branch status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update branch status');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingBranch(null);
    setFormData({
      branchName: '',
      licenseKey: '',
      expirationDays: '365',
    });
  };

  const getSyncStatus = (branch: Branch) => {
    if (!branch.lastSyncAt) return { status: 'never', color: 'bg-slate-500' };

    const minutesSinceSync = (Date.now() - branch.lastSyncAt.getTime()) / (1000 * 60);

    if (minutesSinceSync < 10) return { status: 'recent', color: 'bg-green-500' };
    if (minutesSinceSync < 60) return { status: 'ok', color: 'bg-blue-500' };
    if (minutesSinceSync < 1440) return { status: 'delayed', color: 'bg-amber-500' };
    return { status: 'offline', color: 'bg-red-500' };
  };

  const getLicenseStatus = (branch: Branch) => {
    const daysUntilExpiry = Math.ceil(
      (branch.licenseExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) return { status: 'expired', color: 'bg-red-500', text: 'Expired' };
    if (daysUntilExpiry < 30) return { status: 'warning', color: 'bg-amber-500', text: `${daysUntilExpiry} days left` };
    return { status: 'valid', color: 'bg-green-500', text: `Valid until ${branch.licenseExpiresAt.toLocaleDateString()}` };
  };

  const filteredBranches = branches.filter((branch) =>
    branch.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.licenseKey.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" />
            Branch Management
          </CardTitle>
          <CardDescription>
            Create and manage branch licenses. Branches cannot modify menu or pricing - they can only manage local inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Branch
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingBranch ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="branchName">Branch Name</Label>
                      <Input
                        id="branchName"
                        value={formData.branchName}
                        onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                        placeholder="e.g., Downtown"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="licenseKey">License Key</Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="licenseKey"
                          value={formData.licenseKey}
                          onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                          placeholder="LIC-XXXX-YYYY-ZZZZ"
                          className="pl-10 font-mono"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expirationDays">License Duration (days)</Label>
                      <Input
                        id="expirationDays"
                        type="number"
                        min="1"
                        value={formData.expirationDays}
                        onChange={(e) => setFormData({ ...formData, expirationDays: e.target.value })}
                        placeholder="365"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">{editingBranch ? 'Update' : 'Add'} Branch</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

     

      <Card>
        <CardHeader>
          <CardTitle>
            Branches ({filteredBranches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-600">Loading...</div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="min-w-[800px] md:min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch Name</TableHead>
                    <TableHead>License Key</TableHead>
                    <TableHead>License Status</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Menu Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBranches.map((branch) => {
                    const syncStatus = getSyncStatus(branch);
                    const licenseStatus = getLicenseStatus(branch);
                    return (
                      <TableRow key={branch.id}>
                        <TableCell className="font-medium">{branch.branchName}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {branch.licenseKey}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${licenseStatus.color}`} />
                            <span className="text-sm">{licenseStatus.text}</span>
                            {licenseStatus.status === 'warning' && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${syncStatus.color}`} />
                            <span className="text-sm capitalize">{syncStatus.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {branch.lastSyncAt ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {Math.floor((Date.now() - branch.lastSyncAt.getTime()) / 60000)}m ago
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500">Never</span>
                          )}
                        </TableCell>
                        <TableCell>v{branch.menuVersion}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={branch.isActive}
                              onCheckedChange={() => toggleBranchStatus(branch.id, branch.isActive)}
                            />
                            <Badge variant={branch.isActive ? 'default' : 'secondary'}>
                              {branch.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(branch)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(branch.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredBranches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-600">
                        No branches found
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
    </div>
  );
}
