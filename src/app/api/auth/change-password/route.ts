import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, newPassword, requesterUserId } = body;

    if (!userId || !newPassword || !requesterUserId) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Get requester (user trying to change the password)
    const requester = await db.user.findUnique({
      where: { id: requesterUserId },
    });

    if (!requester) {
      return NextResponse.json(
        { success: false, error: 'Requester not found' },
        { status: 404 }
      );
    }

    // Get the target user (whose password is being changed)
    const targetUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Check permissions based on roles
    // HQ Admin: Can change any user's password
    // Branch Manager: Can change their own password and their cashiers' passwords
    // Cashier: Cannot change passwords

    let hasPermission = false;

    if (requester.role === 'ADMIN') {
      // HQ Admin has full access to change any password
      hasPermission = true;
    } else if (requester.role === 'BRANCH_MANAGER') {
      // Branch Manager can change their own password or their cashiers' passwords
      if (requester.id === userId) {
        // Changing their own password
        hasPermission = true;
      } else if (targetUser.role === 'CASHIER' && targetUser.branchId === requester.branchId) {
        // Changing a cashier's password from same branch
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to change this password. HQ Admin can change any password. Branch Managers can change their own password and their cashiers\' passwords.'
        },
        { status: 403 }
      );
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
