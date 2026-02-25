'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ShoppingCart, LayoutDashboard, Utensils, Package, Store, BarChart3, Settings, Users, LogOut, Lock, Globe, Coffee, Clock, TrendingUp, MapPin, UserRound, DollarSign, AlertTriangle, ArrowRight, Trash2, Gift, RefreshCw, Menu, Receipt as ReceiptIcon, Building, Tag, LayoutGrid, FileText } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useI18n, Language } from '@/lib/i18n-context';
import MenuManagement from '@/components/menu-management';
import POSInterface from '@/components/pos-interface';
import IngredientManagement from '@/components/ingredient-management';
import RecipeManagement from '@/components/recipe-management';
import BranchManagement from '@/components/branch-management';
import ReportsDashboard from '@/components/reports-dashboard';
import UserManagement from '@/components/user-management';
import ShiftManagement from '@/components/shift-management';
import AdvancedAnalytics from '@/components/advanced-analytics';
import DeliveryManagement from '@/components/delivery-management';
import CustomerManagement from '@/components/customer-management';
import CostManagement from '@/components/cost-management';
import InventoryAlerts from '@/components/inventory-alerts';
import InventoryTransfers from '@/components/inventory-transfers';
import WasteTracking from '@/components/waste-tracking';
import LoyaltyProgram from '@/components/loyalty-program';
import PromoCodesManagement from '@/components/promo-codes-management';
import ReceiptSettings from '@/components/receipt-settings';
import SuppliersManagement from '@/components/suppliers-management';
import PurchaseOrdersManagement from '@/components/purchase-orders-management';
import TableManagement from '@/components/table-management';
import AuditLogs from '@/components/audit-logs';
import { OfflineStatusIndicator } from '@/components/offline-status-indicator';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';
import { offlineManager } from '@/lib/offline/offline-manager';
import { showSuccessToast, showErrorToast, showWarningToast } from '@/hooks/use-toast';

