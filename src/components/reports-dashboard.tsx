'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart3, TrendingUp, TrendingDown, Package, ShoppingCart, Calendar,
  DollarSign, Store, FileText, RotateCw, FileSpreadsheet, PieChart,
  Clock, Users, CreditCard, Wallet, Truck, Utensils, Coffee, ArrowUpRight,
  ArrowDownRight, Activity, Target, AlertCircle, RefreshCw, Download,
  ArrowRight, Eye, Printer, RefreshCw as RefreshIcon, XCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/utils';
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Import report components
import ProductPerformanceReport from './reports-products';
import CustomerAnalyticsReport from './reports-customers';
import BranchComparisonReport from './reports-branches';
import StaffPerformanceReport from './reports-staff';
import DailyReportsTab from './reports-daily';
import { ReceiptViewer } from './receipt-viewer';

interface Branch {
  id: string;
  branchName: string;
  isActive: boolean;
}

interface KPIData {
  revenue: {
    total: number;
    net: number;
    productCost: number;
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

interface Order {
  id: string;
  orderNumber: number;
  subtotal: number;
  totalAmount: number;
  deliveryFee: number;
  orderTimestamp: Date;
  paymentMethod: string;
  orderType: string;
  isRefunded: boolean;
  refundReason?: string;
  cashier: { name: string } | null;
  branch: { branchName: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    menuItem?: {
      id: string;
      name: string;
      category: string;
      price: number;
    };
  }>;
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
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('week');
  const [comparePeriod, setComparePeriod] = useState(true);
  const [kpiData, setKPIData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(false);

  // Sales/Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [duplicateReceiptOrder, setDuplicateReceiptOrder] = useState<Order | null>(null);
  const [refundUsername, setRefundUsername] = useState('');
  const [refundPassword, setRefundPassword] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  // Void item state
  const [voidItemDialogOpen, setVoidItemDialogOpen] = useState(false);
  const [selectedVoidItem, setSelectedVoidItem] = useState<any>(null);
  const [voidQuantity, setVoidQuantity] = useState<number>(1);
  const [voidReason, setVoidReason] = useState('');
  const [voidUsername, setVoidUsername] = useState('');
  const [voidPassword, setVoidPassword] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(12);
  const [totalOrders, setTotalOrders] = useState(0);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

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
    if (activeTab === 'overview') {
      fetchKPIs();
    }
  }, [selectedBranch, timeRange, comparePeriod, activeTab]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranch, timeRange]);

  // Fetch orders when tab changes to sales or page changes
  useEffect(() => {
    if (activeTab === 'sales') {
      fetchOrders();
    }
  }, [selectedBranch, timeRange, activeTab, currentPage]);

