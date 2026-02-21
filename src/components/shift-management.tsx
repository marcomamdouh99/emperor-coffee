'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clock, DollarSign, ShoppingCart, Play, Square, AlertCircle, Calendar, User, TrendingUp, Store, CreditCard, Wallet, CircleDollarSign, Activity } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/utils';
import { useOfflineData, offlineDataFetchers } from '@/hooks/use-offline-data';
import { DayClosingReceipt } from './day-closing-receipt';
import { ShiftClosingReceipt } from './shift-closing-receipt';

interface Shift {
  id: string;
  branchId: string;
  cashierId: string;
  cashier?: {
    id: string;
    username: string;
    name?: string;
  };
  startTime: string;
  endTime?: string;
  openingCash: number;
  closingCash?: number;
  openingOrders: number;
  closingOrders?: number;
  openingRevenue: number;
  closingRevenue?: number;
  isClosed: boolean;
  notes?: string;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
  // For open shifts - calculated at runtime
  currentRevenue?: number;
  currentOrders?: number;
  paymentBreakdown?: {
    cash?: number;
    card?: number;
    other?: number;
  };
}

interface Cashier {
  id: string;
  username: string;
  name?: string;
}

interface PaymentBreakdown {
  cash: number;
  card: number;
  other: number;
  total: number;
}

// Helper function to create shift offline
async function createShiftOffline(shiftData: any, user: any): Promise<void> {
  try {
    console.log('[Shift] Creating shift offline, shiftData:', shiftData);

    // Import localStorageService
    const { getLocalStorageService } = await import('@/lib/storage/local-storage');
    const localStorageService = getLocalStorageService();
    console.log('[Shift] localStorageService imported');

    // Initialize storage if not already initialized
    await localStorageService.init();
    console.log('[Shift] localStorageService initialized');

    // Create a temporary shift ID (will be replaced on sync)
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[Shift] Created tempId:', tempId);

    // Create shift object
    const newShift = {
      id: tempId,
      branchId: shiftData.branchId,
      cashierId: shiftData.cashierId,
      dayId: shiftData.dayId,
      startTime: new Date().toISOString(),
      openingCash: shiftData.openingCash,
      openingOrders: 0,
      openingRevenue: 0,
      isClosed: false,
      notes: shiftData.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Include cashier info for display
      cashier: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
      orderCount: 0,
      currentRevenue: 0,
      currentOrders: 0,
    };

    console.log('[Shift] Created shift object:', newShift);

    // Save shift to IndexedDB
    await localStorageService.saveShift(newShift);
    console.log('[Shift] Shift saved to IndexedDB');

    // Queue operation for sync
    await localStorageService.addOperation({
      type: 'CREATE_SHIFT',
      data: {
        ...shiftData,
        id: tempId,
        startTime: newShift.startTime,
        endTime: newShift.endTime || null,
        isClosed: newShift.isClosed,
        createdAt: newShift.createdAt,
        updatedAt: newShift.updatedAt,
      },
      branchId: shiftData.branchId,
      retryCount: 0,
    });
    console.log('[Shift] Operation queued for sync');

    console.log('[Shift] Shift created offline successfully:', newShift);
  } catch (error) {
    console.error('[Shift] Failed to create shift offline, error:', error);
    throw error;
  }
}

// Helper function to close shift offline
async function closeShiftOffline(
  shift: any,
  closingCash: number,
  notes: string,
  paymentBreakdown: PaymentBreakdown
): Promise<void> {
  try {
    console.log('[Shift] Closing shift offline, shift:', shift);

    // Import localStorageService
    const { getLocalStorageService } = await import('@/lib/storage/local-storage');
    const localStorageService = getLocalStorageService();
    console.log('[Shift] localStorageService imported');

    // Initialize storage if not already initialized
    await localStorageService.init();
    console.log('[Shift] localStorageService initialized');

    // Get all orders for this shift to calculate actual revenue
    // Revenue should exclude delivery fees (courier takes them)
    const allOrders = await localStorageService.getAllOrders();
    const shiftOrders = allOrders.filter((order: any) => order.shiftId === shift.id);

    console.log('[Shift] Found orders for shift:', shiftOrders.length);

    // Debug: Log each order to see what fields we have
    shiftOrders.forEach((order: any, idx: number) => {
      console.log(`[Shift] Order ${idx + 1}:`, {
        id: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        totalAmount: order.totalAmount,
        deliveryFee: order.deliveryFee,
      });
    });

    // Calculate revenue excluding delivery fees
    const subtotal = shiftOrders.reduce((sum: number, order: any) => sum + (order.subtotal || 0), 0);
    const deliveryFees = shiftOrders.reduce((sum: number, order: any) => sum + (order.deliveryFee || 0), 0);
    const cashierRevenue = subtotal; // Subtotal excludes delivery fees

    console.log('[Shift] Calculated closing revenue:', {
      orderCount: shiftOrders.length,
      subtotal,
      deliveryFees,
      cashierRevenue,
      openingCash: shift.openingCash || 0,
    });

    // Update shift object with calculated closing data
    const updatedShift = {
      ...shift,
      endTime: new Date().toISOString(),
      closingCash: closingCash,
      closingOrders: shiftOrders.length,
      closingRevenue: cashierRevenue, // Use calculated revenue (subtotal only, no delivery fees)
      closingLoyaltyDiscounts: 0, // Would need to track this separately
      isClosed: true,
      notes: notes || shift.notes,
      paymentBreakdown: paymentBreakdown || shift.paymentBreakdown,
      updatedAt: new Date().toISOString(),
    };

    console.log('[Shift] Updated shift object:', updatedShift);

    // Save updated shift to IndexedDB
    await localStorageService.saveShift(updatedShift);
    console.log('[Shift] Shift updated in IndexedDB');

    // Queue operation for sync
    await localStorageService.addOperation({
      type: 'CLOSE_SHIFT',
      data: {
        id: shift.id,
        branchId: shift.branchId,
        cashierId: shift.cashierId,
        startTime: shift.startTime, // Include startTime to find the shift during sync
        closingCash: closingCash,
        notes: notes || shift.notes,
        paymentBreakdown: paymentBreakdown || shift.paymentBreakdown,
        endTime: updatedShift.endTime,
      },
      branchId: shift.branchId,
      retryCount: 0,
    });
    console.log('[Shift] Close operation queued for sync');

    console.log('[Shift] Shift closed offline successfully:', updatedShift);
  } catch (error) {
    console.error('[Shift] Failed to close shift offline, error:', error);
    throw error;
  }
}

