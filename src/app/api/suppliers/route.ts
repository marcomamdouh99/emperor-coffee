import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema for creating a supplier
const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone number is required'),
  address: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

// Schema for updating a supplier
const updateSupplierSchema = createSupplierSchema.partial();

// GET /api/suppliers - Get all suppliers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');

    const where: any = {};

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactPerson: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const suppliers = await db.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

// POST /api/suppliers - Create a new supplier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createSupplierSchema.parse(body);

    // Check if supplier with same name or email already exists
    const existingSupplier = await db.supplier.findFirst({
      where: {
        OR: [
          { name: validatedData.name },
          ...(validatedData.email ? [{ email: validatedData.email }] : []),
        ],
      },
    });

    if (existingSupplier) {
      return NextResponse.json(
        { error: 'Supplier with this name or email already exists' },
        { status: 409 }
      );
    }

    const supplier = await db.supplier.create({
      data: validatedData,
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    );
  }
}
