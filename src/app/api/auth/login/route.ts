import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { rateLimit, rateLimits } from '@/lib/rate-limit';
import { createSession } from '@/lib/session-manager';
import { validateRequest, formatZodErrors, loginSchema } from '@/lib/validators';

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

    // Verify password using bcrypt
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