export default function POSDashboard() {
  const router = useRouter();
  const { user, logout, isOnline } = useAuth();
  const { language, setLanguage, currency, t } = useI18n();
  const [activeTab, setActiveTab] = useState('pos');
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [userBranchName, setUserBranchName] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Register Service Worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator && typeof window !== 'undefined') {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.log('[PWA] Service Worker registration failed:', error);
        });
    }
  }, []);

  // Initialize offline manager and fetch data
  useEffect(() => {
    if (user && user.branchId) {
      // Only initialize offline manager if user has a branch (not HQ admin)
      const initData = async () => {
        try {
          console.log('[Dashboard] Initializing offline manager for branch:', user.branchId);

          // Initialize services - offline manager will initialize localStorageService internally
          await offlineManager.initialize(user.branchId);

          // Check if online before attempting sync
          const isOnline = offlineManager.isCurrentlyOnline();

          if (isOnline) {
            console.log('[Dashboard] Online, triggering sync...');
            // Trigger sync immediately
            const syncResult = await offlineManager.syncAll();

            console.log('[Dashboard] Sync completed:', syncResult);

            if (syncResult.success) {
              console.log(`[Dashboard] Sync successful: ${syncResult.operationsProcessed} operations processed`);
            } else if (syncResult.errors.length > 0 && !syncResult.errors.some(e => e.includes('already in progress'))) {
              // Only log errors if they're not "already in progress" (which is expected)
              console.error('[Dashboard] Sync failed:', syncResult.errors);
            }
          } else {
            console.log('[Dashboard] Currently offline - skipping sync, data available from cache');
          }
        } catch (err) {
          console.error('[Dashboard] Failed to initialize offline manager:', err);
        }
      };

      // Run initialization
      initData();
    } else if (user && !user.branchId) {
      console.log('[Dashboard] User has no branchId (HQ Admin), skipping offline sync');
    }
  }, [user?.branchId, user?.id]); // Add user.id to trigger on login

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches');
        const data = await response.json();
        if (response.ok && data.branches) {
          setBranches(data.branches);
          // Set user's branch name if they have a branchId
          if (user?.branchId) {
            const userBranch = data.branches.find((b: any) => b.id === user.branchId);
            if (userBranch) {
              setUserBranchName(userBranch.branchName);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      }
    };
    fetchBranches();
  }, [user?.branchId]);

  // Check authentication on mount
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // For cashiers, check if they have an active shift and redirect to shifts tab if not
  useEffect(() => {
    if (user && user.role === 'CASHIER' && user.branchId) {
      const fetchCurrentShift = async () => {
        try {
          const params = new URLSearchParams({
            branchId: user.branchId,
            cashierId: user.id,
            status: 'open',
          });
          const response = await fetch(`/api/shifts?${params.toString()}`);
          const data = await response.json();

          if (response.ok && data.shifts && data.shifts.length > 0) {
            // Has open shift, stay on current tab
            return;
          }

          // No open shift, redirect to shifts tab
          setActiveTab('shifts');
        } catch (error) {
          console.error('Failed to fetch current shift:', error);
        }
      };

      fetchCurrentShift();
    }
  }, [user]);

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

  // Get role badge styling
  const getRoleBadge = () => {
    switch (user.role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
            HQ Admin
          </span>
        );
      case 'BRANCH_MANAGER':
        return (
          <span className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-800 to-emerald-900 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
            Branch Manager
          </span>
        );
      case 'CASHIER':
        return (
          <span className="inline-flex items-center gap-2 bg-white/20 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
            Cashier
          </span>
        );
      default:
        return <span>{user.role}</span>;
    }
  };

  // Check if user can access certain features
  const canAccessHQFeatures = user.role === 'ADMIN';
  const canAccessBranchFeatures = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessPOS = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER' || user.role === 'CASHIER';
  const canAccessInventory = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessUsers = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessShifts = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER' || user.role === 'CASHIER';
  const canAccessAnalytics = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessDelivery = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessCustomers = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessCosts = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessTransfers = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessSuppliers = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessPurchaseOrders = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';
  const canAccessTables = user.role === 'ADMIN';
  const canAccessAuditLogs = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Navigation items for mobile menu
  const navigationItems = [
    { id: 'pos', label: t('dashboard.pos'), icon: ShoppingCart, show: canAccessPOS },
    { id: 'menu', label: t('dashboard.menu'), icon: Utensils, show: canAccessHQFeatures },
    { id: 'recipes', label: t('dashboard.recipes'), icon: Package, show: canAccessHQFeatures },
    { id: 'ingredients', label: t('dashboard.ingredients'), icon: Store, show: canAccessInventory },
    { id: 'inventory-alerts', label: 'Alerts', icon: AlertTriangle, show: canAccessInventory },
    { id: 'transfers', label: 'Transfers', icon: ArrowRight, show: canAccessTransfers },
    { id: 'waste', label: 'Waste', icon: Trash2, show: canAccessInventory },
    { id: 'loyalty', label: 'Loyalty', icon: Gift, show: canAccessCustomers },
    { id: 'promo-codes', label: 'Promo Codes', icon: Tag, show: canAccessCustomers },
    { id: 'suppliers', label: 'Suppliers', icon: Building, show: canAccessSuppliers },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, show: canAccessPurchaseOrders },
    { id: 'branches', label: t('dashboard.branches'), icon: LayoutDashboard, show: canAccessHQFeatures },
    { id: 'tables', label: 'Tables', icon: LayoutGrid, show: canAccessTables },
    { id: 'reports', label: t('dashboard.reports'), icon: BarChart3, show: canAccessBranchFeatures },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileText, show: canAccessAuditLogs },
    { id: 'users', label: t('dashboard.users'), icon: Users, show: canAccessUsers },
    { id: 'shifts', label: 'Shifts', icon: Clock, show: canAccessShifts },
    { id: 'delivery', label: 'Delivery', icon: MapPin, show: canAccessDelivery },
    { id: 'customers', label: 'Customers', icon: UserRound, show: canAccessCustomers },
    { id: 'costs', label: 'Costs', icon: DollarSign, show: canAccessCosts },
    { id: 'receipt', label: 'Receipt', icon: ReceiptIcon, show: canAccessHQFeatures },
  ].filter(item => item.show);

  return (
    <div className="min-h-screen">
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Premium Gradient Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-800">
          <div className="absolute inset-0 opacity-10">
            {/* Glass morphism effect */}
            <svg className="w-full h-full">
              <defs>
                <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#065f46" />
                  <stop offset="100%" stopColor="#064e3b" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#gradient1)" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Glassmorphism Header - Mobile Responsive */}
        <header className="sticky top-0 z-50 backdrop-blur-xl backdrop-saturate-150 bg-white/80/80 backdrop-filter blur(20px) border-b border-slate-200/200 shadow-2xl">
        <div className="px-2 sm:px-4 py-2 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Mobile Menu Button & Logo */}
            <div className="flex items-center gap-2 sm:gap-6">
              {/* Mobile Menu Button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="text-emerald-700">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Coffee className="h-6 w-6 text-emerald-600" />
                      <span className="text-xl font-bold text-emerald-900">Emperor POS</span>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-2">
                    {navigationItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Button
                          key={item.id}
                          variant={activeTab === item.id ? 'default' : 'ghost'}
                          className={`w-full justify-start gap-3 ${
                            activeTab === item.id
                              ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white'
                              : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
                          }`}
                          onClick={() => {
                            setActiveTab(item.id);
                            setMobileMenuOpen(false);
                          }}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Button>
                      );
                    })}
                    <div className="pt-4 border-t border-slate-200 mt-4">
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-red-600 hover:bg-red-50"
                        onClick={async () => {
                          await handleLogout();
                          setMobileMenuOpen(false);
                        }}
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{t('logout')}</span>
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Logo - Responsive */}
              <div className="flex items-center gap-2 sm:gap-3 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl shadow-lg">
                <Coffee className="h-5 w-5 sm:h-8 sm:w-8" />
                <span className="text-lg sm:text-2xl font-bold tracking-tight hidden sm:inline">Emperor</span>
                <span className="text-lg sm:text-2xl font-bold tracking-tight sm:hidden">Em</span>
              </div>
            </div>
            {/* User Info & Actions - Responsive */}
            <div className="flex items-center gap-1 sm:gap-3">
              {/* Compact User Info for Desktop */}
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  {getRoleBadge()}
                </div>
              </div>

              {/* Offline Status - Hide on mobile */}
              {user.branchId && (
                <div className="hidden sm:block">
                  <OfflineStatusIndicator branchId={user.branchId} />
                </div>
              )}

              {/* Sync Button - Only show on larger screens */}
              {user.branchId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const syncInfo = await offlineManager.getSyncInfo();
                      await offlineManager.checkActualConnectivity();
                      const isOnline = offlineManager.isCurrentlyOnline();
                      if (isOnline) {
                        const result = await offlineManager.forceSync();
                        if (result.success) {
                          showSuccessToast('Sync Complete', `Synced ${result.operationsProcessed} operations`);
                          setTimeout(() => window.location.reload(), 1500);
                        } else {
                          showErrorToast('Sync Failed', result.errors.join(', '));
                        }
                      } else {
                        const lastSync = syncInfo.lastPushTimestamp || syncInfo.lastPullTimestamp;
                        showWarningToast(
                          'Offline Mode',
                          `Pending: ${syncInfo.pendingOperations}. Last sync: ${lastSync ? new Date(lastSync).toLocaleString() : 'Never'}`
                        );
                      }
                    } catch (err) {
                      console.error('Manual sync error:', err);
                      showErrorToast('Sync Error', 'Failed to check sync status');
                    }
                  }}
                  className="border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900 hidden sm:flex"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync
                </Button>
              )}

              {/* Language Selector - Compact on mobile */}
              <Select value={language} onValueChange={(value: Language) => setLanguage(value)}>
                <SelectTrigger className="w-9 sm:w-40 h-9 sm:h-auto border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  <SelectValue className="hidden sm:block" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>

              {/* Logout Button - Icon only on mobile */}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => await handleLogout()}
                className="border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900 transition-all duration-300"
                title={t('logout')}
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('logout')}</span>
              </Button>
            </div>
          </div>

          {/* Compact Header Info for Mobile */}
          <div className="sm:hidden mt-2 pb-2 border-b border-slate-200/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 truncate">
                <span className="font-semibold">{user.name || user.username}</span>
              </span>
              {user.branchId && <OfflineStatusIndicator branchId={user.branchId} />}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-2 sm:px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop Tabs - Hidden on mobile */}
          <TabsList className="hidden lg:flex flex-wrap w-full bg-white/60 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/200 p-1">
            {/* POS - Available to all roles */}
            {canAccessPOS && (
              <TabsTrigger value="pos" className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700 text-emerald-700">
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t('dashboard.pos')}
              </TabsTrigger>
            )}
            {/* Menu - HQ Admin only */}
            {canAccessHQFeatures && (
              <TabsTrigger
                value="menu"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Utensils className="h-4 w-4 mr-2" />
                {t('dashboard.menu')}
              </TabsTrigger>
            )}
            {/* Recipes - HQ Admin only */}
            {canAccessHQFeatures && (
              <TabsTrigger
                value="recipes"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Package className="h-4 w-4 mr-2" />
                {t('dashboard.recipes')}
              </TabsTrigger>
            )}
            {/* Ingredients - Branch Manager and above */}
            {canAccessInventory && (
              <TabsTrigger
                value="ingredients"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Store className="h-4 w-4 mr-2" />
                {t('dashboard.ingredients')}
              </TabsTrigger>
            )}
            {/* Inventory Alerts - Branch Manager and above */}
            {canAccessInventory && (
              <TabsTrigger
                value="inventory-alerts"
                className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Alerts
              </TabsTrigger>
            )}
            {/* Transfers - Branch Manager and above */}
            {canAccessTransfers && (
              <TabsTrigger
                value="transfers"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Transfers
              </TabsTrigger>
            )}
            {/* Waste - Branch Manager and above */}
            {canAccessInventory && (
              <TabsTrigger
                value="waste"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Waste
              </TabsTrigger>
            )}
            {/* Loyalty - Branch Manager and above */}
            {canAccessCustomers && (
              <TabsTrigger
                value="loyalty"
                className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <Gift className="h-4 w-4 mr-2" />
                Loyalty
              </TabsTrigger>
            )}
            {/* Promo Codes - Branch Manager and above */}
            {canAccessCustomers && (
              <TabsTrigger
                value="promo-codes"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Tag className="h-4 w-4 mr-2" />
                Promo Codes
              </TabsTrigger>
            )}
            {/* Suppliers - Branch Manager and above */}
            {canAccessSuppliers && (
              <TabsTrigger
                value="suppliers"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Building className="h-4 w-4 mr-2" />
                Suppliers
              </TabsTrigger>
            )}
            {/* Purchase Orders - Branch Manager and above */}
            {canAccessPurchaseOrders && (
              <TabsTrigger
                value="purchase-orders"
                className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Purchase Orders
              </TabsTrigger>
            )}
            {/* Branches - HQ Admin only */}
            {canAccessHQFeatures && (
              <TabsTrigger
                value="branches"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                {t('dashboard.branches')}
              </TabsTrigger>
            )}
            {/* Reports - Branch Manager and above */}
            {canAccessBranchFeatures && (
              <TabsTrigger
                value="reports"
                className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {t('dashboard.reports')}
              </TabsTrigger>
            )}
            {/* Audit Logs - Branch Manager and above */}
            {canAccessAuditLogs && (
              <TabsTrigger
                value="audit-logs"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                Audit Logs
              </TabsTrigger>
            )}
            {/* Users - Branch Manager and above */}
            {canAccessUsers && (
              <TabsTrigger
                value="users"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Users className="h-4 w-4 mr-2" />
                {t('dashboard.users')}
              </TabsTrigger>
            )}
            {/* Shifts - Available to all roles */}
            {canAccessShifts && (
              <TabsTrigger
                value="shifts"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Clock className="h-4 w-4 mr-2" />
                Shifts
              </TabsTrigger>
            )}
            {/* Delivery - Branch Manager and above */}
            {canAccessDelivery && (
              <TabsTrigger
                value="delivery"
                className="data-[state=active]:bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Delivery
              </TabsTrigger>
            )}
            {/* Customers - Branch Manager and above */}
            {canAccessCustomers && (
              <TabsTrigger
                value="customers"
                className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <UserRound className="h-4 w-4 mr-2" />
                Customers
              </TabsTrigger>
            )}
            {/* Costs - Branch Manager and above */}
            {canAccessCosts && (
              <TabsTrigger
                value="costs"
                className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Costs
              </TabsTrigger>
            )}
            {/* Receipt Settings - Admin only */}
            {canAccessHQFeatures && (
              <TabsTrigger
                value="receipt"
                className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <ReceiptIcon className="h-4 w-4 mr-2" />
                Receipt
              </TabsTrigger>
            )}
            {/* Tables - Admin only */}
            {canAccessTables && (
              <TabsTrigger
                value="tables"
                className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Tables
              </TabsTrigger>
            )}
          </TabsList>

          <div className="mt-6">
            <TabsContent value="pos" className="space-y-4">
              {canAccessPOS ? (
                <POSInterface />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Lock className="h-12 w-12 text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Access Denied</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
                      Your role (<strong className="capitalize">{user.role.toLowerCase().replace('_', ' ')}</strong>) does not have permission to access the POS terminal.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="menu" className="space-y-4">
              {canAccessHQFeatures ? (
                <MenuManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="recipes" className="space-y-4">
              {canAccessHQFeatures ? (
                <RecipeManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="ingredients" className="space-y-4">
              {canAccessInventory ? (
                <IngredientManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="inventory-alerts" className="space-y-4">
              {canAccessInventory ? (
                <InventoryAlerts />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>



            <TabsContent value="transfers" className="space-y-4">
              {canAccessTransfers ? (
                <InventoryTransfers />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="waste" className="space-y-4">
              {canAccessInventory ? (
                <WasteTracking />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="loyalty" className="space-y-4">
              {canAccessCustomers ? (
                <LoyaltyProgram />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="promo-codes" className="space-y-4">
              {canAccessCustomers ? (
                <PromoCodesManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-4">
              {canAccessSuppliers ? (
                <SuppliersManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="purchase-orders" className="space-y-4">
              {canAccessPurchaseOrders ? (
                <PurchaseOrdersManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="branches" className="space-y-4">
              {canAccessHQFeatures ? (
                <BranchManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              {canAccessBranchFeatures ? (
                <ReportsDashboard />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="audit-logs" className="space-y-4">
              {canAccessAuditLogs ? (
                <AuditLogs />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              {canAccessUsers ? (
                <UserManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="shifts" className="space-y-4">
              {canAccessShifts ? (
                <ShiftManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="delivery" className="space-y-4">
              {canAccessDelivery ? (
                <DeliveryManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="customers" className="space-y-4">
              {canAccessCustomers ? (
                <CustomerManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="costs" className="space-y-4">
              {canAccessCosts ? (
                <CostManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="receipt" className="space-y-4">
              {canAccessHQFeatures ? (
                <ReceiptSettings />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>

            <TabsContent value="tables" className="space-y-4">
              {canAccessTables ? (
                <TableManagement />
              ) : (
                <AccessDenied user={user} />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200/200 mt-auto">
        <div className="px-2 sm:px-4 py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 text-xs sm:text-sm text-slate-500">
            <p>© 2026 Emperor Coffee. All rights reserved.</p>
            <div className="text-slate-400">Premium POS System</div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}

function AccessDenied({ user }: { user: any }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Lock className="h-12 w-12 text-slate-400 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Access Denied</h3>
        <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
          Your role (<strong className="capitalize">{user.role.toLowerCase().replace('_', ' ')}</strong>) does not have permission to access this feature. 
          Please contact an <strong>HQ Admin</strong> if you believe this is an error.
        </p>
      </CardContent>
    </Card>
  );
}
