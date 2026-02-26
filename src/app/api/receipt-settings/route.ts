import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/receipt-settings
 * Fetch receipt settings from database
 */
export async function GET() {
  try {
    console.log('[GET] Fetching receipt settings from database...');

    // Try to get settings from database
    let settings = await db.receiptSettings.findFirst();

    // If no settings exist, create default settings
    if (!settings) {
      console.log('[GET] No settings found, creating defaults...');
      settings = await db.receiptSettings.create({
        data: {
          storeName: 'Emperor Coffee',
          branchName: 'Coffee Shop',
          headerText: 'Quality Coffee Since 2024',
          footerText: 'Visit us again soon!',
          thankYouMessage: 'Thank you for your purchase!',
          fontSize: 'medium',
          showLogo: true,
          showCashier: true,
          showDateTime: true,
          showOrderType: true,
          showCustomerInfo: true,
          openCashDrawer: true,
          cutPaper: true,
          cutType: 'full',
          paperWidth: 80,
        },
      });

      console.log('[GET] Created default receipt settings:', settings.id);
    }

    console.log('[GET] Successfully fetched receipt settings:', {
      id: settings.id,
      storeName: settings.storeName,
      hasLogo: !!settings.logoData,
    });

    return NextResponse.json({
      success: true,
      settings: {
        storeName: settings.storeName,
        branchName: settings.branchName,
        headerText: settings.headerText,
        footerText: settings.footerText,
        thankYouMessage: settings.thankYouMessage,
        fontSize: settings.fontSize as 'small' | 'medium' | 'large',
        showLogo: settings.showLogo,
        logoData: settings.logoData,
        showCashier: settings.showCashier,
        showDateTime: settings.showDateTime,
        showOrderType: settings.showOrderType,
        showCustomerInfo: settings.showCustomerInfo,
        openCashDrawer: settings.openCashDrawer,
        cutPaper: settings.cutPaper,
        cutType: settings.cutType as 'full' | 'partial',
        paperWidth: settings.paperWidth,
      },
    });
  } catch (error) {
    console.error('[GET] Error fetching receipt settings:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: 'Failed to fetch receipt settings',
        message: errorMessage,
        stack: errorStack,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/receipt-settings
 * Save receipt settings to database
 */
export async function POST(request: NextRequest) {
  try {
    const settings = await request.json();

    console.log('[POST] Saving receipt settings:', {
      storeName: settings.storeName,
      branchName: settings.branchName,
      hasLogo: !!settings.logoData,
    });

    // Validate required fields
    if (!settings.storeName || !settings.thankYouMessage) {
      console.error('[POST] Validation failed: Missing required fields');
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'storeName and thankYouMessage are required',
        },
        { status: 400 }
      );
    }

    // Use upsert to either create or update
    // We'll use a fixed ID to ensure only one row exists
    const FIXED_ID = 'global-receipt-settings';

    const result = await db.receiptSettings.upsert({
      where: { id: FIXED_ID },
      update: {
        storeName: settings.storeName,
        branchName: settings.branchName || 'Coffee Shop',
        headerText: settings.headerText || null,
        footerText: settings.footerText || null,
        thankYouMessage: settings.thankYouMessage,
        fontSize: settings.fontSize || 'medium',
        showLogo: settings.showLogo ?? true,
        logoData: settings.logoData || null,
        showCashier: settings.showCashier ?? true,
        showDateTime: settings.showDateTime ?? true,
        showOrderType: settings.showOrderType ?? true,
        showCustomerInfo: settings.showCustomerInfo ?? true,
        openCashDrawer: settings.openCashDrawer ?? true,
        cutPaper: settings.cutPaper ?? true,
        cutType: settings.cutType || 'full',
        paperWidth: settings.paperWidth || 80,
      },
      create: {
        id: FIXED_ID,
        storeName: settings.storeName,
        branchName: settings.branchName || 'Coffee Shop',
        headerText: settings.headerText || null,
        footerText: settings.footerText || null,
        thankYouMessage: settings.thankYouMessage,
        fontSize: settings.fontSize || 'medium',
        showLogo: settings.showLogo ?? true,
        logoData: settings.logoData || null,
        showCashier: settings.showCashier ?? true,
        showDateTime: settings.showDateTime ?? true,
        showOrderType: settings.showOrderType ?? true,
        showCustomerInfo: settings.showCustomerInfo ?? true,
        openCashDrawer: settings.openCashDrawer ?? true,
        cutPaper: settings.cutPaper ?? true,
        cutType: settings.cutType || 'full',
        paperWidth: settings.paperWidth || 80,
      },
    });

    console.log('[POST] Successfully saved receipt settings:', result.id);

    return NextResponse.json({
      success: true,
      settings: {
        storeName: result.storeName,
        branchName: result.branchName,
        headerText: result.headerText,
        footerText: result.footerText,
        thankYouMessage: result.thankYouMessage,
        fontSize: result.fontSize as 'small' | 'medium' | 'large',
        showLogo: result.showLogo,
        logoData: result.logoData,
        showCashier: result.showCashier,
        showDateTime: result.showDateTime,
        showOrderType: result.showOrderType,
        showCustomerInfo: result.showCustomerInfo,
        openCashDrawer: result.openCashDrawer,
        cutPaper: result.cutPaper,
        cutType: result.cutType as 'full' | 'partial',
        paperWidth: result.paperWidth,
      },
    });
  } catch (error) {
    console.error('[POST] Error saving receipt settings:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Error';

    return NextResponse.json(
      {
        error: 'Failed to save receipt settings',
        name: errorName,
        message: errorMessage,
        stack: errorStack,
        details: String(error),
      },
      { status: 500 }
    );
  }
}
