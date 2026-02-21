import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for updating promotions
const promotionUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'CATEGORY_PERCENTAGE', 'CATEGORY_FIXED']).optional(),
  discountValue: z.number().min(0).optional(),
  categoryId: z.string().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  usesPerCustomer: z.number().int().positive().nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  allowStacking: z.boolean().optional(),
  minOrderAmount: z.number().min(0).nullable().optional(),
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  branchIds: z.array(z.string()).optional().default([]),
  categoryIds: z.array(z.string()).optional().default([]),
});

// GET /api/promotions/[id] - Get a single promotion
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const promotion = await db.promotion.findUnique({
      where: { id: params.id },
      include: {
        codes: true,
        branchRestrictions: {
          include: {
            branch: true,
          },
        },
        categoryRestrictions: {
          include: {
            category: true,
          },
        },
        _count: {
          select: {
            usageLogs: true,
          },
        },
      },
    });

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: 'Promotion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      promotion,
    });
  } catch (error) {
    console.error('Error fetching promotion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch promotion' },
      { status: 500 }
    );
  }
}

// PUT /api/promotions/[id] - Update a promotion
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = promotionUpdateSchema.parse(body);

    // Check if promotion exists
    const existingPromotion = await db.promotion.findUnique({
      where: { id: params.id },
    });

    if (!existingPromotion) {
      return NextResponse.json(
        { success: false, error: 'Promotion not found' },
        { status: 404 }
      );
    }

    // Validate dates if provided
    if (validatedData.startDate && validatedData.endDate) {
      const startDate = new Date(validatedData.startDate);
      const endDate = new Date(validatedData.endDate);
      if (endDate <= startDate) {
        return NextResponse.json(
          { success: false, error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }

    // Validate percentage discounts if changing
    if (validatedData.discountType && validatedData.discountValue !== undefined) {
      if (
        (validatedData.discountType === 'PERCENTAGE' ||
          validatedData.discountType === 'CATEGORY_PERCENTAGE') &&
        (validatedData.discountValue < 0 || validatedData.discountValue > 100)
      ) {
        return NextResponse.json(
          { success: false, error: 'Percentage discount must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    // Update promotion with related data in a transaction
    const promotion = await db.$transaction(async (tx) => {
      // Update promotion
      const updatedPromotion = await tx.promotion.update({
        where: { id: params.id },
        data: {
          ...(validatedData.name !== undefined && { name: validatedData.name }),
          ...(validatedData.description !== undefined && { description: validatedData.description }),
          ...(validatedData.discountType !== undefined && { discountType: validatedData.discountType }),
          ...(validatedData.discountValue !== undefined && { discountValue: validatedData.discountValue }),
          ...(validatedData.categoryId !== undefined && { categoryId: validatedData.categoryId }),
          ...(validatedData.maxUses !== undefined && { maxUses: validatedData.maxUses }),
          ...(validatedData.usesPerCustomer !== undefined && { usesPerCustomer: validatedData.usesPerCustomer }),
          ...(validatedData.startDate !== undefined && { startDate: new Date(validatedData.startDate) }),
          ...(validatedData.endDate !== undefined && { endDate: new Date(validatedData.endDate) }),
          ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
          ...(validatedData.allowStacking !== undefined && { allowStacking: validatedData.allowStacking }),
          ...(validatedData.minOrderAmount !== undefined && { minOrderAmount: validatedData.minOrderAmount }),
          ...(validatedData.maxDiscountAmount !== undefined && { maxDiscountAmount: validatedData.maxDiscountAmount }),
        },
      });

      // Update branch restrictions if provided
      if (validatedData.branchIds !== undefined) {
        // Delete existing restrictions
        await tx.promotionBranch.deleteMany({
          where: { promotionId: params.id },
        });

        // Add new restrictions
        if (validatedData.branchIds.length > 0) {
          await tx.promotionBranch.createMany({
            data: validatedData.branchIds.map((branchId) => ({
              promotionId: params.id,
              branchId,
            })),
          });
        }
      }

      // Update category restrictions if provided
      if (validatedData.categoryIds !== undefined) {
        // Delete existing restrictions
        await tx.promotionCategory.deleteMany({
          where: { promotionId: params.id },
        });

        // Add new restrictions
        if (validatedData.categoryIds.length > 0) {
          await tx.promotionCategory.createMany({
            data: validatedData.categoryIds.map((categoryId) => ({
              promotionId: params.id,
              categoryId,
            })),
          });
        }
      }

      return updatedPromotion;
    });

    // Fetch the complete promotion with relations
    const completePromotion = await db.promotion.findUnique({
      where: { id: promotion.id },
      include: {
        codes: true,
        branchRestrictions: {
          include: {
            branch: true,
          },
        },
        categoryRestrictions: {
          include: {
            category: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      promotion: completePromotion,
    });
  } catch (error) {
    console.error('Error updating promotion:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update promotion' },
      { status: 500 }
    );
  }
}

// DELETE /api/promotions/[id] - Delete a promotion
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if promotion exists
    const existingPromotion = await db.promotion.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            usageLogs: true,
          },
        },
      },
    });

    if (!existingPromotion) {
      return NextResponse.json(
        { success: false, error: 'Promotion not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if promotion has been used
    if (existingPromotion._count.usageLogs > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete promotion that has been used. Deactivate it instead.',
        },
        { status: 400 }
      );
    }

    // Delete promotion (cascade will handle related records)
    await db.promotion.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Promotion deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete promotion' },
      { status: 500 }
    );
  }
}
