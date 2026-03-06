import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/receipt-settings
 * Fetch receipt settings for a specific branch (or create defaults)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    console.log('[GET] Fetching receipt settings for branch:', branchId || 'default');

    let settings;

    if (branchId) {
      // Get settings for specific branch
      settings = await db.receiptSettings.findFirst({
        where: { branchId },
      });

      // If no settings exist for this branch, create defaults
      if (!settings) {
        console.log('[GET] No settings for branch, creating defaults for branch:', branchId);
        settings = await db.receiptSettings.create({
          data: {
            branchId,
            storeName: 'Emperor Coffee',
            headerText: 'Quality Coffee Since 2024',
            footerText: 'Visit us again soon!',
            thankYouMessage: 'Thank you for your purchase!',
            fontSize: 'medium',
            showLogo: true,
            showCashier: true,
            showDateTime: true,
            showOrderType: true,
            showCustomerInfo: true,
            showBranchPhone: true,
            showBranchAddress: true,
            openCashDrawer: true,
            cutPaper: true,
            cutType: 'full',
            paperWidth: 80,
          },
        });
      }
    } else {
      // No branchId provided - first try to get the old centralized settings (branchId is null)
      settings = await db.receiptSettings.findFirst({
        where: { branchId: null },
      });

      // If no old centralized settings, get first available branch's settings
      if (!settings) {
        console.log('[GET] No old centralized settings, fetching first available branch settings');
        const firstBranch = await db.branch.findFirst({
          where: { isActive: true },
          select: { id: true, branchName: true },
        });

        if (firstBranch) {
          // Get or create settings for the first branch
          settings = await db.receiptSettings.findFirst({
            where: { branchId: firstBranch.id },
          });

          if (!settings) {
            console.log('[GET] No settings for first branch, creating defaults for branch:', firstBranch.id);
            settings = await db.receiptSettings.create({
              data: {
                branchId: firstBranch.id,
                storeName: 'Emperor Coffee',
                headerText: 'Quality Coffee Since 2024',
                footerText: 'Visit us again soon!',
                thankYouMessage: 'Thank you for your purchase!',
                fontSize: 'medium',
                showLogo: true,
                showCashier: true,
                showDateTime: true,
                showOrderType: true,
                showCustomerInfo: true,
                showBranchPhone: true,
                showBranchAddress: true,
                openCashDrawer: true,
                cutPaper: true,
                cutType: 'full',
                paperWidth: 80,
              },
            });
          }
        } else {
          // No active branches - create default settings without branch (for compatibility)
          console.log('[GET] No active branches, creating global defaults');
          settings = await db.receiptSettings.create({
            data: {
              storeName: 'Emperor Coffee',
              headerText: 'Quality Coffee Since 2024',
              footerText: 'Visit us again soon!',
              thankYouMessage: 'Thank you for your purchase!',
              fontSize: 'medium',
              showLogo: true,
              showCashier: true,
              showDateTime: true,
              showOrderType: true,
              showCustomerInfo: true,
              showBranchPhone: true,
              showBranchAddress: true,
              openCashDrawer: true,
              cutPaper: true,
              cutType: 'full',
              paperWidth: 80,
            },
          });
        }
      }
    }

    console.log('[GET] Successfully fetched receipt settings:', {
      id: settings.id,
      branchId: settings.branchId,
      storeName: settings.storeName,
      hasLogo: !!settings.logoData,
    });

    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        branchId: settings.branchId,
        storeName: settings.storeName,
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
        showBranchPhone: settings.showBranchPhone,
        showBranchAddress: settings.showBranchAddress,
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
 * Save receipt settings for a specific branch
 */
export async function POST(request: NextRequest) {
  try {
    const settings = await request.json();

    console.log('[POST] Saving receipt settings:', {
      branchId: settings.branchId,
      storeName: settings.storeName,
      headerText: settings.headerText,
      footerText: settings.footerText,
      thankYouMessage: settings.thankYouMessage,
      fontSize: settings.fontSize,
      showLogo: settings.showLogo,
      showCashier: settings.showCashier,
      showDateTime: settings.showDateTime,
      showOrderType: settings.showOrderType,
      showCustomerInfo: settings.showCustomerInfo,
      showBranchPhone: settings.showBranchPhone,
      showBranchAddress: settings.showBranchAddress,
    });

    // Validate required fields
    if (!settings.storeName || !settings.thankYouMessage) {
      console.error('[POST] Validation failed: storeName and thankYouMessage are required');
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'storeName and thankYouMessage are required',
        },
        { status: 400 }
      );
    }

    // Use upsert to either create or update settings for the branch
    // If branchId is provided, use it; otherwise use null for backward compatibility
    const branchIdValue = settings.branchId || null;

    const result = await db.receiptSettings.upsert({
      where: { id: settings.id || 'default' },
      update: {
        branchId: branchIdValue,
        storeName: settings.storeName,
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
        showBranchPhone: settings.showBranchPhone ?? true,
        showBranchAddress: settings.showBranchAddress ?? true,
        openCashDrawer: settings.openCashDrawer ?? true,
        cutPaper: settings.cutPaper ?? true,
        cutType: settings.cutType || 'full',
        paperWidth: settings.paperWidth || 80,
      },
      create: {
        id: settings.id || undefined,
        branchId: branchIdValue,
        storeName: settings.storeName,
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
        showBranchPhone: settings.showBranchPhone ?? true,
        showBranchAddress: settings.showBranchAddress ?? true,
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
        id: result.id,
        branchId: result.branchId,
        storeName: result.storeName,
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
        showBranchPhone: result.showBranchPhone,
        showBranchAddress: result.showBranchAddress,
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

    return NextResponse.json(
      {
        error: 'Failed to save receipt settings',
        message: errorMessage,
        stack: errorStack,
        details: String(error),
      },
      { status: 500 }
    );
  }
}
