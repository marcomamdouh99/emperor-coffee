import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session-manager';

export async function POST() {
  try {
    // Clear the secure session cookie
    await clearSession();

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to logout' },
      { status: 500 }
    );
  }
}
