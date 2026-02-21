import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-manager';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        success: false,
        user: null
      });
    }

    // Return session data (excluding sensitive fields)
    const userData = {
      id: session.userId,
      username: session.username,
      email: session.email,
      name: session.name,
      role: session.role,
      branchId: session.branchId,
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