export default function ShiftManagement() {
  const { user } = useAuth();
  const { t, currency } = useI18n();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>({
    cash: 0,
    card: 0,
    other: 0,
    total: 0,
  });
  // Business Day states
  const [businessDayStatus, setBusinessDayStatus] = useState<{
    isOpen: boolean;
    businessDayId?: string;
  }>({ isOpen: false });
  const [openDayDialogOpen, setOpenDayDialogOpen] = useState(false);
  const [closeDayDialogOpen, setCloseDayDialogOpen] = useState(false);
  const [dayOpeningNotes, setDayOpeningNotes] = useState('');
  const [dayClosingNotes, setDayClosingNotes] = useState('');
  const [closingReport, setClosingReport] = useState<any>(null);
  const [closingReportOpen, setClosingReportOpen] = useState(false);
  // Shift Closing Receipt state
  const [shiftClosingReceiptOpen, setShiftClosingReceiptOpen] = useState(false);
  const [shiftForReceipt, setShiftForReceipt] = useState<Shift | null>(null);


  // Offline-capable data fetching for branches
  const { data: branchesData } = useOfflineData(
    '/api/branches',
    {
      fetchFromDB: offlineDataFetchers.branches,
    }
  );

  // Offline-capable data fetching for shifts
  const { data: shiftsData, refetch: refetchShifts } = useOfflineData(
    '/api/shifts',
    {
      branchId: selectedBranch,
      fetchFromDB: offlineDataFetchers.shifts,
      enabled: !!selectedBranch,
      deps: [selectedBranch, selectedStatus, selectedCashier],
    }
  );

  // Log when selectedBranch changes
  useEffect(() => {
    console.log('[Shift Management] selectedBranch changed to:', selectedBranch);
    if (selectedBranch) {
      console.log('[Shift Management] Shift fetching is now enabled');
    }
  }, [selectedBranch]);

  // Update branches from offline data
  useEffect(() => {
    console.log('[Shift Management] branchesData changed:', branchesData);
    if (branchesData) {
      const branchesList = Array.isArray(branchesData)
        ? branchesData.map((branch: any) => ({
            id: branch.id,
            name: branch.branchName,
          }))
        : (branchesData.branches || []).map((branch: any) => ({
            id: branch.id,
            name: branch.branchName,
          }));
      console.log('[Shift Management] branchesList:', branchesList);
      setBranches(branchesList);
    }
  }, [branchesData]);

  // Update shifts from offline data
  useEffect(() => {
    console.log('[Shift Management] shiftsData changed:', shiftsData);
    console.log('[Shift Management] selectedBranch:', selectedBranch);

    if (shiftsData && selectedBranch) {
      const apiShifts = Array.isArray(shiftsData) ? shiftsData : (shiftsData.shifts || []);
      console.log('[Shift Management] API shifts:', apiShifts);

      // Also fetch offline shifts from IndexedDB to merge with API shifts
      const mergeShifts = async () => {
        try {
          const { getLocalStorageService } = await import('@/lib/storage/local-storage');
          const localStorageService = getLocalStorageService();
          await localStorageService.init();
          const offlineShifts = await localStorageService.getShifts();
          console.log('[Shift Management] Offline shifts:', offlineShifts);

          // Helper function to check if two shifts are duplicates (same cashier, same startTime within 1 minute)
          const isDuplicateShift = (shift1: any, shift2: any): boolean => {
            if (shift1.id === shift2.id) return true; // Same ID is definitely a duplicate
            if (shift1.cashierId !== shift2.cashierId) return false;
            if (shift1.branchId !== shift2.branchId) return false;

            // Compare start times (within 1 minute = 60000ms)
            const time1 = new Date(shift1.startTime).getTime();
            const time2 = new Date(shift2.startTime).getTime();
            const timeDiff = Math.abs(time1 - time2);

            return timeDiff <= 60000; // 1 minute window
          };

          // Combine API shifts and offline shifts, avoiding duplicates
          const apiShiftIds = new Set(apiShifts.map((s: any) => s.id));
          const uniqueOfflineShifts = offlineShifts.filter((offlineShift: any) => {
            // First, check if ID matches (exact duplicate)
            if (apiShiftIds.has(offlineShift.id)) return false;

            // Then, check if it's a semantic duplicate (same cashier, similar startTime)
            const hasDuplicateInAPI = apiShifts.some((apiShift: any) =>
              isDuplicateShift(offlineShift, apiShift)
            );

            // If it's a duplicate of an API shift, don't include it
            // (API shift takes precedence as it's the synced version)
            if (hasDuplicateInAPI) {
              console.log('[Shift Management] Found duplicate shift, skipping offline shift:', {
                offlineId: offlineShift.id,
                duplicateWith: apiShifts.find((apiShift: any) => isDuplicateShift(offlineShift, apiShift))?.id
              });
              return false;
            }

            return true;
          });

          const allShifts = [...apiShifts, ...uniqueOfflineShifts];
          console.log('[Shift Management] Combined shifts:', allShifts);

          // Filter shifts by branch and status
          const filtered = allShifts.filter((shift: any) => {
            console.log('[Shift Management] Checking shift:', { id: shift.id, branchId: shift.branchId, selectedBranch });

            if (shift.branchId !== selectedBranch) return false;
            if (selectedStatus && selectedStatus !== 'all') {
              const isOpen = !shift.isClosed;
              if (selectedStatus === 'open' && !isOpen) return false;
              if (selectedStatus === 'closed' && isOpen) return false;
            }
            if (selectedCashier && selectedCashier !== 'all' && shift.cashierId !== selectedCashier) {
              return false;
            }
            return true;
          });

          console.log('[Shift Management] Filtered shifts:', filtered);
          setShifts(filtered);
          setLoading(false);
        } catch (error) {
          console.error('[Shift Management] Failed to merge offline shifts:', error);
          // Fallback to just API shifts if offline merge fails
          const filtered = apiShifts.filter((shift: any) => {
            if (shift.branchId !== selectedBranch) return false;
            if (selectedStatus && selectedStatus !== 'all') {
              const isOpen = !shift.isClosed;
              if (selectedStatus === 'open' && !isOpen) return false;
              if (selectedStatus === 'closed' && isOpen) return false;
            }
            if (selectedCashier && selectedCashier !== 'all' && shift.cashierId !== selectedCashier) {
              return false;
            }
            return true;
          });
          setShifts(filtered);
          setLoading(false);
        }
      };

      mergeShifts();
    }
  }, [shiftsData, selectedBranch, selectedStatus, selectedCashier]);

  // Fetch branches (fallback if offline data not available)
  useEffect(() => {
    if (branchesData) return;

    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches');
        const data = await response.json();

        if (response.ok && data.branches) {
          const branchesList = data.branches.map((branch: any) => ({
            id: branch.id,
            name: branch.branchName,
          }));
          setBranches(branchesList);
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      }
    };

    fetchBranches();
  }, [branchesData]);

  // Fetch cashiers (users with CASHIER role)
  useEffect(() => {
    const fetchCashiers = async () => {
      if (!selectedBranch) return;

      try {
        const response = await fetch(`/api/users?currentUserBranchId=${selectedBranch}&currentUserRole=BRANCH_MANAGER`);
        const data = await response.json();

        if (response.ok && data.users) {
          // Filter for CASHIER role users on client side
          const cashiers = data.users.filter((user: any) => user.role === 'CASHIER');
          setCashiers(cashiers);
        }
      } catch (error) {
        console.error('Failed to fetch cashiers:', error);
      }
    };
    fetchCashiers();
  }, [selectedBranch]);

  // Load user on mount and set default branch
  useEffect(() => {
    console.log('[Shift Management] User or branches changed:', {
      user: user ? { id: user.id, username: user.username, role: user.role, branchId: user.branchId } : 'no user',
      branches,
      branchesLength: branches.length
    });

    if (user) {
      if (user.role === 'ADMIN' && branches.length > 0) {
        // For admins, check if there are cached shifts in IndexedDB
        // to find which branch has shifts, otherwise default to first branch
        import('@/lib/storage/local-storage').then(({ getLocalStorageService }) => {
          const localStorageService = getLocalStorageService();
          return localStorageService.init().then(() => localStorageService.getShifts());
        }).then((cachedShifts) => {
          console.log('[Shift Management] Cached shifts for admin branch selection:', cachedShifts.length);

          if (cachedShifts.length > 0) {
            // Find branches that have shifts
            const branchesWithShifts = cachedShifts.reduce((acc: Set<string>, shift: any) => {
              if (shift.branchId && branches.some((b: any) => b.id === shift.branchId)) {
                acc.add(shift.branchId);
              }
              return acc;
            }, new Set());

            console.log('[Shift Management] Branches with shifts:', Array.from(branchesWithShifts));

            // Find the first branch (from the branches list) that has shifts
            const branchWithShifts = branches.find((b: any) => branchesWithShifts.has(b.id));

            if (branchWithShifts) {
              console.log('[Shift Management] Selecting branch with shifts for admin:', branchWithShifts);
              setSelectedBranch(branchWithShifts.id);
            } else {
              console.log('[Shift Management] No cached shifts, selecting first branch for admin:', branches[0]);
              setSelectedBranch(branches[0].id);
            }
          } else {
            console.log('[Shift Management] No cached shifts, selecting first branch for admin:', branches[0]);
            setSelectedBranch(branches[0].id);
          }
        }).catch((err) => {
          console.error('[Shift Management] Failed to check cached shifts:', err);
          // Fallback to first branch
          console.log('[Shift Management] Error fallback, selecting first branch for admin:', branches[0]);
          setSelectedBranch(branches[0].id);
        });
      } else if (user.branchId) {
        console.log('[Shift Management] Setting user branch:', user.branchId);
        setSelectedBranch(user.branchId);
      }
    }
  }, [user, branches]);

  // Clear selectedShift if shifts array becomes empty
  useEffect(() => {
    if (shifts.length === 0 && selectedShift) {
      setSelectedShift(null);
      setClosingCash('');
      setShiftNotes('');
      setCloseDialogOpen(false);
    }
  }, [shifts, selectedShift]);

  // Fetch current shift for cashiers
  useEffect(() => {
    if (user && user.role === 'CASHIER') {
      const fetchCurrentShift = async () => {
        try {
          const params = new URLSearchParams({
            cashierId: user.id,
            branchId: user.branchId,
            status: 'open',
          });

          const response = await fetch(`/api/shifts?${params.toString()}`);
          const data = await response.json();

          if (response.ok && data.shifts && data.shifts.length > 0) {
            setSelectedShift(data.shifts[0]);
          } else {
            setSelectedShift(null);
          }
        } catch (error) {
          console.error('Failed to fetch current shift:', error);
        }
      };

      fetchCurrentShift();
    }
  }, [user]);

  // Fetch current shift for cashiers (helper)
  const fetchCurrentShift = async () => {
    if (user?.role !== 'CASHIER' || !user?.branchId) return;

    try {
      const params = new URLSearchParams({
        cashierId: user.id,
        branchId: user.branchId,
        status: 'open',
      });
      const response = await fetch(`/api/shifts?${params.toString()}`);
      const data = await response.json();

      if (response.ok && data.shifts && data.shifts.length > 0) {
        setSelectedShift(data.shifts[0]);
      } else {
        // API failed or no shift found - check IndexedDB for offline shift
        const { getLocalStorageService } = await import('@/lib/storage/local-storage');
        const localStorageService = getLocalStorageService();
        await localStorageService.init();
        const allShifts = await localStorageService.getShifts();

        // Find open shift for this cashier and branch
        const offlineShift = allShifts.find(
          (s: any) =>
            s.cashierId === user.id &&
            s.branchId === user.branchId &&
            !s.isClosed
        );

        if (offlineShift) {
          console.log('[Shift] Using offline shift:', offlineShift);
          setSelectedShift(offlineShift as Shift);
        } else {
          setSelectedShift(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch current shift, trying offline:', error);

      // On error, check IndexedDB
      try {
        const { getLocalStorageService } = await import('@/lib/storage/local-storage');
        const localStorageService = getLocalStorageService();
        await localStorageService.init();
        const allShifts = await localStorageService.getShifts();

        const offlineShift = allShifts.find(
          (s: any) =>
            s.cashierId === user.id &&
            s.branchId === user.branchId &&
            !s.isClosed
        );

        if (offlineShift) {
          setSelectedShift(offlineShift as Shift);
        } else {
          setSelectedShift(null);
        }
      } catch (dbError) {
        console.error('Failed to fetch offline shift:', dbError);
        setSelectedShift(null);
      }
    }
  };

  // Fetch business day status when branch changes
  const fetchBusinessDayStatus = async () => {
    if (!selectedBranch) return;

    try {
      const response = await fetch(`/api/business-days/status?branchId=${selectedBranch}`);
      const data = await response.json();

      if (response.ok) {
        if (data.status === 'OPEN' && data.businessDay) {
          setBusinessDayStatus({
            isOpen: true,
            businessDayId: data.businessDay.id,
          });
        } else {
          setBusinessDayStatus({
            isOpen: false,
          });
        }
      }
    } catch (error) {
      console.error('[Shift Management] Failed to fetch business day status:', error);
    }
  };

  // Fetch business day status when branch is selected
  useEffect(() => {
    if (selectedBranch) {
      fetchBusinessDayStatus();
    }
  }, [selectedBranch]);


  // Business Day handlers
  const handleOpenBusinessDay = async () => {
    if (!selectedBranch) {
      alert('Please select a branch first');
      return;
    }

    if (!user?.id) {
      alert('User not authenticated');
      return;
    }

    try {
      const response = await fetch('/api/business-days/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranch,
          userId: user.id,
          notes: dayOpeningNotes || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Business day opened successfully!');
        setOpenDayDialogOpen(false);
        setDayOpeningNotes('');
        setBusinessDayStatus({
          isOpen: true,
          businessDayId: data.businessDay.id,
        });
      } else {
        alert(data.error || 'Failed to open business day');
      }
    } catch (error) {
      console.error('[Shift Management] Failed to open business day:', error);
      alert('Failed to open business day');
    }
  };

  const handleCloseBusinessDay = async () => {
    if (!businessDayStatus.businessDayId) {
      alert('No business day to close');
      return;
    }

    if (!user?.id) {
      alert('User not authenticated');
      return;
    }

    // Check if all shifts are closed
    const hasOpenShifts = shifts.some(s => !s.isClosed);
    if (hasOpenShifts) {
      alert('Please close all shifts before closing the business day');
      return;
    }

    try {
      const response = await fetch('/api/business-days/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessDayId: businessDayStatus.businessDayId,
          userId: user.id,
          closingCash: 0, // Cash is handled per shift, not per day
          notes: dayClosingNotes || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Fetch closing report
        try {
          const reportResponse = await fetch(`/api/business-days/closing-report?businessDayId=${businessDayStatus.businessDayId}`);
          const reportData = await reportResponse.json();

          if (reportResponse.ok && reportData.success) {
            setClosingReport(reportData.report);
            setClosingReportOpen(true);
          }
        } catch (reportError) {
          console.error('[Shift Management] Failed to fetch closing report:', reportError);
        }

        alert('Business day closed successfully!');
        setCloseDayDialogOpen(false);
        setDayClosingNotes('');
        setBusinessDayStatus({ isOpen: false });
      } else {
        alert(data.error || 'Failed to close business day');
      }
    } catch (error) {
      console.error('[Shift Management] Failed to close business day:', error);
      alert('Failed to close business day');
    }
  };

  const handleOpenShift = async () => {
    console.log('[Shift Management] handleOpenShift called');
    // Check if business day is open
    if (!businessDayStatus.isOpen) {
      alert('You must open the business day before opening a shift');
      return;
    }

    console.log('[Shift Management] user:', user);

    if (user?.role === 'CASHIER') {
      if (!user?.branchId) {
        alert('Your account is not assigned to a branch. Please contact your manager.');
        return;
      }

      const cashierId = user.id;
      const branchId = user.branchId;
      const shiftData = {
        branchId,
        cashierId,
        dayId: businessDayStatus.businessDayId,
        openingCash: parseFloat(openingCash) || 0,
        notes: shiftNotes,
      };

      console.log('[Shift Management] Shift data to send:', shiftData);

      try {
        // Check actual network connectivity before trying API
        let isActuallyOnline = navigator.onLine;

        if (navigator.onLine) {
          // Verify with actual network request
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            await fetch('/api/branches', {
              method: 'HEAD',
              signal: controller.signal,
              cache: 'no-store',
            });
            clearTimeout(timeoutId);
            isActuallyOnline = true;
            console.log('[Shift] Network check passed, trying API...');
          } catch (netError) {
            console.log('[Shift] Network check failed, assuming offline:', netError.message);
            isActuallyOnline = false;
          }
        }

        if (isActuallyOnline) {
          // Try API first
          const response = await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shiftData),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            alert('Shift opened successfully!');
            setOpenDialogOpen(false);
            setOpeningCash('');
            setShiftNotes('');
            refetchShifts();
            fetchCurrentShift();
          } else {
            // API failed - check if it's a network error
            const isNetworkError = !response.ok && (
              response.status === 0 || // Network error
              response.type === 'error' ||
              response.statusText === 'Failed to fetch' ||
              data.error?.includes('Failed to fetch') ||
              data.error?.includes('network') ||
              data.error?.includes('ENOTFOUND') ||
              data.error?.includes('ERR_NAME_NOT_RESOLVED') ||
              data.error?.includes('TypeError') ||
              data.error?.includes('Failed to fetch\n') ||
              data.error?.includes('net::ERR_NAME_NOT_RESOLVED')
            );
            
            if (isNetworkError) {
              console.log('[Shift] Network error detected (API), trying offline mode');
              try {
                await createShiftOffline(shiftData, user);
                alert('Shift opened (offline mode - will sync when online)');
                setOpenDialogOpen(false);
                setOpeningCash('');
                setShiftNotes('');
                fetchCurrentShift();
              } catch (offlineError) {
                console.error('[Shift] Offline shift creation failed:', offlineError);
                alert(`Failed to create shift offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
              }
            } else {
              alert(data.error || 'Failed to open shift');
            }
          }
        } else {
          // Offline mode - create shift locally
          console.log('[Shift] Offline mode detected, creating shift locally');
          try {
            await createShiftOffline(shiftData, user);
            alert('Shift opened (offline mode - will sync when online)');
            setOpenDialogOpen(false);
            setOpeningCash('');
            setShiftNotes('');
            fetchCurrentShift();
          } catch (offlineError) {
            console.error('[Shift] Offline shift creation failed:', offlineError);
            alert(`Failed to create shift offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
          }
        }
      } catch (error) {
        console.error('[Shift] Failed to open shift, error:', error);
        console.error('[Shift] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined,
          user: user ? { id: user.id, username: user.username, branchId: user.branchId } : 'no user',
          shiftData,
          isOffline: !navigator.onLine,
          isNetworkError: error instanceof Error && (
            error.message.includes('Failed to fetch') ||
            error.message.includes('network') ||
            error.name === 'TypeError' &&
            error.message.includes('Failed to fetch')
          ),
        });
        
        // Network error or fetch failure - try offline fallback
        const isNetworkError = error instanceof Error && (
          error.message.includes('Failed to fetch') ||
          error.message.includes('network') ||
          error.name === 'TypeError' &&
          error.message.includes('Failed to fetch')
        );
        
        if (isNetworkError) {
          console.log('[Shift] Network error detected, trying to create shift locally');
          try {
            await createShiftOffline(shiftData, user);
            alert('Shift opened (offline mode - will sync when online)');
            setOpenDialogOpen(false);
            setOpeningCash('');
            setShiftNotes('');
            fetchCurrentShift();
            return;
          } catch (offlineError) {
            console.error('[Shift] Offline shift creation also failed:', offlineError);
            alert(`Failed to create shift offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
          }
        }
        
        alert(`Failed to open shift: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }

    if (!selectedBranch) {
      alert('Please select a branch');
      return;
    }

    // Determine cashier ID
    let cashierId: string;
    if (user?.role === 'BRANCH_MANAGER') {
      // For branch managers, allow them to open shift for themselves
      cashierId = user.id;
    } else {
      // For admins, use selected cashier but validate it's not "all"
      cashierId = selectedCashier;
    }

    // Validate cashierId is set and not "all"
    if (!cashierId || cashierId === 'all' || cashierId === '') {
      alert('Please select a valid cashier');
      return;
    }

    const shiftData = {
      branchId: selectedBranch,
      cashierId,
      dayId: businessDayStatus.businessDayId,
      openingCash: parseFloat(openingCash) || 0,
      notes: shiftNotes,
    };

    try {
      // Check actual network connectivity before trying API
      let isActuallyOnline = navigator.onLine;

      if (navigator.onLine) {
        // Verify with actual network request
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          await fetch('/api/branches', {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store',
          });
          clearTimeout(timeoutId);
          isActuallyOnline = true;
          console.log('[Shift - Manager] Network check passed, trying API...');
        } catch (netError) {
          console.log('[Shift - Manager] Network check failed, assuming offline:', netError.message);
          isActuallyOnline = false;
        }
      }

      if (isActuallyOnline) {
        const response = await fetch('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shiftData),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          alert('Shift opened successfully!');
          setOpenDialogOpen(false);
          setOpeningCash('');
          setShiftNotes('');
          refetchShifts();
        } else {
          // API failed - try offline fallback
          if (!navigator.onLine || !response.ok) {
            console.log('[Shift - Manager] Offline mode, creating shift locally');
            await createShiftOffline(shiftData, user);
            alert('Shift opened (offline mode - will sync when online)');
            setOpenDialogOpen(false);
            setOpeningCash('');
            setShiftNotes('');
            refetchShifts();
          } else {
            alert(data.error || 'Failed to open shift');
          }
        }
      } else {
        // Offline mode - create shift locally
        console.log('[Shift - Manager] Offline mode detected, creating shift locally');
        try {
          await createShiftOffline(shiftData, user);
          alert('Shift opened (offline mode - will sync when online)');
          setOpenDialogOpen(false);
          setOpeningCash('');
          setShiftNotes('');
          refetchShifts();
        } catch (offlineError) {
          console.error('[Shift - Manager] Offline shift creation failed:', offlineError);
          alert(`Failed to create shift offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
        }
      }
    } catch (error) {
      console.error('[Shift - Manager] Failed to open shift, error:', error);
      console.error('[Shift - Manager] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        user: user ? { id: user.id, username: user.username, role: user.role, branchId: user.branchId } : 'no user',
        selectedBranch,
        shiftData,
        isOffline: !navigator.onLine,
      });

      // Network error - try offline fallback
      if (!navigator.onLine || (error instanceof Error && error.message.includes('Failed to fetch'))) {
        console.log('[Shift - Manager] Offline mode, trying to create shift locally');
        try {
          await createShiftOffline(shiftData, user);
          alert('Shift opened (offline mode - will sync when online)');
          setOpenDialogOpen(false);
          setOpeningCash('');
          setShiftNotes('');
          refetchShifts();
          return;
        } catch (offlineError) {
          console.error('[Shift - Manager] Offline shift creation also failed:', offlineError);
          alert(`Failed to create shift offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
        }
      }

      alert(`Failed to open shift: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleCloseShift = async () => {
    if (!selectedShift) {
      alert('Please select a shift to close');
      return;
    }

    if (!selectedBranch) {
      alert('Please select a branch to view shifts');
      return;
    }

    try {
      // Check actual network connectivity before trying API
      let isActuallyOnline = navigator.onLine;

      if (navigator.onLine) {
        // Verify with actual network request
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          await fetch('/api/branches', {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store',
          });
          clearTimeout(timeoutId);
          isActuallyOnline = true;
          console.log('[Shift] Network check passed, trying API to close shift...');
        } catch (netError) {
          console.log('[Shift] Network check failed, assuming offline:', netError.message);
          isActuallyOnline = false;
        }
      }

      if (isActuallyOnline) {
        // Try API first
        const response = await fetch(`/api/shifts/${selectedShift.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _method: 'PATCH',
            closingCash: parseFloat(closingCash) || 0,
            notes: shiftNotes,
            paymentBreakdown,
          }),
        });

        const data = await response.json();

        console.log('[handleCloseShift] Response status:', response.status);
        console.log('[handleCloseShift] Response data:', data);

        if (response.ok && data.success) {
          alert('Shift closed successfully!');
          setCloseDialogOpen(false);
          setClosingCash('');
          setShiftNotes('');
          setPaymentBreakdown({ cash: 0, card: 0, other: 0, total: 0 });
          setSelectedShift(null);
          refetchShifts();
          if (user?.role === 'CASHIER') {
            fetchCurrentShift();
          }
        } else {
          // API failed - check if it's a network error
          const isNetworkError = !response.ok && (
            response.status === 0 || // Network error
            response.type === 'error' ||
            response.statusText === 'Failed to fetch' ||
            data.error?.includes('Failed to fetch') ||
            data.error?.includes('network') ||
            data.error?.includes('ENOTFOUND') ||
            data.error?.includes('ERR_NAME_NOT_RESOLVED') ||
            data.error?.includes('TypeError') ||
            data.error?.includes('Failed to fetch\n') ||
            data.error?.includes('net::ERR_NAME_NOT_RESOLVED')
          );

          if (isNetworkError) {
            console.log('[Shift] Network error detected (API), trying offline mode to close shift');
            try {
              await closeShiftOffline(
                selectedShift,
                parseFloat(closingCash) || 0,
                shiftNotes,
                paymentBreakdown
              );
              alert('Shift closed (offline mode - will sync when online)');
              setCloseDialogOpen(false);
              setClosingCash('');
              setShiftNotes('');
              setPaymentBreakdown({ cash: 0, card: 0, other: 0, total: 0 });
              setSelectedShift(null);
              refetchShifts();
              if (user?.role === 'CASHIER') {
                fetchCurrentShift();
              }
            } catch (offlineError) {
              console.error('[Shift] Offline shift closing failed:', offlineError);
              alert(`Failed to close shift offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
            }
          } else {
            const errorMsg = data.error || data.details || 'Failed to close shift';
            alert(`${errorMsg}\nStatus: ${response.status}`);
          }
        }
      } else {
        // Offline mode - close shift locally
        console.log('[Shift] Offline mode detected, closing shift locally');
        try {
          await closeShiftOffline(
            selectedShift,
            parseFloat(closingCash) || 0,
            shiftNotes,
            paymentBreakdown
          );
          alert('Shift closed (offline mode - will sync when online)');
          setCloseDialogOpen(false);
          setClosingCash('');
          setShiftNotes('');
          setPaymentBreakdown({ cash: 0, card: 0, other: 0, total: 0 });
          setSelectedShift(null);
          refetchShifts();
          if (user?.role === 'CASHIER') {
            fetchCurrentShift();
          }
        } catch (offlineError) {
          console.error('[Shift] Offline shift closing failed:', offlineError);
          alert(`Failed to close shift offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
        }
      }
    } catch (error) {
      console.error('[handleCloseShift] Failed to close shift:', error);
      console.error('[handleCloseShift] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        selectedShift: selectedShift ? { id: selectedShift.id } : 'no shift',
        isOffline: !navigator.onLine,
      });

      // Network error or fetch failure - try offline fallback
      const isNetworkError = error instanceof Error && (
        error.message.includes('Failed to fetch') ||
        error.message.includes('network') ||
        error.message.includes('ERR_NAME_NOT_RESOLVED') ||
        error.name === 'TypeError' &&
        error.message.includes('Failed to fetch')
      );

      if (isNetworkError) {
        console.log('[Shift] Network error detected, trying to close shift locally');
        try {
          await closeShiftOffline(
            selectedShift,
            parseFloat(closingCash) || 0,
            shiftNotes,
            paymentBreakdown
          );
          alert('Shift closed (offline mode - will sync when online)');
          setCloseDialogOpen(false);
          setClosingCash('');
          setShiftNotes('');
          setPaymentBreakdown({ cash: 0, card: 0, other: 0, total: 0 });
          setSelectedShift(null);
          refetchShifts();
          if (user?.role === 'CASHIER') {
            fetchCurrentShift();
          }
          return;
        } catch (offlineError) {
          console.error('[Shift] Offline shift closing also failed:', offlineError);
          alert(`Failed to close shift offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
        }
      }

      alert(`Failed to close shift: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const getShiftStats = (shift: Shift) => {
    if (shift.isClosed) {
      const ordersDuringShift = shift.closingOrders ? shift.closingOrders - shift.openingOrders : 0;
      // closingRevenue is already the revenue during the shift, not cumulative
      const revenueDuringShift = shift.closingRevenue || 0;
      const cashDifference = shift.closingCash ? shift.closingCash - shift.openingCash : 0;

      return {
        ordersDuringShift,
        revenueDuringShift,
        cashDifference,
        isDiscrepancy: Math.abs(cashDifference - revenueDuringShift) > 0.01,
        discrepancyAmount: Math.abs(cashDifference - revenueDuringShift),
      };
    }

    // For open shifts, use current revenue from orders
    const revenueDuringShift = shift.currentRevenue !== undefined ? shift.currentRevenue : 0;
    const ordersDuringShift = shift.currentOrders ? shift.currentOrders - shift.openingOrders : 0;
    const cashDifference = 0;

    return {
      ordersDuringShift,
      revenueDuringShift,
      cashDifference,
      isDiscrepancy: false,
      discrepancyAmount: 0,
    };
  };

  const calculateDiscrepancy = () => {
    if (!selectedShift) return { hasDiscrepancy: false, amount: 0 };

    const stats = getShiftStats(selectedShift);
    const expectedCash = selectedShift.openingCash + stats.revenueDuringShift;
    const actualCash = parseFloat(closingCash) || 0;
    const discrepancy = actualCash - expectedCash;

    return {
      hasDiscrepancy: Math.abs(discrepancy) > 0.01,
      amount: discrepancy,
      expectedCash,
      actualCash,
    };
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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

  const getFilteredShifts = () => {
    return shifts;
  };

  // Update payment breakdown total
  useEffect(() => {
    setPaymentBreakdown(prev => ({
      ...prev,
      total: prev.cash + prev.card + prev.other,
    }));
  }, [paymentBreakdown.cash, paymentBreakdown.card, paymentBreakdown.other]);

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0 pb-safe-bottom">
      {/* Branch Selector */}
      {user?.role === 'ADMIN' && (
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-start gap-3 md:gap-4">
              <Store className="h-5 w-5 text-primary mt-6 md:mt-0 shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-semibold mb-2 block">{t('branch.select')}</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select branch..." />
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
          </CardContent>
        </Card>
      )}

      {/* Business Day Status Card */}
      {selectedBranch && (
        <Card className={`border-2 ${
          businessDayStatus.isOpen
            ? 'border-green-500 dark:border-green-500'
            : 'border-red-500 dark:border-red-500'
        }`}>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-full ${
                  businessDayStatus.isOpen
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-red-100 dark:bg-red-900'
                }`}>
                  <Store className={`h-6 w-6 ${
                    businessDayStatus.isOpen ? 'text-green-600' : 'text-red-600'
                  }`} />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Business Day Status
                  </div>
                  <div className={`text-xl md:text-2xl font-bold ${
                    businessDayStatus.isOpen ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {businessDayStatus.isOpen ? 'OPEN' : 'CLOSED'}
                  </div>
                </div>
              </div>
              
              {businessDayStatus.isOpen ? (
                <Button
                  variant="outline"
                  className="bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-300 h-11 min-h-[44px]"
                  onClick={() => setCloseDayDialogOpen(true)}
                  disabled={!businessDayStatus.isOpen || shifts.some(s => !s.isClosed)}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Close Day
                </Button>
              ) : (
                <Button
                  onClick={() => setOpenDayDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700 h-11 min-h-[44px]"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Open Day
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Clock className="h-5 w-5 text-primary" />
            Shift Management
          </CardTitle>
          <CardDescription className="text-sm md:text-base">
            Track and manage cashier shifts with sales tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:gap-4">
            <div className="flex-1 w-full">
              <Label className="text-sm font-medium mb-2 block">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="open">Open Shifts</SelectItem>
                  <SelectItem value="closed">Closed Shifts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {user?.role === 'ADMIN' && (
              <div className="flex-1 w-full">
                <Label className="text-sm font-medium mb-2 block">Cashier</Label>
                <Select value={selectedCashier} onValueChange={setSelectedCashier}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All cashiers..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cashiers</SelectItem>
                    {cashiers.map((cashier) => (
                      <SelectItem key={cashier.id} value={cashier.id}>
                        {cashier.name || cashier.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-row items-end gap-2 md:flex-col">
              {(user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER') && (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 h-11 min-h-[44px] text-sm md:text-base"
                  onClick={() => setOpenDialogOpen(true)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Open Shift</span>
                  <span className="md:hidden">Open</span>
                </Button>
              )}

              <Button 
                variant="outline" 
                onClick={() => refetchShifts()} 
                disabled={loading}
                className="h-11 min-h-[44px]"
              >
                <Clock className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cashier's Active Shift Dashboard */}
      {user?.role === 'CASHIER' && (
        <Card className={`relative overflow-hidden ${
          selectedShift
            ? 'border-2 border-green-500 dark:border-green-500 shadow-lg'
            : ''
        }`}>
          {selectedShift && (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-green-500 to-green-600 animate-pulse" />
            </>
          )}

          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Clock className={`h-5 w-5 ${selectedShift ? 'text-green-600 animate-pulse' : ''}`} />
              My {selectedShift ? 'Active' : 'Shift'}
            </CardTitle>
            <CardDescription className="text-sm">
              {selectedShift
                ? 'Your shift is currently in progress'
                : 'Start a new shift to process sales'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6">
            {selectedShift ? (
              <>
                {/* Real-time Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                    <CardContent className="pt-4 md:pt-6">
                      <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="text-xs md:text-sm font-medium text-blue-600">Duration</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {formatDuration(selectedShift.startTime)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 md:mt-1">
                        {formatTime(selectedShift.startTime)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                    <CardContent className="pt-4 md:pt-6">
                      <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-xs md:text-sm font-medium text-green-600">Current Revenue</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-green-900 dark:text-green-100">
                        {formatCurrency(
                          selectedShift.currentRevenue !== undefined
                            ? selectedShift.currentRevenue
                            : 0,
                          currency
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 md:mt-1">Live total</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                    <CardContent className="pt-4 md:pt-6">
                      <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                        <ShoppingCart className="h-4 w-4 text-purple-600" />
                        <span className="text-xs md:text-sm font-medium text-purple-600">Orders</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {selectedShift.orderCount}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 md:mt-1">Processed</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
                    <CardContent className="pt-4 md:pt-6">
                      <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                        <Wallet className="h-4 w-4 text-amber-600" />
                        <span className="text-xs md:text-sm font-medium text-amber-600">Opening Cash</span>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {formatCurrency(selectedShift.openingCash, currency)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 md:mt-1">Starting balance</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Payment Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div className="flex items-center gap-3 p-3 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg shrink-0">
                      <Wallet className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">Cash Sales</p>
                      <p className="text-base md:text-lg font-bold truncate">
                        {selectedShift.paymentBreakdown?.cash
                          ? formatCurrency(selectedShift.paymentBreakdown.cash, currency)
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg shrink-0">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">Card Sales</p>
                      <p className="text-base md:text-lg font-bold truncate">
                        {selectedShift.paymentBreakdown?.card
                          ? formatCurrency(selectedShift.paymentBreakdown.card, currency)
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg shrink-0">
                      <CircleDollarSign className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">Other</p>
                      <p className="text-base md:text-lg font-bold truncate">
                        {selectedShift.paymentBreakdown?.other
                          ? formatCurrency(selectedShift.paymentBreakdown.other, currency)
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="closingCash">Closing Cash ({currency})</Label>
                    <Input
                      id="closingCash"
                      type="number"
                      step="0.01"
                      value={closingCash}
                      onChange={(e) => setClosingCash(e.target.value)}
                      placeholder="Enter closing cash amount..."
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={shiftNotes}
                      onChange={(e) => setShiftNotes(e.target.value)}
                      placeholder="Any notes about this shift..."
                      rows={3}
                      className="min-h-[88px]"
                    />
                  </div>

                  <Button
                    onClick={handleCloseShift}
                    disabled={closingCash === '' || closingCash === undefined}
                    className="w-full bg-amber-600 hover:bg-amber-700 h-11 min-h-[44px]"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Close My Shift
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-4">
                <Clock className="h-16 w-16 md:h-20 md:w-20 text-slate-300 dark:text-slate-600" />
                <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 font-medium text-center px-4">
                  You don't have an active shift
                </p>
                <Button
                  onClick={() => setOpenDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700 h-12 min-h-[48px] px-8"
                  disabled={!user.branchId}
                >
                  <Play className="h-5 w-5 mr-2" />
                  Open New Shift
                </Button>
                {!user.branchId && (
                  <p className="text-sm text-red-600 text-center px-4">
                    Your account is not assigned to a branch. Please contact your manager.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shift History Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg md:text-xl">Shift History</CardTitle>
          <CardDescription className="text-sm">
            Track sales, cash, and performance per shift
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <span className="ml-3 text-slate-600">Loading shifts...</span>
            </div>
          ) : shifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Clock className="h-12 w-12 mb-2" />
              <p>No shifts found for selected criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="min-w-[800px] md:min-w-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Cashier</TableHead>
                        <TableHead className="whitespace-nowrap">Date</TableHead>
                        <TableHead className="whitespace-nowrap">Time</TableHead>
                        <TableHead className="whitespace-nowrap">Duration</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Opening Cash</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Closing Cash</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Orders</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Revenue</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Cash</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Card</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Other</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredShifts().map((shift) => {
                        const stats = getShiftStats(shift);
                        return (
                          <TableRow
                            key={shift.id}
                            className={stats.isDiscrepancy ? 'bg-red-50 dark:bg-red-950/20' : ''}
                          >
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                <span className="font-medium">
                                  {shift.cashier?.name || shift.cashier?.username}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(shift.startTime)}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="text-sm">
                                <div>{formatTime(shift.startTime)}</div>
                                {shift.endTime && (
                                  <div className="text-slate-400">{formatTime(shift.endTime)}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge variant="outline" className="font-mono">
                                <Activity className="h-3 w-3 mr-1" />
                                {formatDuration(shift.startTime, shift.endTime)}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant={shift.isClosed ? 'secondary' : 'default'}
                                  className={
                                    !shift.isClosed
                                      ? 'bg-green-600 hover:bg-green-700'
                                      : ''
                                  }
                                >
                                  {shift.isClosed ? 'Closed' : 'Open'}
                                </Badge>
                                {/* Show offline indicator for shifts that haven't synced yet */}
                                {shift.id.startsWith('temp-') && (
                                  <Badge variant="outline" className="text-amber-600 border-amber-600">
                                    Offline
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(shift.openingCash, currency)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {shift.closingCash !== undefined ? (
                                <span className="font-medium">
                                  {formatCurrency(shift.closingCash, currency)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <ShoppingCart className="h-3 w-3 text-slate-400" />
                                <span className="font-medium">{shift.orderCount}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <DollarSign className="h-3 w-3 text-green-500" />
                                <span className="font-medium">
                                  {formatCurrency(stats.revenueDuringShift, currency)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {shift.paymentBreakdown?.cash !== undefined ? (
                                <span className="text-green-600">
                                  {formatCurrency(shift.paymentBreakdown.cash, currency)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {shift.paymentBreakdown?.card !== undefined ? (
                                <span className="text-blue-600">
                                  {formatCurrency(shift.paymentBreakdown.card, currency)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {shift.paymentBreakdown?.other !== undefined ? (
                                <span className="text-purple-600">
                                  {formatCurrency(shift.paymentBreakdown.other, currency)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespacenowrap">
                              {!shift.isClosed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedShift(shift);
                                    setCloseDialogOpen(true);
                                  }}
                                  className="h-9 min-h-[36px]"
                                >
                                  <Square className="h-3 w-3 mr-1" />
                                  Close
                                </Button>
                              )}
                              {shift.isClosed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setShiftForReceipt(shift);
                                    setShiftClosingReceiptOpen(true);
                                  }}
                                  className="h-9 min-h-[36px]"
                                >
                                  Receipt
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Business Day Dialog */}
      <Dialog open={openDayDialogOpen} onOpenChange={setOpenDayDialogOpen}>
        <DialogContent className="z-[100] w-[95vw] max-w-md max-h-[90vh] overflow-y-auto pb-safe-bottom">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Open Business Day</DialogTitle>
            <DialogDescription>
              Start a new business day. Cash is handled per shift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <Label className="text-sm font-medium mb-2 block">Date</Label>
              <p className="text-lg font-semibold">{new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dayOpeningNotes">Opening Notes (Optional)</Label>
              <Textarea
                id="dayOpeningNotes"
                value={dayOpeningNotes}
                onChange={(e) => setDayOpeningNotes(e.target.value)}
                placeholder="Any notes about opening the day..."
                rows={3}
                className="min-h-[88px]"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setOpenDayDialogOpen(false)}
              className="w-full sm:w-auto h-11 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleOpenBusinessDay}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 h-11 min-h-[44px]"
            >
              <Play className="h-4 w-4 mr-2" />
              Open Business Day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Business Day Dialog */}
      <Dialog open={closeDayDialogOpen} onOpenChange={setCloseDayDialogOpen}>
        <DialogContent className="z-[100] w-[95vw] max-w-md max-h-[90vh] overflow-y-auto pb-safe-bottom">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Close Business Day</DialogTitle>
            <DialogDescription>
              Close the business day and generate detailed report. Cash is handled per shift.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {shifts.some(s => !s.isClosed) && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-amber-800 dark:text-amber-200">
                      Open Shifts Detected
                    </div>
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      Please close all shifts before closing the business day.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="dayClosingNotes">Closing Notes (Optional)</Label>
              <Textarea
                id="dayClosingNotes"
                value={dayClosingNotes}
                onChange={(e) => setDayClosingNotes(e.target.value)}
                placeholder="Any notes about closing the day..."
                rows={3}
                className="min-h-[88px]"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCloseDayDialogOpen(false)}
              className="w-full sm:w-auto h-11 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCloseBusinessDay}
              disabled={shifts.some(s => !s.isClosed)}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 h-11 min-h-[44px]"
            >
              <Square className="h-4 w-4 mr-2" />
              Close & Print Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Shift Dialog */}
      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent className="z-[100] w-[95vw] max-w-md max-h-[90vh] overflow-y-auto pb-safe-bottom">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Open New Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {user?.role === 'ADMIN' && (
              <div className="space-y-2">
                <Label htmlFor="cashier">Cashier</Label>
                <Select value={selectedCashier} onValueChange={setSelectedCashier}>
                  <SelectTrigger id="cashier" className="h-11">
                    <SelectValue placeholder="Select cashier..." />
                  </SelectTrigger>
                  <SelectContent className="z-[110] max-h-60 overflow-y-auto">
                    {cashiers.map((cashier) => (
                      <SelectItem key={cashier.id} value={cashier.id}>
                        {cashier.name || cashier.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="openingCash">Opening Cash ({currency})</Label>
              <Input
                id="openingCash"
                type="number"
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="h-11 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="Any special notes for this shift..."
                rows={3}
                className="min-h-[88px] text-base"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setOpenDialogOpen(false)}
              className="w-full sm:w-auto h-11 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleOpenShift}
              disabled={openingCash === '' || openingCash === undefined}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 h-11 min-h-[44px]"
            >
              <Play className="h-4 w-4 mr-2" />
              Open Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto pb-safe-bottom">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Close Shift - {selectedShift?.cashier?.name || selectedShift?.cashier?.username}</DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <>
              <div className="space-y-4 py-2">
                {/* Shift Summary */}
                <div className="grid grid-cols-2 gap-3 md:gap-4 p-3 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-1">Opening Cash</div>
                    <div className="text-base md:text-lg font-bold">
                      {formatCurrency(selectedShift.openingCash, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-1">Revenue</div>
                    <div className="text-base md:text-lg font-bold text-green-600">
                      {formatCurrency(getShiftStats(selectedShift).revenueDuringShift, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-1">Orders</div>
                    <div className="text-base md:text-lg font-bold">{selectedShift.orderCount}</div>
                  </div>
                  <div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-1">Duration</div>
                    <div className="text-base md:text-lg font-bold font-mono">
                      {formatDuration(selectedShift.startTime)}
                    </div>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="p-3 md:p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Label className="text-sm font-medium mb-3 block">Payment Breakdown</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cashPayments" className="text-xs">Cash</Label>
                      <Input
                        id="cashPayments"
                        type="number"
                        step="0.01"
                        value={paymentBreakdown.cash}
                        onChange={(e) => setPaymentBreakdown(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                        className="h-11 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardPayments" className="text-xs">Card</Label>
                      <Input
                        id="cardPayments"
                        type="number"
                        step="0.01"
                        value={paymentBreakdown.card}
                        onChange={(e) => setPaymentBreakdown(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                        className="h-11 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="otherPayments" className="text-xs">Other</Label>
                      <Input
                        id="otherPayments"
                        type="number"
                        step="0.01"
                        value={paymentBreakdown.other}
                        onChange={(e) => setPaymentBreakdown(prev => ({ ...prev, other: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                        className="h-11 text-base"
                      />
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Total Payments</span>
                      <span className="font-bold text-blue-700 dark:text-blue-300">
                        {formatCurrency(paymentBreakdown.total, currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expected Cash */}
                <div className="p-3 md:p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                  <div className="flex justify-between items-start md:items-center">
                    <div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Expected Cash</div>
                      <div className="text-xs text-slate-500">
                        Opening + (Total Payments - Card - Other)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl md:text-2xl font-bold text-amber-700 dark:text-amber-300">
                        {formatCurrency(
                          selectedShift.openingCash + paymentBreakdown.cash + paymentBreakdown.other,
                          currency
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Closing Cash Input */}
                <div className="space-y-2">
                  <Label htmlFor="closingCash">Closing Cash ({currency})</Label>
                  <Input
                    id="closingCash"
                    type="number"
                    step="0.01"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder="Enter closing cash amount..."
                    autoFocus
                    className="h-11 text-base"
                  />
                </div>

                {/* Live Discrepancy Detection */}
                {closingCash && (
                  <div
                    className={`p-3 md:p-4 rounded-lg border-2 ${
                      calculateDiscrepancy().hasDiscrepancy
                        ? 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-800'
                        : 'bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle
                        className={`h-5 w-5 mt-0.5 shrink-0 ${
                          calculateDiscrepancy().hasDiscrepancy
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-sm md:text-base">
                            {calculateDiscrepancy().hasDiscrepancy
                              ? 'Discrepancy Detected'
                              : 'Cash Matches'}
                          </span>
                          <Badge
                            variant={calculateDiscrepancy().hasDiscrepancy ? 'destructive' : 'default'}
                            className={
                              !calculateDiscrepancy().hasDiscrepancy
                                ? 'bg-green-600 hover:bg-green-700'
                                : ''
                            }
                          >
                            {formatCurrency(calculateDiscrepancy().amount, currency)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">Expected:</span>
                            <span className="ml-2 font-medium">
                              {formatCurrency(calculateDiscrepancy().expectedCash, currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">Actual:</span>
                            <span className="ml-2 font-medium">
                              {formatCurrency(calculateDiscrepancy().actualCash, currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="closeNotes">Notes (Optional)</Label>
                  <Textarea
                    id="closeNotes"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    placeholder="Any notes about this shift..."
                    rows={3}
                    className="min-h-[88px] text-base"
                  />
                </div>

                {/* Opening Notes */}
                {selectedShift.notes && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <Label className="text-sm font-medium">Opening Notes:</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {selectedShift.notes}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCloseDialogOpen(false);
                    setSelectedShift(null);
                    setClosingCash('');
                    setShiftNotes('');
                    setPaymentBreakdown({ cash: 0, card: 0, other: 0, total: 0 });
                  }}
                  className="w-full sm:w-auto h-11 min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCloseShift}
                  disabled={closingCash === '' || closingCash === undefined}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 h-11 min-h-[44px]"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Close Shift
                </Button>
              </DialogFooter>
            </>
        )}
      </DialogContent>
      </Dialog>
      {/* Closing Day Receipt Dialog */}
      {closingReport && businessDayStatus.businessDayId && (
        <DayClosingReceipt
          businessDayId={businessDayStatus.businessDayId}
          open={closingReportOpen}
          onClose={() => {
            setClosingReportOpen(false);
            setClosingReport(null);
          }}
        />
      )}

      {/* Shift Closing Receipt Dialog */}
      {shiftForReceipt && (
        <ShiftClosingReceipt
          shiftId={shiftForReceipt.id}
          open={shiftClosingReceiptOpen}
          onClose={() => {
            setShiftClosingReceiptOpen(false);
            setShiftForReceipt(null);
          }}
        />
      )}
    </div>
  );
}
