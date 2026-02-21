'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3, TrendingUp, TrendingDown, Package, ShoppingCart, Calendar,
  DollarSign, Store, FileText, RotateCw, FileSpreadsheet, PieChart,
  Clock, Users, CreditCard, Wallet, Truck, Utensils, Coffee, ArrowUpRight,
  ArrowDownRight, Activity, Target, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/utils';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Branch {
  id: string;
  branchName: string;
  isActive: boolean;
}

interface KPIData {
  revenue: {
    total: number;
    net: number;
    deliveryFees: number;
    growth: number;
  };
  orders: {
    total: number;
    items: number;
    avgValue: number;
    growth: number;
    avgValueGrowth: number;
  };
  orderTypes: {
    dineIn: { count: number; revenue: number };
    takeAway: { count: number; revenue: number };
    delivery: { count: number; revenue: number };
  };
  paymentMethods: any;
  hourlySales: { hour: number; revenue: number; orders: number }[];
  peakHour: {
    hour: number;
    revenue: number;
    orders: number;
  };
  refunds: {
    count: number;
    rate: number;
  };
  topCategories: { category: string; revenue: number }[];
  comparison: any;
}

const timeRanges = [
  { value: 'today', label: 'Today', days: 1 },
  { value: 'yesterday', label: 'Yesterday', days: 1 },
  { value: 'week', label: 'This Week', days: 7 },
  { value: 'lastWeek', label: 'Last Week', days: 7 },
  { value: 'month', label: 'This Month', days: 30 },
  { value: 'lastMonth', label: 'Last Month', days: 30 },
  { value: 'quarter', label: 'This Quarter', days: 90 },
  { value: 'year', label: 'This Year', days: 365 },
];

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

