import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-manager';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        success: false,
        user: null
      });
    }

    // Validate user and branch status from database
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        branchId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      // User not found or inactive - session is invalid
      return NextResponse.json({
        success: false,
        user: null,
        error: 'User account is inactive or does not exist'
      });
    }

    // Check if user's branch is still active (if user has a branch)
    if (user.branchId) {
      const branch = await db.branch.findUnique({
        where: { id: user.branchId },
        select: { id: true, branchName: true, isActive: true, licenseExpiresAt: true },
      });

      if (!branch || !branch.isActive) {
        // Branch not found or deactivated - session is invalid
        return NextResponse.json({
          success: false,
          user: null,
          error: branch ? `Branch "${branch.branchName}" is deactivated` : 'Branch not found'
        });
      }

      // Check if license is expired
      if (new Date(branch.licenseExpiresAt) < new Date()) {
        return NextResponse.json({
          success: false,
          user: null,
          error: `Branch license expired on ${new Date(branch.licenseExpiresAt).toLocaleDateString()}`
        });
      }
    }

    // Return session data (excluding sensitive fields)
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      isActive: true
    };

    return NextResponse.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
