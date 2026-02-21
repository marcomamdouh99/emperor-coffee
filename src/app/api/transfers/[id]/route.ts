// Inventory Transfers ID API
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema for updating a transfer
const updateTransferSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']).optional(),
  sourceBranchId: z.string().optional(), // For admin to select source when approving PO
  notes: z.string().optional(),
});

// GET /api/transfers/[id] - Get a single transfer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transfer = await db.inventoryTransfer.findUnique({
      where: { id },
      include: {
        sourceBranch: true,
        targetBranch: true,
        items: {
          include: {
            ingredient: true,
            sourceInventory: true,
            targetInventory: true,
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
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ transfer });
  } catch (error) {
    console.error('Error fetching transfer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer' },
      { status: 500 }
    );
  }
}

// PUT /api/transfers/[id] - Update a transfer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateTransferSchema.parse(body);

    // Check if transfer exists
    const existingTransfer = await db.inventoryTransfer.findUnique({
      where: { id },
      include: {
        sourceBranch: true,
        targetBranch: true,
        items: {
          include: {
            ingredient: true,
            sourceInventory: true,
            targetInventory: true,
          },
        },
      },
    });

    if (!existingTransfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    let updateData: any = { ...validatedData };

    // Get a valid user ID
    let userId = body.userId;
    if (!userId) {
      const adminUser = await db.user.findFirst({
        where: { role: 'ADMIN' },
      });
      if (adminUser) {
        userId = adminUser.id;
      } else {
        const firstUser = await db.user.findFirst();
        userId = firstUser?.id;
      }
    }

    // If approving, set approver and approvedAt
    if (validatedData.status === 'APPROVED' && !existingTransfer.approvedBy) {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    }

    // If completing, set completer and completedAt
    if (validatedData.status === 'COMPLETED' && !existingTransfer.completedBy) {
      updateData.completedBy = userId;
      updateData.completedAt = new Date();
    }

    // Process transfer if status is COMPLETED
    if (validatedData.status === 'COMPLETED') {
      // Ensure sourceBranchId is set
      if (!existingTransfer.sourceBranchId) {
        return NextResponse.json(
          { error: 'Cannot complete transfer: source branch not set' },
          { status: 400 }
        );
      }

      for (const item of existingTransfer.items) {
        // Find or create target inventory
        let targetInventory = await db.branchInventory.findUnique({
          where: {
            branchId_ingredientId: {
              branchId: existingTransfer.targetBranchId,
              ingredientId: item.ingredientId,
            },
          },
        });

        let targetStockBefore = 0;
        if (!targetInventory) {
          targetInventory = await db.branchInventory.create({
            data: {
              branchId: existingTransfer.targetBranchId,
              ingredientId: item.ingredientId,
              currentStock: 0,
            },
          });
          targetStockBefore = 0;
        } else {
          targetStockBefore = targetInventory.currentStock;
        }

        // Update target inventory (add stock)
        const updatedTargetInventory = await db.branchInventory.update({
          where: { id: targetInventory.id },
          data: {
            currentStock: {
              increment: item.quantity,
            },
          },
        });

        // Update transfer item with target inventory ID
        await db.inventoryTransferItem.update({
          where: { id: item.id },
          data: { targetInventoryId: targetInventory.id },
        });

        // Find and update source inventory (deduct stock)
        let sourceInventory = null;

        if (item.sourceInventoryId) {
          sourceInventory = await db.branchInventory.findUnique({
            where: { id: item.sourceInventoryId },
          });
        } else {
          // Find source inventory by branch and ingredient (for POs where sourceInventoryId wasn't set)
          sourceInventory = await db.branchInventory.findUnique({
            where: {
              branchId_ingredientId: {
                branchId: existingTransfer.sourceBranchId!,
                ingredientId: item.ingredientId,
              },
            },
          });
        }

        if (sourceInventory) {
          const sourceStockBefore = sourceInventory.currentStock;
          
          // Update source inventory (deduct stock)
          const updatedSourceInventory = await db.branchInventory.update({
            where: { id: sourceInventory.id },
            data: {
              currentStock: {
                decrement: item.quantity,
              },
            },
          });

          // Update transfer item with source inventory ID
          await db.inventoryTransferItem.update({
            where: { id: item.id },
            data: { sourceInventoryId: sourceInventory.id },
          });

          // Create inventory transaction for source (deduct)
          await db.inventoryTransaction.create({
            data: {
              branchId: existingTransfer.sourceBranchId!,
              ingredientId: item.ingredientId,
              transactionType: 'ADJUSTMENT',
              quantityChange: -item.quantity,
              stockBefore: sourceStockBefore,
              stockAfter: updatedSourceInventory.currentStock,
              reason: `Transfer to ${existingTransfer.targetBranch.branchName} - ${existingTransfer.transferNumber}`,
              createdBy: userId || 'system',
            },
          });
        } else {
          // Source inventory doesn't exist, create it with negative stock
          sourceInventory = await db.branchInventory.create({
            data: {
              branchId: existingTransfer.sourceBranchId!,
              ingredientId: item.ingredientId,
              currentStock: -item.quantity,
            },
          });

          // Update transfer item with source inventory ID
          await db.inventoryTransferItem.update({
            where: { id: item.id },
            data: { sourceInventoryId: sourceInventory.id },
          });

          // Create inventory transaction for source (deduct)
          await db.inventoryTransaction.create({
            data: {
              branchId: existingTransfer.sourceBranchId!,
              ingredientId: item.ingredientId,
              transactionType: 'ADJUSTMENT',
              quantityChange: -item.quantity,
              stockBefore: 0,
              stockAfter: -item.quantity,
              reason: `Transfer to ${existingTransfer.targetBranch.branchName} - ${existingTransfer.transferNumber}`,
              createdBy: userId || 'system',
            },
          });
        }

        // Create inventory transaction for target (add)
        await db.inventoryTransaction.create({
          data: {
            branchId: existingTransfer.targetBranchId,
            ingredientId: item.ingredientId,
            transactionType: 'ADJUSTMENT',
            quantityChange: item.quantity,
            stockBefore: targetStockBefore,
            stockAfter: updatedTargetInventory.currentStock,
            reason: `Transfer from ${existingTransfer.sourceBranch?.branchName || 'HQ'} - ${existingTransfer.transferNumber}`,
            createdBy: userId || 'system',
          },
        });
      }
    }

    const transfer = await db.inventoryTransfer.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ transfer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating transfer:', error);
    return NextResponse.json(
      { error: 'Failed to update transfer' },
      { status: 500 }
    );
  }
}

// DELETE /api/transfers/[id] - Delete a transfer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transfer = await db.inventoryTransfer.findUnique({
      where: { id },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    if (transfer.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only delete pending transfers' },
        { status: 400 }
      );
    }

    await db.inventoryTransfer.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Transfer deleted successfully' });
  } catch (error) {
    console.error('Error deleting transfer:', error);
    return NextResponse.json(
      { error: 'Failed to delete transfer' },
      { status: 500 }
    );
  }
}
