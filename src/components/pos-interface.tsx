'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Coffee, Cake, Cookie, IceCream, Trash2, Plus, Minus, CreditCard, DollarSign,
  Printer, ShoppingCart, Store, X, CheckCircle, Package, Truck,
  Search, User, Clock, MapPin, Phone, Star, Flame, Zap,
  TrendingUp, AlertTriangle, Grid, Filter, Menu as MenuIcon,
  Sparkles, Bell, Layers, Wallet, Calendar, Barcode, Receipt, Utensils,
  ChevronRight, Tag, Gift, ShoppingBag, RefreshCw, Check, Info,
  PanelLeftClose, PanelLeftOpen, Users, MessageSquare, Edit3, Smartphone, Pause, Play, Calculator, ArrowRight
} from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { formatCurrency } from '@/lib/utils';
import { ReceiptViewer } from '@/components/receipt-viewer';
import CustomerSearch from '@/components/customer-search';
import { NumberPad } from '@/components/ui/number-pad';
import { useOfflineData, offlineDataFetchers } from '@/hooks/use-offline-data';
import { useAutoSync } from '@/hooks/use-auto-sync';
import TableGridView from '@/components/table-grid-view';

// Helper function to create order offline
async function createOrderOffline(orderData: any, shift: any, cartItems: CartItem[]): Promise<any> {
  try {
    console.log('[Order] Creating order offline, orderData:', orderData);
    console.log('[Order] Cart items:', cartItems);

    // Import localStorageService
    const { getLocalStorageService } = await import('@/lib/storage/local-storage');
    const localStorageService = getLocalStorageService();
    console.log('[Order] localStorageService imported');

    // Initialize storage if not already initialized
    await localStorageService.init();
    console.log('[Order] localStorageService initialized');

    // Create a temporary order ID (will be replaced on sync)
    const tempId = `temp-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[Order] Created tempId:', tempId);

    // Get the last order number from local storage to generate a new one
    const allOrders = await localStorageService.getAllOrders();
    const lastOrderNum = allOrders.reduce((max: number, order: any) => {
      return order.orderNumber ? Math.max(max, order.orderNumber) : max;
    }, 0);

    // Prepare items in the format expected by the API
    const preparedItems = cartItems.map((cartItem) => {
      const unitPrice = cartItem.price || 0;
      const totalPrice = unitPrice * cartItem.quantity;

      return {
        menuItemId: cartItem.menuItemId,
        quantity: cartItem.quantity,
        menuItemVariantId: cartItem.variantId || null,
        customVariantValue: cartItem.customVariantValue || null,
        unitPrice,
        totalPrice,
        specialInstructions: cartItem.note || null,
      };
    });

    // Calculate total amount including tax
    const taxAmount = orderData.subtotal * (orderData.taxRate || 0.14);
    const totalAmount = orderData.total || (orderData.subtotal + taxAmount + (orderData.deliveryFee || 0) - (orderData.loyaltyDiscount || 0));

    // Generate transaction hash for tamper detection
    const transactionHash = Buffer.from(
      `${orderData.branchId}-${lastOrderNum + 1}-${totalAmount}-${orderData.cashierId || shift.cashierId}-${Date.now()}`
    ).toString('base64');

    // Create order object with fields matching API expectations
    const newOrder = {
      id: tempId,
      branchId: orderData.branchId,
      orderNumber: lastOrderNum + 1,
      customerId: orderData.customerId || null,
      orderType: orderData.orderType,
      totalAmount,
      subtotal: orderData.subtotal, // Store subtotal at top level for shift revenue calculation
      deliveryFee: orderData.deliveryFee || 0, // Store deliveryFee at top level for shift revenue calculation
      status: 'completed' as const, // Use correct Prisma enum value
      paymentStatus: 'paid' as const, // Use correct Prisma enum value
      paymentMethod: orderData.paymentMethod,
      paymentMethodDetail: orderData.paymentMethodDetail || null,
      cardReferenceNumber: orderData.cardReferenceNumber || null,
      notes: orderData.notes || null,
      orderTimestamp: new Date().toISOString(), // Set orderTimestamp for receipt
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Include shift ID to associate order with the shift
      shiftId: shift.id,
      // Include transaction hash for tamper detection
      transactionHash,
      // Store additional fields that will be synced separately
      _offlineData: {
        items: preparedItems,
        subtotal: orderData.subtotal,
        taxRate: orderData.taxRate,
        tax: taxAmount,
        deliveryFee: orderData.deliveryFee || 0,
        loyaltyPointsRedeemed: orderData.loyaltyPointsRedeemed || 0,
        loyaltyDiscount: orderData.loyaltyDiscount || 0,
        deliveryAddress: orderData.deliveryAddress || null,
        deliveryAreaId: orderData.deliveryAreaId || null,
        courierId: orderData.courierId || null,
        customerAddressId: orderData.customerAddressId || null,
        customerPhone: orderData.customerPhone || null,
        customerName: orderData.customerName || null,
      },
    };

    console.log('[Order] Created order object:', newOrder);

    // Save order to IndexedDB
    await localStorageService.saveOrder(newOrder);
    console.log('[Order] Order saved to IndexedDB');

    // Update shift statistics
    if (shift && shift.id) {
      console.log('[Order] Updating shift statistics for shift:', shift.id);

      // Get all shifts from IndexedDB and find the current one
      const allShifts = await localStorageService.getAllShifts();
      const currentShift = allShifts.find((s: any) => s.id === shift.id);

      if (currentShift) {
        // Update shift statistics
        // Use subtotal for currentRevenue (excludes delivery fees - couriers take them)
        const updatedShift = {
          ...currentShift,
          currentRevenue: (currentShift.currentRevenue || 0) + (orderData.subtotal || 0),
          orderCount: (currentShift.orderCount || 0) + 1,
          currentOrders: (currentShift.currentOrders || 0) + 1,
          updatedAt: new Date().toISOString(),
        };

        // Save updated shift to IndexedDB
        await localStorageService.saveShift(updatedShift);
        console.log('[Order] Shift statistics updated:', updatedShift);

        // Update the local shift object reference
        Object.assign(shift, updatedShift);
      } else {
        console.warn('[Order] Could not find shift in IndexedDB:', shift.id);
      }
    }

    // Queue operation for sync
    await localStorageService.addOperation({
      type: 'CREATE_ORDER',
      data: {
        ...orderData,
        id: tempId,
        orderNumber: newOrder.orderNumber,
        status: newOrder.status,
        totalAmount,
        subtotal: orderData.subtotal, // Include subtotal for sync
        deliveryFee: orderData.deliveryFee || 0, // Include deliveryFee for sync
        paymentStatus: 'paid',
        notes: newOrder.notes,
        transactionHash, // Include transaction hash for sync
        items: preparedItems,
        _offlineData: newOrder._offlineData, // Include _offlineData for sync
        createdAt: newOrder.createdAt,
        updatedAt: newOrder.updatedAt,
      },
      branchId: orderData.branchId,
      retryCount: 0,
    });
    console.log('[Order] Operation queued for sync');

    console.log('[Order] Order created offline successfully:', newOrder);
    return { order: newOrder, success: true };
  } catch (error) {
    console.error('[Order] Failed to create order offline, error:', error);
    throw error;
  }
}

interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  variantName?: string;
  variantId?: string;
  customVariantValue?: number;
  note?: string;
}

interface MenuItemVariant {
  id: string;
  menuItemId: string;
  variantTypeId: string;
  variantOptionId: string;
  priceModifier: number;
  sortOrder: number;
  isActive: boolean;
  variantType: {
    id: string;
    name: string;
    isCustomInput: boolean;
  };
  variantOption: {
    id: string;
    name: string;
  };
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  categoryId?: string | null;
  price: number;
  isActive: boolean;
  hasVariants: boolean;
  imagePath?: string;
  variants?: MenuItemVariant[];
}

interface Category {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  defaultVariantTypeId?: string | null;
}

export default function POSInterface() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [orderType, setOrderType] = useState<'dine-in' | 'take-away' | 'delivery'>('take-away');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [deliveryAreas, setDeliveryAreas] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>('none');
  const [lastOrderNumber, setLastOrderNumber] = useState<number>(0);
  const [processing, setProcessing] = useState(false);

  // Loyalty redemption state
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<number>(0);

  // Promo code state
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoCodeId, setPromoCodeId] = useState<string>('');
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<string>('');
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Categories expanded state
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);

  // Variant selection dialog state
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [selectedItemForVariant, setSelectedItemForVariant] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuItemVariant | null>(null);
  const [customVariantValue, setCustomVariantValue] = useState<string>('');

  // Add New Address dialog state
  const [showAddAddressDialog, setShowAddAddressDialog] = useState(false);
  const [newAddress, setNewAddress] = useState({
    building: '',
    streetAddress: '',
    floor: '',
    apartment: '',
    deliveryAreaId: '',
  });
  const [creatingAddress, setCreatingAddress] = useState(false);

  // Mobile cart drawer state
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Table management state for Dine In
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [tableCart, setTableCart] = useState<CartItem[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Card payment confirmation dialog state
  const [showCardPaymentDialog, setShowCardPaymentDialog] = useState(false);
  const [cardReferenceNumber, setCardReferenceNumber] = useState('');
  const [paymentMethodDetail, setPaymentMethodDetail] = useState<'CARD' | 'INSTAPAY' | 'MOBILE_WALLET'>('CARD');

  // Item note dialog state
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [editingQuantity, setEditingQuantity] = useState(1);

  // Daily Expenses dialog state
  const [showDailyExpenseDialog, setShowDailyExpenseDialog] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');
  const [currentDailyExpenses, setCurrentDailyExpenses] = useState<number>(0);
  const [loadingDailyExpenses, setLoadingDailyExpenses] = useState(false);

  // Hold Orders state
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [showHeldOrdersDialog, setShowHeldOrdersDialog] = useState(false);

  // Number Pad state
  const [showNumberPad, setShowNumberPad] = useState(false);
  const [numberPadValue, setNumberPadValue] = useState('');
  const [numberPadCallback, setNumberPadCallback] = useState<((value: string) => void) | null>(null);

  // Table Item Transfer state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferItems, setTransferItems] = useState<Record<string, number>>({});
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [availableTables, setAvailableTables] = useState<any[]>([]);

  const { currency, t } = useI18n();
  const { data: categoriesData, loading: categoriesLoading } = useOfflineData(
    '/api/categories?active=true',
    {
      fetchFromDB: offlineDataFetchers.categories,
    }
  );

  const { data: menuItemsData, loading: menuItemsLoading, refetch: refetchMenuItems } = useOfflineData(
    '/api/menu-items?active=true&includeVariants=true',
    {
      fetchFromDB: offlineDataFetchers.menuItems,
    }
  );

  const { data: branchesData } = useOfflineData(
    '/api/branches',
    {
      fetchFromDB: offlineDataFetchers.branches,
    }
  );

  const { data: deliveryAreasData } = useOfflineData(
    '/api/delivery-areas',
    {
      fetchFromDB: offlineDataFetchers.deliveryAreas,
    }
  );

  const { data: couriersData } = useOfflineData(
    '',
    {
      fetchFromDB: offlineDataFetchers.couriers,
      enabled: !!user?.branchId,
      deps: [selectedBranch, user?.branchId, user?.role],
    }
  );

  // Update local state when data changes
  useEffect(() => {
    if (categoriesData && Array.isArray(categoriesData)) {
      setCategories(categoriesData);
    }
  }, [categoriesData]);

  useEffect(() => {
    if (menuItemsData && Array.isArray(menuItemsData)) {
      setMenuItems(menuItemsData);
      setLoading(false);
    } else if (!menuItemsLoading) {
      setLoading(false);
    }
  }, [menuItemsData, menuItemsLoading]);

  // Update branches from offline data
  useEffect(() => {
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
      setBranches(branchesList);
    }
  }, [branchesData]);

  // Update delivery areas from offline data
  useEffect(() => {
    if (deliveryAreasData) {
      const areas = Array.isArray(deliveryAreasData) 
        ? deliveryAreasData 
        : (deliveryAreasData.areas || []);
      setDeliveryAreas(areas);
    }
  }, [deliveryAreasData]);

  // Update couriers from offline data
  useEffect(() => {
    if (couriersData && user) {
      const branchId = user?.role === 'ADMIN' ? selectedBranch : user?.branchId;
      if (!branchId) {
        setCouriers([]);
        return;
      }
      const allCouriers = Array.isArray(couriersData) ? couriersData : [];
      const filtered = allCouriers.filter((c: any) => 
        c.branchId === branchId && c.isActive
      );
      setCouriers(filtered);
    }
  }, [couriersData, selectedBranch, user?.branchId, user?.role]);

  // Fetch branches (fallback if offline data not available)
  useEffect(() => {
    if (branchesData) return; // Already have data from offline hook

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

  // Fetch delivery areas (fallback if offline data not available)
  useEffect(() => {
    if (deliveryAreasData) return; // Already have data from offline hook

    const fetchDeliveryAreas = async () => {
      try {
        const response = await fetch('/api/delivery-areas');
        const data = await response.json();
        if (response.ok && data.areas) {
          setDeliveryAreas(data.areas);
        }
      } catch (error) {
        console.error('Failed to fetch delivery areas:', error);
      }
    };
    fetchDeliveryAreas();
  }, [deliveryAreasData]);

  // Fetch couriers (fallback if offline data not available)
  useEffect(() => {
    if (couriersData) return; // Already have data from offline hook

    const fetchCouriers = async () => {
      try {
        const branchId = user?.role === 'ADMIN' ? selectedBranch : user?.branchId;
        if (!branchId) {
          setCouriers([]);
          return;
        }
        const response = await fetch(`/api/couriers?branchId=${branchId}`);
        const data = await response.json();
        if (response.ok && data.couriers) {
          setCouriers(data.couriers.filter((c: any) => c.isActive));
        }
      } catch (error) {
        console.error('Failed to fetch couriers:', error);
      }
    };
    fetchCouriers();
  }, [couriersData, selectedBranch, user?.branchId, user?.role]);

  // Load user on mount
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  // Refresh shift when window/tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.role === 'CASHIER') {
        const fetchCurrentShift = async () => {
          try {
            const branchId = user.branchId;
            if (!branchId) {
              setCurrentShift(null);
              return;
            }
            const params = new URLSearchParams({
              branchId,
              cashierId: user.id,
              status: 'open',
            });
            const response = await fetch(`/api/shifts?${params.toString()}`);
            const data = await response.json();
            if (response.ok && data.shifts && data.shifts.length > 0) {
              setCurrentShift(data.shifts[0]);
            } else {
              setCurrentShift(null);
            }
          } catch (error) {
            console.error('Failed to refresh shift on tab visibility:', error);
          }
        };
        fetchCurrentShift();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, user?.branchId]);

  // Set default branch for admin
  useEffect(() => {
    if (user?.role === 'ADMIN' && branches.length > 0 && !selectedBranch) {
      setSelectedBranch(branches[0].id);
    }
  }, [user, branches, selectedBranch]);

  // Auto-sync when connection is restored
  const currentBranchId = user?.role === 'CASHIER' ? user?.branchId : selectedBranch;
  useAutoSync(currentBranchId);

  // Fetch current shift for cashiers
  useEffect(() => {
    const fetchCurrentShift = async () => {
      if (!user || user.role !== 'CASHIER') {
        setCurrentShift(null);
        return;
      }
      const branchId = user.role === 'CASHIER' ? user.branchId : selectedBranch;
      if (!branchId) {
        setCurrentShift(null);
        return;
      }
      try {
        const params = new URLSearchParams({
          branchId,
          cashierId: user.id,
          status: 'open',
        });
        const response = await fetch(`/api/shifts?${params.toString()}`);
        const data = await response.json();
        if (response.ok && data.shifts && data.shifts.length > 0) {
          setCurrentShift(data.shifts[0]);
        } else {
          // API failed or no shift found - check IndexedDB for offline shift
          const { getLocalStorageService } = await import('@/lib/storage/local-storage');
          const localStorageService = getLocalStorageService();
          await localStorageService.init();
          const allShifts = await localStorageService.getAllShifts();
          
          // Find open shift for this cashier and branch
          const offlineShift = allShifts.find(
            (s: any) => 
              s.cashierId === user.id && 
              s.branchId === branchId && 
              !s.isClosed
          );
          
          if (offlineShift) {
            console.log('[POS] Using offline shift:', offlineShift);
            setCurrentShift(offlineShift);
          } else {
            setCurrentShift(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch current shift, trying offline:', error);
        
        // On error, check IndexedDB
        try {
          const { getLocalStorageService } = await import('@/lib/storage/local-storage');
          const localStorageService = getLocalStorageService();
          await localStorageService.init();
          const allShifts = await localStorageService.getAllShifts();
          
          const offlineShift = allShifts.find(
            (s: any) => 
              s.cashierId === user.id && 
              s.branchId === branchId && 
              !s.isClosed
          );
          
          if (offlineShift) {
            setCurrentShift(offlineShift);
          } else {
            setCurrentShift(null);
          }
        } catch (dbError) {
          console.error('Failed to fetch offline shift:', dbError);
          setCurrentShift(null);
        }
      }
    };
    fetchCurrentShift();
  }, [user, user?.branchId, selectedBranch]);

  // Fetch daily expenses for current shift
  useEffect(() => {
    const fetchDailyExpenses = async () => {
      if (!currentShift?.id) {
        setCurrentDailyExpenses(0);
        return;
      }
      
      setLoadingDailyExpenses(true);
      try {
        const response = await fetch(`/api/daily-expenses?shiftId=${currentShift.id}`);
        const data = await response.json();
        if (response.ok && data.expenses) {
          const total = data.expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
          setCurrentDailyExpenses(total);
        } else {
          setCurrentDailyExpenses(0);
        }
      } catch (error) {
        console.error('Failed to fetch daily expenses:', error);
        setCurrentDailyExpenses(0);
      } finally {
        setLoadingDailyExpenses(false);
      }
    };
    fetchDailyExpenses();
  }, [currentShift?.id]);

  // Fetch low stock alerts
  useEffect(() => {
    const fetchLowStockAlerts = async () => {
      const branchId = user?.role === 'ADMIN' ? selectedBranch : user?.branchId;
      if (!branchId) {
        setLowStockAlerts([]);
        return;
      }
      try {
        const response = await fetch(`/api/inventory/low-stock?branchId=${branchId}`);
        const data = await response.json();
        if (response.ok && data.alerts) {
          setLowStockAlerts(data.alerts);
        }
      } catch (error) {
        console.error('Failed to fetch low stock alerts:', error);
      }
    };
    fetchLowStockAlerts();
  }, [selectedBranch, user?.branchId, user?.role]);

  // Auto-fill delivery info when address is selected
  useEffect(() => {
    if (selectedAddress) {
      const parts = [];
      if (selectedAddress.building) parts.push(selectedAddress.building);
      parts.push(selectedAddress.streetAddress);
      if (selectedAddress.floor) parts.push(`${selectedAddress.floor} Floor`);
      if (selectedAddress.apartment) parts.push(`Apt ${selectedAddress.apartment}`);
      setDeliveryAddress(parts.join(', '));
      if (selectedAddress.deliveryAreaId) {
        setDeliveryArea(selectedAddress.deliveryAreaId);
      }
    }
  }, [selectedAddress]);

  // Reset selected courier when order type changes
  useEffect(() => {
    if (orderType !== 'delivery') {
      setSelectedCourierId('none');
    }
  }, [orderType]);

  // Show table grid when switching to Dine In
  useEffect(() => {
    if (orderType === 'dine-in' && !selectedTable) {
      setShowTableGrid(true);
    } else if (orderType !== 'dine-in') {
      setShowTableGrid(false);
      setSelectedTable(null);
    }
  }, [orderType, selectedTable]);

  // Filter menu items by category and search
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || 
                            item.categoryId === selectedCategory ||
                            item.category === selectedCategory;
      const matchesSearch = searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const getCategoryColor = (categoryName: string): string => {
    const name = categoryName.toLowerCase();
    const colors = {
      coffee: 'from-amber-500 to-orange-600',
      hot: 'from-red-500 to-pink-600',
      ice: 'from-cyan-500 to-blue-600',
      cold: 'from-blue-500 to-indigo-600',
      cake: 'from-pink-500 to-rose-600',
      pastry: 'from-purple-500 to-violet-600',
      snack: 'from-yellow-500 to-amber-600',
      food: 'from-orange-500 to-red-600',
      bean: 'from-green-500 to-emerald-600',
    };
    for (const [key, color] of Object.entries(colors)) {
      if (name.includes(key)) return color;
    }
    return 'from-emerald-500 to-teal-600';
  };

  const allCategories = useMemo(() => {
    const cats = [
      { id: 'all', name: 'All Products', color: 'from-slate-600 to-slate-700' },
      ...categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        color: getCategoryColor(cat.name),
      }))
    ];
    return cats;
  }, [categories]);

  const handleItemClick = (item: MenuItem) => {
    if (item.hasVariants && item.variants && item.variants.length > 0) {
      setSelectedItemForVariant(item);
      setCustomVariantValue('');
      
      // Auto-select custom input variant if present
      const customInputVariant = item.variants.find(v => v.variantType.isCustomInput);
      if (customInputVariant) {
        setSelectedVariant(customInputVariant);
      } else {
        setSelectedVariant(null);
      }
      
      setVariantDialogOpen(true);
    } else {
      addToCart(item, null);
    }
  };

  const addToCart = (item: MenuItem, variant: MenuItemVariant | null, note?: string) => {
    const uniqueId = note
      ? `${variant ? `${item.id}-${variant.id}` : item.id}-note-${btoa(note).slice(0, 8)}`
      : (variant ? `${item.id}-${variant.id}` : item.id);
    const finalPrice = variant ? item.price + variant.priceModifier : item.price;
    const variantName = variant ? `${variant.variantType.name}: ${variant.variantOption.name}` : undefined;

    const cartItem = {
      id: uniqueId,
      menuItemId: item.id,
      name: item.name,
      price: finalPrice,
      quantity: 1,
      variantName,
      variantId: variant?.id,
      note: note || undefined,
    };

    // If dine-in with table selected, add to table cart
    if (orderType === 'dine-in' && selectedTable) {
      setTableCart((prevCart) => {
        const existingItem = prevCart.find((i) => i.id === uniqueId);
        if (existingItem) {
          return prevCart.map((i) =>
            i.id === uniqueId ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prevCart, cartItem];
      });

      // Save to localStorage for persistence
      const updatedCart = tableCart.some(i => i.id === uniqueId)
        ? tableCart.map((i) => i.id === uniqueId ? { ...i, quantity: i.quantity + 1 } : i)
        : [...tableCart, cartItem];

      localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify(updatedCart));
    } else {
      // Regular cart for other order types
      setCart((prevCart) => {
        const existingItem = prevCart.find((i) => i.id === uniqueId);
        if (existingItem) {
          return prevCart.map((i) =>
            i.id === uniqueId ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prevCart, cartItem];
      });
    }
  };

  const handleVariantConfirm = () => {
    if (selectedItemForVariant) {
      if (selectedVariant?.variantType.isCustomInput) {
        // For custom input variants, calculate price dynamically
        const multiplier = parseFloat(customVariantValue);
        if (isNaN(multiplier) || multiplier <= 0) {
          alert('Please enter a valid multiplier (e.g., 0.125 for 1/8)');
          return;
        }

        const finalPrice = selectedItemForVariant.price * multiplier;
        const variantName = `${selectedVariant.variantType.name}: ${multiplier}x`;

        const uniqueId = `${selectedItemForVariant.id}-${selectedVariant.id}-${multiplier}`;
        const cartItem = {
          id: uniqueId,
          menuItemId: selectedItemForVariant.id,
          name: selectedItemForVariant.name,
          price: finalPrice,
          quantity: 1,
          variantName,
          variantId: selectedVariant.id,
          customVariantValue: multiplier,
        };

        if (orderType === 'dine-in' && selectedTable) {
          setTableCart((prevCart) => [...prevCart, cartItem]);
          localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify([...tableCart, cartItem]));
        } else {
          setCart((prevCart) => [...prevCart, cartItem]);
        }
      } else if (selectedVariant) {
        // For regular variants
        addToCart(selectedItemForVariant, selectedVariant);
      }

      setVariantDialogOpen(false);
      setSelectedItemForVariant(null);
      setSelectedVariant(null);
      setCustomVariantValue('');
    }
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    if (orderType === 'dine-in' && selectedTable) {
      setTableCart((prevCart) => {
        const updated = prevCart
          .map((item) =>
            item.id === itemId ? { ...item, quantity: newQuantity } : item
          )
          .filter((item) => item.quantity > 0);

        // Save to localStorage
        localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify(updated));
        return updated;
      });
    } else {
      setCart((prevCart) =>
        prevCart
          .map((item) =>
            item.id === itemId ? { ...item, quantity: newQuantity } : item
          )
          .filter((item) => item.quantity > 0)
      );
    }
  };

  const handleIncrementQuantity = (itemId: string) => {
    const currentCart = (orderType === 'dine-in' && selectedTable) ? tableCart : cart;
    const item = currentCart.find(i => i.id === itemId);
    if (item) {
      updateQuantity(itemId, item.quantity + 1);
    }
  };

  const handleDecrementQuantity = (itemId: string) => {
    const currentCart = (orderType === 'dine-in' && selectedTable) ? tableCart : cart;
    const item = currentCart.find(i => i.id === itemId);
    if (item && item.quantity > 1) {
      updateQuantity(itemId, item.quantity - 1);
    }
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    console.log('[handleQuantityChange] itemId:', itemId, 'value:', value);
    const numValue = parseInt(value);
    console.log('[handleQuantityChange] parsed numValue:', numValue, 'isValid:', !isNaN(numValue) && numValue >= 1);
    if (!isNaN(numValue) && numValue >= 1) {
      updateQuantity(itemId, numValue);
    }
  };

  const openNoteDialog = (item: CartItem) => {
    setEditingItem(item);
    setEditingNote(item.note || '');
    setEditingQuantity(item.quantity);
    setShowNoteDialog(true);
  };

  const handleSaveNote = () => {
    if (!editingItem) return;

    const menuItem = menuItems.find(m => m.id === editingItem.menuItemId);
    const variant = menuItem?.variants?.find(v => v.id === editingItem.variantId);

    if (orderType === 'dine-in' && selectedTable) {
      setTableCart((prevCart) => {
        // Remove the old item
        const filtered = prevCart.filter((i) => i.id !== editingItem.id);
        
        // If quantity is 0 or note was cleared and no variant, don't add back
        if (editingQuantity === 0 || (!editingNote.trim() && !editingItem.variantId)) {
          localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify(filtered));
          return filtered;
        }

        // Create new unique ID based on note
        const newUniqueId = editingNote.trim()
          ? `${editingItem.menuItemId}-${editingItem.variantId || 'no-variant'}-note-${btoa(editingNote.trim()).slice(0, 8)}`
          : (editingItem.variantId ? `${editingItem.menuItemId}-${editingItem.variantId}` : editingItem.menuItemId);

        const updatedItem = {
          ...editingItem,
          id: newUniqueId,
          quantity: editingQuantity,
          note: editingNote.trim() || undefined,
        };

        const updated = [...filtered, updatedItem];
        localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify(updated));
        return updated;
      });
    } else {
      setCart((prevCart) => {
        const filtered = prevCart.filter((i) => i.id !== editingItem.id);
        
        if (editingQuantity === 0 || (!editingNote.trim() && !editingItem.variantId)) {
          return filtered;
        }

        const newUniqueId = editingNote.trim()
          ? `${editingItem.menuItemId}-${editingItem.variantId || 'no-variant'}-note-${btoa(editingNote.trim()).slice(0, 8)}`
          : (editingItem.variantId ? `${editingItem.menuItemId}-${editingItem.variantId}` : editingItem.menuItemId);

        const updatedItem = {
          ...editingItem,
          id: newUniqueId,
          quantity: editingQuantity,
          note: editingNote.trim() || undefined,
        };

        return [...filtered, updatedItem];
      });
    }

    setShowNoteDialog(false);
    setEditingItem(null);
    setEditingNote('');
    setEditingQuantity(1);
  };


  const removeFromCart = (itemId: string) => {
    if (orderType === 'dine-in' && selectedTable) {
      setTableCart((prevCart) => {
        const updated = prevCart.filter((item) => item.id !== itemId);
        localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify(updated));
        return updated;
      });
    } else {
      setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
    }
  };

  const clearCart = () => {
    if (orderType === 'dine-in' && selectedTable) {
      setTableCart([]);
      localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify([]));
    } else {
      setCart([]);
    }
    setRedeemedPoints(0);
    setLoyaltyDiscount(0);
    handleClearPromoCode();
  };

  // Table handling functions
  const handleTableSelect = (table: any) => {
    setSelectedTable(table);
    setShowTableGrid(false);

    // Load existing table cart from localStorage if table has items
    const storedTableCart = localStorage.getItem(`table-cart-${table.id}`);
    if (storedTableCart) {
      setTableCart(JSON.parse(storedTableCart));
    } else {
      setTableCart([]);
    }
  };

  const handleDeselectTable = () => {
    // Save current table cart before deselecting
    if (selectedTable) {
      localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify(tableCart));
    }

    setSelectedTable(null);
    setShowTableGrid(true);
    setTableCart([]);
  };

  // Transfer Items handlers
  const handleOpenTransferDialog = async () => {
    if (!selectedTable) return;

    const branchId = user?.role === 'CASHIER' ? user?.branchId : selectedBranch;
    if (!branchId) return;

    try {
      const response = await fetch(`/api/tables?branchId=${branchId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter only OCCUPIED tables (excluding current table)
        const occupiedTables = (data.tables || []).filter(
          (t: any) => t.status === 'OCCUPIED' && t.id !== selectedTable.id
        );
        setAvailableTables(occupiedTables);

        if (occupiedTables.length === 0) {
          alert('No other occupied tables available for transfer');
          return;
        }

        // Initialize transfer items with current quantities
        const initialTransferItems: Record<string, number> = {};
        tableCart.forEach(item => {
          initialTransferItems[item.id] = 0;
        });
        setTransferItems(initialTransferItems);
        setTargetTableId('');
        setShowTransferDialog(true);
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      alert('Failed to load available tables');
    }
  };

  const handleTransferItems = () => {
    if (!selectedTable || !targetTableId) {
      alert('Please select a target table');
      return;
    }

    // Validate at least one item is selected
    const itemsToTransfer = Object.entries(transferItems).filter(([_, qty]) => qty > 0);
    if (itemsToTransfer.length === 0) {
      alert('Please select at least one item to transfer');
      return;
    }

    // Validate quantities
    for (const [itemId, qty] of itemsToTransfer) {
      const item = tableCart.find(i => i.id === itemId);
      if (!item || qty > item.quantity) {
        alert(`Invalid quantity for ${item?.name || 'item'}`);
        return;
      }
    }

    if (!confirm(`Transfer ${itemsToTransfer.length} item(s) to Table ${availableTables.find(t => t.id === targetTableId)?.tableNumber}?`)) {
      return;
    }

    // Perform transfer
    try {
      const sourceCart = [...tableCart];
      const targetCartKey = `table-cart-${targetTableId}`;
      const targetCartJson = localStorage.getItem(targetCartKey);
      let targetCart: CartItem[] = targetCartJson ? JSON.parse(targetCartJson) : [];

      itemsToTransfer.forEach(([itemId, qty]) => {
        const sourceItem = sourceCart.find(i => i.id === itemId);
        if (!sourceItem) return;

        // Check if item exists in target cart
        const targetItem = targetCart.find(t =>
          t.menuItemId === sourceItem.menuItemId &&
          t.variantId === sourceItem.variantId &&
          t.note === sourceItem.note &&
          t.customVariantValue === sourceItem.customVariantValue
        );

        if (targetItem) {
          // Update existing item
          targetItem.quantity += qty;
        } else {
          // Add new item
          targetCart.push({
            ...sourceItem,
            quantity: qty,
          });
        }

        // Update or remove from source cart
        if (qty >= sourceItem.quantity) {
          // Remove item completely
          const idx = sourceCart.findIndex(i => i.id === itemId);
          if (idx > -1) sourceCart.splice(idx, 1);
        } else {
          // Update quantity
          sourceItem.quantity -= qty;
        }
      });

      // Save both carts
      setTableCart(sourceCart);
      localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify(sourceCart));
      localStorage.setItem(targetCartKey, JSON.stringify(targetCart));

      setShowTransferDialog(false);
      setTransferItems({});
      setTargetTableId('');
      alert('Items transferred successfully!');
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Failed to transfer items');
    }
  };

  const handleTransferQuantityChange = (itemId: string, value: number) => {
    setTransferItems(prev => ({
      ...prev,
      [itemId]: Math.max(0, value),
    }));
  };

  const handleSetMaxQuantity = (itemId: string) => {
    const item = tableCart.find(i => i.id === itemId);
    if (item) {
      setTransferItems(prev => ({
        ...prev,
        [itemId]: item.quantity,
      }));
    }
  };

  const handleCloseTable = async () => {
    if (!selectedTable) return;

    if (tableCart.length === 0) {
      if (confirm(`Table ${selectedTable.tableNumber} has no items. Close it anyway?`)) {
        // Just close the table without creating an order
        await closeTableInDB();
      }
      return;
    }

    // Show payment dialog
    setShowPaymentDialog(true);
  };

  const handlePaymentSelect = async (paymentMethod: 'cash' | 'card') => {
    if (paymentMethod === 'cash') {
      // Process cash payment immediately
      setShowPaymentDialog(false);
      await createTableOrder('cash');
    } else {
      // For card payments, show card payment dialog to select payment method detail
      setShowPaymentDialog(false);
      setCardReferenceNumber('');
      setPaymentMethodDetail('CARD');
      setShowCardPaymentDialog(true);
    }
  };

  const closeTableInDB = async (skipDeselect: boolean = false) => {
    if (!selectedTable) return;

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        alert('User not logged in');
        return;
      }

      const user = JSON.parse(userStr);

      const response = await fetch(`/api/tables/${selectedTable.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId: user.id,
        }),
      });

      if (response.ok) {
        // Clear table cart from localStorage (only if not already cleared)
        if (localStorage.getItem(`table-cart-${selectedTable.id}`)) {
          localStorage.removeItem(`table-cart-${selectedTable.id}`);
        }
        if (!skipDeselect) {
          alert(`Table ${selectedTable.tableNumber} closed successfully`);
          handleDeselectTable();
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to close table');
      }
    } catch (error) {
      console.error('Failed to close table:', error);
      alert('Failed to close table');
    }
  };

  const createTableOrder = async (paymentMethod: 'cash' | 'card') => {
    if (!selectedTable || tableCart.length === 0) return;

    setProcessing(true);

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        alert('User not logged in');
        setProcessing(false);
        return;
      }

      const user = JSON.parse(userStr);

      const branchId = user?.role === 'CASHIER' ? user?.branchId : selectedBranch;
      if (!branchId) {
        alert('Branch not found');
        setProcessing(false);
        return;
      }

      // Calculate totals
      const subtotal = tableCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const total = subtotal; // No delivery fee for dine-in

      // Prepare order items
      const orderItems = tableCart.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        menuItemVariantId: item.variantId || null,
        customVariantValue: item.customVariantValue || null,
        specialInstructions: item.note || null,
      }));

      const orderData: any = {
        branchId,
        orderType: 'dine-in',
        items: orderItems,
        subtotal,
        taxRate: 0.14,
        total,
        paymentMethod,
        cashierId: user?.id,
        tableId: selectedTable.id,
        shiftId: currentShift?.id,
      };

      // Try API first
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Show receipt
        setReceiptData(data.order);
        setShowReceipt(true);

        // Clear table cart and close table
        localStorage.removeItem(`table-cart-${selectedTable.id}`);
        setTableCart([]);

        // Close the table in DB (skip deselect to avoid re-saving cart)
        await closeTableInDB(true);

        // Manually deselect table and show table grid
        setSelectedTable(null);
        setShowTableGrid(true);
      } else {
        const errorMessage = data.error || data.details || 'Failed to create order';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to create table order:', error);
      alert(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const createTableOrderWithCard = async (cardRefNumber: string, paymentMethodDetailParam: 'CARD' | 'INSTAPAY' | 'MOBILE_WALLET') => {
    if (!selectedTable || tableCart.length === 0) return;

    setProcessing(true);

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        alert('User not logged in');
        setProcessing(false);
        return;
      }

      const user = JSON.parse(userStr);

      const branchId = user?.role === 'CASHIER' ? user?.branchId : selectedBranch;
      if (!branchId) {
        alert('Branch not found');
        setProcessing(false);
        return;
      }

      // Calculate totals
      const subtotal = tableCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const total = subtotal; // No delivery fee for dine-in

      // Prepare order items
      const orderItems = tableCart.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        menuItemVariantId: item.variantId || null,
        customVariantValue: item.customVariantValue || null,
        specialInstructions: item.note || null,
      }));

      const orderData: any = {
        branchId,
        orderType: 'dine-in',
        items: orderItems,
        subtotal,
        taxRate: 0.14,
        total,
        paymentMethod: 'card',
        cardReferenceNumber: cardRefNumber,
        paymentMethodDetail: paymentMethodDetailParam,
        cashierId: user?.id,
        tableId: selectedTable.id,
        shiftId: currentShift?.id,
      };

      // Try API first
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Show receipt
        setReceiptData(data.order);
        setShowReceipt(true);

        // Clear table cart and close table
        localStorage.removeItem(`table-cart-${selectedTable.id}`);
        setTableCart([]);

        // Close the table in DB (skip deselect to avoid re-saving cart)
        await closeTableInDB(true);

        // Manually deselect table and show table grid
        setSelectedTable(null);
        setShowTableGrid(true);
      } else {
        const errorMessage = data.error || data.details || 'Failed to create order';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to create table order:', error);
      alert(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const getDeliveryFee = () => {
    if (orderType === 'delivery' && deliveryArea) {
      const area = deliveryAreas.find(a => a.id === deliveryArea);
      return area ? area.fee : 0;
    }
    return 0;
  };

  // Use tableCart for dine-in with selected table, otherwise use regular cart
  const currentCart = (orderType === 'dine-in' && selectedTable) ? tableCart : cart;

  const subtotal = currentCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee - loyaltyDiscount - promoDiscount;
  const totalItems = currentCart.reduce((sum, item) => sum + item.quantity, 0);

  // Reset loyalty redemption when customer changes or cart is cleared
  useEffect(() => {
    setRedeemedPoints(0);
    setLoyaltyDiscount(0);
  }, [selectedAddress]);

  const handleRedeemPoints = () => {
    if (!selectedAddress || selectedAddress.loyaltyPoints === undefined) {
      alert('Please select a customer first');
      return;
    }

    const customerPoints = selectedAddress.loyaltyPoints || 0;
    if (customerPoints < 15) {
      alert('Customer needs at least 15 loyalty points to redeem');
      return;
    }

    // Calculate maximum redeemable points (multiples of 15)
    const maxRedeemable = Math.floor(customerPoints / 15) * 15;

    // Ask user how many points to redeem
    const pointsToRedeem = prompt(
      `Enter points to redeem (multiples of 15, max ${maxRedeemable}):`,
      maxRedeemable.toString()
    );

    if (!pointsToRedeem) return;

    const pointsToRedeemNum = parseInt(pointsToRedeem);

    // Validate the input
    if (isNaN(pointsToRedeemNum)) {
      alert('Please enter a valid number');
      return;
    }

    if (pointsToRedeemNum < 15) {
      alert('Minimum 15 points required for redemption');
      return;
    }

    if (pointsToRedeemNum > customerPoints) {
      alert(`Customer only has ${customerPoints} points available`);
      return;
    }

    if (pointsToRedeemNum % 15 !== 0) {
      alert('Points must be redeemed in multiples of 15');
      return;
    }

    // Set the redemption
    setRedeemedPoints(pointsToRedeemNum);
    setLoyaltyDiscount(pointsToRedeemNum); // 1 point = 1 EGP discount
  };

  const handleClearRedemption = () => {
    setRedeemedPoints(0);
    setLoyaltyDiscount(0);
  };

  const handleValidatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoMessage('Please enter a promo code');
      return;
    }

    if (cart.length === 0) {
      setPromoMessage('Add items to cart first');
      return;
    }

    const branchId = user?.role === 'CASHIER' ? user?.branchId : selectedBranch;
    if (!branchId) {
      setPromoMessage('Branch not found');
      return;
    }

    setValidatingPromo(true);
    setPromoMessage('');

    try {
      const response = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode.trim(),
          branchId,
          customerId: selectedAddress?.customerId || undefined,
          orderSubtotal: subtotal,
          orderItems: cart.map(item => {
            // Find the menu item to get the category ID
            const menuItem = menuItems.find(m => m.id === item.menuItemId);
            return {
              menuItemId: item.menuItemId,
              categoryId: menuItem?.categoryId || null,
              price: item.price,
              quantity: item.quantity,
            };
          }),
        }),
      });

      const data = await response.json();

      if (data.success && data.valid) {
        setPromoCodeId(data.promo.id);
        setPromoDiscount(data.promo.discountAmount);
        setPromoMessage(data.promo.message);
      } else {
        setPromoCodeId('');
        setPromoDiscount(0);
        setPromoMessage(data.error || 'Invalid promo code');
      }
    } catch (error) {
      console.error('Error validating promo code:', error);
      setPromoMessage('Failed to validate promo code');
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleClearPromoCode = () => {
    setPromoCode('');
    setPromoCodeId('');
    setPromoDiscount(0);
    setPromoMessage('');
  };

  const handleAddAddress = async () => {
    if (!selectedAddress) return;

    if (!newAddress.streetAddress.trim()) {
      alert('Please enter a street address');
      return;
    }

    setCreatingAddress(true);
    try {
      const response = await fetch(`/api/customers/${selectedAddress.customerId}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building: newAddress.building || null,
          streetAddress: newAddress.streetAddress,
          floor: newAddress.floor || null,
          apartment: newAddress.apartment || null,
          deliveryAreaId: newAddress.deliveryAreaId || null,
          isDefault: false,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.error || 'Failed to add address');
        setCreatingAddress(false);
        return;
      }

      // Get the created address
      if (data.address) {
        const newAddressObj: Address = {
          id: data.address.id,
          customerId: data.address.customerId,
          customerName: selectedAddress.customerName,
          customerPhone: selectedAddress.customerPhone,
          building: data.address.building,
          streetAddress: data.address.streetAddress,
          floor: data.address.floor,
          apartment: data.address.apartment,
          deliveryAreaId: data.address.deliveryAreaId,
          orderCount: 0,
          isDefault: data.address.isDefault,
          loyaltyPoints: selectedAddress.loyaltyPoints,
        };

        // Auto-select the new address
        setSelectedAddress(newAddress);
        setShowAddAddressDialog(false);

        // Reset form
        setNewAddress({
          building: '',
          streetAddress: '',
          floor: '',
          apartment: '',
          deliveryAreaId: '',
        });
      }
    } catch (error) {
      console.error('Add address error:', error);
      alert('Failed to add address. Please try again.');
    } finally {
      setCreatingAddress(false);
    }
  };

  // Daily expense handlers
  const handleDailyExpenseSubmit = async () => {
    if (!currentShift) {
      alert('No active shift. Please open a shift first.');
      return;
    }

    const amount = parseFloat(expenseAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!expenseReason.trim()) {
      alert('Please enter a reason for expense');
      return;
    }

    try {
      const branchId = user?.role === 'CASHIER' ? user?.branchId : selectedBranch;
      const response = await fetch('/api/daily-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          shiftId: currentShift.id,
          amount,
          reason: expenseReason.trim(),
          recordedBy: user.id,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Update daily expenses total
        setCurrentDailyExpenses(prev => prev + amount);

        // Close dialog and reset form
        setShowDailyExpenseDialog(false);
        setExpenseAmount('');
        setExpenseReason('');

        alert('Daily expense recorded successfully!');
      } else {
        alert(data.error || 'Failed to record expense');
      }
    } catch (error) {
      console.error('Failed to record daily expense:', error);
      alert('Failed to record expense. Please try again.');
    }
  };

  // Held Orders handlers
  const getLocalStorageKey = () => {
    const branchId = user?.role === 'CASHIER' ? user?.branchId : selectedBranch;
    return `heldOrders_${branchId}_${currentShift?.id || 'no-shift'}`;
  };

  const loadHeldOrders = () => {
    try {
      const key = getLocalStorageKey();
      const stored = localStorage.getItem(key);
      if (stored) {
        setHeldOrders(JSON.parse(stored));
      } else {
        setHeldOrders([]);
      }
    } catch (error) {
      console.error('Failed to load held orders:', error);
      setHeldOrders([]);
    }
  };

  const handleHoldOrder = () => {
    const currentCart = (orderType === 'dine-in' && selectedTable) ? tableCart : cart;

    if (currentCart.length === 0) {
      alert('Cart is empty. Add items before holding.');
      return;
    }

    try {
      const branchId = user?.role === 'CASHIER' ? user?.branchId : selectedBranch;
      const holdOrder = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        items: currentCart,
        orderType: orderType,
        tableNumber: selectedTable?.tableNumber || null,
        tableId: selectedTable?.id || null,
        customerData: selectedAddress || null,
        customerAddressId: selectedAddress?.id || null,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
        deliveryArea: orderType === 'delivery' ? deliveryArea : null,
        selectedCourierId: orderType === 'delivery' ? selectedCourierId : null,
        notes: '', // Can be extended if needed
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        loyaltyDiscount: loyaltyDiscount,
        promoDiscount: promoDiscount,
        promoCodeId: promoCodeId,
        promoCode: promoCode,
        redeemedPoints: redeemedPoints,
      };

      const key = getLocalStorageKey();
      const existingHeldOrders = JSON.parse(localStorage.getItem(key) || '[]');
      const updatedHeldOrders = [...existingHeldOrders, holdOrder];
      localStorage.setItem(key, JSON.stringify(updatedHeldOrders));

      // Clear cart state
      if (orderType === 'dine-in' && selectedTable) {
        setTableCart([]);
        localStorage.setItem(`table-cart-${selectedTable.id}`, JSON.stringify([]));
      } else {
        setCart([]);
      }

      // Clear discounts and customer
      setRedeemedPoints(0);
      setLoyaltyDiscount(0);
      setPromoCode('');
      setPromoCodeId('');
      setPromoDiscount(0);
      setSelectedAddress(null);
      setDeliveryAddress('');
      setDeliveryArea('');
      setSelectedCourierId('none');

      // Refresh held orders list
      loadHeldOrders();

      alert('Order held successfully!');
    } catch (error) {
      console.error('Failed to hold order:', error);
      alert('Failed to hold order. Please try again.');
    }
  };

  const handleRestoreHeldOrder = (holdId: string) => {
    try {
      const key = getLocalStorageKey();
      const existingHeldOrders = JSON.parse(localStorage.getItem(key) || '[]');
      const heldOrderIndex = existingHeldOrders.findIndex((h: any) => h.id === holdId);

      if (heldOrderIndex === -1) {
        alert('Held order not found');
        return;
      }

      const heldOrder = existingHeldOrders[heldOrderIndex];

      // Restore cart
      if (heldOrder.orderType === 'dine-in' && heldOrder.tableId) {
        // Find and select the table
        setOrderType('dine-in');
        // Note: We'd need to fetch the table details and set selectedTable
        // For now, restore to table cart
        setTableCart(heldOrder.items);
        if (heldOrder.tableId) {
          localStorage.setItem(`table-cart-${heldOrder.tableId}`, JSON.stringify(heldOrder.items));
        }
      } else {
        setOrderType(heldOrder.orderType);
        setCart(heldOrder.items);
      }

      // Restore other state
      setSelectedAddress(heldOrder.customerData);
      if (heldOrder.orderType === 'delivery') {
        setDeliveryAddress(heldOrder.deliveryAddress || '');
        setDeliveryArea(heldOrder.deliveryArea || '');
        setSelectedCourierId(heldOrder.selectedCourierId || 'none');
      }
      setRedeemedPoints(heldOrder.redeemedPoints || 0);
      setLoyaltyDiscount(heldOrder.loyaltyDiscount || 0);
      setPromoCode(heldOrder.promoCode || '');
      setPromoCodeId(heldOrder.promoCodeId || '');
      setPromoDiscount(heldOrder.promoDiscount || 0);

      // Remove from localStorage
      const updatedHeldOrders = existingHeldOrders.filter((h: any) => h.id !== holdId);
      localStorage.setItem(key, JSON.stringify(updatedHeldOrders));
      loadHeldOrders();

      alert('Order restored successfully!');
      setShowHeldOrdersDialog(false);
    } catch (error) {
      console.error('Failed to restore held order:', error);
      alert('Failed to restore order. Please try again.');
    }
  };

  const handleDeleteHeldOrder = (holdId: string) => {
    if (!confirm('Are you sure you want to delete this held order?')) {
      return;
    }

    try {
      const key = getLocalStorageKey();
      const existingHeldOrders = JSON.parse(localStorage.getItem(key) || '[]');
      const updatedHeldOrders = existingHeldOrders.filter((h: any) => h.id !== holdId);
      localStorage.setItem(key, JSON.stringify(updatedHeldOrders));
      loadHeldOrders();
    } catch (error) {
      console.error('Failed to delete held order:', error);
      alert('Failed to delete held order. Please try again.');
    }
  };

  // Number Pad handlers
  const openNumberPad = (callback: (value: string) => void, initialValue: string = '') => {
    console.log('[openNumberPad] Opening numpad with initialValue:', initialValue);
    setNumberPadValue(initialValue);
    setNumberPadCallback(() => callback);
    setShowNumberPad(true);
  };

  const handleNumberPadValueChange = (value: string) => {
    console.log('[handleNumberPadValueChange] Value changed:', value, 'type:', typeof value, 'isNull:', value === null);
    setNumberPadValue(value);
    // Immediately call the callback to update the input field
    if (numberPadCallback) {
      console.log('[handleNumberPadValueChange] Calling callback with value:', value, 'type:', typeof value);
      numberPadCallback(value);
    } else {
      console.log('[handleNumberPadValueChange] No callback, skipping');
    }
  };

  const handleNumberPadClose = () => {
    console.log('[handleNumberPadClose] Closing numpad');
    setShowNumberPad(false);
    setNumberPadValue('');
    setNumberPadCallback(null);
  };

  // Load held orders when shift changes
  useEffect(() => {
    loadHeldOrders();
  }, [currentShift?.id, selectedBranch, user?.branchId, user?.role]);

  const handlePrint = () => {
    if (receiptData) {
      setShowReceipt(true);
    }
  };

  // Card payment handlers
  const handleCardPaymentClick = () => {
    if (cart.length === 0) return;
    setShowCardPaymentDialog(true);
    setCardReferenceNumber('');
    setPaymentMethodDetail('CARD');
  };

  const handleCardPaymentSubmit = async () => {
    if (!cardReferenceNumber.trim()) {
      alert('Please enter the reference number');
      return;
    }
    setShowCardPaymentDialog(false);

    // Check if this is a table order or regular cart order
    if (orderType === 'dine-in' && selectedTable && tableCart.length > 0) {
      // Create table order with card payment
      await createTableOrderWithCard(cardReferenceNumber.trim(), paymentMethodDetail);
    } else {
      // Regular cart order
      await handleCheckout('card', cardReferenceNumber.trim(), paymentMethodDetail);
    }
  };

  const handleCardPaymentCancel = () => {
    setShowCardPaymentDialog(false);
    setCardReferenceNumber('');
    setPaymentMethodDetail('CARD');
  };

  const handleCheckout = async (paymentMethod: 'cash' | 'card', cardRefNumber?: string, paymentMethodDetailParam?: 'CARD' | 'INSTAPAY' | 'MOBILE_WALLET') => {
    if (cart.length === 0) return;

    // For cashiers, check if they have an active shift
    if (user?.role === 'CASHIER' && !currentShift) {
      alert('Please open a shift in the Shifts tab before processing sales.');
      return;
    }

    // Validate branch selection for admin
    if (user?.role === 'ADMIN' && !selectedBranch) {
      alert('Please select a branch to process this sale');
      return;
    }

    setProcessing(true);

    try {
      const branchId = user?.role === 'ADMIN' ? selectedBranch : user?.branchId;
      if (!branchId) {
        alert('Branch not found. Please contact administrator.');
        return;
      }

      // Prepare order items with variant info
      const orderItems = cart.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        menuItemVariantId: item.variantId || null,
        customVariantValue: item.customVariantValue || null,
        specialInstructions: item.note || null,
      }));

      // Validate delivery fields
      if (orderType === 'delivery') {
        if (!deliveryArea) {
          alert('Please select a delivery area for delivery orders.');
          setProcessing(false);
          return;
        }
        if (!deliveryAddress.trim()) {
          alert('Please enter a delivery address for delivery orders.');
          setProcessing(false);
          return;
        }
      }

      const orderData: any = {
        branchId,
        orderType,
        items: orderItems,
        subtotal,
        taxRate: 0.14,
        total,
        paymentMethod,
        cashierId: user?.id,
      };

      // Add card reference number if provided
      if (paymentMethod === 'card' && cardRefNumber) {
        orderData.cardReferenceNumber = cardRefNumber;
        orderData.paymentMethodDetail = paymentMethodDetailParam || 'CARD';
      }

      // Add shiftId to order data
      orderData.shiftId = currentShift?.id;

      // Add tableId for dine-in orders
      if (orderType === 'dine-in' && selectedTable) {
        orderData.tableId = selectedTable.id;
      }

      // Add customer data for all order types (not just delivery)
      if (selectedAddress) {
        orderData.customerId = selectedAddress.customerId;
        orderData.customerAddressId = selectedAddress.id;
        if (selectedAddress.customerPhone) {
          orderData.customerPhone = selectedAddress.customerPhone;
        }
        if (selectedAddress.customerName) {
          orderData.customerName = selectedAddress.customerName;
        }

        // Add loyalty redemption if points are being redeemed
        if (redeemedPoints > 0) {
          orderData.loyaltyPointsRedeemed = redeemedPoints;
          orderData.loyaltyDiscount = loyaltyDiscount;
        }

        // Add promo code if applied
        if (promoCodeId && promoDiscount > 0) {
          orderData.promoCodeId = promoCodeId;
          orderData.promoDiscount = promoDiscount;
        }
      }

      // Add delivery-specific fields
      if (orderType === 'delivery') {
        orderData.deliveryAddress = deliveryAddress;
        orderData.deliveryAreaId = deliveryArea;
        orderData.deliveryFee = deliveryFee;
        if (selectedCourierId && selectedCourierId !== 'none') {
          orderData.courierId = selectedCourierId;
        }
      }

      console.log('Order data prepared:', orderData);

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
          console.log('[Order] Network check passed, trying API...');
        } catch (netError) {
          console.log('[Order] Network check failed, assuming offline:', netError.message);
          isActuallyOnline = false;
        }
      }

      if (isActuallyOnline) {
        // Try API first
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setReceiptData(data.order);
          setLastOrderNumber(data.order.orderNumber);
          clearCart();
          setShowReceipt(true);
          setDeliveryAddress('');
          setDeliveryArea('');
          setSelectedCourierId('none');
          // Clear customer selection for all order types
          setSelectedAddress(null);
          // Clear loyalty redemption
          setRedeemedPoints(0);
          setLoyaltyDiscount(0);
          // Clear promo code
          handleClearPromoCode();
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
            console.log('[Order] Network error detected (API), trying offline mode');
            try {
              const result = await createOrderOffline(orderData, currentShift, cart);
              setReceiptData(result.order);
              setLastOrderNumber(result.order.orderNumber);
              clearCart();
              setShowReceipt(true);
              setDeliveryAddress('');
              setDeliveryArea('');
              setSelectedCourierId('none');
              setSelectedAddress(null);
              setRedeemedPoints(0);
              setLoyaltyDiscount(0);
              handleClearPromoCode();
              alert('Order created (offline mode - will sync when online)');
            } catch (offlineError) {
              console.error('[Order] Offline order creation failed:', offlineError);
              throw new Error(`Failed to create order offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
            }
          } else {
            console.error('Order creation failed:', {
              status: response.status,
              data,
              orderData,
            });
            const errorMessage = data.error || data.details || 'Failed to create order';
            if (data.errorName || data.details) {
              console.error('Error details:', {
                name: data.errorName,
                details: data.details,
              });
            }
            throw new Error(errorMessage);
          }
        }
      } else {
        // Offline mode - create order locally
        console.log('[Order] Offline mode detected, creating order locally');
        try {
          const result = await createOrderOffline(orderData, currentShift, cart);
          setReceiptData(result.order);
          setLastOrderNumber(result.order.orderNumber);
          clearCart();
          setShowReceipt(true);
          setDeliveryAddress('');
          setDeliveryArea('');
          setSelectedCourierId('none');
          setSelectedAddress(null);
          setRedeemedPoints(0);
          setLoyaltyDiscount(0);
          handleClearPromoCode();
          alert('Order created (offline mode - will sync when online)');
        } catch (offlineError) {
          console.error('[Order] Offline order creation failed:', offlineError);
          throw new Error(`Failed to create order offline: ${offlineError instanceof Error ? offlineError.message : String(offlineError)}`);
        }
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert(error instanceof Error ? error.message : 'Failed to process order');
    } finally {
      setProcessing(false);
    }
  };

  // If no user, show loading
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
      {/* Mobile Categories - Horizontal Scroll Bar */}
      <div className="md:hidden flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {allCategories.map((category) => {
            const isActive = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSearchQuery('');
                }}
                className={`flex-shrink-0 px-4 h-11 rounded-full text-xs font-bold transition-all duration-300 border ${
                  isActive
                    ? 'from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-500/50'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                } ${isActive ? 'bg-gradient-to-r' : ''}`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Left Sidebar - Modern Categories (Desktop) */}
      {categoriesExpanded && (
        <div className="hidden md:flex flex-col w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 shadow-2xl flex-shrink-0 h-full overflow-hidden">
          {/* Logo/Brand Section */}
          <div className="flex-shrink-0 p-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-500/20">
                <Store className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">Emperor</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase">POS System</p>
              </div>
            </div>
          </div>

          {/* Categories Section */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/30">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Filter className="h-3 w-3" />
                Categories
              </h2>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-4 py-4">
                <div className="space-y-2">
                  {allCategories.map((category) => {
                    const isActive = selectedCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setSearchQuery('');
                        }}
                        className={`w-full group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 ${
                          isActive
                            ? 'bg-gradient-to-r shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/30'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                        style={isActive ? { background: `linear-gradient(to right, var(--tw-gradient-stops))`, '--tw-gradient-from': `var(--color-${category.color.split('-')[0]}-500)`, '--tw-gradient-to': `var(--color-${category.color.split('-')[2]}-600)` } as React.CSSProperties : {}}
                      >
                        <div className={`bg-gradient-to-r ${category.color} absolute inset-0 opacity-0 ${isActive ? 'opacity-100' : ''} transition-opacity duration-300`} />

                        <div className="relative flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <span className={`font-semibold text-sm block truncate transition-colors ${
                              isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                            }`}>
                              {category.name}
                            </span>
                            {category.id !== 'all' && (
                              <span className={`text-xs mt-1 block font-medium transition-colors ${
                                isActive ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                              }`}>
                                {menuItems.filter(m => m.categoryId === category.id || m.category === categories.find(c => c.id === category.id)?.name).length} items
                              </span>
                            )}
                          </div>

                          {isActive ? (
                            <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                              <CheckCircle className="h-3.5 w-3.5 text-white" />
                            </div>
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Low Stock Alert */}
          {lowStockAlerts.length > 0 && (
            <div className="flex-shrink-0 p-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-0.5">Low Stock Alert</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    {lowStockAlerts.length} {lowStockAlerts.length === 1 ? 'item' : 'items'} running low
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Center - Menu Items */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Modern Top Bar */}
        <div className="flex-shrink-0 px-4 md:px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Sidebar Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCategoriesExpanded(!categoriesExpanded)}
              className="hidden md:flex h-11 w-11 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all duration-200 border border-slate-200/50 dark:border-slate-700/50"
              title={categoriesExpanded ? 'Hide Sidebar' : 'Show Sidebar'}
            >
              {categoriesExpanded ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>

            {/* Enhanced Search */}
            <div className="flex-1 relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors z-10" />
              <Input
                type="text"
                placeholder="Search products, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-11 bg-slate-100/80 dark:bg-slate-800/80 border-0 focus:ring-2 focus:ring-emerald-500/50 rounded-xl transition-all relative z-0"
              />
            </div>

            {/* Order Type Toggle - Pill Style (Desktop) */}
            <div className="hidden md:flex bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl p-1.5 border border-slate-200/50 dark:border-slate-700/50">
              {(['take-away', 'dine-in', 'delivery'] as const).map((type) => {
                const icons = {
                  'dine-in': <Utensils className="h-3.5 w-3.5" />,
                  'take-away': <Package className="h-3.5 w-3.5" />,
                  'delivery': <Truck className="h-3.5 w-3.5" />,
                };
                return (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      orderType === type
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {icons[type]}
                    {type === 'dine-in' && 'Dine In'}
                    {type === 'take-away' && 'Take Away'}
                    {type === 'delivery' && 'Delivery'}
                  </button>
                );
              })}
            </div>

            {/* Mobile Order Type Selector */}
            <div className="md:hidden">
              <Select value={orderType} onValueChange={(value: any) => setOrderType(value)}>
                <SelectTrigger className="w-24 h-11 bg-slate-100/80 dark:bg-slate-800/80 border-0 focus:ring-2 focus:ring-emerald-500/50 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="take-away">Take Away</SelectItem>
                  <SelectItem value="dine-in">Dine In</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Branch Selector for Admin */}
            {user?.role === 'ADMIN' && (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-44 h-12 bg-slate-100/80 dark:bg-slate-800/80 border-0 focus:ring-2 focus:ring-emerald-500/50 rounded-xl">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Modern Products Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="relative">
                  <div className="animate-spin h-12 w-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full mx-auto mb-4" />
                  <div className="absolute inset-0 animate-pulse bg-emerald-500/10 rounded-full" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">Loading menu...</p>
              </div>
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4">
                <Search className="h-10 w-10 opacity-40" />
              </div>
              <p className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-1">No products found</p>
              <p className="text-sm">Try adjusting your search or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
              {filteredMenuItems.map((item) => {
                const categoryColor = getCategoryColor(item.category);
                return (
                  <Card
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="group cursor-pointer border-0 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 transform hover:-translate-y-1"
                  >
                    {/* Modern Product Image/Icon Section */}
                    <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 to-slate-850 relative overflow-hidden">
                      {/* Animated Gradient Background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${categoryColor} opacity-0 group-hover:opacity-10 transition-all duration-500`} />
                      
                      {/* Decorative Pattern */}
                      <div className="absolute inset-0 opacity-5">
                        <div className="absolute top-4 right-4 w-20 h-20 border-2 border-slate-300 dark:border-slate-600 rounded-full" />
                        <div className="absolute bottom-4 left-4 w-16 h-16 border-2 border-slate-300 dark:border-slate-600 rounded-full" />
                      </div>

                      {/* Icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Coffee className="h-16 w-16 text-slate-200 dark:text-slate-700 group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      
                      {/* Category Tag */}
                      <div className="absolute top-3 left-3">
                        <Badge 
                          variant="secondary" 
                          className="bg-white/95 dark:bg-slate-700/95 backdrop-blur-sm text-xs font-semibold px-3 py-1.5 rounded-full shadow-md border border-slate-100 dark:border-slate-600"
                        >
                          {item.category}
                        </Badge>
                      </div>

                      {/* Variants Badge */}
                      {item.hasVariants && (
                        <div className="absolute top-3 right-3">
                          <div className={`bg-gradient-to-br ${categoryColor} text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5`}>
                            <Layers className="h-3 w-3" />
                            <span>{item.variants?.length || 0}</span>
                          </div>
                        </div>
                      )}

                      {/* Add Button - Modern Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-end pb-6">
                        <Button 
                          className={`bg-gradient-to-r ${categoryColor} hover:opacity-90 text-white rounded-full px-6 py-2.5 shadow-xl shadow-emerald-500/30 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 font-semibold`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add to Order
                        </Button>
                      </div>
                    </div>
                    
                    {/* Product Info */}
                    <CardContent className="p-4 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.name}
                        </h3>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.price, currency)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                          <Tag className="h-3 w-3" />
                          <span className="text-xs font-medium">ID: {item.id.slice(0, 6)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Cart (Desktop) */}
      <div className="hidden lg:flex flex-col h-full w-[440px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-l border-slate-200/50 dark:border-slate-800/50 shadow-2xl flex-shrink-0">
        {/* Cart Header */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-850/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Current Order</h2>
            </div>
            <Badge variant="outline" className="bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-semibold px-3 py-1.5 rounded-full">
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </Badge>
          </div>
          {lastOrderNumber > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 ml-13">
              <Receipt className="h-3 w-3" />
              Last Order: <span className="font-semibold text-slate-700 dark:text-slate-300">#{lastOrderNumber}</span>
            </div>
          )}
          {/* Daily Expenses Section */}
          {currentShift && (
            <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Daily Expenses</p>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                      {formatCurrency(currentDailyExpenses, currency)}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowDailyExpenseDialog(true)}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          )}
          {/* Held Orders Button */}
          <div className="mt-2 flex gap-2">
            {orderType === 'dine-in' && selectedTable && tableCart.length > 0 && (
              <Button
                onClick={handleOpenTransferDialog}
                size="sm"
                variant="outline"
                className="flex-1 h-9 text-xs border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/50"
              >
                <ArrowRight className="h-3.5 w-3.5 mr-2" />
                Transfer Items
              </Button>
            )}
            <Button
              onClick={() => setShowHeldOrdersDialog(true)}
              size="sm"
              variant="outline"
              className={`h-9 text-xs border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 ${orderType === 'dine-in' && selectedTable && tableCart.length > 0 ? 'flex-1' : 'flex-1'}`}
            >
              <Clock className="h-3.5 w-3.5 mr-2" />
              Held Orders
              {heldOrders.length > 0 && (
                <Badge className="ml-2 h-5 min-w-[20px] px-1.5 flex items-center justify-center bg-indigo-600 text-white text-[10px] font-bold">
                  {heldOrders.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {currentCart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4">
                  <ShoppingCart className="h-10 w-10 opacity-40" />
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Cart is empty</p>
                <p className="text-xs">Add items to start order</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentCart.map((item) => (
                <div
                  key={item.id}
                  className="group bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-850 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                          {item.name}
                        </h4>
                        {item.note && (
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title={item.note}>
                            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                          </div>
                        )}
                      </div>
                      {item.variantName && (
                        <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-2 py-1 rounded-lg mb-1.5">
                          <Layers className="h-3 w-3" />
                          {item.variantName}
                        </div>
                      )}
                      {item.note && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 italic">
                          "{item.note}"
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex-shrink-0 rounded-xl transition-all"
                        onClick={() => openNoteDialog(item)}
                        title="Edit note or quantity"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 flex-shrink-0 rounded-xl transition-all"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 transition-all"
                        onClick={() => handleDecrementQuantity(item.id)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-16 h-9 text-center font-bold text-lg text-slate-900 dark:text-white border-slate-200 dark:border-slate-700"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 dark:hover:text-emerald-400 border-slate-200 dark:border-slate-700 transition-all"
                        onClick={() => openNumberPad(
                          (value) => handleQuantityChange(item.id, value),
                          item.quantity.toString()
                        )}
                        title="Open Number Pad"
                      >
                        <Calculator className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 transition-all"
                        onClick={() => handleIncrementQuantity(item.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(item.price * item.quantity, currency)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {formatCurrency(item.price, currency)} each
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        </div>

        {/* Customer Section - Available for All Order Types */}
        <div className="p-5 border-t border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <User className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Customer</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Link customer to earn loyalty points</p>
            </div>
          </div>
          <CustomerSearch
            onAddressSelect={setSelectedAddress}
            selectedAddress={selectedAddress}
            deliveryAreas={deliveryAreas}
            branchId={user?.role === 'ADMIN' ? selectedBranch : user?.branchId}
          />
          {selectedAddress && (
            <div className="space-y-3">
              <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-slate-700 dark:text-slate-300">
                      <strong>{selectedAddress.customerName}</strong> - {selectedAddress.customerPhone}
                    </span>
                  </div>
                  <Button
                    onClick={() => setShowAddAddressDialog(true)}
                    size="sm"
                    variant="outline"
                    className="text-emerald-600 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-800 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Address
                  </Button>
                </div>
              </div>

              {/* Promo Code Section */}
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                    Promo Code
                  </span>
                </div>
                {promoCodeId ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <div>
                          <p className="text-sm font-bold text-green-700 dark:text-green-300">
                            {promoCode}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Discount: {formatCurrency(promoDiscount, currency)}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleClearPromoCode}
                        size="sm"
                        variant="outline"
                        className="h-9 w-9 p-0 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        onKeyPress={(e) => e.key === 'Enter' && handleValidatePromoCode()}
                        placeholder="Enter code..."
                        className="flex-1 h-9 text-sm"
                        disabled={validatingPromo}
                      />
                      <Button
                        onClick={handleValidatePromoCode}
                        disabled={validatingPromo || !promoCode.trim()}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white h-9 px-3"
                      >
                        {validatingPromo ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                  {promoMessage && !promoCodeId && (
                    <p className="text-xs mt-2 text-red-600 dark:text-red-400">
                      {promoMessage}
                    </p>
                  )}
              </div>

              {/* Loyalty Redemption Section */}
              {redeemedPoints === 0 && selectedAddress?.loyaltyPoints !== undefined && selectedAddress.loyaltyPoints >= 15 && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <div>
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                          {selectedAddress.loyaltyPoints.toFixed(0)} pts available
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          Redeem 15 pts = 15 EGP off
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleRedeemPoints}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Gift className="h-4 w-4 mr-2" />
                      Redeem Points
                    </Button>
                  </div>
                </div>
              )}

              {/* Active Redemption Display */}
              {redeemedPoints > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-sm font-bold text-green-700 dark:text-green-300">
                          {redeemedPoints} pts redeemed
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Discount: {formatCurrency(loyaltyDiscount, currency)}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleClearRedemption}
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delivery Section - Only for Delivery Orders */}
        {orderType === 'delivery' && (
          <div className="p-5 border-t border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Truck className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">Delivery Information</h3>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Delivery Address</Label>
                <Textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter full delivery address..."
                  rows={2}
                  className="text-sm mt-1.5 resize-none rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Delivery Area</Label>
                <Select value={deliveryArea} onValueChange={setDeliveryArea}>
                  <SelectTrigger className="text-sm h-10 mt-1.5 rounded-xl">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryAreas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name} ({formatCurrency(area.fee, currency)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {couriers.length > 0 && (
                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Assign Courier</Label>
                  <Select value={selectedCourierId} onValueChange={setSelectedCourierId}>
                    <SelectTrigger className="text-sm h-10 mt-1.5 rounded-xl">
                      <SelectValue placeholder="Select courier (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No courier assigned</SelectItem>
                      {couriers.map((courier: any) => (
                        <SelectItem key={courier.id} value={courier.id}>
                          {courier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Table Information for Dine In */}
        {orderType === 'dine-in' && (
          <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-900/20 dark:to-teal-900/20">
            {showTableGrid ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Select a Table</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Choose a table to start ordering</p>
                  </div>
                </div>
                <TableGridView
                  branchId={user?.role === 'CASHIER' ? user?.branchId : selectedBranch}
                  onTableSelect={handleTableSelect}
                  selectedTableId={selectedTable?.id || null}
                />
              </div>
            ) : selectedTable ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {selectedTable.tableNumber}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-lg">
                      Table {selectedTable.tableNumber}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Badge className="bg-blue-100 text-blue-700">
                        <Users className="h-3 w-3 mr-1" />
                        {selectedTable.status === 'OCCUPIED' ? 'Occupied' : selectedTable.status.toLowerCase()}
                      </Badge>
                      {selectedTable.capacity && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {selectedTable.capacity} seats
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCloseTable}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Close Table
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectTable}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Order Summary */}
        <div className="p-6 border-t border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-t from-slate-50/80 to-white dark:from-slate-800/80 dark:to-slate-900">
          <div className="space-y-3 mb-5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Subtotal</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>

            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Delivery</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(deliveryFee, currency)}
                </span>
              </div>
            )}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-orange-600 dark:text-orange-400 font-medium">Promo Discount</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">
                  -{formatCurrency(promoDiscount, currency)}
                </span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-purple-600 dark:text-purple-400 font-medium">Loyalty Discount ({redeemedPoints} pts)</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  -{formatCurrency(loyaltyDiscount, currency)}
                </span>
              </div>
            )}
            <Separator className="bg-slate-200 dark:bg-slate-700 my-3" />
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(total, currency)}
              </span>
            </div>
          </div>

          {/* For Dine-In with table, show close table message instead of checkout buttons */}
          {orderType === 'dine-in' && selectedTable ? (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-center">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                Items are held on Table {selectedTable.tableNumber}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Click "Close Table" above to complete order and print receipt
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleHoldOrder}
                disabled={processing || currentCart.length === 0}
                variant="outline"
                className="w-full h-12 text-base font-semibold border-2 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-all"
              >
                <Pause className="h-4.5 w-4.5 mr-2" />
                Hold Order
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleCheckout('cash')}
                  disabled={processing || currentCart.length === 0}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/30 font-bold h-12 text-base rounded-xl transition-all hover:shadow-emerald-500/40"
                >
                  <DollarSign className="h-4.5 w-4.5 mr-2" />
                  Cash
                </Button>
                <Button
                  onClick={handleCardPaymentClick}
                  disabled={processing || currentCart.length === 0}
                  variant="outline"
                  className="border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 font-bold h-12 text-base rounded-xl transition-all"
                >
                  <CreditCard className="h-4.5 w-4.5 mr-2" />
                  Card
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Cart Bottom Bar - Always visible */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 shadow-2xl pb-safe">
        <div className="px-4 py-3 flex items-center gap-3 max-w-4xl mx-auto">
          <button
            onClick={() => setMobileCartOpen(true)}
            className={`flex-1 flex items-center justify-between gap-3 h-11 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] ${
              currentCart.length > 0
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingBag className="h-5 w-5" />
                {currentCart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold">
                {currentCart.length > 0 ? 'View Cart' : 'Add Items'}
              </span>
            </div>
            {currentCart.length > 0 && (
              <span className="text-base font-bold">
                {formatCurrency(total, currency)}
              </span>
            )}
          </button>
        </div>
        {/* Safe area inset for iOS */}
        <div className="h-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      </div>

      {/* Mobile Cart Drawer */}
      <Dialog open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <DialogContent
          className="fixed bottom-0 left-0 right-0 top-auto translate-x-0 translate-y-0 w-full max-w-none max-h-[85vh] h-auto rounded-t-3xl border-b-0 pb-safe p-0 gap-0 z-[100]"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {/* Hidden DialogTitle for accessibility */}
          <DialogHeader className="sr-only">
            <DialogTitle>Shopping Cart</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col h-full max-h-[85vh] overflow-y-auto">
            {/* Drawer Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-850/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Current Order</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {totalItems} {totalItems === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileCartOpen(false)}
                  className="h-10 w-10 rounded-xl"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Cart Items */}
              <div className="p-4">
                {currentCart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                      <ShoppingCart className="h-8 w-8 opacity-40" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentCart.map((item) => (
                      <div
                        key={item.id}
                        className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-850 rounded-2xl p-3 border border-slate-200/50 dark:border-slate-700/50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                                {item.name}
                              </h4>
                              {item.note && (
                                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title={item.note}>
                                  <MessageSquare className="h-3 w-3 flex-shrink-0" />
                                </div>
                              )}
                            </div>
                            {item.variantName && (
                              <div className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-lg mb-1">
                                <Layers className="h-2.5 w-2.5" />
                                {item.variantName}
                              </div>
                            )}
                            {item.note && (
                              <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 italic">
                                "{item.note}"
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex-shrink-0 rounded-lg"
                              onClick={() => openNoteDialog(item)}
                              title="Edit note or quantity"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 flex-shrink-0 rounded-lg"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                              onClick={() => handleDecrementQuantity(item.id)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              className="w-14 h-9 text-center font-bold text-base text-slate-900 dark:text-white border-slate-200 dark:border-slate-700"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 dark:hover:text-emerald-400 border-slate-200 dark:border-slate-700"
                              onClick={() => openNumberPad(
                                (value) => handleQuantityChange(item.id, value),
                                item.quantity.toString()
                              )}
                              title="Open Numpad"
                            >
                              <Calculator className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                              onClick={() => handleIncrementQuantity(item.id)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(item.price * item.quantity, currency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Section */}
              <div className="px-4 pb-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Customer</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Link customer for loyalty points</p>
                  </div>
                </div>
                <CustomerSearch
                  onAddressSelect={setSelectedAddress}
                  selectedAddress={selectedAddress}
                  deliveryAreas={deliveryAreas}
                  branchId={user?.role === 'ADMIN' ? selectedBranch : user?.branchId}
                />
                {selectedAddress && (
                  <div className="space-y-2 mt-3">
                    <div className="p-2.5 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-slate-700 dark:text-slate-300">
                            {selectedAddress.customerName}
                          </span>
                        </div>
                        <Button
                          onClick={() => setShowAddAddressDialog(true)}
                          size="sm"
                          variant="outline"
                          className="h-8 text-[10px] text-emerald-600 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-800 dark:hover:bg-emerald-950/50 px-2"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Address
                        </Button>
                      </div>
                    </div>

                    {/* Promo Code Section - Always Visible When Customer Selected */}
                <div className="p-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                    <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300">
                      Promo Code
                    </span>
                  </div>
                  {promoCodeId ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        <div>
                          <p className="text-xs font-bold text-green-700 dark:text-green-300">
                            {promoCode}
                          </p>
                          <p className="text-[10px] text-green-600 dark:text-green-400">
                            Discount: {formatCurrency(promoDiscount, currency)}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleClearPromoCode}
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/50"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        onKeyPress={(e) => e.key === 'Enter' && handleValidatePromoCode()}
                        placeholder="Enter code..."
                        className="flex-1 h-8 text-xs"
                        disabled={validatingPromo}
                      />
                      <Button
                        onClick={handleValidatePromoCode}
                        disabled={validatingPromo || !promoCode.trim()}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white h-8 px-3"
                      >
                        {validatingPromo ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  )}
                  {promoMessage && !promoCodeId && (
                    <p className="text-[10px] mt-2 text-red-600 dark:text-red-400">
                      {promoMessage}
                    </p>
                  )}
                </div>

                {/* Loyalty Redemption Section */}
                    {redeemedPoints === 0 && selectedAddress.loyaltyPoints !== undefined && selectedAddress.loyaltyPoints >= 15 && (
                      <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Star className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                            <div>
                              <p className="text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                                {selectedAddress.loyaltyPoints.toFixed(0)} pts available
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={handleRedeemPoints}
                            size="sm"
                            className="h-8 text-[10px] bg-purple-600 hover:bg-purple-700 text-white px-2"
                          >
                            <Gift className="h-3 w-3 mr-1" />
                            Redeem
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Active Redemption Display */}
                    {redeemedPoints > 0 && (
                      <div className="p-2.5 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            <div>
                              <p className="text-xs font-bold text-green-700 dark:text-green-300">
                                {redeemedPoints} pts redeemed
                              </p>
                              <p className="text-[10px] text-green-600 dark:text-green-400">
                                -{formatCurrency(loyaltyDiscount, currency)}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={handleClearRedemption}
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/50"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery Section - Only for Delivery Orders */}
              {orderType === 'delivery' && (
                <div className="px-4 pb-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/20 dark:to-orange-950/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <Truck className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">Delivery Info</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Delivery Address</Label>
                      <Textarea
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Enter full delivery address..."
                        rows={2}
                        className="text-xs mt-1 resize-none rounded-xl h-20"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Delivery Area</Label>
                      <Select value={deliveryArea} onValueChange={setDeliveryArea}>
                        <SelectTrigger className="text-xs h-10 mt-1 rounded-xl">
                          <SelectValue placeholder="Select area" />
                        </SelectTrigger>
                        <SelectContent className="z-[150]">
                          {deliveryAreas.map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.name} ({formatCurrency(area.fee, currency)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {couriers.length > 0 && (
                      <div>
                        <Label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Assign Courier</Label>
                        <Select value={selectedCourierId} onValueChange={setSelectedCourierId}>
                          <SelectTrigger className="text-xs h-10 mt-1 rounded-xl">
                            <SelectValue placeholder="Select courier (optional)" />
                          </SelectTrigger>
                          <SelectContent className="z-[150]">
                            <SelectItem value="none">No courier assigned</SelectItem>
                            {couriers.map((courier: any) => (
                              <SelectItem key={courier.id} value={courier.id}>
                                {courier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="px-4 py-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-t from-slate-50/80 to-white dark:from-slate-800/80 dark:to-slate-900">
                <div className="space-y-2.5 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Subtotal</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(subtotal, currency)}
                    </span>
                  </div>

                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Delivery</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(deliveryFee, currency)}
                      </span>
                    </div>
                  )}
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-600 dark:text-orange-400 font-medium">Promo Discount</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        -{formatCurrency(promoDiscount, currency)}
                      </span>
                    </div>
                  )}
                  {loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-600 dark:text-purple-400 font-medium">Loyalty Discount ({redeemedPoints} pts)</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        -{formatCurrency(loyaltyDiscount, currency)}
                      </span>
                    </div>
                  )}
                  <Separator className="bg-slate-200 dark:bg-slate-700" />
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-slate-900 dark:text-white">Total</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(total, currency)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => {
                      setMobileCartOpen(false);
                      handleCheckout('cash');
                    }}
                    disabled={processing || cart.length === 0}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/30 font-bold h-12 text-sm rounded-xl transition-all"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Cash
                  </Button>
                  <Button
                    onClick={() => {
                      setMobileCartOpen(false);
                      handleCardPaymentClick();
                    }}
                    disabled={processing || cart.length === 0}
                    variant="outline"
                    className="border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold h-12 text-sm rounded-xl transition-all"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Card
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Selection Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">Select Variant</DialogTitle>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 pl-13">
              Choose an option for <span className="font-semibold text-slate-900 dark:text-white">{selectedItemForVariant?.name}</span>
            </p>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {/* Check if any variant has custom input enabled */}
            {selectedItemForVariant?.variants?.some(v => v.variantType.isCustomInput) ? (
              // Show custom input for custom input variants
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-blue-900 dark:text-blue-100">
                      {selectedItemForVariant.variants[0].variantType.name}
                    </span>
                    <Badge variant="default" className="bg-purple-600 hover:bg-purple-700 ml-auto text-xs">
                      Custom Input
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="customVariantValue">Enter Multiplier</Label>
                      <div className="flex gap-2">
                        <Input
                          id="customVariantValue"
                          type="number"
                          step="0.001"
                          min="0.001"
                          max="999"
                          value={customVariantValue}
                          onChange={(e) => setCustomVariantValue(e.target.value)}
                          placeholder="e.g., 0.125 for 1/8, 0.5 for half"
                          className="h-11 text-lg font-semibold flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 shrink-0"
                          onClick={() => {
                            console.log('[Custom Input Numpad Button] Clicked, current customVariantValue:', customVariantValue);
                            openNumberPad(
                              (value) => {
                                console.log('[Custom Input Callback] Called with value:', value);
                                setCustomVariantValue(value);
                              },
                              customVariantValue || ''
                            );
                          }}
                          title="Open Number Pad"
                        >
                          <Calculator className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Enter a multiplier to calculate the price proportionally. For example, if the base is 500g and you want 62.5g (1/8), enter 0.125.
                    </p>
                    {customVariantValue && !isNaN(parseFloat(customVariantValue)) && parseFloat(customVariantValue) > 0 && (
                      <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Base Price:</span>
                          <span className="font-semibold">{formatCurrency(selectedItemForVariant.price, currency)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Multiplier:</span>
                          <span className="font-semibold">{customVariantValue}x</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900 dark:text-white">Final Price:</span>
                          <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(selectedItemForVariant.price * parseFloat(customVariantValue), currency)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Select the custom input variant */}
                <button
                  type="button"
                  onClick={() => setSelectedVariant(selectedItemForVariant.variants[0])}
                  className={`w-full p-4 border-2 rounded-2xl text-left transition-all duration-300 group hover:shadow-lg ${
                    selectedVariant?.id === selectedItemForVariant.variants[0].id
                      ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 shadow-lg shadow-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <span className="font-bold text-slate-900 dark:text-white">
                        Use Custom Input
                      </span>
                    </div>
                    {selectedVariant?.id === selectedItemForVariant.variants[0].id && (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </button>
              </div>
            ) : (
              // Show regular variant list
              selectedItemForVariant?.variants?.map((variant) => {
                const finalPrice = selectedItemForVariant.price + variant.priceModifier;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariant(variant)}
                    className={`w-full p-4 border-2 rounded-2xl text-left transition-all duration-300 group hover:shadow-lg ${
                      selectedVariant?.id === variant.id
                        ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 shadow-lg shadow-emerald-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 dark:text-white mb-1.5 text-base">
                          {variant.variantType.name}: {variant.variantOption.name}
                        </div>
                        {variant.priceModifier !== 0 && (
                          <div className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-lg ${
                            variant.priceModifier > 0 
                              ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' 
                              : 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                          }`}>
                            {variant.priceModifier > 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {formatCurrency(Math.abs(variant.priceModifier), currency)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end ml-4">
                        <div className="font-black text-xl text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(finalPrice, currency)}
                        </div>
                        {selectedVariant?.id === variant.id && (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold mt-1">
                            <CheckCircle className="h-3 w-3" />
                            Selected
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => {
                setVariantDialogOpen(false);
                setSelectedItemForVariant(null);
                setSelectedVariant(null);
                setCustomVariantValue('');
              }}
              className="rounded-xl h-11 px-6 font-semibold"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleVariantConfirm}
              disabled={
                !selectedVariant || 
                (selectedVariant?.variantType.isCustomInput && !customVariantValue)
              }
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl h-11 px-6 font-semibold shadow-lg shadow-emerald-500/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Address Dialog */}
      <Dialog open={showAddAddressDialog} onOpenChange={setShowAddAddressDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
            <DialogDescription>
              Add a new delivery address for {selectedAddress?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="building">Building (Optional)</Label>
              <Input
                id="building"
                value={newAddress.building}
                onChange={(e) => setNewAddress(prev => ({ ...prev, building: e.target.value }))}
                placeholder="Building name/number"
              />
            </div>
            <div>
              <Label htmlFor="streetAddress">Street Address *</Label>
              <Input
                id="streetAddress"
                value={newAddress.streetAddress}
                onChange={(e) => setNewAddress(prev => ({ ...prev, streetAddress: e.target.value }))}
                placeholder="Street address"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="floor">Floor (Optional)</Label>
                <Input
                  id="floor"
                  value={newAddress.floor}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, floor: e.target.value }))}
                  placeholder="Floor"
                />
              </div>
              <div>
                <Label htmlFor="apartment">Apartment (Optional)</Label>
                <Input
                  id="apartment"
                  value={newAddress.apartment}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, apartment: e.target.value }))}
                  placeholder="Apt #"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="deliveryArea">Delivery Area</Label>
              <Select value={newAddress.deliveryAreaId} onValueChange={(value) => setNewAddress(prev => ({ ...prev, deliveryAreaId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select delivery area" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryAreas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAddAddressDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddAddress}
                disabled={creatingAddress}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {creatingAddress ? 'Adding...' : 'Add Address'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Payment Confirmation Dialog */}
      <Dialog open={showCardPaymentDialog} onOpenChange={setShowCardPaymentDialog}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">Card Payment</DialogTitle>
            </div>
            <DialogDescription>
              Enter the card transaction reference number after successful payment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                    Process payment on terminal first
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Complete the card transaction on your payment terminal, then select the payment type and enter the reference number below.
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Payment Method Type</Label>
              <RadioGroup value={paymentMethodDetail} onValueChange={(value: 'CARD' | 'INSTAPAY' | 'MOBILE_WALLET') => setPaymentMethodDetail(value)} className="grid grid-cols-1 gap-3">
                <div className="flex items-center space-x-3 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer bg-white dark:bg-slate-800">
                  <RadioGroupItem value="CARD" id="card" className="border-slate-300" />
                  <label htmlFor="card" className="flex items-center gap-3 flex-1 cursor-pointer">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Card</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Credit/Debit Card</p>
                    </div>
                  </label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors cursor-pointer bg-white dark:bg-slate-800">
                  <RadioGroupItem value="INSTAPAY" id="instapay" className="border-slate-300" />
                  <label htmlFor="instapay" className="flex items-center gap-3 flex-1 cursor-pointer">
                    <Smartphone className="h-5 w-5 text-emerald-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Instapay</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Instant Payment</p>
                    </div>
                  </label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 transition-colors cursor-pointer bg-white dark:bg-slate-800">
                  <RadioGroupItem value="MOBILE_WALLET" id="mobile-wallet" className="border-slate-300" />
                  <label htmlFor="mobile-wallet" className="flex items-center gap-3 flex-1 cursor-pointer">
                    <Smartphone className="h-5 w-5 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Mobile Wallet</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Vodafone Cash, Etisalat, Orange</p>
                    </div>
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="cardRefNumber" className="text-sm font-semibold">
                Reference Number *
              </Label>
              <Input
                id="cardRefNumber"
                value={cardReferenceNumber}
                onChange={(e) => setCardReferenceNumber(e.target.value)}
                placeholder="Enter transaction reference number..."
                className="mt-2 text-sm h-11 rounded-xl"
                autoFocus
                onKeyPress={(e) => e.key === 'Enter' && handleCardPaymentSubmit()}
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                This reference will be saved with the order for tracking purposes
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  If the card transaction fails, click Cancel and pay with Cash instead
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={handleCardPaymentCancel}
              disabled={processing}
              className="flex-1 rounded-xl h-11 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCardPaymentSubmit}
              disabled={processing || !cardReferenceNumber.trim()}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl h-11 font-semibold shadow-lg shadow-blue-500/30"
            >
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit & Process Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog for Closing Table */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
            <DialogDescription>
              Table {selectedTable?.tableNumber} • {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-600">Total Amount</p>
              <p className="text-3xl font-bold text-emerald-600">
                {formatCurrency(total, currency)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button
                onClick={() => handlePaymentSelect('cash')}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 h-14 text-lg font-semibold"
              >
                <DollarSign className="h-5 w-5 mr-2" />
                Cash
              </Button>
              <Button
                onClick={() => handlePaymentSelect('card')}
                variant="outline"
                className="h-14 text-lg font-semibold border-2"
              >
                <CreditCard className="h-5 w-5 mr-2" />
                Card
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Viewer */}
      <ReceiptViewer
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        order={receiptData}
        autoPrint={true}
      />

      {/* Number Pad Dialog */}
      <NumberPad
        isOpen={showNumberPad}
        onClose={handleNumberPadClose}
        onValueChange={handleNumberPadValueChange}
        title="Enter Value"
        decimal={true}
        maxLength={10}
        initialValue={numberPadValue}
      />

      {/* Daily Expenses Dialog */}
      <Dialog open={showDailyExpenseDialog} onOpenChange={setShowDailyExpenseDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">Add Daily Expense</DialogTitle>
            </div>
            <DialogDescription>
              Record a daily expense for the current shift
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="expenseAmount" className="text-sm font-semibold">
                Amount ({currency}) *
              </Label>
              <Input
                id="expenseAmount"
                type="number"
                min="0"
                step="0.01"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="Enter amount..."
                className="mt-1.5 text-sm h-11 rounded-xl"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="expenseReason" className="text-sm font-semibold">
                Reason / Notes *
              </Label>
              <Textarea
                id="expenseReason"
                value={expenseReason}
                onChange={(e) => setExpenseReason(e.target.value)}
                placeholder="e.g., Electricity Company, Supplies, etc..."
                rows={3}
                className="mt-1.5 resize-none rounded-xl"
                maxLength={200}
              />
              <p className="text-xs text-slate-500 mt-1">
                {expenseReason.length}/200 characters
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  This expense will be automatically added to the Costs tab for tracking and reporting.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowDailyExpenseDialog(false);
                setExpenseAmount('');
                setExpenseReason('');
              }}
              className="flex-1 rounded-xl h-11 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDailyExpenseSubmit}
              disabled={!expenseAmount || !expenseReason.trim()}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl h-11 font-semibold shadow-lg shadow-amber-500/30"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Record Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold">Edit Item</DialogTitle>
            </div>
            <DialogDescription>
              {editingItem?.name} {editingItem?.variantName && `(${editingItem.variantName})`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="quantity" className="text-sm font-semibold">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={editingQuantity}
                onChange={(e) => setEditingQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="note" className="text-sm font-semibold">Note (Optional)</Label>
              <Textarea
                id="note"
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                placeholder="e.g., Very hot please, Extra sugar, No ice..."
                rows={3}
                className="mt-1.5 resize-none"
                maxLength={200}
              />
              <p className="text-xs text-slate-500 mt-1">
                {editingNote.length}/200 characters
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Tip:</strong> Items with different notes will appear on separate lines in the cart.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNoteDialog(false);
                setEditingItem(null);
                setEditingNote('');
                setEditingQuantity(1);
              }}
              className="rounded-xl h-11 px-6 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNote}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl h-11 px-6 font-semibold shadow-lg shadow-emerald-500/30"
            >
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Held Orders Dialog */}
      <Dialog open={showHeldOrdersDialog} onOpenChange={setShowHeldOrdersDialog}>
        <DialogContent className="sm:max-w-2xl rounded-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Held Orders</DialogTitle>
                <DialogDescription>
                  {heldOrders.length} {heldOrders.length === 1 ? 'order' : 'orders'} on hold
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 py-4 px-2">
            {heldOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                  <Clock className="h-8 w-8 opacity-40" />
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No held orders</p>
              </div>
            ) : (
              <div className="space-y-3 pr-2">
                {heldOrders.map((heldOrder) => {
                  const itemsCount = heldOrder.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                  const totalAmount = heldOrder.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) + (heldOrder.deliveryFee || 0) - (heldOrder.loyaltyDiscount || 0) - (heldOrder.promoDiscount || 0);
                  const timeHeld = Math.floor((Date.now() - heldOrder.timestamp) / 60000); // minutes

                  const getOrderTypeBadge = (type: string) => {
                    switch (type) {
                      case 'dine-in':
                        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Dine In</Badge>;
                      case 'take-away':
                        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Take Away</Badge>;
                      case 'delivery':
                        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Delivery</Badge>;
                      default:
                        return <Badge>{type}</Badge>;
                    }
                  };

                  return (
                    <div key={heldOrder.id} className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-850 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          {getOrderTypeBadge(heldOrder.orderType)}
                          {heldOrder.tableNumber && (
                            <Badge variant="outline" className="border-blue-300 text-blue-700">
                              Table {heldOrder.tableNumber}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {timeHeld < 60 ? `${timeHeld}m ago` : `${Math.floor(timeHeld / 60)}h ${timeHeld % 60}m ago`}
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        {heldOrder.items.slice(0, 3).map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-300">
                              {item.name} {item.variantName && `(${item.variantName})`} x{item.quantity}
                            </span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {formatCurrency(item.price * item.quantity, currency)}
                            </span>
                          </div>
                        ))}
                        {heldOrder.items.length > 3 && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            +{heldOrder.items.length - 3} more items
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                          </p>
                          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(totalAmount, currency)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleDeleteHeldOrder(heldOrder.id)}
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleRestoreHeldOrder(heldOrder.id)}
                            size="sm"
                            className="h-9 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-500/30"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Restore
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
            <Button
              onClick={() => setShowHeldOrdersDialog(false)}
              variant="outline"
              className="flex-1 rounded-xl h-11 font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Items Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="sm:max-w-2xl rounded-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                <ArrowRight className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Transfer Items</DialogTitle>
                <DialogDescription>
                  From Table {selectedTable?.tableNumber} to another table
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 py-4 px-2">
            <div className="space-y-4">
              {/* Target Table Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Target Table *</Label>
                <Select value={targetTableId} onValueChange={setTargetTableId}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        Table {table.tableNumber} {table.customer ? `- ${table.customer.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Items to Transfer */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Items to Transfer</Label>
                <div className="space-y-3">
                  {tableCart.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {item.name}
                          </h4>
                          {item.variantName && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.variantName}</p>
                          )}
                          {item.note && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 italic">"{item.note}"</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.price * item.quantity, currency)}
                          </p>
                          <p className="text-xs text-slate-500">Available: {item.quantity}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetMaxQuantity(item.id)}
                          className="h-8 text-xs"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          All
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={transferItems[item.id] || 0}
                          onChange={(e) => handleTransferQuantityChange(item.id, parseInt(e.target.value) || 0)}
                          className="h-8 text-center font-semibold"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleTransferQuantityChange(item.id, Math.max(0, (transferItems[item.id] || 0) - 1))}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleTransferQuantityChange(item.id, Math.min(item.quantity, (transferItems[item.id] || 0) + 1))}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
            <Button
              onClick={() => setShowTransferDialog(false)}
              variant="outline"
              className="flex-1 rounded-xl h-11 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransferItems}
              disabled={!targetTableId || Object.values(transferItems).every(qty => qty === 0)}
              className="flex-1 rounded-xl h-11 font-semibold bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 shadow-lg shadow-blue-500/30"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Transfer Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
