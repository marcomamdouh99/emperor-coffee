'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { type DayClosingReportData, type DayClosingShiftData } from '@/lib/escpos-encoder';
import { Printer, X, Loader2, AlertCircle, FileText, DollarSign, Users, Clock } from 'lucide-react';

interface DayClosingReceiptProps {
  businessDayId: string;
  open: boolean;
  onClose: () => void;
}

export function DayClosingReceipt({ businessDayId, open, onClose }: DayClosingReceiptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DayClosingReportData | null>(null);

  // Fetch closing report data when dialog opens
  useEffect(() => {
    if (open && businessDayId) {
      fetchClosingReport();
    }
  }, [open, businessDayId]);

  // Auto-print all papers when data is loaded
  useEffect(() => {
    if (data && open && data.shifts && data.shifts.length > 0) {
      console.log('[Day Closing] Auto-printing day closing receipt...');
      
      // Small delay to ensure the dialog is rendered
      const initialDelay = 1000;
      
      // Create print queue
      const printQueue: Array<() => void> = [];
      
      // Add Paper 1 for each shift
      data.shifts.forEach((shift, index) => {
        printQueue.push(() => {
          console.log(`[Day Closing] Printing Paper 1 for Shift ${shift.shiftNumber}...`);
          printShiftPaper(shift);
        });
      });
      
      // Add Paper 2 (Item Summary) after all shift papers
      printQueue.push(() => {
        console.log('[Day Closing] Printing Paper 2 (Item Summary)...');
        printItemSummary();
      });
      
      // Execute print queue with delays
      printQueue.forEach((printFn, index) => {
        const delay = initialDelay + (index * 3500); // 3.5 second delay between each print
        setTimeout(() => {
          printFn();
        }, delay);
      });
    }
  }, [data, open]);

  const fetchClosingReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/business-days/closing-report?businessDayId=${businessDayId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch closing report: ${response.statusText}`);
      }
      const result = await response.json();
      
      // The API returns { success: true, report: DayClosingReportData, legacyReport: ... }
      if (result.success && result.report) {
        setData(result.report);
      } else {
        throw new Error(result.error || 'Failed to fetch closing report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintShiftPaper1 = (shift: DayClosingShiftData, index: number) => {
    printShiftPaper(shift);
  };

  const handlePrintItemSummary = () => {
    if (!data) return;
    printItemSummary();
  };

  const printShiftPaper = (shift: DayClosingShiftData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cashierName = shift.cashier?.name || shift.cashier?.username || 'Unknown';
    const totalCard = shift.totals?.card || 0;
    const totalCash = shift.totals?.cash || 0;
    const dateStr = new Date(shift.startTime).toLocaleDateString();
    const timeStr = `${new Date(shift.startTime).toLocaleTimeString()} - ${new Date(shift.endTime).toLocaleTimeString()}`;

    const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Shift Closing - Shift ${shift.shiftNumber}</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      max-width: 80mm;
      margin: 0;
      padding: 5mm;
      font-size: 12px;
      line-height: 1.4;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
      border-bottom: 2px dashed #000;
      padding-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
    }
    .info {
      margin-bottom: 15px;
      font-size: 11px;
    }
    .info div {
      margin: 3px 0;
    }
    .totals {
      border-top: 2px dashed #000;
      padding-top: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .total-row.grand-total {
      font-weight: bold;
      font-size: 14px;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 2px dashed #000;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Emperor Coffee</h1>
    <div>${data.branchName}</div>
    <div>Shift Closing #${shift.shiftNumber}</div>
  </div>

  <div class="info">
    <div>Date: ${dateStr}</div>
    <div>Time: ${timeStr}</div>
    <div>Cashier: ${cashierName}</div>
  </div>

  <div class="totals">
    <div class="total-row">
      <span>TOTAL Visa:</span>
      <span>${totalCard.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>TOTAL Cash:</span>
      <span>${totalCash.toFixed(2)}</span>
    </div>
    <div class="total-row grand-total">
      <span>TOTAL:</span>
      <span>${(totalCard + totalCash).toFixed(2)}</span>
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

  const printItemSummary = () => {
    if (!data) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = new Date(data.date).toLocaleDateString();

    let itemsHtml = '';
    data.categoryBreakdown?.forEach(category => {
      itemsHtml += `
        <div style="margin-bottom: 15px;">
          <div style="font-weight: bold; margin-bottom: 5px;">${category.categoryName}</div>
      `;

      category.items?.forEach(item => {
        itemsHtml += `
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span style="flex: 0 0 30px; text-align: left; font-weight: bold;">${item.quantity}x</span>
            <span style="flex: 1; text-align: left;">${item.itemName}</span>
            <span style="flex: 0 0 80px; text-align: right;">${item.totalPrice.toFixed(2)}</span>
          </div>
        `;
      });

      itemsHtml += `
        <div style="border-top: 2px dashed #000; margin: 10px 0;"></div>
        </div>
      `;
    });

    const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Day Closing - Item Summary</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      max-width: 80mm;
      margin: 0;
      padding: 5mm;
      font-size: 12px;
      line-height: 1.4;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
      border-bottom: 2px dashed #000;
      padding-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
    }
    .info {
      margin-bottom: 15px;
      font-size: 11px;
    }
    .info div {
      margin: 3px 0;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 2px dashed #000;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Emperor Coffee</h1>
    <div>${data.branchName}</div>
    <div>Day Closing - Item Summary</div>
  </div>

  <div class="info">
    <div>Date: ${dateStr}</div>
  </div>

  <div style="border-top: 2px dashed #000; margin: 15px 0;"></div>

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

  const sendToThermalPrinter = (encoderData: Uint8Array) => {
    // This function is no longer used - replaced with browser print
  };

  const handleStandardPrint = () => {
    if (!data) return;
    window.print();
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading closing report...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Failed to load closing report
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fetchClosingReport}>
              Retry
            </Button>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Day Closing Receipt
          </DialogTitle>
          <DialogDescription>
            {data.storeName} - {data.branchName} | {new Date(data.date).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="shifts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="shifts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Shifts ({data.shifts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Item Summary
            </TabsTrigger>
          </TabsList>

          {/* Shift Summaries Tab */}
          <TabsContent value="shifts" className="space-y-4">
            {data.shifts?.map((shift, index) => (
              <ShiftSummaryCard
                key={shift.shiftNumber}
                shift={shift}
                index={index}
                totalShifts={data.shifts?.length || 1}
                onPrint={() => handlePrintShiftPaper1(shift, index)}
              />
            ))}
          </TabsContent>

          {/* Item Summary Tab */}
          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Item Breakdown
                </CardTitle>
                <CardDescription>
                  All items sold on {new Date(data.date).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {data.categoryBreakdown?.map((category) => (
                    <div key={category.categoryName}>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-semibold">{category.categoryName}</h4>
                        <Badge variant="secondary">{formatCurrency(category.totalSales)}</Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2">Item</th>
                              <th className="text-right py-2 px-2">Qty</th>
                              <th className="text-right py-2 px-2">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.items?.map((item, idx) => (
                              <tr key={idx} className="border-b border-border/50">
                                <td className="py-2 px-2">{item.itemName}</td>
                                <td className="text-right py-2 px-2">{item.quantity}</td>
                                <td className="text-right py-2 px-2">{formatCurrency(item.totalPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleStandardPrint}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Standard Print
          </Button>
          <Button
            onClick={handlePrintItemSummary}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print Item Summary (Paper 2)
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ShiftSummaryCardProps {
  shift: DayClosingShiftData;
  index: number;
  totalShifts: number;
  onPrint: () => void;
}

function ShiftSummaryCard({ shift, index, totalShifts, onPrint }: ShiftSummaryCardProps) {
  const cashierName = shift.cashier?.name || shift.cashier?.username || 'Unknown';

  // Calculate totals
  const totalSales = shift.totals?.sales || 0;
  const totalDiscounts = shift.totals?.discounts || 0;
  const totalDeliveryFees = shift.totals?.deliveryFees || 0;
  const totalRefunds = shift.totals?.refunds || 0;
  const totalCard = shift.totals?.card || 0;
  const totalCash = shift.totals?.cash || 0;
  const openingBalance = shift.totals?.openingCashBalance || 0;
  const expectedCash = shift.totals?.expectedCash || 0;
  const closingBalance = shift.totals?.closingCashBalance || 0;
  const overShort = shift.totals?.overShort || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Shift {shift.shiftNumber} of {totalShifts}
            </CardTitle>
            <CardDescription>
              {cashierName} | {new Date(shift.startTime).toLocaleTimeString()} - {new Date(shift.endTime).toLocaleTimeString()}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onPrint}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print Paper 1
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Order Type Breakdown */}
          <div className="space-y-2">
            <h4 className="font-semibold">Order Type Breakdown</h4>
            <div className="grid gap-2 md:grid-cols-3">
              <OrderTypeCard
                label="Take Away"
                value={shift.orderTypeBreakdown['take-away']?.value || 0}
                discounts={shift.orderTypeBreakdown['take-away']?.discounts || 0}
                total={shift.orderTypeBreakdown['take-away']?.total || 0}
              />
              <OrderTypeCard
                label="Dine In"
                value={shift.orderTypeBreakdown['dine-in']?.value || 0}
                discounts={shift.orderTypeBreakdown['dine-in']?.discounts || 0}
                total={shift.orderTypeBreakdown['dine-in']?.total || 0}
              />
              <OrderTypeCard
                label="Delivery"
                value={shift.orderTypeBreakdown['delivery']?.value || 0}
                discounts={shift.orderTypeBreakdown['delivery']?.discounts || 0}
                total={shift.orderTypeBreakdown['delivery']?.total || 0}
              />
            </div>
          </div>

          {/* Financial Summary */}
          <div className="space-y-2">
            <h4 className="font-semibold">Financial Summary</h4>
            <div className="grid gap-2 md:grid-cols-2">
              <SummaryRow label="Total Sales" value={totalSales} highlight />
              <SummaryRow label="Total Discounts" value={totalDiscounts} />
              <SummaryRow label="Total Delivery Fees" value={totalDeliveryFees} />
              <SummaryRow label="Total Refunds" value={totalRefunds} />
              <SummaryRow label="Total Card" value={totalCard} />
              <SummaryRow label="Total Cash" value={totalCash} highlight />
              <SummaryRow label="Opening Cash Balance" value={openingBalance} />
              <SummaryRow label="Expected Cash" value={expectedCash} highlight />
              <SummaryRow label="Closing Cash Balance" value={closingBalance} />
              <SummaryRow
                label="Over/Short"
                value={overShort}
                variant={overShort < 0 ? 'negative' : overShort > 0 ? 'positive' : 'neutral'}
                highlight
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface OrderTypeCardProps {
  label: string;
  value: number;
  discounts: number;
  total: number;
}

function OrderTypeCard({ label, value, discounts, total }: OrderTypeCardProps) {
  return (
    <div className="rounded-lg border p-3">
      <h5 className="font-medium text-sm mb-2">{label}</h5>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Value:</span>
          <span>{formatCurrency(value)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Discounts:</span>
          <span className="text-destructive">-{formatCurrency(discounts)}</span>
        </div>
        <div className="flex justify-between font-semibold pt-1 border-t">
          <span>Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  value: number;
  variant?: 'positive' | 'negative' | 'neutral';
  highlight?: boolean;
}

function SummaryRow({ label, value, variant = 'neutral', highlight }: SummaryRowProps) {
  const valueColor = variant === 'positive' ? 'text-green-600' : variant === 'negative' ? 'text-red-600' : '';

  return (
    <div className={`flex justify-between py-1 ${highlight ? 'font-semibold bg-muted/50 px-2 rounded' : ''}`}>
      <span>{label}:</span>
      <span className={valueColor}>{formatCurrency(value)}</span>
    </div>
  );
}
