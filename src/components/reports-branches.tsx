'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Store, BarChart3, TrendingUp, TrendingDown, RefreshCw, 
  Trophy, AlertCircle, DollarSign, ShoppingCart,
  Users, Package, Lock
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

interface BranchMetric {
  branchId: string;
  branchName: string;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
  avgOrderValue: number;
  orderTypes: any;
  paymentMethods: any;
  deliveryRevenue: number;
  deliveryPercentage: number;
  inventoryValue: number;
  activeStaff: number;
  customerCount: number;
  ordersPerStaff: number;
  revenuePerStaff: number;
}

interface BranchData {
  branches: BranchMetric[];
  bestBranch: any;
  worstBranch: any;
  averageRevenue: number;
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  growthData: any[];
  ranking: any[];
}

const timeRanges = [
  { value: 'today', label: 'Today', days: 1 },
  { value: 'week', label: 'This Week', days: 7 },
  { value: 'month', label: 'This Month', days: 30 },
  { value: 'quarter', label: 'This Quarter', days: 90 },
  { value: 'year', label: 'This Year', days: 365 },
];

export default function BranchComparisonReport() {
  const { user } = useAuth();
  const { currency } = useI18n();
  const [timeRange, setTimeRange] = useState('month');
  const [branchData, setBranchData] = useState<BranchData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch branch comparison data (Admin only)
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchBranchData();
    }
  }, [user, timeRange]);

  const fetchBranchData = async () => {
    setLoading(true);
    try {
      const range = timeRanges.find(r => r.value === timeRange);
      if (!range) return;

      const now = new Date();
      const endDate = new Date(now);
      let startDate = new Date(now);
      startDate.setDate(now.getDate() - range.days);

      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());

      const response = await fetch(`/api/reports/branches?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setBranchData(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch branch comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Lock className="h-16 w-16 text-slate-300 mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h3>
          <p className="text-slate-600 text-center max-w-md">
            Branch comparison reports are only available to HQ Admins
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading && !branchData) {
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
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold">Multi-Branch Comparison</h3>
                <p className="text-sm text-slate-500">Compare performance across all locations</p>
              </div>
            </div>
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
            <Button variant="outline" onClick={() => fetchBranchData()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Total Revenue</p>
            <p className="text-3xl font-bold text-emerald-600">
              {formatCurrency(branchData?.totalRevenue || 0, currency)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {branchData?.branches?.length || 0} branches
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Total Orders</p>
            <p className="text-3xl font-bold text-blue-600">{branchData?.totalOrders || 0}</p>
            <p className="text-xs text-slate-500 mt-1">All locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Total Customers</p>
            <p className="text-3xl font-bold text-purple-600">{branchData?.totalCustomers || 0}</p>
            <p className="text-xs text-slate-500 mt-1">Across all branches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Avg Revenue/Branch</p>
            <p className="text-3xl font-bold text-amber-600">
              {formatCurrency((branchData?.averageRevenue || 0) / (branchData?.branches?.length || 1), currency)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Per location</p>
          </CardContent>
        </Card>
      </div>

      {/* Best/Worst Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {branchData?.bestBranch && (
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <Trophy className="h-5 w-5" />
                Top Performing Branch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mb-4">
                {branchData.bestBranch.branchName}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Revenue</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(branchData.bestBranch.totalRevenue, currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Orders</span>
                  <span className="font-semibold">
                    {branchData.bestBranch.totalOrders}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Above Avg</span>
                  <Badge className="bg-emerald-600 text-white">
                    +{formatCurrency(branchData.bestBranch.performanceAboveAvg, currency)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {branchData?.worstBranch && (
          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30 border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-300">
                <AlertCircle className="h-5 w-5" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-4">
                {branchData.worstBranch.branchName}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Revenue</span>
                  <span className="font-bold text-red-700">
                    {formatCurrency(branchData.worstBranch.totalRevenue, currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Below Avg</span>
                  <Badge className="bg-red-600 text-white">
                    -{formatCurrency(branchData.worstBranch.performanceBelowAvg, currency)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Orders</span>
                  <span className="font-semibold">
                    {branchData.worstBranch.totalOrders}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Revenue Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Branch Revenue Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchData?.ranking || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branchName" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tickFormatter={(value) => formatCurrency(value, currency)} />
                <Tooltip 
                  formatter={(value: any, name: string, props: any) => {
                    const growth = props.payload?.growth;
                    return [
                      formatCurrency(value, currency),
                      growth ? `(${growth.toFixed(1)}% vs prev)` : ''
                    ];
                  }}
                />
                <Bar dataKey="revenue" fill="url(#branchGradient)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="branchGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Branch Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Branch Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="min-w-[800px] md:min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Avg Order</TableHead>
                <TableHead className="text-right">Orders/Staff</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right">Delivery %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(branchData?.branches || []).map((branch: BranchMetric) => {
                const isBest = branchData.bestBranch?.branchId === branch.branchId;
                const isWorst = branchData.worstBranch?.branchId === branch.branchId;

                return (
                  <TableRow key={branch.branchId} className={isBest ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : isWorst ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isBest && <Trophy className="h-4 w-4 text-emerald-600" />}
                        {isWorst && <AlertCircle className="h-4 w-4 text-red-600" />}
                        <span className="font-medium">{branch.branchName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(branch.totalRevenue, currency)}
                    </TableCell>
                    <TableCell className="text-right">{branch.totalOrders}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(branch.avgOrderValue, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {branch.ordersPerStaff.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={branch.customerCount > 50 ? "default" : "outline"}>
                        {branch.customerCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={branch.deliveryPercentage > 20 ? "default" : "outline"}>
                        {branch.deliveryPercentage.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
