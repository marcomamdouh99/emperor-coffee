import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateReceiptESCPOS, ReceiptData } from '@/lib/escpos-encoder';

const FIXED_SETTINGS_ID = 'global-receipt-settings';

/**
 * GET /api/orders/orderId/receipt/escpos
 * Generate a raw ESC/POS receipt for thermal printers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    console.log('[ESC/POS] Generating receipt for order:', orderId);

    // Test database connection
    try {
      await db.$connect();
      console.log('[ESC/POS] Database connected successfully');
    } catch (dbError) {
      console.error('[ESC/POS] Database connection failed:', dbError);
      return NextResponse.json(
        {
          error: 'Database connection failed',
          message: 'Could not connect to database. Please check DATABASE_URL environment variable.',
          details: dbError instanceof Error ? dbError.message : String(dbError),
        },
        { status: 500 }
      );
    }

    // Fetch order with all related data
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        branch: true,
        cashier: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    if (!order) {
      console.log('[ESC/POS] Order not found:', orderId);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    console.log('[ESC/POS] Order found:', {
      orderNumber: order.orderNumber,
      branch: order.branch?.branchName,
      itemCount: order.items.length,
    });

    // Default settings
    let receiptSettings = {
      storeName: 'Emperor Coffee',
      branchName: 'Coffee Shop',
      headerText: 'Quality Coffee Since 2024',
      footerText: 'Visit us again soon!',
      thankYouMessage: 'Thank you for your purchase!',
      fontSize: 'medium' as const,
      showLogo: true,
      showCashier: true,
      showDateTime: true,
      showOrderType: true,
      showCustomerInfo: true,
      openCashDrawer: true,
      cutPaper: true,
      cutType: 'full' as const,
      paperWidth: 80,
    };

    // Fetch receipt settings - try branch-specific first, then fallback to global
    try {
      const dbSettings = await db.receiptSettings.findFirst({
        where: {
          OR: [
            { branchId: order.branchId },
            { branchId: null }
          ]
        },
        orderBy: {
          branchId: 'desc' // Prefer branch-specific settings over global
        }
      });

      if (dbSettings) {
        receiptSettings = {
          storeName: dbSettings.storeName,
          branchName: order.branch?.branchName || 'Coffee Shop', // Use actual branch name
          headerText: dbSettings.headerText || undefined,
          footerText: dbSettings.footerText || undefined,
          thankYouMessage: dbSettings.thankYouMessage,
          fontSize: dbSettings.fontSize as 'small' | 'medium' | 'large',
          showLogo: dbSettings.showLogo,
          showCashier: dbSettings.showCashier,
          showDateTime: dbSettings.showDateTime,
          showOrderType: dbSettings.showOrderType,
          showCustomerInfo: dbSettings.showCustomerInfo,
          showBranchPhone: dbSettings.showBranchPhone ?? true,
          showBranchAddress: dbSettings.showBranchAddress ?? true,
          openCashDrawer: dbSettings.openCashDrawer,
          cutPaper: dbSettings.cutPaper,
          cutType: dbSettings.cutType as 'full' | 'partial',
          paperWidth: dbSettings.paperWidth,
          logoData: dbSettings.logoData || undefined,
        };

        console.log('[ESC/POS] Receipt settings loaded:', {
          storeName: receiptSettings.storeName,
          branchName: receiptSettings.branchName,
          hasLogo: !!receiptSettings.logoData,
          fontSize: receiptSettings.fontSize,
          showBranchPhone: receiptSettings.showBranchPhone,
          showBranchAddress: receiptSettings.showBranchAddress,
          branchPhone: order.branch?.phone,
          branchAddress: order.branch?.address,
        });
      } else {
        console.log('[ESC/POS] No settings found, using defaults');
      }
    } catch (error) {
      console.error('[ESC/POS] Failed to fetch settings:', error);
    }

    // Fetch promo code if promoCodeId exists
    let promoCode: string | undefined = undefined;
    if (order.promoCodeId) {
      try {
        const promoCodeData = await db.promotionCode.findUnique({
          where: { id: order.promoCodeId },
          select: { code: true },
        });
        promoCode = promoCodeData?.code || undefined;
      } catch (error) {
        console.error('[ESC/POS] Failed to fetch promo code:', error);
      }
    }

    // Prepare receipt data
    const receiptData: ReceiptData = {
      storeName: receiptSettings.storeName,
      branchName: order.branch?.branchName || receiptSettings.branchName,
      branchPhone: order.branch?.phone || undefined,
      branchAddress: order.branch?.address || undefined,
      orderNumber: order.orderNumber,
      date: new Date(order.orderTimestamp),
      cashier: order.cashier?.name || order.cashier?.username || 'Unknown',
      orderType: order.orderType as any,
      customerPhone: order.customerPhone || undefined,
      customerName: order.customerName || undefined,
      deliveryAddress: order.deliveryAddress || undefined,
      items: order.items.map(item => ({
        itemName: item.itemName,
        quantity: item.quantity,
        subtotal: item.subtotal,
        price: item.unitPrice,
      })),
      subtotal: order.subtotal || 0,
      deliveryFee: order.deliveryFee,
      loyaltyDiscount: order.loyaltyDiscount || undefined,
      loyaltyPointsRedeemed: order.loyaltyPointsRedeemed || undefined,
      promoDiscount: order.promoDiscount || undefined,
      promoCode: promoCode,
      total: order.totalAmount,
      paymentMethod: order.paymentMethod as 'cash' | 'card',
      isRefunded: order.isRefunded,
      refundReason: order.refundReason || undefined,
      // Receipt settings
      logoData: receiptSettings.logoData,
      headerText: receiptSettings.headerText,
      footerText: receiptSettings.footerText,
      thankYouMessage: receiptSettings.thankYouMessage,
      fontSize: receiptSettings.fontSize,
      showLogo: receiptSettings.showLogo,
      showCashier: receiptSettings.showCashier,
      showDateTime: receiptSettings.showDateTime,
      showOrderType: receiptSettings.showOrderType,
      showCustomerInfo: receiptSettings.showCustomerInfo,
      showBranchPhone: receiptSettings.showBranchPhone,
      showBranchAddress: receiptSettings.showBranchAddress,
      openCashDrawer: receiptSettings.openCashDrawer,
      cutPaper: receiptSettings.cutPaper,
      cutType: receiptSettings.cutType,
    };

    console.log('[ESC/POS] Receipt data prepared');

    // Generate ESC/POS data
    const escposData = generateReceiptESCPOS(receiptData);

    console.log('[ESC/POS] Generated receipt, size:', escposData.length);

    // Return as base64
    const base64Data = Buffer.from(escposData).toString('base64');

    return NextResponse.json({
      success: true,
      order,
      escposData: base64Data,
      size: escposData.length,
    });

  } catch (error) {
    console.error('[ESC/POS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      {
        error: 'Failed to generate receipt',
        message: errorMessage,
        details: errorStack,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
