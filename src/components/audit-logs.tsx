'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Download, Clock, User, FileText, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { format } from 'date-fns';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  actionType: string;
  entityType?: string | null;
  entityId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  previousHash?: string | null;
  currentHash: string;
  user: {
    id: string;
    username: string;
    name?: string | null;
    role: string;
  };
}

interface User {
  id: string;
  username: string;
  name?: string | null;
  role: string;
}

export default function AuditLogs() {
  const { t, language } = useI18n();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filter state
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedEntity, setSelectedEntity] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Action types
  const actionTypes = [
    'login',
    'logout',
    'order_created',
    'order_refunded',
    'shift_opened',
    'shift_closed',
    'day_opened',
    'day_closed',
    'inventory_adjusted',
    'menu_updated',
    'user_created',
    'user_updated',
    'user_deleted',
    'branch_created',
    'branch_updated',
    'customer_created',
    'customer_updated',
    'promo_code_applied',
    'waste_logged',
  ];

  // Entity types
  const entityTypes = [
    'Order',
    'Shift',
    'BusinessDay',
    'InventoryTransaction',
    'MenuItem',
    'User',
    'Branch',
    'Customer',
    'PromotionCode',
    'WasteLog',
  ];

  // Fetch users for filter
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch logs when filters change
  useEffect(() => {
    fetchLogs();
  }, [selectedUser, selectedAction, selectedEntity, startDate, endDate, offset]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/branches/users');
      const data = await response.json();
      if (response.ok && data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (selectedUser !== 'all') params.append('userId', selectedUser);
      if (selectedAction !== 'all') params.append('actionType', selectedAction);
      if (selectedEntity !== 'all') params.append('entityType', selectedEntity);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      const data = await response.json();

      if (response.ok && data.logs) {
        setLogs(data.logs);
        setTotal(data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter logs by search query
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const searchText = `
      ${log.user.username}
      ${log.user.name || ''}
      ${log.actionType}
      ${log.entityType || ''}
      ${log.oldValue || ''}
      ${log.newValue || ''}
      ${log.ipAddress || ''}
    `.toLowerCase();

    return searchText.includes(query);
  });

  // Get action type badge color
  const getActionBadge = (actionType: string) => {
    const colorMap: { [key: string]: string } = {
      login: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      logout: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      order_created: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      order_refunded: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      shift_opened: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
      shift_closed: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      day_opened: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      day_closed: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      inventory_adjusted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      menu_updated: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      user_created: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      user_updated: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
      user_deleted: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
      branch_created: 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
      branch_updated: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200',
      customer_created: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      customer_updated: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
      promo_code_applied: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      waste_logged: 'bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-200',
    };

    return colorMap[actionType] || 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
  };

  // Format action type for display
  const formatActionType = (actionType: string) => {
    return actionType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Export logs to CSV
  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Entity ID', 'Old Value', 'New Value', 'IP Address'];
    const rows = filteredLogs.map((log) => [
      log.timestamp,
      log.user.name || log.user.username,
      log.user.role,
      formatActionType(log.actionType),
      log.entityType || '',
      log.entityId || '',
      log.oldValue || '',
      log.newValue || '',
      log.ipAddress || '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FileText className="h-8 w-8 text-emerald-600" />
            {language === 'ar' ? 'سجل الأنشطة' : 'Audit Logs'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'تتبع جميع إجراءات المستخدمين في النظام' : 'Track all user actions in the system'}
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {language === 'ar' ? 'فلاتر البحث' : 'Search Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* User Filter */}
            <div>
              <label className="text-sm font-medium mb-1 block text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'المستخدم' : 'User'}
              </label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'الكل' : 'All Users'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All Users'}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.username} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Type Filter */}
            <div>
              <label className="text-sm font-medium mb-1 block text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'نوع الإجراء' : 'Action Type'}
              </label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'الكل' : 'All Actions'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All Actions'}</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatActionType(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entity Type Filter */}
            <div>
              <label className="text-sm font-medium mb-1 block text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'نوع الكيان' : 'Entity Type'}
              </label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'الكل' : 'All Entities'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All Entities'}</SelectItem>
                  {entityTypes.map((entity) => (
                    <SelectItem key={entity} value={entity}>
                      {entity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-sm font-medium mb-1 block text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'من تاريخ' : 'From Date'}
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-sm font-medium mb-1 block text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'إلى تاريخ' : 'To Date'}
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Search */}
            <div>
              <label className="text-sm font-medium mb-1 block text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'بحث' : 'Search'}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={language === 'ar' ? 'ابحث...' : 'Search...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Reset Filters */}
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedUser('all');
                setSelectedAction('all');
                setSelectedEntity('all');
                setStartDate('');
                setEndDate('');
                setSearchQuery('');
                setOffset(0);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'إعادة تعيين الفلاتر' : 'Reset Filters'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
            </CardTitle>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {language === 'ar' ? 'إجمالي' : 'Total'}: {filteredLogs.length} {language === 'ar' ? 'سجل' : 'logs'}
            </span>
          </div>
          <CardDescription>
            {language === 'ar' ? 'عرض أحدث النشاطات أولاً' : 'Showing most recent activity first'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'لا توجد سجلات' : 'No logs found'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'التوقيت' : 'Timestamp'}
                    </th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'المستخدم' : 'User'}
                    </th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'الإجراء' : 'Action'}
                    </th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'الكيان' : 'Entity'}
                    </th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {language === 'ar' ? 'التفاصيل' : 'Details'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 text-sm text-slate-600 dark:text-slate-400">
                        {format(new Date(log.timestamp), 'PPp')}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {log.user.name || log.user.username}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {log.user.role}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionBadge(log.actionType)}`}>
                          {formatActionType(log.actionType)}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-slate-600 dark:text-slate-400">
                        {log.entityType || '-'}
                        {log.entityId && (
                          <span className="text-xs text-slate-500 dark:text-slate-500 ml-1">
                            (#{log.entityId.slice(0, 8)}...)
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {(log.oldValue || log.newValue) && (
                          <div className="text-xs space-y-1">
                            {log.oldValue && (
                              <div className="text-red-600 dark:text-red-400">
                                <span className="font-medium">-</span> {log.oldValue.slice(0, 50)}
                                {log.oldValue.length > 50 && '...'}
                              </div>
                            )}
                            {log.newValue && (
                              <div className="text-green-600 dark:text-green-400">
                                <span className="font-medium">+</span> {log.newValue.slice(0, 50)}
                                {log.newValue.length > 50 && '...'}
                              </div>
                            )}
                          </div>
                        )}
                        {log.ipAddress && (
                          <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                            IP: {log.ipAddress}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'عرض' : 'Showing'} {offset + 1} - {Math.min(offset + limit, total)} {language === 'ar' ? 'من' : 'of'} {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {language === 'ar' ? 'السابق' : 'Previous'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                >
                  {language === 'ar' ? 'التالي' : 'Next'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
