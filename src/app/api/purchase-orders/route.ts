import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { getSession } from '@/lib/session-manager';

// Schema for creating a purchase order item
const purchaseOrderItemSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  unitPrice: z.number().positive(),
});

// Schema for creating a purchase order
const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  branchId: z.string().min(1, 'Branch is required'),
  orderNumber: z.string().min(1),
  expectedAt: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1, 'At least one item is required'),
});

// Schema for updating a purchase order
const updatePurchaseOrderSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'RECEIVED', 'PARTIAL', 'CANCELLED']).optional(),
  expectedAt: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  notes: z.string().optional(),
});

// GET /api/purchase-orders - Get all purchase orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};

    if (branchId) where.branchId = branchId;
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;

    const [purchaseOrders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          branch: true,
          items: {
            include: {
              ingredient: true,
            },
          },
          approver: {
            select: { id: true, name: true, username: true },
          },
          creator: {
            select: { id: true, name: true, username: true },
          },
        },
        orderBy: { orderedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({
      purchaseOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders - Create a new purchase order
export async function POST(request: NextRequest) {
  try {
    // Get current user from session
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login to continue.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createPurchaseOrderSchema.parse(body);

    // Check if order number already exists
    const existingOrder = await db.purchaseOrder.findUnique({
      where: { orderNumber: validatedData.orderNumber },
    });

    if (existingOrder) {
      return NextResponse.json(
        { error: 'Purchase order with this number already exists' },
        { status: 409 }
      );
    }

    // Calculate total amount
    const totalAmount = validatedData.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // Create purchase order with items
    const purchaseOrder = await db.purchaseOrder.create({
      data: {
        supplierId: validatedData.supplierId,
        branchId: validatedData.branchId,
        orderNumber: validatedData.orderNumber,
        expectedAt: validatedData.expectedAt,
        notes: validatedData.notes,
        totalAmount,
        createdBy: session.userId, // Use userId from session
        items: {
          create: validatedData.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: {
        supplier: true,
        branch: true,
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return NextResponse.json({ purchaseOrder }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}
