/**
 * Offline Data Import API
 * Imports exported data into IndexedDB for offline use
 * Use this when setting up a branch device without internet connection
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/offline/import
 *
 * Imports exported data into IndexedDB for offline use
 * Body: { data: <exported data object> }
 *
 * This endpoint returns the data that should be stored in IndexedDB
 * The actual IndexedDB storage happens on the client side
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'data is required' },
        { status: 400 }
      );
    }

    // Validate export structure
    if (!data.version || !data.data) {
      return NextResponse.json(
        { success: false, error: 'Invalid export data format' },
        { status: 400 }
      );
    }

    console.log(`[Offline Import] Importing data for branch ${data.branch.name}...`);

    // The import happens on the client side in IndexedDB
    // This endpoint just validates and returns the data
    const importData = {
      branch: data.branch,
      categories: data.data.categories || [],
      menuItems: data.data.menuItems || [],
      ingredients: data.data.ingredients || [],
      inventory: data.data.inventory || [],
      users: data.data.users || [],
      orders: data.data.orders || [],
      shifts: data.data.shifts || [],
      wasteLogs: data.data.wasteLogs || [],
      importedAt: new Date().toISOString()
    };

    console.log(`[Offline Import] Import validated:`, {
      categories: importData.categories.length,
      menuItems: importData.menuItems.length,
      ingredients: importData.ingredients.length,
      inventory: importData.inventory.length,
      users: importData.users.length,
      orders: importData.orders.length,
      shifts: importData.shifts.length,
      wasteLogs: importData.wasteLogs.length
    });

    return NextResponse.json({
      success: true,
      data: importData,
      message: 'Data validated successfully. Store in IndexedDB on client side.'
    });
  } catch (error) {
    console.error('[Offline Import] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
