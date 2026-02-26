// Sync Push API
// Uploads branch data to central server (UP sync)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SyncDirection, SyncStatus } from '@prisma/client';
import {
  createSyncHistory,
  updateSyncHistory,
  updateBranchLastSync
} from '@/lib/sync-utils';

/**
 * POST /api/sync/push
 * Body:
 * - branchId: string (required)
 * - dataTypes: string[] (optional) - Types of data to push ['orders', 'inventory', 'waste', 'shifts']
 * - dryRun: boolean (optional) - If true, doesn't actually mark items as synced
 *
 * Uploads unsynced data from branch to central:
 * - Orders (not yet synced)
 * - Inventory transactions
 * - Waste logs
 * - Shift data
 */
export async function POST(request: NextRequest) {
  const syncHistoryId = await createSyncHistory(
    'system', // Will be updated with actual branchId
    SyncDirection.UP,
    0
  );

  try {
    const body = await request.json();
    const { branchId, dataTypes = ['orders', 'inventory', 'waste', 'shifts'], dryRun = false } = body;

    if (!branchId) {
      await updateSyncHistory(
        syncHistoryId,
        SyncStatus.FAILED,
        0,
        'branchId is required'
      );
      return NextResponse.json(
        { success: false, error: 'branchId is required' },
        { status: 400 }
      );
    }

    // Get branch
    const branch = await db.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      await updateSyncHistory(
        syncHistoryId,
        SyncStatus.FAILED,
        0,
        `Branch not found: ${branchId}`
      );
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Update sync history with correct branchId
    await db.syncHistory.update({
      where: { id: syncHistoryId },
      data: { branchId }
    });

    let totalRecordsProcessed = 0;
    let totalConflicts = 0;
    const pushResults: any = {};

    // ============================================
    // Push Orders
    // ============================================
    if (dataTypes.includes('orders')) {
      console.log(`[Sync Push] Pushing orders for branch ${branchId}...`);

      // Get unsynced orders
      const unsyncedOrders = await db.order.findMany({
        where: {
          branchId,
          synced: false
        },
        include: {
          items: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true
            }
          },
          courier: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // In a centralized system, orders are already in the database
      // We just need to mark them as synced
      if (!dryRun && unsyncedOrders.length > 0) {
        await db.order.updateMany({
          where: {
            branchId,
            synced: false
          },
          data: {
            synced: true
          }
        });
      }

      pushResults.orders = {
        count: unsyncedOrders.length,
        orders: unsyncedOrders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          orderTimestamp: order.orderTimestamp
        }))
      };

      totalRecordsProcessed += unsyncedOrders.length;
    }

    // ============================================
    // Push Inventory Transactions
    // ============================================
    if (dataTypes.includes('inventory')) {
      console.log(`[Sync Push] Pushing inventory transactions for branch ${branchId}...`);

      // Get recent inventory transactions (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const inventoryTransactions = await db.inventoryTransaction.findMany({
        where: {
          branchId,
          createdAt: {
            gte: oneDayAgo
          }
        },
        include: {
          ingredient: {
            select: {
              id: true,
              name: true,
              unit: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      pushResults.inventory = {
        count: inventoryTransactions.length,
        transactions: inventoryTransactions.slice(0, 100) // Limit to last 100 for preview
      };

      totalRecordsProcessed += inventoryTransactions.length;
    }

    // ============================================
    // Push Waste Logs
    // ============================================
    if (dataTypes.includes('waste')) {
      console.log(`[Sync Push] Pushing waste logs for branch ${branchId}...`);

      // Get recent waste logs (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const wasteLogs = await db.wasteLog.findMany({
        where: {
          branchId,
          createdAt: {
            gte: oneDayAgo
          }
        },
        include: {
          ingredient: {
            select: {
              id: true,
              name: true,
              unit: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      pushResults.waste = {
        count: wasteLogs.length,
        logs: wasteLogs
      };

      totalRecordsProcessed += wasteLogs.length;
    }

    // ============================================
    // Push Shift Data
    // ============================================
    if (dataTypes.includes('shifts')) {
      console.log(`[Sync Push] Pushing shift data for branch ${branchId}...`);

      // Get recent shifts (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const shifts = await db.shift.findMany({
        where: {
          branchId,
          createdAt: {
            gte: sevenDaysAgo
          }
        },
        include: {
          cashier: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Get order counts and revenue for each shift
      const shiftsWithStats = await Promise.all(
        shifts.map(async (shift) => {
          const orderCount = await db.order.count({
            where: {
              shiftId: shift.id
            }
          });

          const revenueResult = await db.order.aggregate({
            where: {
              shiftId: shift.id
            },
            _sum: {
              subtotal: true
            }
          });

          return {
            ...shift,
            orderCount,
            revenue: revenueResult._sum.subtotal || 0
          };
        })
      );

      pushResults.shifts = {
        count: shiftsWithStats.length,
        shifts: shiftsWithStats
      };

      totalRecordsProcessed += shiftsWithStats.length;
    }

    // ============================================
    // Update Branch Last Sync Time
    // ============================================
    if (!dryRun) {
      await updateBranchLastSync(branchId);
    }

    // ============================================
    // Finalize Sync History
    // ============================================
    const finalStatus = totalConflicts > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS;

    await updateSyncHistory(
      syncHistoryId,
      finalStatus,
      totalRecordsProcessed,
      totalConflicts > 0 ? `${totalConflicts} conflicts detected` : undefined
    );

    // Return sync result
    return NextResponse.json({
      success: true,
      message: dryRun
        ? 'Dry run completed - no changes made'
        : 'Push completed successfully',
      data: {
        branchId: branch.id,
        branchName: branch.branchName,
        syncHistoryId,
        recordsProcessed: totalRecordsProcessed,
        conflicts: totalConflicts,
        dryRun,
        results: pushResults
      }
    });
  } catch (error: any) {
    console.error('[Sync Push Error]', error);

    await updateSyncHistory(
      syncHistoryId,
      SyncStatus.FAILED,
      0,
      error.message || 'Unknown error'
    );

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Sync push failed'
      },
      { status: 500 }
    );
  }
}
