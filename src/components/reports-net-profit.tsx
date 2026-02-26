'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, TrendingDown, Package, ShoppingCart, Calendar, RefreshCw, ArrowUpRight, ArrowDownRight, AlertCircle, Download, Printer, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';

interface Branch {
  id: string;
  branchName: string;
}

interface NetProfitData {
  period: string;
  sales: {
    revenue: number;
    productCost: number;
    netProfitFromOperations: number;
    grossMargin: number;
  };
  costs: {
    operational: number;
    entries: number;
    byCategory: Record<string, number>;
  };
  netProfit: {
    amount: number;
    margin: number;
    isProfitable: boolean;
  };
  items: {
    sold: number;
    orders: number;
  };
  costsBreakdown: Array<{
    id: string;
    category: string;
    amount: number;
    branch: string;
    notes: string | null;
    date: Date;
  }>;
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    orders: number;
    itemsSold: number;
    productCost: number;
    netFromOperations: number;
    grossMargin: number;
  }>;
}

export default function NetProfitReport() {
  const { user: currentUser } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(currentUser?.role === 'BRANCH_MANAGER' ? currentUser.branchId || '' : 'all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [data, setData] = useState<NetProfitData | null>(null);
  const [loading, setLoading] = useState(false);

  // Get current period (YYYY-MM)
  const getCurrentPeriod = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Generate period options (last 6 months + current month)
  const getPeriodOptions = () => {
    const periods: Array<{ value: string; label: string }> = [];
    const now = new Date();
    
    for (let i = -6; i <= 0; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      periods.push({ value: period, label });
    }
    
    return periods.reverse();
  };

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches');
        const data = await response.json();
        if (response.ok && data.branches) {
          setBranches(data.branches);
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      }
    };
    fetchBranches();
  }, []);

  // Set default period
  useEffect(() => {
    setSelectedPeriod(getCurrentPeriod());
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    if (selectedPeriod) {
      fetchData();
    }
  }, [selectedBranch, selectedPeriod]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branchId', selectedBranch);
      if (selectedPeriod) params.append('period', selectedPeriod);

      const response = await fetch(`/api/reports/net-profit?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch net profit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const handleExport = () => {
    if (!data) return;

    const periodLabel = getPeriodLabel(data.period);
    const branchLabel = selectedBranch === 'all' ? 'All Branches' : branches.find(b => b.id === selectedBranch)?.branchName || 'Unknown';

    let csvContent = `Net Profit/Loss Report\n`;
    csvContent += `Period: ${periodLabel}\n`;
    csvContent += `Branch: ${branchLabel}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;

    csvContent += `SUMMARY\n`;
    csvContent += `Metric,Value\n`;
    csvContent += `Total Revenue,${data.sales.revenue}\n`;
    csvContent += `Orders,${data.items.orders}\n`;
    csvContent += `Items Sold,${data.items.sold}\n`;
    csvContent += `Product Cost,${data.sales.productCost}\n`;
    csvContent += `Net from Operations,${data.sales.netProfitFromOperations}\n`;
    csvContent += `Gross Margin,${data.sales.grossMargin.toFixed(1)}%\n`;
    csvContent += `Operational Costs,${data.costs.operational}\n`;
    csvContent += `Cost Entries,${data.costs.entries}\n`;
    csvContent += `Net Profit/Loss,${data.netProfit.amount}\n`;
    csvContent += `Net Margin,${data.netProfit.margin.toFixed(1)}%\n\n`;

    csvContent += `SALES BY CATEGORY\n`;
    csvContent += `Category,Revenue,Orders,Items Sold,Product Cost,Net from Operations,Gross Margin\n`;
    data.categoryBreakdown.forEach(cat => {
      csvContent += `${cat.category},${cat.revenue},${cat.orders},${cat.itemsSold},${cat.productCost},${cat.netFromOperations},${cat.grossMargin.toFixed(1)}%\n`;
    });
    csvContent += `\n`;

    csvContent += `OPERATIONAL COSTS BY CATEGORY\n`;
    csvContent += `Category,Amount\n`;
    Object.entries(data.costs.byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, amount]) => {
        csvContent += `${category},${amount}\n`;
      });
    csvContent += `\n`;

    csvContent += `COST ENTRIES DETAILS\n`;
    csvContent += `Category,Amount,Branch,Date,Notes\n`;
    data.costsBreakdown.forEach(cost => {
      const notes = cost.notes ? cost.notes.replace(/,/g, ';') : '';
      csvContent += `${cost.category},${cost.amount},${cost.branch},${new Date(cost.date).toLocaleDateString()},"${notes}"\n`;
    });

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `net-profit-report-${data.period}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handlePrint = () => {
    if (!data) return;

    const periodLabel = getPeriodLabel(data.period);
    const branchLabel = selectedBranch === 'all' ? 'All Branches' : branches.find(b => b.id === selectedBranch)?.branchName || 'Unknown';

    let salesByCategoryHtml = '';
    if (data.categoryBreakdown.length > 0) {
      salesByCategoryHtml = `
        <div style="margin-top: 20px;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Sales by Category</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 12px;">Category</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 12px;">Revenue</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 12px;">Orders</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 12px;">Items Sold</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 12px;">Product Cost</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 12px;">Net from Ops</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 12px;">Gross Margin</th>
              </tr>
            </thead>
            <tbody>
              ${data.categoryBreakdown.map(cat => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px; font-weight: 500;">${cat.category}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 11px;">${formatCurrency(cat.revenue)}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 11px;">${cat.orders}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 11px;">${cat.itemsSold}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 11px;">${formatCurrency(cat.productCost)}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 11px; font-weight: 500;">${formatCurrency(cat.netFromOperations)}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 11px; ${cat.grossMargin >= 0 ? 'color: #166534;' : 'color: #991b1b;'}">${cat.grossMargin.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let costsByCategoryHtml = '';
    if (Object.keys(data.costs.byCategory).length > 0) {
      costsByCategoryHtml = `
        <div style="margin-top: 20px;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Operational Costs by Category</h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 15px;">Total: ${formatCurrency(data.costs.operational)} (${data.costs.entries} entries)</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 12px;">Category</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 12px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(data.costs.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${category}</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 11px;">${formatCurrency(amount)}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let costEntriesHtml = '';
    if (data.costsBreakdown.length > 0) {
      costEntriesHtml = `
        <div style="margin-top: 20px;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">Cost Entries Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 12px;">Category</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 12px;">Amount</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 12px;">Branch</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 12px;">Date</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 12px;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${data.costsBreakdown.map(cost => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${cost.category}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 11px;">${formatCurrency(cost.amount)}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${cost.branch}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${new Date(cost.date).toLocaleDateString()}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; font-size: 11px;">${cost.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Net Profit/Loss Report - ${periodLabel}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      max-width: 100%;
      margin: 0;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
      font-weight: bold;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .summary-card {
      background: #f9fafb;
      padding: 15px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .summary-card.positive {
      background: #f0fdf4;
      border-color: #22c55e;
    }
    .summary-card.negative {
      background: #fef2f2;
      border-color: #ef4444;
    }
    .summary-card h3 {
      margin: 0 0 5px 0;
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
    }
    .summary-card .amount {
      font-size: 20px;
      font-weight: bold;
      margin: 5px 0;
    }
    .summary-card .subtitle {
      font-size: 10px;
      color: #999;
    }
    .summary-card .margin {
      font-size: 12px;
      font-weight: 600;
    }
    .net-profit-summary {
      background: ${data.netProfit.isProfitable ? '#f0fdf4' : '#fef2f2'};
      border: 2px solid ${data.netProfit.isProfitable ? '#22c55e' : '#ef4444'};
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .net-profit-summary h2 {
      margin: 0 0 15px 0;
      font-size: 18px;
      font-weight: bold;
      color: ${data.netProfit.isProfitable ? '#166534' : '#991b1b'};
    }
    .net-profit-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }
    .net-profit-detail-item {
      text-align: center;
      padding: 10px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 8px;
    }
    .net-profit-detail-item p {
      margin: 5px 0;
    }
    .net-profit-detail-item .label {
      font-size: 11px;
      color: #666;
    }
    .net-profit-detail-item .value {
      font-size: 18px;
      font-weight: bold;
    }
    .net-profit-detail-item .small {
      font-size: 10px;
      color: #999;
    }
    @media print {
      body {
        padding: 10px;
      }
      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .net-profit-details {
        grid-template-columns: repeat(3, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>صافي الربح/الخسارة</h1>
    <p>Net Profit/Loss Report</p>
    <p><strong>Period:</strong> ${periodLabel}</p>
    <p><strong>Branch:</strong> ${branchLabel}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-card positive">
      <h3>Total Revenue</h3>
      <div class="amount">${formatCurrency(data.sales.revenue)}</div>
      <div class="subtitle">${data.items.orders} orders</div>
    </div>
    <div class="summary-card negative">
      <h3>Product Cost</h3>
      <div class="amount">${formatCurrency(data.sales.productCost)}</div>
      <div class="subtitle">${data.items.sold} items sold</div>
    </div>
    <div class="summary-card ${data.sales.netProfitFromOperations >= 0 ? 'positive' : 'negative'}">
      <h3>Net from Operations</h3>
      <div class="amount">${formatCurrency(data.sales.netProfitFromOperations)}</div>
      <div class="subtitle">Revenue - Product Cost</div>
      <div class="margin">${data.sales.grossMargin.toFixed(1)}% margin</div>
    </div>
    <div class="summary-card ${data.netProfit.isProfitable ? 'positive' : 'negative'}">
      <h3>Net Profit/Loss</h3>
      <div class="amount">${formatCurrency(Math.abs(data.netProfit.amount))}</div>
      <div class="subtitle">After operational costs</div>
      <div class="margin">${data.netProfit.margin.toFixed(1)}% margin</div>
    </div>
  </div>

  <div class="net-profit-summary">
    <h2>${data.netProfit.isProfitable ? 'صافي الربح' : 'صافي الخسارة'}</h2>
    <p style="text-align: center; margin-bottom: 15px; font-size: 12px;">
      ${formatCurrency(data.sales.revenue)} (Sales) - ${formatCurrency(data.sales.productCost)} (Product Cost) - ${formatCurrency(data.costs.operational)} (Operational Costs) = ${formatCurrency(Math.abs(data.netProfit.amount))}
    </p>
    <div class="net-profit-details">
      <div class="net-profit-detail-item">
        <p class="label">Total Revenue</p>
        <p class="value">${formatCurrency(data.sales.revenue)}</p>
      </div>
      <div class="net-profit-detail-item">
        <p class="label">Total Costs (Product + Operations)</p>
        <p class="value">${formatCurrency(data.sales.productCost + data.costs.operational)}</p>
        <p class="small">Product: ${formatCurrency(data.sales.productCost)} | Operations: ${formatCurrency(data.costs.operational)}</p>
      </div>
      <div class="net-profit-detail-item">
        <p class="label">Net Margin</p>
        <p class="value" style="color: ${data.netProfit.isProfitable ? '#166534' : '#991b1b'};">${data.netProfit.margin.toFixed(1)}%</p>
        <p class="small">${formatCurrency(data.netProfit.amount)} net profit/loss</p>
      </div>
    </div>
  </div>

  ${salesByCategoryHtml}
  ${costsByCategoryHtml}
  ${costEntriesHtml}

  <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999;">
    <p>Emperor Coffee Franchise</p>
    <p>Net Profit/Loss Report - ${periodLabel}</p>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  const ProfitCard = ({
    title,
    amount,
    subtitle,
    icon: Icon,
    isPositive,
    percentage
  }: {
    title: string;
    amount: number;
    subtitle?: string;
    icon: any;
    isPositive?: boolean;
    percentage?: number;
  }) => (
    <Card className={`border-2 ${isPositive === false ? 'border-red-200 bg-red-50/50' : isPositive === true ? 'border-green-200 bg-green-50/50' : 'border-slate-200'}`}>
      <CardHeader className="pb-3">
        <CardDescription className="text-xs font-medium flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${isPositive === false ? 'text-red-600' : isPositive === true ? 'text-green-600' : 'text-slate-600'}`} />
          {title}
        </CardDescription>
        <CardTitle className={`text-2xl font-bold ${isPositive === false ? 'text-red-900' : isPositive === true ? 'text-green-900' : 'text-slate-900'}`}>
          {formatCurrency(Math.abs(amount))}
        </CardTitle>
        {subtitle && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{subtitle}</p>
        )}
        {percentage !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            {isPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
            )}
            <span className={`text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {percentage.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500">margin</span>
          </div>
        )}
      </CardHeader>
    </Card>
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full"></div>
          <p className="text-slate-600">Loading net profit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-200">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${data?.netProfit.isProfitable ? 'bg-green-500' : 'bg-red-500'} shadow-lg`}>
                {data?.netProfit.isProfitable ? (
                  <TrendingUp className="h-6 w-6 text-white" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">صافي الربح/الخسارة</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Net Profit/Loss Report</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {currentUser?.role === 'ADMIN' && (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
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

              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Calendar className="h-4 w-4 mr-2 text-emerald-600" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getPeriodOptions().map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={handleExport}
                disabled={loading || !data}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button
                variant="default"
                size="default"
                onClick={handlePrint}
                disabled={loading || !data}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Print</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ProfitCard
              title="Total Revenue"
              amount={data.sales.revenue}
              subtitle={`${data.items.orders} orders`}
              icon={ShoppingCart}
              isPositive={true}
            />
            <ProfitCard
              title="Product Cost"
              amount={data.sales.productCost}
              subtitle={`${data.items.sold} items sold`}
              icon={Package}
              isPositive={false}
            />
            <ProfitCard
              title="Net from Operations"
              amount={data.sales.netProfitFromOperations}
              subtitle="Revenue - Product Cost"
              icon={DollarSign}
              isPositive={data.sales.netProfitFromOperations >= 0}
              percentage={data.sales.grossMargin}
            />
            <ProfitCard
              title="Net Profit/Loss"
              amount={data.netProfit.amount}
              subtitle="After operational costs"
              icon={data.netProfit.isProfitable ? TrendingUp : TrendingDown}
              isPositive={data.netProfit.isProfitable}
              percentage={data.netProfit.margin}
            />
          </div>

          {/* Final Net Profit Summary */}
          <Card className={`border-2 ${data.netProfit.isProfitable ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' : 'border-red-300 bg-gradient-to-br from-red-50 to-orange-50'} shadow-xl`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-3 ${data.netProfit.isProfitable ? 'text-green-900' : 'text-red-900'}`}>
                {data.netProfit.isProfitable ? (
                  <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-white" />
                  </div>
                )}
                <span>
                  {data.netProfit.isProfitable ? 'صافي الربح' : 'صافي الخسارة'}
                  <span className="text-sm font-normal text-slate-600 ml-2">
                    ({getPeriodLabel(data.period)})
                  </span>
                </span>
              </CardTitle>
              <CardDescription>
                {data.sales.revenue} (Sales) - {data.sales.productCost} (Product Cost) - {data.costs.operational} (Operational Costs) = {formatCurrency(Math.abs(data.netProfit.amount))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(data.sales.revenue)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">Total Costs (Product + Operations)</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(data.sales.productCost + data.costs.operational)}</p>
                  <p className="text-xs text-slate-500">Product: {formatCurrency(data.sales.productCost)} | Operations: {formatCurrency(data.costs.operational)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">Net Margin</p>
                  <p className={`text-2xl font-bold ${data.netProfit.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                    {data.netProfit.margin.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500">{formatCurrency(data.netProfit.amount)} net profit/loss</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales by Category */}
          {data.categoryBreakdown.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-slate-700" />
                  Sales by Category
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of sales performance by product category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                  <div className="min-w-[900px] md:min-w-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Total Revenue</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Items Sold</TableHead>
                          <TableHead className="text-right">Product Cost</TableHead>
                          <TableHead className="text-right">Net from Ops</TableHead>
                          <TableHead className="text-right">Gross Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.categoryBreakdown.map((cat) => (
                          <TableRow key={cat.category}>
                            <TableCell className="font-medium">{cat.category}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(cat.revenue)}</TableCell>
                            <TableCell className="text-right">{cat.orders}</TableCell>
                            <TableCell className="text-right">{cat.itemsSold}</TableCell>
                            <TableCell className="text-right text-slate-600">{formatCurrency(cat.productCost)}</TableCell>
                            <TableCell className={`text-right font-semibold ${cat.netFromOperations >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(cat.netFromOperations)}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${cat.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {cat.grossMargin.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Costs Breakdown by Category */}
          {Object.keys(data.costs.byCategory).length > 0 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-slate-700" />
                  Operational Costs by Category
                </CardTitle>
                <CardDescription>
                  Total: {formatCurrency(data.costs.operational)} ({data.costs.entries} entries)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(data.costs.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => (
                      <div key={category} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-xs font-medium text-slate-600 truncate mb-1">{category}</p>
                        <p className="text-lg font-bold text-slate-900">{formatCurrency(amount)}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Costs Table */}
          {data.costsBreakdown.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-slate-700" />
                  Cost Entries Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                  <div className="min-w-[800px] md:min-w-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.costsBreakdown.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell className="font-medium">{cost.category}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(cost.amount)}</TableCell>
                          <TableCell>{cost.branch}</TableCell>
                          <TableCell>{new Date(cost.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-slate-500">{cost.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                  </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
