'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Printer, FileText, Package, DollarSign, Loader2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { type ShiftClosingReportData } from '@/lib/escpos-encoder';

interface ShiftClosingReceiptProps {
  shiftId: string;
  shiftData?: any; // Optional shift data for offline mode
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
      notes?: string | null;
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
      voidedItems: number;
      card: number;
      instapay: number;
      wallet: number;
      cash: number;
      dailyExpenses: number;
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
    voidedItems: Array<{
      id: string;
      itemName: string;
      voidedQuantity: number;
      unitPrice: number;
      voidedSubtotal: number;
      reason: string;
      voidedBy: string;
      voidedAt: string;
      orderNumber: number;
      orderTimestamp: string;
    }>;
    refundedOrders: Array<{
      id: string;
      orderNumber: number;
      orderTimestamp: string;
      refundAmount: number;
      refundReason: string;
      refundedAt: string;
      paymentMethod: string;
    }>;
  };
  error?: string;
  details?: string;
}

export function ShiftClosingReceipt({ shiftId, shiftData, open, onClose }: ShiftClosingReceiptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShiftClosingReportData | null>(null);
  const [fullReportData, setFullReportData] = useState<ApiResponse['report'] | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Fetch shift closing data when dialog opens, or use provided shiftData
  useEffect(() => {
    if (open) {
      const loadData = async () => {
        // Only use shiftData directly for offline shifts (temp IDs)
        // For online shifts, always fetch from API to get complete order data
        if (shiftData && shiftData.id && shiftData.id.startsWith('temp-') && (shiftData.shiftNumber || shiftData.closingRevenue !== undefined || shiftData.closingOrders !== undefined)) {
          console.log('[Shift Closing Receipt] Using provided shiftData prop (offline shift):', shiftData);
          await loadReceiptFromShiftData(shiftData);
        } else if (shiftId) {
          // For online shifts, always fetch from API
          console.log('[Shift Closing Receipt] Fetching shift data from API for shiftId:', shiftId);
          fetchShiftData();
        }
      };

      loadData();
    }
  }, [open, shiftId, shiftData]);

  // Auto-print all three papers when data is loaded
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

      // Print Paper 3 (Voids and Refunds) after another delay
      const timer3 = setTimeout(() => {
        console.log('[Shift Closing] Printing Paper 3 (Voids and Refunds)...');
        printThermalPaper3();
      }, 7000); // 7 second delay between prints

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [data, open]);

  const fetchShiftData = async () => {
    setLoading(true);
    setError(null);
    setIsOfflineMode(false);

    try {
      // Check if shiftId is a temporary ID and map it to real ID
      let apiShiftId = shiftId;
      if (shiftId.startsWith('temp-')) {
        try {
          const { getIndexedDBStorage } = await import('@/lib/storage/indexeddb-storage');
          const storageService = getIndexedDBStorage();
          await storageService.init();

          const realId = await storageService.getRealIdFromTemp(shiftId);
          if (realId) {
            console.log('[Shift Closing Receipt] Mapped temp ID', shiftId, 'to real ID', realId);
            apiShiftId = realId;
          } else {
            console.warn('[Shift Closing Receipt] No mapping found for temp ID', shiftId);
          }
        } catch (mapError) {
          console.error('[Shift Closing Receipt] Error checking ID mapping:', mapError);
        }
      }

      // Try API first
      const response = await fetch(`/api/shifts/${apiShiftId}/closing-report`);
      const result: ApiResponse = await response.json();

      if (!result.success || !result.report) {
        throw new Error(result.error || 'Failed to fetch shift data');
      }

      const report = result.report;
      console.log('[Shift Closing Receipt] API Response report:', report);
      console.log('[Shift Closing Receipt] Category breakdown:', report.categoryBreakdown);

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
      setIsOfflineMode(false);
    } catch (err: any) {
      console.error('[Shift Closing Receipt] API fetch failed:', err);

      // Try to load from local storage (offline mode)
      try {
        console.log('[Shift Closing Receipt] Loading from local storage...');
        await fetchOfflineShiftReport();
        setIsOfflineMode(true);
      } catch (offlineError: any) {
        console.error('[Shift Closing Receipt] Offline fetch failed:', offlineError);
        setError(err.message || 'Failed to load shift closing data');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load receipt data from shiftData prop (offline mode)
  const loadReceiptFromShiftData = async (shift: any) => {
    console.log('[Shift Closing Receipt] Loading receipt from shiftData:', shift);

    // Generate shift number if not available
    const shiftNumber = shift.shiftNumber || shift.closingOrders || shift.openingOrders || 1;
    const startTime = shift.startTime || new Date().toISOString();
    const endTime = shift.endTime || new Date().toISOString();

    // Extract cashier info from shiftData
    const cashierName = shift.cashier?.name || shift.cashierName || shift.cashierUsername || 'Unknown';
    const cashierUsername = shift.cashier?.username || shift.cashierUsername || 'unknown';

    // Extract branch info from shiftData
    const branchName = shift.branch?.branchName || shift.branchName || 'Unknown Branch';

    // Extract payment breakdown
    const paymentBreakdown = shift.paymentBreakdown || {
      cash: 0,
      card: 0,
      instapay: 0,
      wallet: 0,
      total: 0
    };

    // Calculate totals from payment breakdown or orders
    let cash = 0, card = 0, instapay = 0, wallet = 0;
    if (paymentBreakdown) {
      cash = paymentBreakdown.cash || 0;
      card = paymentBreakdown.card || 0;
      instapay = paymentBreakdown.instapay || 0;
      wallet = paymentBreakdown.wallet || 0;
    }

    // Fetch orders from local storage to build category breakdown
    let categoryBreakdown: any[] = [];
    let totalSales = 0;

    try {
      const { getIndexedDBStorage } = await import('@/lib/storage/indexeddb-storage');
      const indexedDBStorage = getIndexedDBStorage();
      await indexedDBStorage.init();

      // Fetch menu items from IndexedDB to get category information
      const menuItems = await indexedDBStorage.getAllMenuItems();
      const menuItemCategoryMap = new Map<string, string>();

      console.log('[Shift Closing Receipt] Loaded', menuItems.length, 'menu items from IndexedDB');

      menuItems.forEach((menuItem: any) => {
        if (menuItem.id && menuItem.categoryRel) {
          menuItemCategoryMap.set(menuItem.id, menuItem.categoryRel.name);
        }
      });

      console.log('[Shift Closing Receipt] Built category map for', menuItemCategoryMap.size, 'menu items');

      const allOrders = await indexedDBStorage.getAllOrders();
      const shiftOrders = allOrders.filter((order: any) => order.shiftId === shift.id);

      console.log('[Shift Closing Receipt] Found orders for category breakdown:', shiftOrders.length);

      // Group items by category
      const categoryMap = new Map<string, {
        categoryName: string;
        totalSales: number;
        items: Map<string, {
          itemId: string;
          itemName: string;
          quantity: number;
          totalPrice: number;
        }>;
      }>();

      shiftOrders.forEach((order: any) => {
        if (order.isRefunded) return;

        if (order.items) {
          order.items.forEach((item: any) => {
            // Get category from menu item map, fallback to itemName's category, then 'Uncategorized'
            let category = menuItemCategoryMap.get(item.menuItemId);

            if (!category) {
              // Try to get from item.menuItem.category (if available)
              category = item.menuItem?.category;
            }

            if (!category) {
              // Try to get from item.categoryName (if available)
              category = item.categoryName;
            }

            if (!category) {
              // Fallback to 'Uncategorized'
              category = 'Uncategorized';
            }

            if (!categoryMap.has(category)) {
              categoryMap.set(category, {
                categoryName: category,
                totalSales: 0,
                items: new Map()
              });
            }

            const catData = categoryMap.get(category)!;
            catData.totalSales += item.subtotal || 0;
            totalSales += item.subtotal || 0;

            const itemId = item.menuItemId + (item.menuItemVariantId ? `_${item.menuItemVariantId}` : '');
            const itemName = item.menuItemVariant?.variantOption?.name
              ? `${item.itemName || item.name} (${item.menuItemVariant.variantOption.name})`
              : (item.itemName || item.name || 'Unknown Item');

            if (!catData.items.has(itemId)) {
              catData.items.set(itemId, {
                itemId,
                itemName,
                quantity: 0,
                totalPrice: 0
              });
            }

            const itemData = catData.items.get(itemId)!;
            itemData.quantity += item.quantity || 0;
            itemData.totalPrice += item.subtotal || 0;
          });
        }
      });

      // Convert to array
      categoryBreakdown = Array.from(categoryMap.values())
        .filter(cat => cat.totalSales > 0)
        .map(cat => ({
          categoryName: cat.categoryName,
          totalSales: cat.totalSales,
          items: Array.from(cat.items.values()).map(item => ({
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.quantity,
            totalPrice: item.totalPrice
          }))
        }))
        .sort((a, b) => b.totalSales - a.totalSales);

      console.log('[Shift Closing Receipt] Category breakdown:', categoryBreakdown);
    } catch (error) {
      console.error('[Shift Closing Receipt] Error building category breakdown:', error);
    }

    // Generate report structure
    const report = {
      shift: {
        id: shift.id,
        shiftNumber,
        startTime,
        endTime,
        cashier: {
          name: cashierName,
          username: cashierUsername
        },
        branch: {
          id: shift.branchId || '',
          branchName
        },
        openingCash: shift.openingCash || 0,
        closingCash: shift.closingCash || 0,
        openingOrders: shift.openingOrders || 0,
        closingOrders: shift.closingOrders || 0,
        openingRevenue: shift.openingRevenue || 0,
        closingRevenue: shift.closingRevenue || 0,
        notes: shift.notes
      },
      paymentSummary: {
        cash,
        card,
        instapay,
        wallet,
        other: 0,
        total: cash + card + instapay + wallet
      },
      orderTypeBreakdown: {
        'take-away': { value: 0, discounts: 0, count: 0, total: 0 },
        'dine-in': { value: 0, discounts: 0, count: 0, total: 0 },
        'delivery': { value: 0, discounts: 0, count: 0, total: 0 }
      },
      totals: {
        sales: totalSales > 0 ? totalSales : (shift.closingRevenue || 0),
        discounts: 0,
        deliveryFees: 0,
        refunds: 0,
        voidedItems: 0,
        card,
        instapay,
        wallet,
        cash,
        dailyExpenses: 0,
        openingCashBalance: shift.openingCash || 0,
        expectedCash: (shift.openingCash || 0) + cash,
        closingCashBalance: shift.closingCash || 0,
        overShort: shift.closingCash ? (shift.closingCash - ((shift.openingCash || 0) + cash)) : 0
      },
      categoryBreakdown,
      voidedItems: [],
      refundedOrders: []
    };

    setFullReportData(report);

    // Transform to ShiftClosingReportData format
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
    console.log('[Shift Closing Receipt] Receipt loaded from shiftData with', categoryBreakdown.length, 'categories');
  };

  // Generate closing report from local storage data
  const fetchOfflineShiftReport = async () => {
    const { getIndexedDBStorage } = await import('@/lib/storage/indexeddb-storage');
    const indexedDBStorage = getIndexedDBStorage();
    await indexedDBStorage.init();

    // Get shift data
    const shifts = await indexedDBStorage.getAllShifts();
    const shift = shifts.find((s: any) => s.id === shiftId);

    if (!shift) {
      throw new Error('Shift not found in IndexedDB');
    }

    console.log('[Shift Closing Receipt] Found shift in IndexedDB:', shift);

    // Get orders for this shift
    const allOrders = await indexedDBStorage.getAllOrders();
    const shiftOrders = allOrders.filter((order: any) => order.shiftId === shiftId);

    console.log('[Shift Closing Receipt] Found orders:', shiftOrders.length);

    // Calculate payment breakdown
    let cash = 0;
    let card = 0;
    let instapay = 0;
    let wallet = 0;

    shiftOrders.forEach((order: any) => {
      const paymentMethod = order.paymentMethod?.toLowerCase();
      if (paymentMethod === 'cash') {
        cash += order.totalAmount || 0;
      } else if (paymentMethod === 'card') {
        const detail = order.paymentMethodDetail?.toUpperCase();
        if (detail === 'INSTAPAY') {
          instapay += order.totalAmount || 0;
        } else if (detail === 'MOBILE_WALLET') {
          wallet += order.totalAmount || 0;
        } else {
          card += order.totalAmount || 0;
        }
      }
    });

    // Calculate order type breakdown
    const orderTypeBreakdown = {
      'take-away': { value: 0, discounts: 0, count: 0, total: 0 },
      'dine-in': { value: 0, discounts: 0, count: 0, total: 0 },
      'delivery': { value: 0, discounts: 0, count: 0, total: 0 }
    };

    let totalSales = 0;
    let totalDiscounts = 0;
    let totalDeliveryFees = 0;

    shiftOrders.forEach((order: any) => {
      if (order.isRefunded) return;

      const type = order.orderType || 'dine-in';
      if (orderTypeBreakdown[type]) {
        orderTypeBreakdown[type].value += order.subtotal || 0;
        orderTypeBreakdown[type].count += 1;
        totalSales += order.subtotal || 0;
      }

      const orderDiscount = (order.promoDiscount || 0) + (order.loyaltyDiscount || 0);
      if (orderTypeBreakdown[type]) {
        orderTypeBreakdown[type].discounts += orderDiscount;
      }
      totalDiscounts += orderDiscount;

      totalDeliveryFees += order.deliveryFee || 0;
    });

    // Calculate totals per order type
    Object.keys(orderTypeBreakdown).forEach(type => {
      orderTypeBreakdown[type].total = orderTypeBreakdown[type].value - orderTypeBreakdown[type].discounts;
    });

    // Fetch menu items from IndexedDB to get category information
    const menuItems = await indexedDBStorage.getAllMenuItems();
    const menuItemCategoryMap = new Map<string, string>();

    console.log('[Shift Closing Receipt] Loaded', menuItems.length, 'menu items from IndexedDB for offline report');

    menuItems.forEach((menuItem: any) => {
      if (menuItem.id && menuItem.categoryRel) {
        menuItemCategoryMap.set(menuItem.id, menuItem.categoryRel.name);
      }
    });

    console.log('[Shift Closing Receipt] Built category map for', menuItemCategoryMap.size, 'menu items (offline)');

    // Group items by category
    const categoryMap = new Map<string, {
      categoryName: string;
      totalSales: number;
      items: Map<string, {
        itemId: string;
        itemName: string;
        quantity: number;
        totalPrice: number;
      }>;
    }>();

    shiftOrders.forEach((order: any) => {
      if (order.isRefunded) return;

      if (order.items) {
        order.items.forEach((item: any) => {
          // Get category from menu item map, fallback to item.menuItem.category, then 'Uncategorized'
          let category = menuItemCategoryMap.get(item.menuItemId);

          if (!category) {
            // Try to get from item.menuItem.category (if available)
            category = item.menuItem?.category;
          }

          if (!category) {
            // Try to get from item.categoryName (if available)
            category = item.categoryName;
          }

          if (!category) {
            // Fallback to 'Uncategorized'
            category = 'Uncategorized';
          }

          if (!categoryMap.has(category)) {
            categoryMap.set(category, {
              categoryName: category,
              totalSales: 0,
              items: new Map()
            });
          }

          const catData = categoryMap.get(category)!;
          catData.totalSales += item.subtotal || 0;

          const itemId = item.menuItemId + (item.menuItemVariantId ? `_${item.menuItemVariantId}` : '');
          const itemName = item.menuItemVariant?.variantOption?.name
            ? `${item.itemName} (${item.menuItemVariant.variantOption.name})`
            : item.itemName;

          if (!catData.items.has(itemId)) {
            catData.items.set(itemId, {
              itemId,
              itemName,
              quantity: 0,
              totalPrice: 0
            });
          }

          const itemData = catData.items.get(itemId)!;
          itemData.quantity += item.quantity || 0;
          itemData.totalPrice += item.subtotal || 0;
        });
      }
    });

    // Convert to array
    const categoryBreakdown = Array.from(categoryMap.values())
      .filter(cat => cat.totalSales > 0)
      .map(cat => ({
        categoryName: cat.categoryName,
        totalSales: cat.totalSales,
        items: Array.from(cat.items.values()).map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: item.quantity,
          totalPrice: item.totalPrice
        }))
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    // Get daily expenses from localStorage
    const totalDailyExpenses = 0; // Not tracked in localStorage yet

    // Calculate expected cash
    const expectedCash = (shift.openingCash || 0) + cash - totalDailyExpenses;
    const overShort = shift.closingCash ? shift.closingCash - expectedCash : 0;

    // Generate shift number
    const shiftNumber = shift.openingOrders || shift.closingOrders || shiftOrders.length || 1;

    // Create the full report data
    const report = {
      shift: {
        id: shift.id,
        shiftNumber,
        startTime: shift.startTime,
        endTime: shift.endTime || new Date().toISOString(),
        cashier: {
          name: shift.cashierName || 'Unknown',
          username: shift.cashierUsername || 'Unknown'
        },
        branch: {
          id: shift.branchId,
          branchName: shift.branchName || 'Unknown Branch'
        },
        openingCash: shift.openingCash || 0,
        closingCash: shift.closingCash || 0,
        openingOrders: shift.openingOrders || 0,
        closingOrders: shift.closingOrders || shiftOrders.length,
        openingRevenue: shift.openingRevenue || 0,
        closingRevenue: shift.closingRevenue || totalSales,
        notes: shift.notes
      },
      paymentSummary: {
        cash,
        card,
        instapay,
        wallet,
        other: 0,
        total: cash + card + instapay + wallet
      },
      orderTypeBreakdown,
      totals: {
        sales: totalSales,
        discounts: totalDiscounts,
        deliveryFees: totalDeliveryFees,
        refunds: 0,
        voidedItems: 0,
        card,
        instapay,
        wallet,
        cash,
        dailyExpenses: totalDailyExpenses,
        openingCashBalance: shift.openingCash || 0,
        expectedCash,
        closingCashBalance: shift.closingCash || 0,
        overShort
      },
      categoryBreakdown,
      voidedItems: [],
      refundedOrders: []
    };

    setFullReportData(report);

    // Transform to ShiftClosingReportData format
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
    console.log('[Shift Closing Receipt] Offline report generated successfully');
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
    const totalVoidedItems = fullReportData.totals.voidedItems || 0;
    const totalCard = fullReportData.totals.card || 0;
    const totalInstapay = fullReportData.totals.instapay || 0;
    const totalWallet = fullReportData.totals.wallet || 0;
    const totalCash = fullReportData.totals.cash || 0;
    const totalDailyExpenses = fullReportData.totals.dailyExpenses || 0;
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

    .notes-section {
      margin-top: 10px;
      padding: 5px;
      border: 1px solid #000;
    }

    .notes-title {
      font-weight: bold;
      margin-bottom: 5px;
    }

    .notes-content {
      font-size: 11px;
      line-height: 1.3;
      word-wrap: break-word;
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
      <span>-${formatCurrency(totalRefunds)}</span>
    </div>
    <div class="total-row">
      <span>Total Voided Items:</span>
      <span>-${formatCurrency(totalVoidedItems)}</span>
    </div>
    <div class="total-row">
      <span>Total Card:</span>
      <span>${formatCurrency(totalCard)}</span>
    </div>
    <div class="total-row">
      <span>Total InstaPay:</span>
      <span>${formatCurrency(totalInstapay)}</span>
    </div>
    <div class="total-row">
      <span>Total Wallet:</span>
      <span>${formatCurrency(totalWallet)}</span>
    </div>
    <div class="total-row">
      <span>Total Cash:</span>
      <span>${formatCurrency(totalCash)}</span>
    </div>
    <div class="total-row">
      <span>Total Daily Expenses:</span>
      <span>-${formatCurrency(totalDailyExpenses)}</span>
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

  ${fullReportData.shift.notes ? `
  <div class="notes-section">
    <div class="notes-title">Notes:</div>
    <div class="notes-content">${fullReportData.shift.notes}</div>
  </div>
  ` : ''}

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

  const printThermalPaper3 = () => {
    if (!fullReportData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cashierName = fullReportData.shift.cashier.name || fullReportData.shift.cashier.username;
    const dateStr = new Date(fullReportData.shift.startTime).toLocaleDateString();
    const timeStr = `${new Date(fullReportData.shift.startTime).toLocaleTimeString()} - ${new Date(fullReportData.shift.endTime).toLocaleTimeString()}`;

    const voidedItems = fullReportData.voidedItems || [];
    const refundedOrders = fullReportData.refundedOrders || [];

    let voidsHtml = '';
    if (voidedItems.length > 0) {
      voidsHtml = `
        <div style="margin-bottom: 10px;">
          <div style="font-weight: bold; margin-bottom: 5px; text-decoration: underline;">VOIDED ITEMS</div>
      `;

      voidedItems.forEach(item => {
        const voidedDate = new Date(item.voidedAt).toLocaleString();
        voidsHtml += `
          <div style="margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 5px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: bold;">${item.itemName}</span>
              <span style="font-weight: bold;">-${formatCurrency(item.voidedSubtotal)}</span>
            </div>
            <div style="font-size: 11px; margin-bottom: 1px;">Qty Voided: ${item.voidedQuantity} x ${formatCurrency(item.unitPrice)}</div>
            <div style="font-size: 11px; margin-bottom: 1px;">Order #${item.orderNumber}</div>
            <div style="font-size: 11px; margin-bottom: 1px;">Voided At: ${voidedDate}</div>
            <div style="font-size: 11px; margin-bottom: 1px;">Reason: ${item.reason}</div>
          </div>
        `;
      });

      voidsHtml += '</div>';
    }

    let refundsHtml = '';
    if (refundedOrders.length > 0) {
      refundsHtml = `
        <div style="margin-bottom: 10px;">
          <div style="font-weight: bold; margin-bottom: 5px; text-decoration: underline;">REFUNDS</div>
      `;

      refundedOrders.forEach(refund => {
        const refundedDate = new Date(refund.refundedAt).toLocaleString();
        refundsHtml += `
          <div style="margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 5px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: bold;">Order #${refund.orderNumber}</span>
              <span style="font-weight: bold;">-${formatCurrency(refund.refundAmount)}</span>
            </div>
            <div style="font-size: 11px; margin-bottom: 1px;">Refunded At: ${refundedDate}</div>
            <div style="font-size: 11px; margin-bottom: 1px;">Payment Method: ${refund.paymentMethod}</div>
            <div style="font-size: 11px; margin-bottom: 1px;">Reason: ${refund.refundReason}</div>
          </div>
        `;
      });

      refundsHtml += '</div>';
    }

    const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Shift Closing - Voids and Refunds</title>
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

    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      padding: 0;
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

    .section-divider {
      border-top: 2px dashed #000;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Emperor Coffee</h1>
    <div>${fullReportData.shift.branch.branchName}</div>
    <div>Shift Closing #${fullReportData.shift.shiftNumber}</div>
    <div>Voids & Refunds</div>
  </div>

  <div class="info">
    <div>Date: ${dateStr}</div>
    <div>Time: ${timeStr}</div>
    <div>Cashier: ${cashierName}</div>
  </div>

  <div style="border-top: 2px dashed #000; margin: 10px 0;"></div>

  ${voidsHtml}

  ${voidsHtml && refundsHtml ? '<div class="section-divider"></div>' : ''}

  ${refundsHtml}

  <div style="border-top: 2px dashed #000; margin: 10px 0;"></div>

  <div>
    <div class="total-row">
      <span>Total Voided Items:</span>
      <span>-${formatCurrency(fullReportData.totals.voidedItems || 0)}</span>
    </div>
    <div class="total-row">
      <span>Total Refunds:</span>
      <span>-${formatCurrency(fullReportData.totals.refunds || 0)}</span>
    </div>
    <div class="total-row grand-total">
      <span>Total Deductions:</span>
      <span>-${formatCurrency((fullReportData.totals.voidedItems || 0) + (fullReportData.totals.refunds || 0))}</span>
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 flex flex-col" style={{ height: '85vh' }}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>Shift Closing Receipt</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6" style={{ minHeight: 0 }}>
            {loading && (
              <div className="flex items-center justify-center py-8 px-6">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Loading shift data...</span>
              </div>
            )}

            {error && (
              <div className="px-6 py-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}

            {!loading && !error && data && (
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
                        {/* Card Payment Breakdown */}
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Methods</div>
                          <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                            <span className="font-semibold text-sm">Total Card:</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {formatCurrency(data.paymentSummary.card)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
                            <span className="font-semibold text-sm">Total InstaPay:</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">
                              {formatCurrency(data.paymentSummary.instapay)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                            <span className="font-semibold text-sm">Total Wallet:</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400">
                              {formatCurrency(data.paymentSummary.wallet)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                              <span className="font-semibold text-sm">Total Cash:</span>
                            </div>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(data.paymentSummary.cash)}
                            </span>
                          </div>
                        </div>

                        {/* Daily Expenses */}
                        {fullReportData && fullReportData.totals.dailyExpenses > 0 && (
                          <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-red-600 dark:text-red-400" />
                              <span className="font-semibold text-sm">Total Daily Expenses:</span>
                            </div>
                            <span className="font-bold text-red-600 dark:text-red-400">
                              -{formatCurrency(fullReportData.totals.dailyExpenses)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm">User:</span>
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

                {/* Paper 3: Voids and Refunds */}
                {fullReportData && (fullReportData.voidedItems?.length > 0 || fullReportData.refundedOrders?.length > 0) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <AlertCircle className="h-5 w-5" />
                            Paper 3: Voids & Refunds
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Voided items and refunds during shift #{data.shift.shiftNumber}
                          </CardDescription>
                        </div>
                        <Button
                          onClick={printThermalPaper3}
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
                      <div className="space-y-6">
                        {/* Voided Items Section */}
                        {fullReportData.voidedItems && fullReportData.voidedItems.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <X className="h-4 w-4 text-red-600" />
                              <span className="font-semibold text-sm text-red-600">
                                Voided Items ({fullReportData.voidedItems.length})
                              </span>
                            </div>
                            <div className="space-y-2">
                              {fullReportData.voidedItems.map((item, idx) => (
                                <div key={idx} className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">{item.itemName}</div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Order #{item.orderNumber}
                                      </div>
                                    </div>
                                    <div className="font-bold text-red-600 dark:text-red-400">
                                      -{formatCurrency(item.voidedSubtotal)}
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>Qty: {item.voidedQuantity} × {formatCurrency(item.unitPrice)}</span>
                                    <span>{new Date(item.voidedAt).toLocaleString()}</span>
                                  </div>
                                  {item.reason && (
                                    <div className="mt-2 text-xs bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">
                                      Reason: {item.reason}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Refunded Orders Section */}
                        {fullReportData.refundedOrders && fullReportData.refundedOrders.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <RefreshCw className="h-4 w-4 text-orange-600" />
                              <span className="font-semibold text-sm text-orange-600">
                                Refunded Orders ({fullReportData.refundedOrders.length})
                              </span>
                            </div>
                            <div className="space-y-2">
                              {fullReportData.refundedOrders.map((refund, idx) => (
                                <div key={idx} className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">Order #{refund.orderNumber}</div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Payment: {refund.paymentMethod}
                                      </div>
                                    </div>
                                    <div className="font-bold text-orange-600 dark:text-orange-400">
                                      -{formatCurrency(refund.refundAmount)}
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>Refunded: {new Date(refund.refundedAt).toLocaleString()}</span>
                                  </div>
                                  {refund.refundReason && (
                                    <div className="mt-2 text-xs bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">
                                      Reason: {refund.refundReason}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Totals Summary */}
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <span className="font-semibold text-sm">Total Voided Items:</span>
                            <span className="font-bold text-red-600">
                              -{formatCurrency(fullReportData.totals.voidedItems || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <span className="font-semibold text-sm">Total Refunds:</span>
                            <span className="font-bold text-orange-600">
                              -{formatCurrency(fullReportData.totals.refunds || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900 mt-2">
                            <span className="font-semibold text-sm">Total Deductions:</span>
                            <span className="font-bold text-red-600">
                              -{formatCurrency((fullReportData.totals.voidedItems || 0) + (fullReportData.totals.refunds || 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
