'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Printer, Eye, Store, Clock, DollarSign, ShoppingCart, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { DayClosingReceipt } from './day-closing-receipt';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface BusinessDay {
  id: string;
  branchId: string;
  openedAt: string;
  closedAt?: string;
  isOpen: boolean;
  totalOrders: number;
  totalSales: number;
  subtotal: number;
  taxAmount: number;
  deliveryFees: number;
  loyaltyDiscounts: number;
  cashSales: number;
  cardSales: number;
  dineInOrders: number;
  dineInSales: number;
  takeAwayOrders: number;
  takeAwaySales: number;
  deliveryOrders: number;
  deliverySales: number;
  notes?: string;
  openedByUser?: {
    id: string;
    name: string;
    username: string;
  };
  closedByUser?: {
    id: string;
    name: string;
    username: string;
  };
  branch?: {
    id: string;
    branchName: string;
  };
  shifts: {
    id: string;
    cashier: {
      id: string;
      name: string;
      username: string;
    };
    isClosed: boolean;
  }[];
}

export default function DailyReportsTab() {
  const { user } = useAuth();
  const { currency } = useI18n();
  const [businessDays, setBusinessDays] = useState<BusinessDay[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDay, setSelectedDay] = useState<BusinessDay | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const itemsPerPage = 20;

  // Fetch branches for Admin users
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchBranches();
    }
  }, [user]);

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches');
      const data = await response.json();
      if (data.branches) {
        const branchesList = data.branches.map((branch: any) => ({
          id: branch.id,
          name: branch.branchName
        }));
        setBranches(branchesList);
        if (branchesList.length > 0) {
          setSelectedBranch(branchesList[0].id);
        }
      }
    } catch (error) {
      console.error('[Daily Reports] Failed to fetch branches:', error);
    }
  };

  // Fetch business days
  useEffect(() => {
    const branchToUse = user?.role === 'ADMIN' ? selectedBranch : user?.branchId;
    if (branchToUse) {
      fetchBusinessDays(1, branchToUse);
    }
  }, [user?.branchId, selectedBranch]);

  const fetchBusinessDays = async (page: number, branchId?: string) => {
    const actualBranchId = branchId || (user?.role === 'ADMIN' ? selectedBranch : user?.branchId);
    if (!actualBranchId) return;

    setLoading(true);
    try {
      const offset = (page - 1) * itemsPerPage;
      const params = new URLSearchParams({
        branchId: actualBranchId,
        limit: itemsPerPage.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/business-days/list?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setBusinessDays(data.businessDays);
        setTotalPages(data.pagination.pages);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('[Daily Reports] Failed to fetch business days:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (day: BusinessDay) => {
    setSelectedDay(day);
    setReportDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Daily Reports
          </CardTitle>
          <CardDescription>
            View and manage historical daily closing reports
          </CardDescription>
          {/* Branch Selector for Admin Users */}
          {user?.role === 'ADMIN' && branches.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <Label htmlFor="branch-select">Select Branch:</Label>
                <Select value={selectedBranch} onValueChange={(value) => {
                  setSelectedBranch(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger id="branch-select" className="w-[250px]">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Business Days List */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <span className="ml-3 text-slate-600">Loading daily reports...</span>
            </div>
          ) : businessDays.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No daily reports available</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <div className="min-w-[800px] md:min-w-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time Range</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Opened By</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead>Shifts</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {businessDays.map((day) => (
                        <TableRow key={day.id}>
                          <TableCell className="font-medium">
                            {formatDate(day.openedAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{formatTime(day.openedAt)}</div>
                            {day.closedAt && (
                              <div className="text-slate-500">{formatTime(day.closedAt)}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {day.branch?.branchName || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            {day.openedByUser?.name || day.openedByUser?.username || 'Unknown'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {day.totalOrders}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {formatCurrency(day.totalSales, currency)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              <span className="text-sm">
                                {day.shifts.length} shift{day.shifts !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewReport(day)}
                              className="h-9 min-h-[36px]"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Report
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, businessDays.length)} of {businessDays.length} reports
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchBusinessDays(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
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
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => fetchBusinessDays(pageNum)}
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
                      onClick={() => fetchBusinessDays(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
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

      {/* Closing Day Receipt Dialog */}
      {selectedDay && (
        <DayClosingReceipt
          businessDayId={selectedDay.id}
          open={reportDialogOpen}
          onClose={() => {
            setReportDialogOpen(false);
            setSelectedDay(null);
          }}
        />
      )}
    </div>
  );
}
