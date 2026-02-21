import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema for creating a waste log
const createWasteLogSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  ingredientId: z.string().min(1, 'Ingredient is required'),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  reason: z.enum(['EXPIRED', 'SPOILED', 'DAMAGED', 'PREPARATION', 'MISTAKE', 'THEFT', 'OTHER']),
  notes: z.string().optional(),
});

// GET /api/waste-logs - Get all waste logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const ingredientId = searchParams.get('ingredientId');
    const reason = searchParams.get('reason');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};

    if (branchId) where.branchId = branchId;
    if (ingredientId) where.ingredientId = ingredientId;
    if (reason) where.reason = reason;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [wasteLogs, total] = await Promise.all([
      db.wasteLog.findMany({
        where,
        include: {
          branch: true,
          ingredient: true,
          recorder: {
            select: { id: true, name: true, username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wasteLog.count({ where }),
    ]);

    return NextResponse.json({
      wasteLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching waste logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch waste logs' },
      { status: 500 }
    );
  }
}

// POST /api/waste-logs - Create a new waste log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createWasteLogSchema.parse(body);

    // Get ingredient info to calculate loss value
    const ingredient = await db.ingredient.findUnique({
      where: { id: validatedData.ingredientId },
    });

    if (!ingredient) {
      return NextResponse.json(
        { error: 'Ingredient not found' },
        { status: 404 }
      );
    }

    const lossValue = validatedData.quantity * ingredient.costPerUnit;

    // Check and update branch inventory
    const inventory = await db.branchInventory.findUnique({
      where: {
        branchId_ingredientId: {
          branchId: validatedData.branchId,
          ingredientId: validatedData.ingredientId,
        },
      },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory not found for this branch and ingredient' },
        { status: 404 }
      );
    }

    if (inventory.currentStock < validatedData.quantity) {
      return NextResponse.json(
        {
          error: 'Insufficient stock',
          available: inventory.currentStock,
          requested: validatedData.quantity,
        },
        { status: 400 }
      );
    }

    // Deduct from inventory
    const updatedInventory = await db.branchInventory.update({
      where: { id: inventory.id },
      data: {
        currentStock: {
          decrement: validatedData.quantity,
        },
      },
    });

    // Create waste log
    const wasteLog = await db.wasteLog.create({
      data: {
        ...validatedData,
        lossValue,
        recordedBy: body.userId || 'system',
      },
      include: {
        branch: true,
        ingredient: true,
        recorder: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    // Create inventory transaction
    await db.inventoryTransaction.create({
      data: {
        branchId: validatedData.branchId,
        ingredientId: validatedData.ingredientId,
        transactionType: 'WASTE',
        quantityChange: -validatedData.quantity,
        stockBefore: inventory.currentStock,
        stockAfter: updatedInventory.currentStock,
        reason: `${validatedData.reason}${validatedData.notes ? `: ${validatedData.notes}` : ''}`,
        createdBy: body.userId || 'system',
      },
    });

    return NextResponse.json({ wasteLog }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating waste log:', error);
    return NextResponse.json(
      { error: 'Failed to create waste log' },
      { status: 500 }
    );
  }
}
