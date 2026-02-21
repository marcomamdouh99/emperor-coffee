'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Printer, FileText, Package, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { type ShiftClosingReportData } from '@/lib/escpos-encoder';

interface ShiftClosingReceiptProps {
  shiftId: string;
  open: boolean;
  onClose: () => void;
}

interface ApiResponse {
  success: boolean;
  report?: {
    shift: {
      id: string;
      shiftNumber: number;
      startTime: string;
      endTime: string;
      cashier: { name: string; username: string };
      branch: { id: string; branchName: string };
      openingCash: number;
      closingCash: number | null;
      openingOrders: number;
      closingOrders: number | null;
      openingRevenue: number;
      closingRevenue: number | null;
    };
    paymentSummary: {
      cash: number;
      card: number;
      other: number;
      total: number;
    };
    orderTypeBreakdown: {
      'take-away': { value: number; discounts: number; count: number; total: number };
      'dine-in': { value: number; discounts: number; count: number; total: number };
      'delivery': { value: number; discounts: number; count: number; total: number };
    };
    totals: {
      sales: number;
      discounts: number;
      deliveryFees: number;
      refunds: number;
      card: number;
      cash: number;
      openingCashBalance: number;
      expectedCash: number;
      closingCashBalance: number;
      overShort: number | null;
    };
    categoryBreakdown: Array<{
      categoryName: string;
      totalSales: number;
      items: Array<{
        itemId: string;
        itemName: string;
        quantity: number;
        totalPrice: number;
      }>;
    }>;
  };
  error?: string;
  details?: string;
}

