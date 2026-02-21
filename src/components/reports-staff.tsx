'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, TrendingUp, TrendingDown, RefreshCw, 
  Award, Clock, DollarSign, ShoppingCart,
  Activity, Target, AlertCircle 
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

interface StaffMetric {
  userId: string;
  name: string;
  username: string;
  role: string;
  branchName?: string;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
  avgOrderValue: number;
  avgItemsPerOrder: number;
  hourlyPerformance: { hour: number; orders: number; revenue: number }[];
  peakHour: { hour: number; revenue: number; orders: number };
  refundRate: number;
  refundedOrders: number;
  productivityScore: number;
  ordersPerHour: number;
}

interface Branch {
  id: string;
  branchName: string;
  isActive: boolean;
}

const timeRanges = [
  { value: 'today', label: 'Today', days: 1 },
  { value: 'week', label: 'This Week', days: 7 },
  { value: 'month', label: 'This Month', days: 30 },
  { value: 'quarter', label: 'This Quarter', days: 90 },
  { value: 'year', label: 'This Year', days: 365 },
];

export default function StaffPerformanceReport() {
  const { user } = useAuth();
  const { currency } = useI18n();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('month');
  const [staffData, setStaffData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches');
        if (response.ok) {
          const data = await response.json();
          setBranches(data.branches || []);
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      }
    };
    fetchBranches();
  }, []);

  // Set default branch
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        setSelectedBranch('all');
      } else if (user.branchId) {
        setSelectedBranch(user.branchId);
      }
    }
  }, [user]);

  // Fetch staff data
  useEffect(() => {
    fetchStaffData();
  }, [selectedBranch, timeRange]);

  const fetchStaffData = async () => {
    setLoading(true);
    try {
      const range = timeRanges.find(r => r.value === timeRange);
      if (!range) return;

      const now = new Date();
      const endDate = new Date(now);
      let startDate = new Date(now);
      startDate.setDate(now.getDate() - range.days);

      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== 'all') {
        params.append('branchId', selectedBranch);
      }
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());

      const response = await fetch(`/api/reports/staff?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setStaffData(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch staff data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const getProductivityColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-600';
    if (score >= 60) return 'bg-blue-600';
    if (score >= 40) return 'bg-amber-600';
    return 'bg-red-600';
  };

  if (loading && !staffData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {user?.role === 'ADMIN' && (
              <Select value={selectedBranch} onValueChange={setSelectedBranch} className="w-[200px]">
                <SelectTrigger>
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
            <Select value={timeRange} onValueChange={setTimeRange} className="w-[180px]">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeRanges.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => fetchStaffData()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Staff</p>
                <p className="text-3xl font-bold text-slate-900">{staffData?.summary?.totalStaff || 0}</p>
              </div>
              <Users className="h-8 w-8 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(staffData?.summary?.totalRevenue || 0, currency)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Orders</p>
                <p className="text-3xl font-bold text-blue-600">{staffData?.summary?.totalOrders || 0}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Avg Productivity</p>
                <p className="text-3xl font-bold text-purple-600">
                  {staffData?.summary?.avgProductivityScore || 0}%
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Global Peak Hour</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatHour(staffData?.summary?.globalPeakHour?.hour || 0)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {staffData?.summary?.globalPeakHour?.orders || 0} orders
                </p>
              </div>
              <Clock className="h-8 w-8 text-amber-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performer Card */}
      {staffData?.summary?.topPerformer && (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-100 dark:from-amber-950/30 dark:to-orange-900/30 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Award className="h-5 w-5" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {staffData.summary.topPerformer.name}
                </h3>
                <p className="text-sm text-slate-600">{staffData.summary.topPerformer.role}</p>
                {staffData.summary.topPerformer.branchName && (
                  <p className="text-xs text-slate-500">{staffData.summary.topPerformer.branchName}</p>
                )}
                <div className="flex gap-4 mt-3">
                  <div>
                    <p className="text-xs text-slate-500">Revenue</p>
                    <p className="font-bold text-emerald-700">
                      {formatCurrency(staffData.summary.topPerformer.totalRevenue, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Orders</p>
                    <p className="font-semibold">{staffData.summary.topPerformer.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Score</p>
                    <Badge className={getProductivityColor(staffData.summary.topPerformer.productivityScore)}>
                      {staffData.summary.topPerformer.productivityScore}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Staff Productivity Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffData?.staffMetrics || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => value + '%'} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: any) => [value + '%', 'Productivity Score']}
                />
                <Bar dataKey="productivityScore" radius={[4, 4, 0, 0]}>
                  {(staffData?.staffMetrics || []).map((staff: StaffMetric) => {
                    const color = staff.productivityScore >= 80 ? '#10b981' : 
                                  staff.productivityScore >= 60 ? '#3b82f6' : 
                                  staff.productivityScore >= 40 ? '#f59e0b' : '#ef4444';
                    return <Cell key={staff.userId} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Staff Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <div className="min-w-[800px] md:min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Avg Order</TableHead>
                  <TableHead className="text-right">Productivity</TableHead>
                  <TableHead className="text-right">Refund %</TableHead>
                  <TableHead className="text-right">Peak Hour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(staffData?.staffMetrics || []).map((staff: StaffMetric) => (
                  <TableRow key={staff.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-xs text-slate-500">{staff.username}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.role === 'BRANCH_MANAGER' ? 'default' : 'outline'}>
                        {staff.role === 'BRANCH_MANAGER' ? 'Manager' : 'Cashier'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(staff.totalRevenue, currency)}
                    </TableCell>
                    <TableCell className="text-right">{staff.totalOrders}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(staff.avgOrderValue, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getProductivityColor(staff.productivityScore)}>
                        {staff.productivityScore}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={staff.refundRate > 5 ? 'destructive' : 'outline'}>
                        {staff.refundRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-500">
                      {formatHour(staff.peakHour.hour)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!staffData?.staffMetrics || staffData.staffMetrics.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      No staff data available for this period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
