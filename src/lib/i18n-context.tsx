'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'ar';
export type Currency = 'EGP' | 'USD';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Common
    'welcome': 'Welcome',
    'login': 'Sign In',
    'logout': 'Logout',
    'loading': 'Loading...',
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'add': 'Add',
    'search': 'Search',
    'actions': 'Actions',
    'status': 'Status',

    // Login
    'login.title': 'Welcome Back',
    'login.subtitle': 'Enter your credentials to access Emperor Coffee POS',
    'username': 'Username',
    'password': 'Password',
    'demo.credentials': 'Demo Credentials:',
    'password.security': 'Password Security:',
    'password.security.note': 'All passwords are bcrypt-hashed for your protection',

    // Dashboard
    'dashboard.pos': 'POS',
    'dashboard.menu': 'Menu',
    'dashboard.recipes': 'Recipes',
    'dashboard.ingredients': 'Inventory',
    'dashboard.branches': 'Branches',
    'dashboard.reports': 'Reports',
    'dashboard.users': 'Users',
    'dashboard.shifts': 'Shifts',
    'dashboard.analytics': 'Analytics',

    // POS
    'pos.menu.items': 'Menu Items',
    'pos.categories.all': 'All Items',
    'pos.categories.hot': 'Hot Drinks',
    'pos.categories.cold': 'Cold Drinks',
    'pos.categories.pastries': 'Pastries',
    'pos.categories.snacks': 'Snacks',
    'pos.cart.title': 'Current Order',
    'pos.cart.empty': 'Cart is empty',
    'pos.cart.add.items': 'Click items to add them',
    'pos.subtotal': 'Subtotal',
    'pos.total': 'Total',
    'pos.cash': 'Cash',
    'pos.card': 'Card',
    'pos.print': 'Print Receipt',
    'pos.process.sale': 'Process Sale for Branch',
    'pos.branch': 'Branch',
    'pos.select.branch': 'Select branch...',
    'pos.select.branch.prompt': 'Please select a branch to process this sale',
    'pos.order.type': 'Order Type',
    'pos.order-type.dine-in': 'Dine-in',
    'pos.order-type.take-away': 'Take-away',
    'pos.order-type.delivery': 'Delivery',
    'pos.delivery.fee': 'Delivery Fee',
    'pos.delivery.address': 'Delivery Address',
    'pos.delivery.address.placeholder': 'Enter delivery address...',
    'pos.delivery.area': 'Delivery Area',
    'pos.delivery.area.placeholder': 'Select delivery area',
    'pos.delivery.area.none': 'None',
    'order.type': 'Order Type',
    'order.delivery.fee': 'Delivery Fee',
    'order.subtotal': 'Subtotal',
    'order.total': 'Total',
    'order.payment': 'Payment Method',
    'order.delivery.address': 'Delivery Address',
    'order.delivery.area': 'Delivery Area',

    // Alerts
    'alerts.low.stock': 'Low Stock Items',

    // Inventory
    'inventory.waste': 'Record Waste',
    'inventory.restock': 'Restock Inventory',

    // Branch
    'branch.select': 'View Reports for Branch:',
    'branch.your': 'Your Branch',
    'branch.view.inventory': 'View Inventory for Branch:',
    'branch.downtown': 'Downtown',
    'branch.airport': 'Airport',
    'branch.all': 'All Branches',

    // Reports
    'reports.sales': 'Sales',
    'reports.inventory': 'Inventory',
    'reports.total.sales': 'Total Sales',
    'reports.net.sales': 'Net Sales',
    'reports.total.orders': 'Total Orders',
    'reports.avg.order': 'Avg Order Value',
    'reports.gross.sales': 'Gross sales before tax',
    'reports.items.sold': 'items sold',
    'reports.per.transaction': 'Per transaction',
    'reports.sales.details': 'Sales Details',
    'reports.total.ingredients': 'Total Ingredients',
    'reports.low.stock': 'Low Stock Alert',
    'reports.critical.stock': 'Critical Stock',
    'reports.all.tracked': 'All tracked items',
    'reports.below.threshold': 'Below reorder threshold',
    'reports.needs.restock': 'Needs immediate restock',
    'reports.inventory.status': 'Inventory Status',
    'reports.current.stock': 'Current Stock',
    'reports.reorder.level': 'Reorder Level',
    'reports.stock.ok': 'In Stock',
    'reports.stock.low': 'Low',
    'reports.stock.critical': 'Critical',

    // Orders
    'order.number': 'Order #',
    'order.items': 'Items',
    'order.total': 'Total',
    'order.cashier': 'Cashier',
    'order.time': 'Time',
    'order.processing': 'Processing order...',
    'order.success': 'Order processed successfully!',
    'order.details': 'Order Details',
    'order.payment': 'Payment',
    'order.invoice': 'Invoice',
    'order.refund': 'Refund',
    'order.refund.confirm': 'Are you sure you want to refund this order?',
    'order.refund.admin.password': 'Enter Admin Password',
    'order.refund.admin.prompt': 'This action requires administrator approval',
    'access.denied': 'Access Denied - You do not have permission to access this feature',

    // Shifts
    'shifts.title': 'Shift Management',
    'shifts.description': 'Track and manage cashier shifts with sales tracking',
    'shifts.open': 'Open Shift',
    'shifts.close': 'Close Shift',
    'shifts.history': 'Shift History',
    'shifts.opening.cash': 'Opening Cash',
    'shifts.closing.cash': 'Closing Cash',
    'shifts.orders': 'Orders',
    'shifts.revenue': 'Revenue',
    'shifts.cash.diff': 'Cash Diff',
    'shifts.status.open': 'Open',
    'shifts.status.closed': 'Closed',
    'shifts.open.new': 'Open New Shift',
    'shifts.cashier': 'Cashier',
    'shifts.date': 'Date',
    'shifts.time': 'Time',
    'shifts.actions': 'Actions',
    'shifts.select.cashier': 'Select cashier...',
    'shifts.notes': 'Notes',
    'shifts.opening.notes': 'Opening Notes',
    'shifts.closing.notes': 'Closing Notes (Optional)',
    'shifts.expected.cash': 'Expected Cash',

    // Analytics
    'analytics.title': 'Advanced Analytics',
    'analytics.description': 'Sales trends, forecasting, and performance insights',
    'analytics.trends': 'Sales Trends',
    'analytics.forecast': 'Forecast',
    'analytics.products': 'Top Products',
    'analytics.hourly': 'Hourly Sales',
    'analytics.total.revenue': 'Total Revenue',
    'analytics.total.orders': 'Total Orders',
    'analytics.avg.order': 'Avg Order Value',
    'analytics.peak.hour': 'Peak Hour',
    'analytics.revenue.trend': 'Revenue Trend',
    'analytics.orders.trend': 'Orders Trend',
    'analytics.forecast.title': '7-Day Revenue Forecast',
    'analytics.forecast.description': 'Predicted revenue based on historical data',
    'analytics.total.predicted': 'Total Predicted',
    'analytics.average.daily': 'Average Daily',
    'analytics.confidence.high': 'high',
    'analytics.confidence.medium': 'medium',
    'analytics.confidence.low': 'low',
    'analytics.top.products': 'Top Performing Products',
    'analytics.top.description': 'Best-selling items by revenue',
    'analytics.sold': 'sold',
    'analytics.hourly.distribution': 'Hourly Sales Distribution',
    'analytics.hourly.description': 'Average revenue and orders by hour of day',

    // Receipt
    'receipt.title': 'Receipt',
    'receipt.search': 'Receipt Search',
    'receipt.search.description': 'Search for orders to view and print receipts',
    'receipt.search.placeholder': 'Search by order number or transaction ID...',
    'receipt.no.orders': 'No orders found',
    'receipt.type.characters': 'Type at least 3 characters to search',
    'receipt.print': 'Print Receipt',
    'receipt.download': 'Download',
  },
  ar: {
    // Common
    'welcome': 'مرحباً',
    'login': 'تسجيل الدخول',
    'logout': 'تسجيل الخروج',
    'loading': 'جاري التحميل...',
    'save': 'حفظ',
    'cancel': 'إلغاء',
    'delete': 'حذف',
    'edit': 'تعديل',
    'add': 'إضافة',
    'search': 'بحث',
    'actions': 'الإجراءات',
    'status': 'الحالة',

    // Login
    'login.title': 'مرحباً بعودتك',
    'login.subtitle': 'أدخل بيانات الاعتماد للوصول إلى نظام نقاط البيع',
    'username': 'اسم المستخدم',
    'password': 'كلمة المرور',
    'demo.credentials': 'بيانات التجريب:',
    'password.security': 'أمان كلمة المرور:',
    'password.security.note': 'جميع كلمات المرور مشفرة لحمايتك',

    // Dashboard
    'dashboard.pos': 'نقاط البيع',
    'dashboard.menu': 'القائمة',
    'dashboard.recipes': 'الوصفات',
    'dashboard.ingredients': 'المخزون',
    'dashboard.branches': 'الفروع',
    'dashboard.reports': 'التقارير',
    'dashboard.users': 'المستخدمين',
    'dashboard.shifts': 'الورديات',
    'dashboard.analytics': 'التحليلات المتقدمة',

    // POS
    'pos.menu.items': 'عناصر القائمة',
    'pos.categories.all': 'جميع العناصر',
    'pos.categories.hot': 'مشروبات ساخنة',
    'pos.categories.cold': 'مشروبات باردة',
    'pos.categories.pastries': 'معجنات',
    'pos.categories.snacks': 'وجبات خفيفة',
    'pos.cart.title': 'الطلب الحالي',
    'pos.cart.empty': 'السلة فارغة',
    'pos.cart.add.items': 'اضغط على العناصر لإضافتها',
    'pos.subtotal': 'المجموع الجزئي',
    'pos.total': 'الإجمالي',
    'pos.cash': 'نقداً',
    'pos.card': 'بطاقة',
    'pos.print': 'طباعة الفاتورة',
    'pos.process.sale': 'معالجة البيع للفرع',
    'pos.branch': 'الفرع',
    'pos.select.branch': 'اختر الفرع...',
    'pos.select.branch.prompt': 'الرجاء اختيار فرع لمعالجة هذا البيع',
    'pos.order.type': 'نوع الطلب',
    'pos.order-type.dine-in': 'تناول بالمكان',
    'pos.order-type.take-away': 'استلام خارج',
    'pos.order-type.delivery': 'توصيل',
    'pos.delivery.fee': 'رسوم التوصيل',
    'pos.delivery.address': 'عنوان التوصيل',
    'pos.delivery.address.placeholder': 'أدخل عنوان التوصيل...',
    'pos.delivery.area': 'منطقة التوصيل',
    'pos.delivery.area.placeholder': 'اختر منطقة التوصيل',
    'pos.delivery.area.none': 'لا شيء',
    'order.type': 'نوع الطلب',
    'order.delivery.fee': 'رسوم التوصيل',
    'order.subtotal': 'المجموع الجزئي',
    'order.total': 'الإجمالي',
    'order.payment': 'طريقة الدفع',
    'order.delivery.address': 'عنوان التوصيل',
    'order.delivery.area': 'منطقة التوصيل',

    // Alerts
    'alerts.low.stock': 'عناصر منخفضة المخزون',

    // Inventory
    'inventory.waste': 'تسجيل الهدر',
    'inventory.restock': 'إعادة تخزين',

    // Branch
    'branch.select': 'عرض التقارير للفرع:',
    'branch.your': 'فرعك',
    'branch.view.inventory': 'عرض المخزون للفرع:',
    'branch.downtown': 'الوسط',
    'branch.airport': 'المطار',
    'branch.all': 'جميع الفروع',

    // Reports
    'reports.sales': 'المبيعات',
    'reports.inventory': 'المخزون',
    'reports.total.sales': 'إجمالي المبيعات',
    'reports.net.sales': 'صافي المبيعات',
    'reports.total.orders': 'إجمالي الطلبات',
    'reports.avg.order': 'متوسط قيمة الطلب',
    'reports.gross.sales': 'المبيعات الإجمالية قبل الضريبة',
    'reports.items.sold': 'عناصر مباعة',
    'reports.per.transaction': 'لكل معاملة',
    'reports.sales.details': 'تفاصيل المبيعات',
    'reports.total.ingredients': 'إجمالي العناصر',
    'reports.low.stock': 'تنبيه انخفاض المخزون',
    'reports.critical.stock': 'مخزون حرج',
    'reports.all.tracked': 'جميع العناصر المتابعة',
    'reports.below.threshold': 'أقل من حد إعادة الطلب',
    'reports.needs.restock': 'يحتاج إعادة تخزين فورية',
    'reports.inventory.status': 'حالة المخزون',
    'reports.current.stock': 'المخزون الحالي',
    'reports.reorder.level': 'مستوى إعادة الطلب',
    'reports.stock.ok': 'متوفر',
    'reports.stock.low': 'منخفض',
    'reports.stock.critical': 'حرج',

    // Orders
    'order.number': 'رقم الطلب #',
    'order.items': 'العناصر',
    'order.total': 'الإجمالي',
    'order.cashier': 'الكاشير',
    'order.time': 'الوقت',
    'order.processing': 'جاري معالجة الطلب...',
    'order.success': 'تمت معالجة الطلب بنجاح!',
    'order.details': 'تفاصيل الطلب',
    'order.payment': 'طريقة الدفع',
    'order.invoice': 'فاتورة',
    'order.refund': 'إلغاء الطلب',
    'order.refund.confirm': 'هل أنت متأكد من إلغاء هذا الطلب؟',
    'order.refund.admin.password': 'أدخل كلمة مرور المدير',
    'order.refund.admin.prompt': 'هذا الإجراء يتطلب موافقة المدير',
    'access.denied': 'تم رفض الوصول - ليس لديك الإذن للوصول إلى هذه الميزة',

    // Shifts
    'shifts.title': 'إدارة الورديات',
    'shifts.description': 'تتبع وإدارة ورديات الكاشير مع تتبع المبيعات',
    'shifts.open': 'فتح الوردية',
    'shifts.close': 'إغلاق الوردية',
    'shifts.history': 'سجل الورديات',
    'shifts.opening.cash': 'النقدية الافتتاحية',
    'shifts.closing.cash': 'النقدية الإغلاقية',
    'shifts.orders': 'الطلبات',
    'shifts.revenue': 'الإيرادات',
    'shifts.cash.diff': 'فرق النقدية',
    'shifts.status.open': 'مفتوحة',
    'shifts.status.closed': 'مغلقة',
    'shifts.open.new': 'فتح وردية جديدة',
    'shifts.cashier': 'الكاشير',
    'shifts.date': 'التاريخ',
    'shifts.time': 'الوقت',
    'shifts.actions': 'الإجراءات',
    'shifts.select.cashier': 'اختر الكاشير...',
    'shifts.notes': 'ملاحظات',
    'shifts.opening.notes': 'ملاحظات الافتتاح',
    'shifts.closing.notes': 'ملاحظات الإغلاق (اختياري)',
    'shifts.expected.cash': 'النقدية المتوقعة',

    // Analytics
    'analytics.title': 'التحليلات المتقدمة',
    'analytics.description': 'اتجاهات المبيعات، التنبؤات، ورؤى الأداء',
    'analytics.trends': 'اتجاهات المبيعات',
    'analytics.forecast': 'التنبؤات',
    'analytics.products': 'المنتجات الأكثر مبيعاً',
    'analytics.hourly': 'المبيعات الساعية',
    'analytics.total.revenue': 'إجمالي الإيرادات',
    'analytics.total.orders': 'إجمالي الطلبات',
    'analytics.avg.order': 'متوسط قيمة الطلب',
    'analytics.peak.hour': 'ساعة الذروة',
    'analytics.revenue.trend': 'اتجاه الإيرادات',
    'analytics.orders.trend': 'اتجاه الطلبات',
    'analytics.forecast.title': 'تنبؤ إيرادات 7 أيام',
    'analytics.forecast.description': 'الإيرادات المتوقعة بناءً على البيانات التاريخية',
    'analytics.total.predicted': 'الإجمالي المتوقع',
    'analytics.average.daily': 'المتوسط اليومي',
    'analytics.confidence.high': 'عالية',
    'analytics.confidence.medium': 'متوسطة',
    'analytics.confidence.low': 'منخفضة',
    'analytics.top.products': 'أفضل المنتجات أداءً',
    'analytics.top.description': 'أفضل المنتجات مبيعاً حسب الإيرادات',
    'analytics.sold': 'تم بيعها',
    'analytics.hourly.distribution': 'توزيع المبيعات الساعية',
    'analytics.hourly.description': 'متوسط الإيرادات والطلبات حسب ساعة اليوم',

    // Receipt
    'receipt.title': 'فاتورة',
    'receipt.search': 'بحث الفاتورة',
    'receipt.search.description': 'البحث عن الطلبات لعرض وطباعة الفواتير',
    'receipt.search.placeholder': 'البحث برقم الطلب أو معرف المعاملة...',
    'receipt.no.orders': 'لم يتم العثور على طلبات',
    'receipt.type.characters': 'اكتب 3 أحرف على الأقل للبحث',
    'receipt.print': 'طباعة الفاتورة',
    'receipt.download': 'تنزيل',
  },
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [currency, setCurrency] = useState<Currency>('EGP');

  // Update html lang and dir when language changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      html.setAttribute('lang', language);
      html.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    }
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, currency, setCurrency, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
