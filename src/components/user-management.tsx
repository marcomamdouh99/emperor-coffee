'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Users, Shield, Search, Key, Lock, Power, PowerOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface User {
  id: string;
  username: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER';
  branchId?: string;
  branchName?: string;
  isActive: boolean;
  createdAt: Date;
}

interface UserFormData {
  username: string;
  email: string;
  name?: string;
  password?: string;
  role: 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER';
  branchId?: string;
}

interface ChangePasswordData {
  newPassword: string;
  confirmPassword: string;
}

const roles = [
  { value: 'ADMIN', label: 'HQ Admin', description: 'Full control over all branches' },
  { value: 'BRANCH_MANAGER', label: 'Branch Manager', description: 'Manage single branch inventory and staff' },
  { value: 'CASHIER', label: 'Cashier', description: 'Process sales only' },
];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    name: '',
    password: '',
    role: 'CASHIER',
    branchId: '',
  });
  const [passwordData, setPasswordData] = useState<ChangePasswordData>({
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches');
        const data = await response.json();
        if (response.ok && data.branches) {
          setBranches(data.branches.map((b: any) => ({ id: b.id, name: b.branchName })));
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      }
    };
    fetchBranches();
  }, []);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentUser?.role === 'BRANCH_MANAGER' && currentUser?.branchId) {
        params.append('currentUserBranchId', currentUser.branchId);
        params.append('currentUserRole', 'BRANCH_MANAGER');
      }

      const response = await fetch(`/api/users?${params.toString()}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setUsers(data.users);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to fetch users' });
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setMessage({ type: 'error', text: 'Failed to fetch users' });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge className="bg-emerald-600">HQ Admin</Badge>;
      case 'BRANCH_MANAGER':
        return <Badge className="bg-blue-600">Branch Manager</Badge>;
      case 'CASHIER':
        return <Badge className="bg-slate-600">Cashier</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      (user.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const canCreateUser = () => {
    return currentUser?.role === 'ADMIN' || currentUser?.role === 'BRANCH_MANAGER';
  };

  const canEditUser = (user: User) => {
    if (!currentUser) return false;

    // HQ Admin: Can edit any user except themselves
    if (currentUser.role === 'ADMIN') {
      return currentUser.id !== user.id;
    }

    // Branch Manager: Can only edit cashiers in their branch or themselves
    if (currentUser.role === 'BRANCH_MANAGER') {
      return user.role === 'CASHIER' && user.branchId === currentUser.branchId;
    }

    // Cashier: Cannot edit users
    return false;
  };

  const canDeleteUser = (user: User) => {
    if (!currentUser) return false;

    // HQ Admin: Can delete any user except themselves
    if (currentUser.role === 'ADMIN') {
      return currentUser.id !== user.id;
    }

    // Branch Manager: Can only delete cashiers in their branch
    if (currentUser.role === 'BRANCH_MANAGER') {
      return user.role === 'CASHIER' && user.branchId === currentUser.branchId;
    }

    // Cashier: Cannot delete users
    return false;
  };

  const canChangeStatus = (user: User) => {
    if (!currentUser) return false;

    // Cannot change own status
    if (currentUser.id === user.id) return false;

    // HQ Admin: Can change any user's status
    if (currentUser.role === 'ADMIN') {
      return true;
    }

    // Branch Manager: Can only change cashiers in their branch
    if (currentUser.role === 'BRANCH_MANAGER') {
      return user.role === 'CASHIER' && user.branchId === currentUser.branchId;
    }

    // Cashier: Cannot change user status
    return false;
  };

  const canChangePassword = (user: User) => {
    if (!currentUser) return false;

    // HQ Admin: Can change any password
    if (currentUser.role === 'ADMIN') {
      return true;
    }

    // Branch Manager: Can change their own password or their cashiers' passwords
    if (currentUser.role === 'BRANCH_MANAGER') {
      return currentUser.id === user.id || (user.role === 'CASHIER' && user.branchId === currentUser.branchId);
    }

    // Cashier: Can only change their own password
    if (currentUser.role === 'CASHIER') {
      return currentUser.id === user.id;
    }

    return false;
  };

  const handlePasswordChange = async () => {
    if (!passwordTargetUser || !currentUser) return;

    // Validate
    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    if (!/[A-Z]/.test(passwordData.newPassword)) {
      setMessage({ type: 'error', text: 'Password must contain at least one uppercase letter' });
      return;
    }

    if (!/[a-z0-9]/.test(passwordData.newPassword)) {
      setMessage({ type: 'error', text: 'Password must contain at least one lowercase letter or number' });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setPasswordLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: passwordTargetUser.id,
          newPassword: passwordData.newPassword,
          requesterUserId: currentUser.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Failed to change password' });
        return;
      }

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordDialogOpen(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Password change error:', error);
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const openPasswordDialog = (user: User) => {
    if (!canChangePassword(user)) {
      let errorMsg = 'Only HQ Admins can change any password. ';
      if (currentUser?.role === 'BRANCH_MANAGER') {
        errorMsg += 'Branch Managers can change their own password and their cashiers\' passwords.';
      } else if (currentUser?.role === 'CASHIER') {
        errorMsg += 'Cashiers can only change their own password.';
      }
      setMessage({ type: 'error', text: errorMsg });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setPasswordTargetUser(user);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setMessage(null);
    setPasswordDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate branch manager can only create cashiers for their branch
    if (currentUser?.role === 'BRANCH_MANAGER') {
      if (formData.role !== 'CASHIER') {
        setMessage({ type: 'error', text: 'Branch Managers can only create Cashier accounts' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
      if (formData.branchId !== currentUser.branchId) {
        setMessage({ type: 'error', text: 'Branch Managers can only create users for their assigned branch' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
    }

    // Validate password for new users
    if (!editingUser && !formData.password) {
      setMessage({ type: 'error', text: 'Password is required for new users' });
      return;
    }

    if (!editingUser && formData.password) {
      if (formData.password.length < 8) {
        setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
        return;
      }
      if (!/[A-Z]/.test(formData.password)) {
        setMessage({ type: 'error', text: 'Password must contain at least one uppercase letter' });
        return;
      }
      if (!/[a-z0-9]/.test(formData.password)) {
        setMessage({ type: 'error', text: 'Password must contain at least one lowercase letter or number' });
        return;
      }
    }

    setLoading(true);
    setMessage(null);

    try {
      // Prepare data for submission
      const submissionData = {
        ...formData,
        createdBy: currentUser?.id,
        // For ADMIN role, don't send branchId (backend will set it to null)
        branchId: formData.role === 'ADMIN' ? undefined : formData.branchId,
      };

      if (editingUser) {
        // Update user
        const response = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...submissionData,
            requesterId: currentUser?.id,
            requesterRole: currentUser?.role,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setMessage({ type: 'error', text: data.error || 'Failed to update user' });
          return;
        }

        await fetchUsers(); // Refresh list from database
      } else {
        // Create new user
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submissionData),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setMessage({ type: 'error', text: data.error || 'Failed to create user' });
          return;
        }

        await fetchUsers(); // Refresh list from database
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save user:', error);
      setMessage({ type: 'error', text: 'Failed to save user' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    if (!canEditUser(user)) {
      setMessage({ type: 'error', text: 'You do not have permission to edit this user' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      branchId: user.branchId || '',
    });
    setDialogOpen(true);
    setMessage(null);
  };

  const handleDelete = async (userId: string, user: User) => {
    if (!canDeleteUser(user)) {
      setMessage({ type: 'error', text: 'You do not have permission to delete this user' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const confirmMessage = user.isActive
      ? 'Are you sure you want to delete this user?'
      : 'Are you sure you want to permanently delete this deactivated user?';

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/users/${userId}?requesterId=${currentUser?.id}&requesterRole=${currentUser?.role}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete user' });
        return;
      }

      await fetchUsers(); // Refresh list from database

      // Show appropriate message based on soft/hard delete
      if (data.softDelete) {
        setMessage({ type: 'success', text: data.message || 'User deactivated successfully' });
      } else {
        setMessage({ type: 'success', text: data.message || 'User deleted successfully' });
      }
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to delete user:', error);
      setMessage({ type: 'error', text: 'Failed to delete user' });
    }
  };

  const handleToggleStatus = async (user: User) => {
    const action = user.isActive ? 'deactivate' : 'activate';

    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const response = await fetch(`/api/users/${user.id}?requesterId=${currentUser?.id}&requesterRole=${currentUser?.role}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...user,
          isActive: !user.isActive,
          requesterId: currentUser?.id,
          requesterRole: currentUser?.role,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || `Failed to ${action} user` });
        return;
      }

      await fetchUsers(); // Refresh list
      setMessage({ type: 'success', text: `User ${action}d successfully` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      setMessage({ type: 'error', text: `Failed to ${action} user` });
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      name: '',
      password: '',
      role: 'CASHIER',
      branchId: currentUser?.branchId || '',
    });
    setEditingUser(null);
    setMessage(null);
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

      <Card className="border-[#C7A35A]/20 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0F3A2E] dark:text-[#FFFDF8]">
            <Users className="h-6 w-6" />
            Users ({filteredUsers.length})
            {currentUser?.role === 'BRANCH_MANAGER' && (
              <span className="text-sm font-normal text-slate-500 ml-2">(Your Branch Only)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-48">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="ADMIN">HQ Admin</SelectItem>
                  <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canCreateUser() && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-[#C7A35A] to-[#b88e3b] hover:from-[#b88e3b] hover:to-[#C7A35A] text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="Enter username"
                          required
                          disabled={!!editingUser}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="user@example.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={formData.role}
                          onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                          disabled={currentUser?.role === 'BRANCH_MANAGER'}
                        >
                          <SelectTrigger id="role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                <div>
                                  <div className="font-medium">{role.label}</div>
                                  <div className="text-xs text-slate-500">{role.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="branch">Branch</Label>
                        {formData.role === 'ADMIN' ? (
                          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-500">
                            None (HQ Admin - No branch assigned)
                          </div>
                        ) : (
                          <Select
                            value={formData.branchId}
                            onValueChange={(value: any) => setFormData({ ...formData, branchId: value })}
                            disabled={formData.role === 'ADMIN'}
                          >
                            <SelectTrigger id="branch">
                              <SelectValue placeholder="Select Branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {currentUser?.role === 'BRANCH_MANAGER' && (
                          <p className="text-xs text-slate-500 mt-1">Creating user for your branch</p>
                        )}
                      </div>
                      {!editingUser && (
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="••••••••"
                            required
                            minLength={8}
                          />
                          <p className="text-xs text-slate-500">
                            Minimum 8 characters, must include uppercase and lowercase/number
                          </p>
                        </div>
                      )}
                    </div>
                    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto h-11 min-h-[44px]">
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-[#C7A35A] to-[#b88e3b] hover:from-[#b88e3b] hover:to-[#C7A35A] text-white w-full sm:w-auto h-11 min-h-[44px]"
                        disabled={loading}
                      >
                        {loading ? 'Saving...' : editingUser ? 'Update' : 'Add'} User
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-[#0F3A2E]/70 dark:text-[#FFFDF8]/70">Loading...</div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="min-w-[800px] md:min-w-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F4F0EA] dark:bg-[#0B2B22]">
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.name || '-'}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{user.branchName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canChangePassword(user) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openPasswordDialog(user)}
                              className="hover:text-[#C7A35A]"
                              title="Change Password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          )}
                          {canEditUser(user) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(user)}
                              title="Edit User"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canChangeStatus(user) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(user)}
                              className={user.isActive ? 'hover:text-orange-600' : 'hover:text-green-600'}
                              title={user.isActive ? 'Deactivate User' : 'Activate User'}
                            >
                              {user.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                            </Button>
                          )}
                          {canDeleteUser(user) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(user.id, user)}
                              className="hover:text-red-600"
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#0F3A2E] dark:text-[#FFFDF8]">
              <Lock className="h-5 w-5 text-[#C7A35A]" />
              Change Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Change password for: <strong>{passwordTargetUser?.username}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Enter new password"
                minLength={8}
                disabled={passwordLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                minLength={8}
                disabled={passwordLoading}
              />
            </div>
            <p className="text-xs text-slate-500">
              Minimum 8 characters, must include uppercase and lowercase/number
            </p>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPasswordDialogOpen(false);
                setPasswordData({ newPassword: '', confirmPassword: '' });
              }}
              disabled={passwordLoading}
              className="w-full sm:w-auto h-11 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordChange}
              className="bg-gradient-to-r from-[#C7A35A] to-[#b88e3b] hover:from-[#b88e3b] hover:to-[#C7A35A] text-white w-full sm:w-auto h-11 min-h-[44px]"
              disabled={passwordLoading}
            >
              {passwordLoading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-transparent animate-spin rounded-full"></div>
                  Processing...
                </span>
              ) : (
                'Change Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