export default function ReportsDashboard() {
  const { user } = useAuth();
  const { currency, t } = useI18n();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('today');
  const [comparePeriod, setComparePeriod] = useState(true);
  const [kpiData, setKPIData] = useState<KPIData | null>(null);
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

  // Set default branch based on user role
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        setSelectedBranch('all');
      } else if (user.branchId) {
        setSelectedBranch(user.branchId);
      }
    }
  }, [user]);

  // Fetch KPIs when filters change
  useEffect(() => {
    fetchKPIs();
  }, [selectedBranch, timeRange, comparePeriod]);

  const fetchKPIs = async () => {
    setLoading(true);
    try {
      const range = timeRanges.find(r => r.value === timeRange);
      if (!range) return;

      const now = new Date();
      const endDate = new Date(now);
      let startDate = new Date(now);

      // Calculate start date based on range
      if (timeRange === 'yesterday') {
        startDate.setDate(now.getDate() - 1);
        endDate.setDate(now.getDate() - 1);
      } else if (timeRange === 'lastWeek') {
        startDate.setDate(now.getDate() - 14);
        endDate.setDate(now.getDate() - 7);
      } else if (timeRange === 'lastMonth') {
        startDate.setMonth(now.getMonth() - 1);
        startDate.setDate(1);
        endDate.setMonth(now.getMonth());
        endDate.setDate(0);
      } else {
        startDate.setDate(now.getDate() - range.days);
      }

      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== 'all') {
        params.append('branchId', selectedBranch);
      }
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());
      if (comparePeriod) {
        params.append('comparePeriod', 'true');
      }

      const response = await fetch(`/api/reports/kpi?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setKPIData(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const GrowthBadge = ({ value, label }: { value: number; label?: string }) => {
    const isPositive = value >= 0;
    return (
      <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span>{Math.abs(value).toFixed(1)}%</span>
        {label && <span className="text-slate-500 ml-1">vs prev</span>}
      </div>
    );
  };

  const KPICard = ({ 
    title, 
    value, 
    icon: Icon, 
    growth, 
    subtitle, 
    color = 'primary' 
  }: { 
    title: string; 
    value: string; 
    icon: any; 
    growth?: number; 
    subtitle?: string; 
    color?: string;
  }) => (
    <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/30">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">{title}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
              {value}
            </p>
            <div className="mt-3 space-y-1">
              {growth !== undefined && <GrowthBadge value={growth} />}
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${color}/10 group-hover:bg-${color}/20 transition-colors`}>
            <Icon className={`h-6 w-6 text-${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading && !kpiData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
          <p className="text-slate-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Executive Dashboard</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Real-time performance insights</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {user?.role === 'ADMIN' && (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Store className="h-4 w-4 mr-2 text-primary" />
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

              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Calendar className="h-4 w-4 mr-2 text-primary" />
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

              <Button
                variant="outline"
                size="icon"
                onClick={() => fetchKPIs()}
                disabled={loading}
              >
                <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(kpiData?.revenue.total || 0, currency)}
          icon={DollarSign}
          growth={kpiData?.revenue.growth}
          subtitle={`Net: ${formatCurrency(kpiData?.revenue.net || 0, currency)}`}
          color="emerald"
        />
        <KPICard
          title="Total Orders"
          value={(kpiData?.orders.total || 0).toString()}
          icon={ShoppingCart}
          growth={kpiData?.orders.growth}
          subtitle={`${kpiData?.orders.items || 0} items sold`}
          color="blue"
        />
        <KPICard
          title="Avg Order Value"
          value={formatCurrency(kpiData?.orders.avgValue || 0, currency)}
          icon={Target}
          growth={kpiData?.orders.avgValueGrowth}
          subtitle="Per transaction"
          color="purple"
        />
        <KPICard
          title="Refund Rate"
          value={`${(kpiData?.refunds.rate || 0).toFixed(1)}%`}
          icon={AlertCircle}
          subtitle={`${kpiData?.refunds.count || 0} refunded orders`}
          color="red"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Hourly Sales
            </CardTitle>
            <CardDescription>
              Peak hour: {formatHour(kpiData?.peakHour.hour || 0)} ({formatCurrency(kpiData?.peakHour.revenue || 0, currency)})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpiData?.hourlySales || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={formatHour} />
                  <YAxis tickFormatter={(value) => formatCurrency(value, currency)} />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(value, currency), 'Revenue']}
                    labelFormatter={formatHour}
                  />
                  <Bar dataKey="revenue" fill="url(#colorGradient)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Order Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Order Type Distribution
            </CardTitle>
            <CardDescription>Revenue breakdown by order type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={[
                      { name: 'Dine-In', value: kpiData?.orderTypes.dineIn.revenue || 0, orders: kpiData?.orderTypes.dineIn.count || 0 },
                      { name: 'Take-Away', value: kpiData?.orderTypes.takeAway.revenue || 0, orders: kpiData?.orderTypes.takeAway.count || 0 },
                      { name: 'Delivery', value: kpiData?.orderTypes.delivery.revenue || 0, orders: kpiData?.orderTypes.delivery.count || 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip formatter={(value: any) => [formatCurrency(value, currency), 'Revenue']} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Order Type Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <Utensils className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-slate-600">Dine-In</p>
                <p className="font-bold text-emerald-700">{kpiData?.orderTypes.dineIn.count || 0}</p>
              </div>
              <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-amber-600 mx-auto mb-2" />
                <p className="text-xs text-slate-600">Take-Away</p>
                <p className="font-bold text-amber-700">{kpiData?.orderTypes.takeAway.count || 0}</p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <Truck className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-slate-600">Delivery</p>
                <p className="font-bold text-blue-700">{kpiData?.orderTypes.delivery.count || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Categories */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-primary" />
              Top Performing Categories
            </CardTitle>
            <CardDescription>Revenue by product category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {kpiData?.topCategories.map((category, index) => (
                <div key={category.category} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-900 dark:text-white">{category.category}</span>
                      <span className="font-bold text-primary">{formatCurrency(category.revenue, currency)}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${((category.revenue / (kpiData?.topCategories[0]?.revenue || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Methods
            </CardTitle>
            <CardDescription>Transaction breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {kpiData?.paymentMethods && Object.entries(kpiData.paymentments || {}).map(([method, data]: [string, any]) => {
                const count = typeof data === 'object' ? data.count : data;
                const revenue = typeof data === 'object' ? data.revenue : 0;
                if (typeof data !== 'object' || count === 0) return null;
                
                const Icon = method.toLowerCase() === 'card' ? CreditCard : Wallet;
                
                return (
                  <div key={method} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      <div>
                        <p className="font-medium capitalize text-slate-900 dark:text-white">{method}</p>
                        <p className="text-xs text-slate-500">{count} transactions</p>
                      </div>
                    </div>
                    <p className="font-bold text-primary">{formatCurrency(revenue, currency)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Actions */}
      <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Export Reports</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Download detailed reports in Excel or PDF format</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => window.location.href = `/api/reports/export?format=excel&branchId=${selectedBranch}&comparePeriod=${comparePeriod}`}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
                onClick={() => window.location.href = `/api/reports/export?format=pdf&branchId=${selectedBranch}&comparePeriod=${comparePeriod}`}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
