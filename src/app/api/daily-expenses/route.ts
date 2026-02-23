import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Get or create "Daily Expenses" cost category for a branch
 */
async function getDailyExpensesCostCategory(branchId: string) {
  let costCategory = await db.costCategory.findFirst({
    where: {
      name: 'Daily Expenses',
      branchId, // Only get branch-specific category
    },
  });

  if (!costCategory) {
    // Create the daily expenses category for this branch
    costCategory = await db.costCategory.create({
      data: {
        name: 'Daily Expenses',
        description: 'Daily expenses recorded by cashiers',
        icon: 'Wallet',
        sortOrder: 997, // Show just above promo codes
        isActive: true,
        branchId, // Make it branch-specific
      },
    });
  }

  return costCategory;
}

/**
 * Create a daily expense cost record for a branch
 */
async function createDailyExpenseCost(
  branchId: string,
  amount: number,
  reason: string,
  shiftId: string,
  recordedBy: string
) {
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

  const costCategory = await getDailyExpensesCostCategory(branchId);

  const branchCost = await db.branchCost.create({
    data: {
      branchId,
      costCategoryId: costCategory.id,
      shiftId, // Link to shift for accurate reporting
      amount: amount,
      period: currentPeriod,
      notes: `Daily expense: ${reason}`,
    },
  });

  console.log('[Daily Expenses] Branch cost created:', branchCost.id);
  return branchCost;
}

/**
 * GET /api/daily-expenses
 * List daily expenses with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const shiftId = searchParams.get('shiftId');
    const recordedBy = searchParams.get('recordedBy');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};

    if (branchId) {
      where.branchId = branchId;
    }
    if (shiftId) {
      where.shiftId = shiftId;
    }
    if (recordedBy) {
      where.recordedBy = recordedBy;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDateTime;
      }
    }

    const expenses = await db.dailyExpense.findMany({
      where,
      include: {
        branch: {
          select: { id: true, branchName: true },
        },
        shift: {
          select: { id: true, startTime: true, endTime: true, cashier: true },
        },
        recorder: {
          select: { id: true, username: true, name: true },
        },
        cost: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.dailyExpense.count({ where });

    return NextResponse.json({
      success: true,
      expenses,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + expenses.length < total,
      },
    });
  } catch (error: any) {
    console.error('[Daily Expenses] Get expenses error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch expenses', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/daily-expenses
 * Create a new daily expense
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, shiftId, amount, reason, recordedBy } = body;

    // Validation
    if (!branchId || !shiftId || !amount || !reason || !recordedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: branchId, shiftId, amount, reason, recordedBy' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reason cannot be empty' },
        { status: 400 }
      );
    }

    // Verify shift exists and is open
    const shift = await db.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      return NextResponse.json(
        { success: false, error: 'Shift not found' },
        { status: 404 }
      );
    }

    if (shift.isClosed) {
      return NextResponse.json(
        { success: false, error: 'Cannot add expenses to a closed shift' },
        { status: 400 }
      );
    }

    // Verify shift belongs to the same branch
    if (shift.branchId !== branchId) {
      return NextResponse.json(
        { success: false, error: 'Shift does not belong to this branch' },
        { status: 400 }
      );
    }

    // Create daily expense
    const expense = await db.dailyExpense.create({
      data: {
        branchId,
        shiftId,
        amount: parseFloat(amount),
        reason: reason.trim(),
        recordedBy,
      },
    });

    // Create corresponding BranchCost record for reporting in Branch Operation
    let branchCost = null;
    try {
      branchCost = await createDailyExpenseCost(branchId, parseFloat(amount), reason.trim(), shiftId, recordedBy);
      
      // Update the expense with the costId
      await db.dailyExpense.update({
        where: { id: expense.id },
        data: { costId: branchCost.id },
      });
      
      expense.costId = branchCost.id;
    } catch (costError) {
      console.error('[Daily Expenses] Failed to create cost record:', costError);
      // Don't fail the expense creation if cost creation fails
    }

    console.log('[Daily Expenses] Created expense:', {
      id: expense.id,
      amount: expense.amount,
      reason: expense.reason,
      costId: expense.costId,
    });

    return NextResponse.json({
      success: true,
      expense,
      message: 'Daily expense recorded successfully',
    });
  } catch (error: any) {
    console.error('[Daily Expenses] Create expense error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create expense', details: error.message },
      { status: 500 }
    );
  }
}
