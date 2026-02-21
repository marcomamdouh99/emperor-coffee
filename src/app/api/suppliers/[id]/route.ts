import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema for updating a supplier
const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(1).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

// GET /api/suppliers/[id] - Get a single supplier
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplier = await db.supplier.findUnique({
      where: { id: params.id },
      include: {
        purchaseOrders: {
          orderBy: { orderedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier' },
      { status: 500 }
    );
  }
}

// PUT /api/suppliers/[id] - Update a supplier
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateSupplierSchema.parse(body);

    // Check if supplier exists
    const existingSupplier = await db.supplier.findUnique({
      where: { id: params.id },
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name/email if changed
    if (validatedData.name || validatedData.email) {
      const duplicate = await db.supplier.findFirst({
        where: {
          AND: [
            { id: { not: params.id } },
            {
              OR: [
                ...(validatedData.name ? [{ name: validatedData.name }] : []),
                ...(validatedData.email ? [{ email: validatedData.email }] : []),
              ],
            },
          ],
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Supplier with this name or email already exists' },
          { status: 409 }
        );
      }
    }

    const supplier = await db.supplier.update({
      where: { id: params.id },
      data: validatedData,
    });

    return NextResponse.json({ supplier });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    );
  }
}

// PATCH /api/suppliers/[id] - Partially update a supplier
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateSupplierSchema.parse(body);

    // Check if supplier exists
    const existingSupplier = await db.supplier.findUnique({
      where: { id: params.id },
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name/email if changed
    if (validatedData.name || validatedData.email) {
      const duplicate = await db.supplier.findFirst({
        where: {
          AND: [
            { id: { not: params.id } },
            {
              OR: [
                ...(validatedData.name ? [{ name: validatedData.name }] : []),
                ...(validatedData.email ? [{ email: validatedData.email }] : []),
              ],
            },
          ],
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Supplier with this name or email already exists' },
          { status: 409 }
        );
      }
    }

    const supplier = await db.supplier.update({
      where: { id: params.id },
      data: validatedData,
    });

    return NextResponse.json({ supplier });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    );
  }
}

// DELETE /api/suppliers/[id] - Soft delete a supplier (set isActive=false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if supplier exists
    const existingSupplier = await db.supplier.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    const supplier = await db.supplier.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ supplier, message: 'Supplier deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate supplier' },
      { status: 500 }
    );
  }
}
