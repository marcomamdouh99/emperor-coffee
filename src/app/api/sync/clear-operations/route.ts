import { NextRequest, NextResponse } from 'next/server';
import { getLocalStorageService } from '@/lib/storage/local-storage';

// This API route is for clearing operations in IndexedDB
// Note: This will only work when called from the browser context

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operationTypes, branchId } = body;

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    const localStorageService = getLocalStorageService();
    await localStorageService.init();

    // Get all operations
    const allOperations = await localStorageService.getPendingOperations();

    // Filter operations to clear
    const operationsToClear = allOperations.filter((op: any) => {
      // Filter by branchId
      if (op.branchId !== branchId) return false;

      // Filter by operation types if specified
      if (operationTypes && Array.isArray(operationTypes)) {
        return operationTypes.includes(op.type);
      }

      return true;
    });

    // Clear the operations
    for (const op of operationsToClear) {
      await localStorageService.deleteOperation(op.id);
    }

    return NextResponse.json({
      success: true,
      clearedCount: operationsToClear.length,
      message: `Cleared ${operationsToClear.length} operations`,
    });
  } catch (error) {
    console.error('[ClearOperations] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear operations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