  const fetchKPIs = async () => {
    setLoading(true);
    try {
      const range = timeRanges.find(r => r.value === timeRange);
      if (!range) return;

      const now = new Date();
      const endDate = new Date(now);
      let startDate = new Date(now);

      // Set start time to 00:00:00 and end time to 23:59:59 for proper day filtering
      if (timeRange === 'today') {
        // Today: start at 00:00:00, end at 23:59:59
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'yesterday') {
        // Yesterday: yesterday 00:00:00 to yesterday 23:59:59
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'lastWeek') {
        // Last 7 days: start 7 days ago, end yesterday
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'lastMonth') {
        // Last month: 1st of last month to last day of last month
        startDate.setMonth(now.getMonth() - 1);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(now.getMonth());
        endDate.setDate(0); // Last day of current month (previous month)
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'week') {
        // This week: start of week (Sunday) to today
        const dayOfWeek = startDate.getDay(); // 0 = Sunday, 6 = Saturday
        startDate.setDate(startDate.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'month') {
        // This month: 1st of current month to today
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'quarter') {
        // This quarter: 3 months ago to today
        startDate.setMonth(startDate.getMonth() - 3);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'year') {
        // This year: Jan 1 to today
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
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

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const range = timeRanges.find(r => r.value === timeRange);
      if (!range) return;

      const now = new Date();
      const endDate = new Date(now);
      let startDate = new Date(now);

      // Set start time to 00:00:00 and end time to 23:59:59 for proper day filtering
      if (timeRange === 'today') {
        // Today: start at 00:00:00, end at 23:59:59
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'yesterday') {
        // Yesterday: yesterday 00:00:00 to yesterday 23:59:59
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'lastWeek') {
        // Last 7 days: start 7 days ago, end yesterday
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'lastMonth') {
        // Last month: 1st of last month to last day of last month
        startDate.setMonth(now.getMonth() - 1);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(now.getMonth());
        endDate.setDate(0); // Last day of current month (previous month)
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'week') {
        // This week: start of week (Sunday) to today
        const dayOfWeek = startDate.getDay(); // 0 = Sunday, 6 = Saturday
        startDate.setDate(startDate.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'month') {
        // This month: 1st of current month to today
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'quarter') {
        // This quarter: 3 months ago to today
        startDate.setMonth(startDate.getMonth() - 3);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (timeRange === 'year') {
        // This year: Jan 1 to today
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      const offset = (currentPage - 1) * ordersPerPage;

      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== 'all') {
        params.append('branchId', selectedBranch);
      }
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());
      params.append('limit', ordersPerPage.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json();

      if (data.orders) {
        setOrders(data.orders);
        setTotalOrders(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedOrder) return;

    setIsRefunding(true);
    try {
      const response = await fetch('/api/orders/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          username: refundUsername,
          password: refundPassword,
          reason: refundReason,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === selectedOrder.id
              ? { ...order, isRefunded: true, refundReason }
              : order
          )
        );

        setRefundDialogOpen(false);
        setRefundUsername('');
        setRefundPassword('');
        setRefundReason('');
        setSelectedOrder(null);
        setOrderDialogOpen(false);

        alert('Order refunded successfully!');
        fetchOrders();
      } else {
        alert(data.error || 'Failed to process refund');
      }
    } catch (error) {
      console.error('Refund error:', error);
      alert('Failed to process refund');
    } finally {
      setIsRefunding(false);
    }
  };

  const handleVoidItem = async () => {
    if (!selectedVoidItem || !voidQuantity || voidQuantity <= 0) {
      alert('Please select an item and quantity to void');
      return;
    }

    setIsVoiding(true);
    try {
      const response = await fetch('/api/orders/void-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItemId: selectedVoidItem.id,
          quantity: voidQuantity,
          username: voidUsername,
          password: voidPassword,
          reason: voidReason,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`Voided ${voidQuantity} ${selectedVoidItem.menuItem?.name || selectedVoidItem.itemName} successfully!`);
        setVoidItemDialogOpen(false);
        setVoidQuantity(1);
        setVoidReason('');
        setVoidUsername('');
        setVoidPassword('');
        setSelectedVoidItem(null);
        // Refresh order data
        fetchOrders();
        // Reopen order dialog to show updated data
        if (selectedOrder) {
          const updatedOrderResponse = await fetch(`/api/orders/${selectedOrder.id}`);
          if (updatedOrderResponse.ok) {
            const updatedOrderData = await updatedOrderResponse.json();
            if (updatedOrderData.success) {
              setSelectedOrder(updatedOrderData.order);
            }
          }
        }
      } else {
        alert(data.error || 'Failed to void item');
      }
    } catch (error) {
      console.error('Void item error:', error);
      alert('Failed to void item');
    } finally {
      setIsVoiding(false);
    }
  };

  const openVoidDialog = (item: any) => {
    if (selectedOrder?.isRefunded) {
      alert('Cannot void items from a refunded order');
      return;
    }
    setSelectedVoidItem(item);
    setVoidQuantity(1);
    setVoidReason('');
    setVoidUsername('');
    setVoidPassword('');
    setVoidItemDialogOpen(true);
  };

  const handleExport = () => {
    if (!exportStartDate || !exportEndDate) {
      alert('Please select both start and end dates');
      return;
    }

    const params = new URLSearchParams();
    params.append('format', 'excel');
    params.append('startDate', exportStartDate);
    params.append('endDate', exportEndDate);
    if (selectedBranch && selectedBranch !== 'all') {
      params.append('branchId', selectedBranch);
    }

    window.location.href = `/api/reports/export?${params.toString()}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  if (loading && !kpiData && activeTab === 'overview') {
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
                onClick={() => activeTab === 'overview' ? fetchKPIs() : fetchOrders()}
                disabled={loading}
              >
                <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white dark:bg-slate-800 overflow-x-auto">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="sales">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Sales & Refunds
          </TabsTrigger>
          <TabsTrigger value="daily">
            <Calendar className="h-4 w-4 mr-2" />
            Daily Reports
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="customers">
            <Users className="h-4 w-4 mr-2" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="staff">
            <Users className="h-4 w-4 mr-2" />
            Staff
          </TabsTrigger>
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="branches">
              <Store className="h-4 w-4 mr-2" />
              Branches
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Revenue"
              value={formatCurrency(kpiData?.revenue.total || 0, currency)}
              icon={DollarSign}
              growth={kpiData?.revenue.growth}
              subtitle={`Product Cost: ${formatCurrency(kpiData?.revenue.productCost || 0, currency)} | Net: ${formatCurrency(kpiData?.revenue.net || 0, currency)}`}
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
                  {!kpiData?.topCategories || kpiData.topCategories.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Coffee className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No category data available for the selected period</p>
                    </div>
                  ) : (
                    kpiData.topCategories.map((category, index) => (
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
                                width: `${((category.revenue / (kpiData.topCategories[0]?.revenue || 1)) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
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
                  {!kpiData?.paymentMethods || Object.keys(kpiData.paymentMethods).length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No payment data available for the selected period</p>
                    </div>
                  ) : (
                    Object.entries(kpiData.paymentMethods).map(([method, data]: [string, any]) => {
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
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Export Actions */}
          <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Export Reports</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Download detailed reports in Excel format</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Date</Label>
                    <Input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To Date</Label>
                    <Input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleExport}
                      disabled={!exportStartDate || !exportEndDate}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Excel
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a date range to export orders. Both dates are required.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales & Refunds Tab */}
        <TabsContent value="sales" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Sales Orders
              </CardTitle>
              <CardDescription>View and manage orders, process refunds</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <>
                <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                  <div className="min-w-[800px] md:min-w-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Subtotal</TableHead>
                        <TableHead>Delivery Fee</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Cashier</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => {
                        // Calculate discount: subtotal + deliveryFee - totalAmount
                        const discount = Math.max(0, order.subtotal + (order.deliveryFee || 0) - order.totalAmount);

                        return (
                          <TableRow key={order.id} className={order.isRefunded ? 'opacity-50' : ''}>
                            <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                            <TableCell>
                              {new Date(order.orderTimestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {order.orderType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={order.paymentMethod === 'card' ? 'default' : 'secondary'}>
                                {order.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(order.subtotal, currency)}
                            </TableCell>
                            <TableCell>
                              {order.deliveryFee > 0 ? (
                                <Badge variant="outline" className="text-amber-600">
                                  {formatCurrency(order.deliveryFee, currency)}
                                </Badge>
                              ) : (
                                <span className="text-slate-400">-</span>
                            )}
                            </TableCell>
                            <TableCell>
                              {discount > 0 ? (
                                <Badge variant="outline" className="text-purple-600">
                                  -{formatCurrency(discount, currency)}
                                </Badge>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-bold">
                              {formatCurrency(order.totalAmount, currency)}
                            </TableCell>
                            <TableCell>{order.cashier?.name || 'Unknown'}</TableCell>
                            <TableCell>{order.branch?.branchName || 'Unknown'}</TableCell>
                            <TableCell>
                              {order.isRefunded ? (
                                <Badge variant="destructive">Refunded</Badge>
                              ) : (
                                <Badge className="bg-emerald-600">Completed</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setOrderDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {orders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-slate-500">
                            No orders found for the selected period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </div>
                {/* Pagination */}
                {totalOrders > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Showing {((currentPage - 1) * ordersPerPage) + 1} to {Math.min(currentPage * ordersPerPage, totalOrders)} of {totalOrders} orders
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, Math.ceil(totalOrders / ordersPerPage)) }, (_, i) => {
                          let pageNum;
                          const totalPages = Math.ceil(totalOrders / ordersPerPage);
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-10 h-10 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalOrders / ordersPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(totalOrders / ordersPerPage)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
                </>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Reports Tab */}
        <TabsContent value="daily">
          <DailyReportsTab />
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products">
          <ProductPerformanceReport />
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <CustomerAnalyticsReport />
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff">
          <StaffPerformanceReport />
        </TabsContent>

        {/* Branches Tab (Admin Only) */}
        {user?.role === 'ADMIN' && (
          <TabsContent value="branches">
            <BranchComparisonReport />
          </TabsContent>
        )}
      </Tabs>

      {/* Order Detail Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details #{selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Date & Time</Label>
                  <p className="font-semibold">{new Date(selectedOrder.orderTimestamp).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Order Type</Label>
                  <p className="font-semibold capitalize">{selectedOrder.orderType}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Payment Method</Label>
                  <p className="font-semibold capitalize">{selectedOrder.paymentMethod}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Subtotal</Label>
                  <p className="font-semibold text-lg">
                    {formatCurrency(selectedOrder.subtotal, currency)}
                  </p>
                </div>
                {selectedOrder.deliveryFee > 0 && (
                  <div>
                    <Label className="text-slate-500">Delivery Fee</Label>
                    <p className="font-semibold text-lg text-amber-600">
                      {formatCurrency(selectedOrder.deliveryFee, currency)}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-slate-500">Discount</Label>
                  <p className="font-semibold text-lg text-purple-600">
                    {formatCurrency(Math.max(0, selectedOrder.subtotal + (selectedOrder.deliveryFee || 0) - selectedOrder.totalAmount), currency)}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-500">Total (Paid)</Label>
                  <p className="font-bold text-xl text-emerald-600">
                    {formatCurrency(selectedOrder.totalAmount, currency)}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-500">Cashier</Label>
                  <p className="font-semibold">{selectedOrder.cashier?.name || 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Branch</Label>
                  <p className="font-semibold">{selectedOrder.branch?.branchName || 'Unknown'}</p>
                </div>
              </div>

              <div>
                <Label className="text-slate-500 mb-2 block">Order Items</Label>
                <div className="border rounded-lg divide-y">
                  {selectedOrder.items.map((item, index: number) => (
                    <div key={index} className="p-3 flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{item.menuItem?.name || item.itemName}</p>
                        <p className="text-sm text-slate-500">Qty: {item.quantity} × {formatCurrency(item.unitPrice, currency)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">
                          {formatCurrency(item.quantity * item.unitPrice, currency)}
                        </p>
                        {!selectedOrder.isRefunded && item.quantity > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openVoidDialog(item)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.isRefunded && (
                <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg">
                  <p className="font-semibold text-red-700 dark:text-red-300">Refunded</p>
                  {selectedOrder.refundReason && (
                    <p className="text-sm text-slate-600 mt-1">Reason: {selectedOrder.refundReason}</p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setDuplicateReceiptOrder(selectedOrder);
                    setOrderDialogOpen(false);
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt
                </Button>

                {!selectedOrder.isRefunded && (
                  <Button
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={() => {
                      setOrderDialogOpen(false);
                      setRefundDialogOpen(true);
                    }}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Process Refund
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Refund order #{selectedOrder?.orderNumber} for {formatCurrency(selectedOrder?.totalAmount || 0, currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={refundUsername}
                onChange={(e) => setRefundUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={refundPassword}
                onChange={(e) => setRefundPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason for Refund</Label>
              <Input
                id="reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter refund reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRefund}
              disabled={isRefunding || !refundUsername || !refundPassword || !refundReason}
            >
              {isRefunding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Confirm Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Item Dialog */}
      <Dialog open={voidItemDialogOpen} onOpenChange={setVoidItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Item</DialogTitle>
            <DialogDescription>
              Void {voidQuantity} x {selectedVoidItem?.menuItem?.name || selectedVoidItem?.itemName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="void-quantity">Quantity to Void</Label>
              <Input
                id="void-quantity"
                type="number"
                min="1"
                max={selectedVoidItem?.quantity || 1}
                value={voidQuantity}
                onChange={(e) => setVoidQuantity(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-slate-500 mt-1">
                Available: {selectedVoidItem?.quantity || 0}
              </p>
            </div>
            <div>
              <Label htmlFor="void-username">Username</Label>
              <Input
                id="void-username"
                value={voidUsername}
                onChange={(e) => setVoidUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </div>
            <div>
              <Label htmlFor="void-password">Password</Label>
              <Input
                id="void-password"
                type="password"
                value={voidPassword}
                onChange={(e) => setVoidPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            <div>
              <Label htmlFor="void-reason">Reason for Void</Label>
              <Input
                id="void-reason"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Enter void reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidItemDialogOpen(false)}>
              Cancel
            </Button>
            {isVoiding ? (
              <>
                <Button disabled>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleVoidItem}
                  disabled={!voidUsername || !voidPassword || !voidReason || voidQuantity <= 0}
                >
                  Void Item
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Receipt Dialog */}
      <ReceiptViewer
        open={!!duplicateReceiptOrder}
        onClose={() => setDuplicateReceiptOrder(null)}
        order={duplicateReceiptOrder}
        isDuplicate={true}
      />
    </div>
  );
}