export function ShiftClosingReceipt({ shiftId, open, onClose }: ShiftClosingReceiptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShiftClosingReportData | null>(null);
  const [fullReportData, setFullReportData] = useState<ApiResponse['report'] | null>(null);

  // Fetch shift closing data when dialog opens
  useEffect(() => {
    if (open && shiftId) {
      fetchShiftData();
    }
  }, [open, shiftId]);

  // Auto-print both papers when data is loaded
  useEffect(() => {
    if (data && open) {
      console.log('[Shift Closing] Auto-printing shift closing receipt...');
      
      // Small delay to ensure the dialog is rendered
      const timer1 = setTimeout(() => {
        console.log('[Shift Closing] Printing Paper 1 (Payment Summary)...');
        printThermalPaper1();
      }, 1000); // 1 second delay to allow dialog to render

      // Print Paper 2 (Item Breakdown) after a delay
      const timer2 = setTimeout(() => {
        console.log('[Shift Closing] Printing Paper 2 (Item Breakdown)...');
        printThermalPaper2();
      }, 4000); // 4 second delay between prints

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [data, open]);

  const fetchShiftData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/shifts/${shiftId}/closing-report`);
      const result: ApiResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch shift data');
      }

      const report = result.data;

      // Save full report data for printing
      setFullReportData(report);

      // Transform API response to ShiftClosingReportData format
      const transformedData: ShiftClosingReportData = {
        storeName: 'Emperor Coffee',
        branchName: report.shift.branch.branchName,
        shift: {
          shiftNumber: report.shift.shiftNumber,
          startTime: report.shift.startTime,
          endTime: report.shift.endTime,
          cashier: report.shift.cashier
        },
        paymentSummary: report.paymentSummary,
        categoryBreakdown: report.categoryBreakdown.map(cat => ({
          categoryName: cat.categoryName,
          totalSales: cat.totalSales,
          items: cat.items.map(item => ({
            itemName: item.itemName,
            quantity: item.quantity,
            totalPrice: item.totalPrice
          }))
        })),
        fontSize: 'medium'
      };

      setData(transformedData);
    } catch (err: any) {
      console.error('[Shift Closing Receipt Error]', err);
      setError(err.message || 'Failed to load shift closing data');
    } finally {
      setLoading(false);
    }
  };

  const printThermalPaper1 = () => {
    if (!data) return;
    printStandardPaper1();
  };

  const printStandardPaper1 = () => {
    if (!data || !fullReportData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cashierName = data.shift.cashier.name || data.shift.cashier.username;
    const dateStr = new Date(data.shift.startTime).toLocaleDateString();
    const timeStr = `${new Date(data.shift.startTime).toLocaleTimeString()} - ${new Date(data.shift.endTime).toLocaleTimeString()}`;

    // Order type breakdown data
    const takeAway = fullReportData.orderTypeBreakdown?.['take-away'] || { value: 0, discounts: 0, total: 0 };
    const dineIn = fullReportData.orderTypeBreakdown?.['dine-in'] || { value: 0, discounts: 0, total: 0 };
    const delivery = fullReportData.orderTypeBreakdown?.['delivery'] || { value: 0, discounts: 0, total: 0 };

    // Financial summary data
    const totalSales = fullReportData.totals.sales || 0;
    const totalDiscounts = fullReportData.totals.discounts || 0;
    const totalDeliveryFees = fullReportData.totals.deliveryFees || 0;
    const totalRefunds = fullReportData.totals.refunds || 0;
    const totalCard = fullReportData.totals.card || 0;
    const totalCash = fullReportData.totals.cash || 0;
    const openingBalance = fullReportData.totals.openingCashBalance || 0;
    const expectedCash = fullReportData.totals.expectedCash || 0;
    const closingBalance = fullReportData.totals.closingCashBalance || 0;
    const overShort = fullReportData.totals.overShort || 0;

    const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Shift Closing - Shift ${data.shift.shiftNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
      padding: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      color: #000 !important;
    }

    @media print {
      @page {
        margin: 0;
        padding: 0;
        size: 80mm auto;
      }

      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      html, body {
        height: auto;
        overflow: visible;
      }
    }

    html, body {
      margin: 0;
      padding: 0;
      height: auto;
      width: 80mm;
    }

    body {
      font-family: 'Courier New', monospace;
      max-width: 80mm;
      margin: 0 auto;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
      background: white;
      color: #000;
    }

    .header {
      text-align: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px dashed #000;
    }

    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
      padding: 0;
      color: #000;
    }

    .header div {
      margin: 2px 0;
      padding: 0;
      color: #000;
    }

    .section-title {
      font-weight: bold;
      margin: 10px 0 5px 0;
      padding: 0;
      text-decoration: underline;
    }

    .info {
      margin-bottom: 10px;
      font-size: 12px;
      padding: 0;
    }

    .info div {
      margin: 2px 0;
      padding: 0;
      color: #000;
    }

    .order-type {
      margin-bottom: 10px;
      padding: 5px;
      border: 1px solid #000;
    }

    .order-type-title {
      font-weight: bold;
      margin-bottom: 5px;
    }

    .order-type-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }

    .order-type-row span {
      color: #000 !important;
    }

    .totals {
      border-top: 2px dashed #000;
      padding-top: 8px;
      margin-top: 5px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      padding: 0;
    }

    .total-row span {
      color: #000 !important;
    }

    .total-row.grand-total {
      font-weight: bold;
      font-size: 14px;
      margin-top: 8px;
      padding-top: 5px;
    }

    .footer {
      text-align: center;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 2px dashed #000;
      font-size: 10px;
      padding-bottom: 0;
      color: #000;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Emperor Coffee</h1>
    <div>${data.branchName}</div>
    <div>Shift Closing #${data.shift.shiftNumber}</div>
  </div>

  <div class="info">
    <div>Date: ${dateStr}</div>
    <div>Time: ${timeStr}</div>
    <div>Cashier: ${cashierName}</div>
  </div>

  <div class="section-title">Order Type Breakdown</div>

  <div class="order-type">
    <div class="order-type-title">Take Away</div>
    <div class="order-type-row">
      <span>Value:</span>
      <span>${formatCurrency(takeAway.value)}</span>
    </div>
    <div class="order-type-row">
      <span>Discounts:</span>
      <span>-${formatCurrency(takeAway.discounts)}</span>
    </div>
    <div class="order-type-row">
      <span>Total:</span>
      <span>${formatCurrency(takeAway.total)}</span>
    </div>
  </div>

  <div class="order-type">
    <div class="order-type-title">Dine In</div>
    <div class="order-type-row">
      <span>Value:</span>
      <span>${formatCurrency(dineIn.value)}</span>
    </div>
    <div class="order-type-row">
      <span>Discounts:</span>
      <span>-${formatCurrency(dineIn.discounts)}</span>
    </div>
    <div class="order-type-row">
      <span>Total:</span>
      <span>${formatCurrency(dineIn.total)}</span>
    </div>
  </div>

  <div class="order-type">
    <div class="order-type-title">Delivery</div>
    <div class="order-type-row">
      <span>Value:</span>
      <span>${formatCurrency(delivery.value)}</span>
    </div>
    <div class="order-type-row">
      <span>Discounts:</span>
      <span>-${formatCurrency(delivery.discounts)}</span>
    </div>
    <div class="order-type-row">
      <span>Total:</span>
      <span>${formatCurrency(delivery.total)}</span>
    </div>
  </div>

  <div class="section-title">Financial Summary</div>

  <div class="totals">
    <div class="total-row">
      <span>Total Sales:</span>
      <span>${formatCurrency(totalSales)}</span>
    </div>
    <div class="total-row">
      <span>Total Discounts:</span>
      <span>${formatCurrency(totalDiscounts)}</span>
    </div>
    <div class="total-row">
      <span>Total Delivery Fees:</span>
      <span>${formatCurrency(totalDeliveryFees)}</span>
    </div>
    <div class="total-row">
      <span>Total Refunds:</span>
      <span>${formatCurrency(totalRefunds)}</span>
    </div>
    <div class="total-row">
      <span>Total Card:</span>
      <span>${formatCurrency(totalCard)}</span>
    </div>
    <div class="total-row">
      <span>Total Cash:</span>
      <span>${formatCurrency(totalCash)}</span>
    </div>
    <div class="total-row">
      <span>Opening Cash Balance:</span>
      <span>${formatCurrency(openingBalance)}</span>
    </div>
    <div class="total-row">
      <span>Expected Cash:</span>
      <span>${formatCurrency(expectedCash)}</span>
    </div>
    <div class="total-row">
      <span>Closing Cash Balance:</span>
      <span>${formatCurrency(closingBalance)}</span>
    </div>
    <div class="total-row grand-total">
      <span>Over/Short:</span>
      <span>${formatCurrency(overShort)}</span>
    </div>
  </div>

  <div class="footer">
    <div>Emperor Coffee Franchise</div>
  </div>
</body>
</html>`;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const printThermalPaper2 = () => {
    if (!data) return;
    printStandardPaper2();
  };

  const printStandardPaper2 = () => {
    if (!data) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = new Date(data.shift.startTime).toLocaleDateString();
    const timeStr = `${new Date(data.shift.startTime).toLocaleTimeString()} - ${new Date(data.shift.endTime).toLocaleTimeString()}`;

    let itemsHtml = '';
    data.categoryBreakdown.forEach(category => {
      itemsHtml += `
        <div style="margin-bottom: 10px;">
          <div style="font-weight: bold; margin-bottom: 3px;">${category.categoryName}</div>
      `;

      category.items.forEach(item => {
        itemsHtml += `
          <div style="display: flex; justify-content: space-between; margin: 2px 0;">
            <span style="flex: 0 0 30px; text-align: left; font-weight: bold;">${item.quantity}x</span>
            <span style="flex: 1; text-align: left;">${item.itemName}</span>
            <span style="flex: 0 0 80px; text-align: right;">${item.totalPrice.toFixed(2)}</span>
          </div>
        `;
      });

      itemsHtml += `
        <div style="border-top: 2px dashed #000; margin: 8px 0;"></div>
        </div>
      `;
    });

    const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Shift Closing - Item Breakdown</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
      padding: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      color: #000 !important;
    }

    @media print {
      @page {
        margin: 0;
        padding: 0;
        size: 80mm auto;
      }

      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      html, body {
        height: auto;
        overflow: visible;
      }
    }

    html, body {
      margin: 0;
      padding: 0;
      height: auto;
      width: 80mm;
    }

    body {
      font-family: 'Courier New', monospace;
      max-width: 80mm;
      margin: 0 auto;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
      background: white;
      color: #000;
    }

    .header {
      text-align: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px dashed #000;
    }

    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
      padding: 0;
      color: #000;
    }

    .header div {
      margin: 2px 0;
      padding: 0;
      color: #000;
    }

    .info {
      margin-bottom: 10px;
      font-size: 12px;
      padding: 0;
    }

    .info div {
      margin: 2px 0;
      padding: 0;
      color: #000;
    }

    .footer {
      text-align: center;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 2px dashed #000;
      font-size: 10px;
      padding-bottom: 0;
      color: #000;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Emperor Coffee</h1>
    <div>${data.branchName}</div>
    <div>Shift Closing #${data.shift.shiftNumber}</div>
  </div>

  <div class="info">
    <div>Date: ${dateStr}</div>
    <div>Time: ${timeStr}</div>
  </div>

  <div style="border-top: 2px dashed #000; margin: 10px 0;"></div>

  ${itemsHtml}

  <div class="footer">
    <div>Emperor Coffee Franchise</div>
  </div>
</body>
</html>`;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Shift Closing Receipt</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading shift data...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && data && (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Paper 1: Payment Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-5 w-5" />
                        Paper 1: Payment Summary
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Shift #{data.shift.shiftNumber} •{' '}
                        {new Date(data.shift.startTime).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Button
                      onClick={printThermalPaper1}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="font-semibold text-sm">Time Period</span>
                      <span className="text-sm">
                        {new Date(data.shift.startTime).toLocaleTimeString()} -{' '}
                        {new Date(data.shift.endTime).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold text-sm">TOTAL Visa</span>
                        </div>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(data.paymentSummary.card + data.paymentSummary.other)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="font-semibold text-sm">TOTAL Cash</span>
                        </div>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(data.paymentSummary.cash)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">User</span>
                        </div>
                        <span className="font-medium">
                          {data.shift.cashier.name || data.shift.cashier.username}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Paper 2: Item Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Package className="h-5 w-5" />
                        Paper 2: Item Breakdown
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Items sold by category during shift #{data.shift.shiftNumber}
                      </CardDescription>
                    </div>
                    <Button
                      onClick={printThermalPaper2}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {data.categoryBreakdown.map((category, idx) => (
                      <div key={idx} className="border rounded-lg overflow-hidden">
                        <div className="flex justify-between items-center p-3 bg-muted/50 border-b">
                          <span className="font-semibold text-sm">{category.categoryName}</span>
                          <span className="font-bold text-sm">
                            {formatCurrency(category.totalSales)}
                          </span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {category.items.map((item, itemIdx) => (
                            <div
                              key={itemIdx}
                              className="flex justify-between items-center p-3 text-sm border-b last:border-b-0 hover:bg-muted/30"
                            >
                              <span className="flex-1 mr-4 truncate">{item.itemName}</span>
                              <div className="flex items-center gap-4 flex-shrink-0">
                                <span className="text-muted-foreground text-xs w-12 text-right">
                                  x{item.quantity}
                                </span>
                                <span className="font-medium w-20 text-right">
                                  {formatCurrency(item.totalPrice)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {data.categoryBreakdown.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No items sold during this shift
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
