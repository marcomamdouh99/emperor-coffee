import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

// PATCH - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 16, params is a Promise and must be awaited
    const { id } = await params;

    const body = await request.json();
    const { username, email, name, role, branchId, requesterId, requesterRole, isActive } = body;

    // Verify requester exists
    const requester = await db.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester) {
      return NextResponse.json(
        { success: false, error: 'Requester not found' },
        { status: 404 }
      );
    }

    // Get user to update
    const userToUpdate = await db.user.findUnique({
      where: { id },
    });

    if (!userToUpdate) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check permissions based on role
    const canEdit = requesterRole === 'ADMIN' ||
      (requesterRole === 'BRANCH_MANAGER' &&
       userToUpdate.role === 'CASHIER' &&
       userToUpdate.branchId === requester.branchId) ||
      (requesterRole === 'BRANCH_MANAGER' && id === requesterId);

    if (!canEdit) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Check username uniqueness if being changed
    if (username && username !== userToUpdate.username) {
      const existingUser = await db.user.findFirst({
        where: {
          username,
          id: { not: id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'Username already exists' },
          { status: 400 }
        );
      }
    }

    // Check email uniqueness if being changed
    if (email && email !== userToUpdate.email) {
      const existingEmail = await db.user.findFirst({
        where: {
          email,
          id: { not: id },
        },
      });

      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Branch Manager can only change cashiers in their branch or themselves
    if (requesterRole === 'BRANCH_MANAGER' && role && role !== 'CASHIER') {
      return NextResponse.json(
        { success: false, error: 'Branch Managers can only create/update Cashier accounts' },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Only admins can change roles
    if (requesterRole === 'ADMIN' && role) {
      updateData.role = role;
      // Update branchId based on role
      if (role === 'ADMIN') {
        updateData.branchId = null;
      } else if (branchId) {
        updateData.branchId = branchId;
      }
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 16, params is a Promise and must be awaited
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');
    const requesterRole = searchParams.get('requesterRole');

    // Verify requester exists
    const requester = await db.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester) {
      return NextResponse.json(
        { success: false, error: 'Requester not found' },
        { status: 404 }
      );
    }

    // Get user to delete
    const userToDelete = await db.user.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent self-deletion
    if (id === requesterId) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check permissions
    const canDelete = requesterRole === 'ADMIN' ||
      (requesterRole === 'BRANCH_MANAGER' &&
       userToDelete.role === 'CASHIER' &&
       userToDelete.branchId === requester.branchId);

    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Check if user has related records that would prevent hard delete
    const hasRelatedRecords = await checkUserHasRelatedRecords(id);

    if (hasRelatedRecords) {
      // Use soft delete instead
      await db.user.update({
        where: { id },
        data: { isActive: false },
      });

      console.log(`[DELETE] Soft deleted user ${id} due to foreign key constraints`);

      return NextResponse.json({
        success: true,
        message: 'User deactivated successfully (soft delete)',
        softDelete: true,
        reason: 'User has related records (orders, transactions, etc.)',
      });
    }

    // No related records, can safely hard delete
    await db.user.delete({
      where: { id },
    });

    console.log(`[DELETE] Hard deleted user ${id}`);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      softDelete: false,
    });
  } catch (error) {
    console.error('Delete user error:', error);

    // If it's a foreign key constraint error, try soft delete as fallback
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('foreign key constraint') || errorMessage.includes('violates foreign key')) {
      console.log(`[DELETE] Foreign key constraint detected, falling back to soft delete`);

      try {
        const { id } = await params;
        await db.user.update({
          where: { id },
          data: { isActive: false },
        });

        return NextResponse.json({
          success: true,
          message: 'User deactivated successfully (soft delete)',
          softDelete: true,
          reason: 'Foreign key constraint: User has related records',
        });
      } catch (fallbackError) {
        console.error('[DELETE] Fallback soft delete also failed:', fallbackError);
        return NextResponse.json(
          { success: false, error: 'Failed to delete user (both hard and soft delete failed)' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

/**
 * Check if user has related records that would prevent deletion
 */
async function checkUserHasRelatedRecords(userId: string): Promise<boolean> {
  // Check for orders
  const ordersCount = await db.order.count({
    where: { cashierId: userId },
  });
  if (ordersCount > 0) return true;

  // Check for inventory transactions
  const inventoryTxnCount = await db.inventoryTransaction.count({
    where: { createdBy: userId },
  });
  if (inventoryTxnCount > 0) return true;

  // Check for audit logs
  const auditLogCount = await db.auditLog.count({
    where: { userId },
  });
  if (auditLogCount > 0) return true;

  // Check for shifts
  const shiftCount = await db.shift.count({
    where: { cashierId: userId },
  });
  if (shiftCount > 0) return true;

  // Check for purchase orders
  const poApprovedCount = await db.purchaseOrder.count({
    where: { approvedBy: userId },
  });
  if (poApprovedCount > 0) return true;

  const poCreatedCount = await db.purchaseOrder.count({
    where: { createdBy: userId },
  });
  if (poCreatedCount > 0) return true;

  // Check for inventory transfers
  const transferRequestedCount = await db.inventoryTransfer.count({
    where: { requestedBy: userId },
  });
  if (transferRequestedCount > 0) return true;

  const transferApprovedCount = await db.inventoryTransfer.count({
    where: { approvedBy: userId },
  });
  if (transferApprovedCount > 0) return true;

  const transferCompletedCount = await db.inventoryTransfer.count({
    where: { completedBy: userId },
  });
  if (transferCompletedCount > 0) return true;

  // Check for waste logs
  const wasteLogCount = await db.wasteLog.count({
    where: { recordedBy: userId },
  });
  if (wasteLogCount > 0) return true;

  // No related records found
  return false;
}
