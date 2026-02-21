'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer, Calendar, Clock, DollarSign, User, Store, Wallet, CreditCard, X, FileText, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useEffect, useState, useCallback } from 'react';

interface ClosingDayReportProps {
  open: boolean;
  onClose: () => void;
  report: any;
  currency: string;
  autoPrint?: boolean;
}

export default function ClosingDayReport({ open, onClose, report, currency, autoPrint = false }: ClosingDayReportProps) {
  const [printerConnected, setPrinterConnected] = useState(false);

  const handlePrint = useCallback(async () => {
    try {
      const response = await fetch(`/api/business-days/closing-report-escpos?businessDayId=${report.businessDay.id}`);
      const data = await response.json();

      if (data.success && data.escposData) {
        const { getPrinter } = await import('@/lib/webusb-printer');
        const printer = getPrinter();

        if (printer.isConnected()) {
          await printer.printBase64(data.escposData);
          return;
        } else {
          try {
            await printer.requestDevice();
            await printer.connect();
            setPrinterConnected(true);
            await printer.printBase64(data.escposData);
            return;
          } catch (printerError) {
            console.log('[Closing Report] Could not connect to thermal printer');
          }
        }
      }
      window.print();
    } catch (error) {
      console.error('[Closing Report] Print error:', error);
      window.print();
    }
  }, [report]);

  useEffect(() => {
    if (open && autoPrint && report?.businessDay) {
      setTimeout(handlePrint, 500);
    }
  }, [open, autoPrint, report, handlePrint]);

  if (!report || !report.businessDay) {
    return null;
  }

  const { businessDay, summary, categoryBreakdown, shifts, refunds } = report;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="z-[100] w-[95vw] max-w-7xl h-[90vh] max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogTitle className="sr-only">Daily Closing Report</DialogTitle>
        {/* Fixed Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-sm">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Daily Closing Report</h2>
              <div className="flex items-center gap-2 mt-1">
                <Store className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {businessDay.branch?.branchName || 'Branch'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="default"
              className="h-10 px-4 gap-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <Printer className="h-4 w-4" />
              <span className="font-medium">Print</span>
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-10 w-10 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content with explicit height */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6 max-w-6xl mx-auto">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/60 border-emerald-200/70 dark:border-emerald-800/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-emerald-500/15 rounded-lg">
                        <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Total Sales</span>
                    </div>
                    <div className="text-3xl font-bold text-emerald-800 dark:text-emerald-200 tracking-tight">
                      {formatCurrency(summary.totalSales, currency)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-sm font-medium text-emerald-600/80 dark:text-emerald-400/80">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      <span>{summary.totalOrders} orders</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 via-amber-50/50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/60 border-amber-200/70 dark:border-amber-800/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-amber-500/15 rounded-lg">
                        <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Cash</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-800 dark:text-amber-200 tracking-tight">
                      {formatCurrency(summary.cashSales, currency)}
                    </div>
                    <div className="text-xs font-medium text-amber-600/60 dark:text-amber-400/60 mt-3">
                      Payment Method
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-violet-50 via-violet-50/50 to-violet-100 dark:from-violet-950/40 dark:to-violet-900/60 border-violet-200/70 dark:border-violet-800/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-violet-500/15 rounded-lg">
                        <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <span className="text-sm font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Card / Visa</span>
                    </div>
                    <div className="text-2xl font-bold text-violet-800 dark:text-violet-200 tracking-tight">
                      {formatCurrency(summary.cardSales, currency)}
                    </div>
                    <div className="text-xs font-medium text-violet-600/60 dark:text-violet-400/60 mt-3">
                      Payment Method
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-rose-50 via-rose-50/50 to-rose-100 dark:from-rose-950/40 dark:to-rose-900/60 border-rose-200/70 dark:border-rose-800/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-rose-500/15 rounded-lg">
                        <User className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      </div>
                      <span className="text-sm font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wide">Shifts</span>
                    </div>
                    <div className="text-2xl font-bold text-rose-800 dark:text-rose-200 tracking-tight">
                      {summary.totalShifts}
                    </div>
                    <div className="text-xs font-medium text-rose-600/60 dark:text-rose-400/60 mt-3">
                      Active Periods
                    </div>
                  </CardContent>
                </Card>
              </div>


              {/* Date & Time Info */}
              <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                    <div className="p-1.5 bg-sky-100 dark:bg-sky-900/50 rounded-lg">
                      <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    Date & Time Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</div>
                      <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{formatDate(businessDay.openedAt)}</div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Opening Time</div>
                      <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{formatTime(businessDay.openedAt)}</div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Closing Time</div>
                      <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {businessDay.closedAt ? formatTime(businessDay.closedAt) : 'Still Open'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* Category Breakdown */}
              <div>
                <h3 className="text-xl font-bold mb-5 flex items-center gap-2 text-slate-900 dark:text-slate-50">
                  <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                    <Store className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Sales by Category
                </h3>
                {categoryBreakdown && categoryBreakdown.length > 0 ? (
                  <div className="space-y-5">
                    {categoryBreakdown.map((category: any, categoryIndex: number) => (
                      <Card key={categoryIndex} className="shadow-sm border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/30 pb-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                              {category.categoryName}
                            </CardTitle>
                            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-lg border border-primary/20">
                              <DollarSign className="h-4 w-4 text-primary" />
                              <span className="text-xl font-bold text-primary">
                                {formatCurrency(category.totalSales, currency)}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-b-2 border-slate-200 dark:border-slate-700">
                                  <TableHead className="w-1/2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Item Name</TableHead>
                                  <TableHead className="text-right w-1/4 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Quantity</TableHead>
                                  <TableHead className="text-right w-1/4 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {category.items.map((item: any, itemIndex: number) => (
                                  <TableRow
                                    key={`${categoryIndex}-${itemIndex}-${item.itemId}-${item.variantId}`}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                                  >
                                    <TableCell className="font-semibold text-slate-900 dark:text-slate-100">{item.itemName}</TableCell>
                                    <TableCell className="text-right font-medium text-slate-700 dark:text-slate-300">{item.quantity}</TableCell>
                                    <TableCell className="text-right font-bold text-primary">
                                      {formatCurrency(item.totalPrice, currency)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                                  <TableCell className="font-bold text-slate-900 dark:text-slate-100">Category Total</TableCell>
                                  <TableCell></TableCell>
                                  <TableCell className="text-right font-bold text-lg text-primary">
                                    {formatCurrency(category.totalSales, currency)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="shadow-sm border-dashed border-2 border-slate-300 dark:border-slate-700">
                    <CardContent className="py-16 text-center">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <Store className="h-10 w-10 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-600 dark:text-slate-400">No sales recorded</p>
                      <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Start taking orders to see category breakdown</p>
                    </CardContent>
                  </Card>
                )}
              </div>


              {/* Shifts Summary */}
              {shifts && shifts.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-5 flex items-center gap-2 text-slate-900 dark:text-slate-50">
                    <div className="p-1.5 bg-teal-100 dark:bg-teal-900/50 rounded-lg">
                      <User className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    Shifts Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shifts.map((shift: any, index: number) => (
                      <Card key={index} className="shadow-sm border-slate-200/80 dark:border-slate-700/80 hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-gradient-to-br from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700 rounded-full shadow-sm">
                                <User className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">
                                  {shift.cashier?.name || shift.cashier?.username || 'Unknown'}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{formatTime(shift.startTime)} - {shift.endTime ? formatTime(shift.endTime) : 'Active'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-teal-600 dark:text-teal-400">
                                {formatCurrency(shift.closingRevenue || 0, currency)}
                              </div>
                              <div className="flex items-center justify-end gap-1 mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                <ShoppingCart className="h-3 w-3" />
                                <span>{shift.ordersCount} orders</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}


              {/* Notes */}
              {businessDay.notes && (
                <Card className="shadow-sm border-slate-200/80 dark:border-slate-700/80">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                      Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{businessDay.notes}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Footer */}
              <div className="text-center pt-6 pb-4 border-t border-slate-200 dark:border-slate-700">
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 rounded-full border border-slate-200 dark:border-slate-700">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <div className="text-sm">
                    <p className="text-slate-600 dark:text-slate-400">Report generated on {new Date().toLocaleString()}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 font-medium">Emperor Coffee POS System</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
