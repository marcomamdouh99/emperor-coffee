import { NextRequest, NextResponse } from 'next/server';
import { getIndexedDBStorage } from '@/lib/storage/indexeddb-storage';

/**
 * GET /api/sync/operations
 * Get pending sync operations from IndexedDB
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    const storage = getIndexedDBStorage();
    await storage.init();

    // Get all pending operations
    const allOperations = await storage.getAllOperations();
    
    // Filter by branchId and sort by timestamp (oldest first)
    const branchOperations = allOperations
      .filter((op: any) => op.branchId === branchId)
      .sort((a: any, b: any) => a.timestamp - b.timestamp);

    return NextResponse.json({
      success: true,
      operations: branchOperations,
      total: branchOperations.length,
    });
  } catch (error: any) {
    console.error('[SyncOperations API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operations', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sync/operations/clear-failed
 * Clear all operations that have exceeded max retries
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    const storage = getIndexedDBStorage();
    await storage.init();

    const allOperations = await storage.getAllOperations();
    const failedOperations = allOperations.filter((op: any) => 
      op.branchId === branchId && op.retryCount >= 3
    );

    // Delete each failed operation
    for (const op of failedOperations) {
      await storage.deleteOperation(op.id);
    }

    return NextResponse.json({
      success: true,
      cleared: failedOperations.length,
      message: `Cleared ${failedOperations.length} failed operations`,
    });
  } catch (error: any) {
    console.error('[SyncOperations API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear operations', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/trigger
 * Trigger immediate sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId } = body;

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    const { offlineManager } = await import('@/lib/offline/offline-manager');
    
    // Trigger sync
    const syncResult = await offlineManager.forceSync();

    return NextResponse.json({
      success: syncResult.success,
      operationsProcessed: syncResult.operationsProcessed,
      errors: syncResult.errors,
    });
  } catch (error: any) {
    console.error('[SyncTrigger API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger sync', details: error.message },
      { status: 500 }
    );
  }
}
