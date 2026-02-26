'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Calendar, ArrowUpRight, ArrowDownRight, Activity, PieChart } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/utils';

interface AnalyticsData {
  period: string;
  date: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
  itemsSold: number;
}

interface ForecastData {
  date: string;
  predictedRevenue: number;
  confidence: 'high' | 'medium' | 'low';
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
  growth: number;
}

interface HourlySales {
  hour: number;
  revenue: number;
  orders: number;
}

interface Branch {
  id: string;
  branchName: string;
  isActive: boolean;
}

const periods = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '365', label: 'Last Year' },
];

export default function AdvancedAnalytics() {
  const { user } = useAuth();
  const { currency, t } = useI18n();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [hourlySales, setHourlySales] = useState<HourlySales[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trends');

  // Fetch branches on mount
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

  // Load user and set default branch
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        // Admin can select any branch, default to first or 'all'
        if (branches.length > 0) {
          setSelectedBranch(branches[0].id);
        }
      } else if (user.branchId) {
        // Branch manager only sees their own branch
        setSelectedBranch(user.branchId);
      }
    }
  }, [user, branches]);

  // Fetch analytics when branch or period changes
  useEffect(() => {
    if (selectedBranch) {
      fetchAnalytics();
    }
  }, [selectedBranch, selectedPeriod]);

  const fetchAnalytics = async () => {
    if (!selectedBranch) return;

    setLoading(true);
    try {
      // In production, fetch from API
      // const response = await fetch(`/api/analytics?branchId=${selectedBranch}&period=${selectedPeriod}`);
      // const data = await response.json();
      // setAnalyticsData(data.analytics);
      // setForecastData(data.forecast);
      // setTopProducts(data.topProducts);
      // setHourlySales(data.hourlySales);

      // For now, generate sample data
      generateSampleData();
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleData = () => {
    const days = parseInt(selectedPeriod);
    const analytics: AnalyticsData[] = [];
    const forecast: ForecastData[] = [];
    const hourlyData: HourlySales[] = [];

    // Generate daily analytics data
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const baseRevenue = 500 + Math.random() * 300;
      const orders = Math.floor(baseRevenue / 10 + Math.random() * 10);
      const avgOrderValue = baseRevenue / orders;
      const itemsSold = orders * (2 + Math.floor(Math.random() * 3));

      analytics.push({
        period: 'daily',
        date: dateStr,
        revenue: Math.round(baseRevenue * 100) / 100,
        orders,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        itemsSold,
      });
    }

    // Generate forecast data for next 7 days
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const lastWeekRevenue = analytics[analytics.length - 7]?.revenue || 500;
      const predictedRevenue = lastWeekRevenue * (0.9 + Math.random() * 0.2);
      const confidence = Math.random() > 0.6 ? 'high' : Math.random() > 0.3 ? 'medium' : 'low';

      forecast.push({
        date: dateStr,
        predictedRevenue: Math.round(predictedRevenue * 100) / 100,
        confidence,
      });
    }

    // Generate hourly sales data
    for (let hour = 6; hour <= 22; hour++) {
      const baseRevenue = hour >= 8 && hour <= 10 ? 100 : hour >= 12 && hour <= 14 ? 150 : hour >= 17 && hour <= 19 ? 120 : 30;
      const revenue = baseRevenue + Math.random() * 50;
      const orders = Math.floor(revenue / 12);

      hourlyData.push({
        hour,
        revenue: Math.round(revenue * 100) / 100,
        orders,
      });
    }

    // Generate top products
    const products: TopProduct[] = [
      { name: 'Cappuccino', quantity: 245, revenue: 1102.50, growth: 12.5 },
      { name: 'Latte', quantity: 198, revenue: 910.80, growth: 8.3 },
      { name: 'Americano', quantity: 167, revenue: 668.00, growth: -2.1 },
      { name: 'Mocha', quantity: 134, revenue: 737.00, growth: 15.7 },
      { name: 'Espresso', quantity: 98, revenue: 294.00, growth: 5.2 },
      { name: 'Croissant', quantity: 89, revenue: 534.00, growth: 3.8 },
      { name: 'Muffin', quantity: 76, revenue: 380.00, growth: -5.3 },
      { name: 'Cold Brew', quantity: 65, revenue: 520.00, growth: 22.4 },
    ];

    setAnalyticsData(analytics);
    setForecastData(forecast);
    setTopProducts(products);
    setHourlySales(hourlyData);
  };

  const calculateInsights = () => {
    if (analyticsData.length < 2) return null;

    const recent = analyticsData.slice(-7);
    const previous = analyticsData.slice(-14, -7);

    const recentRevenue = recent.reduce((sum, d) => sum + d.revenue, 0);
    const previousRevenue = previous.reduce((sum, d) => sum + d.revenue, 0);

    const revenueGrowth = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const recentOrders = recent.reduce((sum, d) => sum + d.orders, 0);
    const previousOrders = previous.reduce((sum, d) => sum + d.orders, 0);
    const ordersGrowth = previousOrders > 0 ? ((recentOrders - previousOrders) / previousOrders) * 100 : 0;

    const avgOrderValue = recent.reduce((sum, d) => sum + d.avgOrderValue, 0) / recent.length;
    const peakHour = hourlySales.reduce((max, h) => h.revenue > max.revenue ? h : max, hourlySales[0]);

    return {
      revenueGrowth,
      ordersGrowth,
      avgOrderValue,
      peakHour,
      totalRevenue: recentRevenue,
      totalOrders: recentOrders,
    };
  };

  const insights = calculateInsights();

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Advanced Analytics
          </CardTitle>
          <CardDescription>
            Sales trends, forecasting, and performance insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {user?.role === 'ADMIN' && (
              <div className="flex-1">
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.branchName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {user?.role === 'BRANCH_MANAGER' && selectedBranch && (
              <div className="flex-1">
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Viewing Branch</p>
                    <p className="font-semibold">{branches.find(b => b.id === selectedBranch)?.branchName || 'Your Branch'}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            <span className="ml-3 text-slate-600">Loading analytics...</span>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Key Insights */}
          {insights && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Total Revenue</p>
                      <p className="text-2xl font-bold mt-1">
                        {formatCurrency(insights.totalRevenue, currency)}
                      </p>
                      <div className={`flex items-center gap-1 mt-2 text-sm ${insights.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {insights.revenueGrowth >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span>{Math.abs(insights.revenueGrowth).toFixed(1)}% vs previous period</span>
                      </div>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Total Orders</p>
                      <p className="text-2xl font-bold mt-1">{insights.totalOrders}</p>
                      <div className={`flex items-center gap-1 mt-2 text-sm ${insights.ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {insights.ordersGrowth >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span>{Math.abs(insights.ordersGrowth).toFixed(1)}% vs previous period</span>
                      </div>
                    </div>
                    <ShoppingCart className="h-8 w-8 text-primary opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Avg Order Value</p>
                      <p className="text-2xl font-bold mt-1">
                        {formatCurrency(insights.avgOrderValue, currency)}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-sm text-slate-600">
                        <Calendar className="h-4 w-4" />
                        <span>Last 7 days</span>
                      </div>
                    </div>
                    <Activity className="h-8 w-8 text-primary opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Peak Hour</p>
                      <p className="text-2xl font-bold mt-1">
                        {formatHour(insights.peakHour?.hour || 0)}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                        <ArrowUpRight className="h-4 w-4" />
                        <span>{formatCurrency(insights.peakHour?.revenue || 0, currency)} avg</span>
                      </div>
                    </div>
                    <TrendingUp className="h-8 w-8 text-primary opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Analytics Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white dark:bg-slate-800">
              <TabsTrigger value="trends">
                <TrendingUp className="h-4 w-4 mr-2" />
                Sales Trends
              </TabsTrigger>
              <TabsTrigger value="forecast">
                <Calendar className="h-4 w-4 mr-2" />
                Forecast
              </TabsTrigger>
              <TabsTrigger value="products">
                <PieChart className="h-4 w-4 mr-2" />
                Top Products
              </TabsTrigger>
              <TabsTrigger value="hourly">
                <Activity className="h-4 w-4 mr-2" />
                Hourly Sales
              </TabsTrigger>
            </TabsList>

            {/* Sales Trends */}
            <TabsContent value="trends" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                  <CardDescription>Daily revenue over selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-4">
                      <span>Total: {formatCurrency(analyticsData.reduce((sum, d) => sum + d.revenue, 0), currency)}</span>
                      <span>Avg: {formatCurrency(analyticsData.reduce((sum, d) => sum + d.revenue, 0) / analyticsData.length, currency)}</span>
                    </div>
                    <div className="h-64 flex items-end gap-1 overflow-x-auto pb-4">
                      {analyticsData.map((data, index) => {
                        const maxRevenue = Math.max(...analyticsData.map(d => d.revenue));
                        const height = (data.revenue / maxRevenue) * 100;
                        const isToday = index === analyticsData.length - 1;

                        return (
                          <div
                            key={index}
                            className="flex-1 min-w-[20px] flex flex-col items-center group"
                          >
                            <div
                              className={`w-full rounded-t transition-all ${
                                isToday
                                  ? 'bg-primary'
                                  : 'bg-primary/50 group-hover:bg-primary/70'
                              }`}
                              style={{ height: `${Math.max(height, 5)}%` }}
                              title={`${data.date}: ${formatCurrency(data.revenue, currency)}`}
                            />
                            <div className="text-xs text-slate-500 mt-2 transform rotate-45 origin-bottom-left">
                              {data.date.split('-').slice(1).join('/')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Orders Trend</CardTitle>
                  <CardDescription>Daily orders over selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-4">
                      <span>Total: {analyticsData.reduce((sum, d) => sum + d.orders, 0)}</span>
                      <span>Avg: {Math.round(analyticsData.reduce((sum, d) => sum + d.orders, 0) / analyticsData.length)}</span>
                    </div>
                    <div className="h-64 flex items-end gap-1 overflow-x-auto pb-4">
                      {analyticsData.map((data, index) => {
                        const maxOrders = Math.max(...analyticsData.map(d => d.orders));
                        const height = (data.orders / maxOrders) * 100;
                        const isToday = index === analyticsData.length - 1;

                        return (
                          <div
                            key={index}
                            className="flex-1 min-w-[20px] flex flex-col items-center group"
                          >
                            <div
                              className={`w-full rounded-t transition-all ${
                                isToday
                                  ? 'bg-blue-600'
                                  : 'bg-blue-600/50 group-hover:bg-blue-600/70'
                              }`}
                              style={{ height: `${Math.max(height, 5)}%` }}
                              title={`${data.date}: ${data.orders} orders`}
                            />
                            <div className="text-xs text-slate-500 mt-2 transform rotate-45 origin-bottom-left">
                              {data.date.split('-').slice(1).join('/')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Forecast */}
            <TabsContent value="forecast" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>7-Day Revenue Forecast</CardTitle>
                  <CardDescription>Predicted revenue based on historical data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 flex items-end gap-4">
                    {forecastData.map((data) => {
                      const maxRevenue = Math.max(...forecastData.map(d => d.predictedRevenue));
                      const height = (data.predictedRevenue / maxRevenue) * 70;

                      return (
                        <div
                          key={data.date}
                          className="flex-1 flex flex-col items-center"
                        >
                          <div
                            className={`w-full rounded-t relative group ${
                              data.confidence === 'high'
                                ? 'bg-green-600'
                                : data.confidence === 'medium'
                                ? 'bg-amber-600'
                                : 'bg-red-600'
                            }`}
                            style={{ height: `${Math.max(height, 10)}%` }}
                          >
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                              <div>{data.date}</div>
                              <div className="font-semibold">
                                {formatCurrency(data.predictedRevenue, currency)}
                              </div>
                              <div className={`inline-block w-2 h-2 rounded-full ${getConfidenceColor(data.confidence)} mr-1`} />
                              {data.confidence}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 mt-2">
                            {data.date.split('-').slice(1).join('/')}
                          </div>
                          <div className="text-xs font-medium">
                            {formatCurrency(data.predictedRevenue, currency)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getConfidenceColor('high')}`} />
                      <span>High Confidence (±10%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getConfidenceColor('medium')}`} />
                      <span>Medium Confidence (±20%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getConfidenceColor('low')}`} />
                      <span>Low Confidence (±30%)</span>
                    </div>
              </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Top Products */}
            <TabsContent value="products" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Selling Products</CardTitle>
                  <CardDescription>Best performing items by quantity and revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topProducts.map((product, index) => (
                      <div
                        key={product.name}
                        className="flex items-center gap-4 p-4 border rounded-lg hover:bg-primary/5 transition-colors"
                      >
                        <div className="text-2xl font-bold text-slate-300 w-8">
                          #{index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{product.name}</span>
                            <div className="flex items-center gap-2">
                              {product.growth >= 0 ? (
                                <ArrowUpRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4 text-red-600" />
                              )}
                              <span
                                className={`text-sm font-medium ${
                                  product.growth >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {Math.abs(product.growth)}%
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-600 dark:text-slate-400">Quantity:</span>{' '}
                              <span className="font-medium">{product.quantity}</span>
                            </div>
                            <div>
                              <span className="text-slate-600 dark:text-slate-400">Revenue:</span>{' '}
                              <span className="font-medium">{formatCurrency(product.revenue, currency)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hourly Sales */}
            <TabsContent value="hourly" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Hourly Sales Distribution</CardTitle>
                  <CardDescription>Average revenue and orders by hour of day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 flex items-end gap-2">
                    {hourlySales.map((data) => {
                      const maxRevenue = Math.max(...hourlySales.map(h => h.revenue));
                      const height = (data.revenue / maxRevenue) * 85;
                      const isPeak = data.hour === insights?.peakHour?.hour;

                      return (
                        <div
                          key={data.hour}
                          className="flex-1 flex flex-col items-center group"
                        >
                          <div
                            className={`w-full rounded-t transition-all ${
                              isPeak
                                ? 'bg-primary'
                                : 'bg-primary/40 group-hover:bg-primary/60'
                            }`}
                            style={{ height: `${Math.max(height, 5)}%` }}
                            title={`${formatHour(data.hour)}: ${formatCurrency(data.revenue, currency)} (${data.orders} orders)`}
                          >
                            {isPeak && (
                              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded font-semibold whitespace-nowrap">
                                Peak
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-2">
                            {data.hour}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                    Peak hour: <span className="font-semibold">{formatHour(insights?.peakHour?.hour || 0)}</span> with avg{' '}
                    <span className="font-semibold">{formatCurrency(insights?.peakHour?.revenue || 0, currency)}</span> revenue
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
