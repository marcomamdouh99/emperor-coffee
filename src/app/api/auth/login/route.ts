import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, rateLimits } from '@/lib/rate-limit';
import { createSession } from '@/lib/session-manager';
import { validateRequest, formatZodErrors, loginSchema } from '@/lib/validators';
import { logLogin } from '@/lib/audit-logger';

// Dynamic import for bcryptjs to avoid build issues
const getBcrypt = async () => {
  const bcrypt = await import('bcryptjs');
  return bcrypt;
};

export async function POST(request: NextRequest) {
  // Apply rate limiting (5 login attempts per minute)
  const rateLimitResponse = await rateLimit(rateLimits.login)(request);

  if (rateLimitResponse.status === 429) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(loginSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: formatZodErrors(validation.errors)
        },
        { status: 400 }
      );
    }

    const { username, password } = validation.data!;

    // Find user by username
    const user = await db.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'User account is inactive' },
        { status: 403 }
      );
    }

    // Check if user's branch is active (if user has a branch)
    if (user.branchId) {
      const branch = await db.branch.findUnique({
        where: { id: user.branchId },
        select: { id: true, branchName: true, isActive: true, licenseExpiresAt: true },
      });

      if (!branch) {
        return NextResponse.json(
          { success: false, error: 'Branch not found. Please contact administrator.' },
          { status: 403 }
        );
      }

      if (!branch.isActive) {
        return NextResponse.json(
          { success: false, error: `Branch "${branch.branchName}" is deactivated. Please contact administrator.` },
          { status: 403 }
        );
      }

      // Check if license is expired
      if (new Date(branch.licenseExpiresAt) < new Date()) {
        return NextResponse.json(
          { success: false, error: `Branch license expired on ${new Date(branch.licenseExpiresAt).toLocaleDateString()}. Please contact administrator.` },
          { status: 403 }
        );
      }
    }

    // Verify password using bcrypt
    const bcrypt = await getBcrypt();
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Create session
    const sessionData = await createSession({
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId
    })

    // Log login to audit logs (fire and forget, don't await)
    logLogin(user.id).catch(err => console.error('Failed to log login:', err));

    // Return success with session info
    return NextResponse.json({
      success: true,
      session: sessionData,
      message: 'Login successful'
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
