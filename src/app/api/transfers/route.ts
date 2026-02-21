// Inventory Transfers API
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema for transfer item
const transferItemSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  unitPrice: z.number().optional(), // Optional for regular transfers, required for POs
  totalPrice: z.number().optional(), // Optional, calculated if not provided
});

// Schema for creating a transfer
const createTransferSchema = z.object({
  sourceBranchId: z.string().optional(), // Optional for Purchase Orders
  targetBranchId: z.string().min(1, 'Target branch is required'),
  transferNumber: z.string().min(1),
  poNumber: z.string().optional(), // Purchase Order Number
  isPurchaseOrder: z.boolean().optional().default(false),
  totalPrice: z.number().optional(), // Total price for purchase orders
  notes: z.string().optional(),
  items: z.array(transferItemSchema).min(1, 'At least one item is required'),
});

// Schema for updating a transfer
const updateTransferSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

// GET /api/transfers - Get all transfers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceBranchId = searchParams.get('sourceBranchId');
    const targetBranchId = searchParams.get('targetBranchId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};

    if (sourceBranchId) where.sourceBranchId = sourceBranchId;
    if (targetBranchId) where.targetBranchId = targetBranchId;
    if (status) where.status = status;

    console.log('Fetching transfers with where clause:', where);

    const [transfers, total] = await Promise.all([
      db.inventoryTransfer.findMany({
        where,
        include: {
          sourceBranch: true,
          targetBranch: true,
          items: {
            include: {
              ingredient: true,
            },
          },
          requester: {
            select: { id: true, name: true, username: true },
          },
          approver: {
            select: { id: true, name: true, username: true },
          },
          completer: {
            select: { id: true, name: true, username: true },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.inventoryTransfer.count({ where }),
    ]);

    console.log('Found transfers:', transfers.length);
    console.log('Total transfers:', total);

    return NextResponse.json({
      transfers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfers', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/transfers - Create a new transfer request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received transfer request:', body);
    const validatedData = createTransferSchema.parse(body);
    console.log('Validated transfer data:', validatedData);

    // Check if transfer number already exists
    const existingTransfer = await db.inventoryTransfer.findUnique({
      where: { transferNumber: validatedData.transferNumber },
    });

    if (existingTransfer) {
      return NextResponse.json(
        { error: 'Transfer with this number already exists' },
        { status: 409 }
      );
    }

    // Check if PO number already exists (if provided)
    if (validatedData.poNumber) {
      const existingPO = await db.inventoryTransfer.findUnique({
        where: { poNumber: validatedData.poNumber },
      });

      if (existingPO) {
        return NextResponse.json(
          { error: 'Purchase Order with this number already exists' },
          { status: 409 }
        );
      }
    }

    const isPurchaseOrder = validatedData.isPurchaseOrder || false;

    // Validate that source and target are different (if source provided)
    if (validatedData.sourceBranchId && validatedData.sourceBranchId === validatedData.targetBranchId) {
      return NextResponse.json(
        { error: 'Source and target branches must be different' },
        { status: 400 }
      );
    }

    // Fetch ingredients for pricing (needed for purchase orders)
    const ingredientIds = validatedData.items.map(item => item.ingredientId);
    const ingredients = await db.ingredient.findMany({
      where: { id: { in: ingredientIds } },
    });

    const ingredientMap = new Map(ingredients.map(ing => [ing.id, ing]));

    // Process items differently for POs vs regular transfers
    let processedItems;
    let calculatedTotalPrice = 0;

    if (isPurchaseOrder) {
      // For Purchase Orders: Calculate prices, no stock checks
      processedItems = validatedData.items.map(item => {
        const ingredient = ingredientMap.get(item.ingredientId);
        const unitPrice = item.unitPrice || ingredient?.costPerUnit || 0;
        const itemTotalPrice = unitPrice * item.quantity;
        calculatedTotalPrice += itemTotalPrice;

        return {
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: unitPrice,
          totalPrice: itemTotalPrice,
          sourceInventoryId: null,
          targetInventoryId: null,
        };
      });
    } else {
      // For Regular Transfers: Check stock in source branch
      if (!validatedData.sourceBranchId) {
        return NextResponse.json(
          { error: 'Source branch is required for regular transfers' },
          { status: 400 }
        );
      }

      const inventoryChecks = await Promise.all(
        validatedData.items.map(async (item) => {
          const sourceInventory = await db.branchInventory.findUnique({
            where: {
              branchId_ingredientId: {
                branchId: validatedData.sourceBranchId!,
                ingredientId: item.ingredientId,
              },
            },
          });

          // Find or create target inventory
          let targetInventory = await db.branchInventory.findUnique({
            where: {
              branchId_ingredientId: {
                branchId: validatedData.targetBranchId,
                ingredientId: item.ingredientId,
              },
            },
          });

          if (!targetInventory) {
            targetInventory = await db.branchInventory.create({
              data: {
                branchId: validatedData.targetBranchId,
                ingredientId: item.ingredientId,
                currentStock: 0,
              },
            });
          }

          return {
            ...item,
            availableStock: sourceInventory?.currentStock || 0,
            sourceInventoryId: sourceInventory?.id,
            targetInventoryId: targetInventory.id,
            unitPrice: item.unitPrice || ingredientMap.get(item.ingredientId)?.costPerUnit,
            totalPrice: (item.unitPrice || ingredientMap.get(item.ingredientId)?.costPerUnit || 0) * item.quantity,
          };
        })
      );

      const insufficientStock = inventoryChecks.filter(
        (check) => check.availableStock < check.quantity
      );

      if (insufficientStock.length > 0) {
        return NextResponse.json(
          {
            error: 'Insufficient stock in source branch',
            items: insufficientStock.map((i) => ({
              ingredientId: i.ingredientId,
              requested: i.quantity,
              available: i.availableStock,
            })),
          },
          { status: 400 }
        );
      }

      calculatedTotalPrice = inventoryChecks.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      processedItems = inventoryChecks;
    }

    // Get a valid user ID for the transfer
    let userId = body.userId;
    if (!userId) {
      // Get the first admin user as default
      const adminUser = await db.user.findFirst({
        where: { role: 'ADMIN' },
      });
      if (adminUser) {
        userId = adminUser.id;
      } else {
        // Fallback to first user if no admin exists
        const firstUser = await db.user.findFirst();
        if (!firstUser) {
          return NextResponse.json(
            { error: 'No users found in the system' },
            { status: 400 }
          );
        }
        userId = firstUser.id;
      }
    }

    // Create transfer with items
    const transfer = await db.inventoryTransfer.create({
      data: {
        sourceBranchId: validatedData.sourceBranchId,
        targetBranchId: validatedData.targetBranchId,
        transferNumber: validatedData.transferNumber,
        poNumber: validatedData.poNumber || (isPurchaseOrder ? `PO-${Date.now()}` : null),
        isPurchaseOrder: isPurchaseOrder,
        totalPrice: calculatedTotalPrice || validatedData.totalPrice,
        notes: validatedData.notes,
        requestedBy: userId,
        items: {
          create: processedItems.map((item) => ({
            ingredientId: item.ingredientId,
            sourceInventoryId: item.sourceInventoryId,
            targetInventoryId: item.targetInventoryId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: {
        sourceBranch: true,
        targetBranch: true,
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating transfer:', error);
    return NextResponse.json(
      { error: 'Failed to create transfer' },
      { status: 500 }
    );
  }
}
