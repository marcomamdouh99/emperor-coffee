import { NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/session-manager';
import { logLogout } from '@/lib/audit-logger';

export async function POST() {
  try {
    // Get user ID before clearing session
    const session = await getSession();
    const userId = session?.userId || null;

    // Clear the secure session cookie
    await clearSession();

    // Log logout to audit logs (fire and forget, don't await)
    if (userId) {
      logLogout(userId).catch(err => console.error('Failed to log logout:', err));
    }

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
