import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { validateRequest, userCreateSchema, formatZodErrors } from '@/lib/validators';

// GET - List users with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currentUserBranchId = searchParams.get('currentUserBranchId');
    const currentUserRole = searchParams.get('currentUserRole');

    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
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
      where: currentUserRole === 'BRANCH_MANAGER' && currentUserBranchId
        ? { branchId: currentUserBranchId }
        : undefined,
    });

    // Add branch names for display
    const usersWithBranchNames = await Promise.all(
      users.map(async (user) => {
        if (!user.branchId) return { ...user, branchName: null };
        const branch = await db.branch.findUnique({
          where: { id: user.branchId },
          select: { branchName: true },
        });
        return { ...user, branchName: branch?.branchName || null };
      })
    );

    return NextResponse.json({
      success: true,
      users: usersWithBranchNames,
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(userCreateSchema, body);

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

    const { username, email, password, name, role, branchId } = validation.data!;

    // Validate branchId for non-admin roles
    if (role !== 'ADMIN' && !branchId) {
      return NextResponse.json(
        { success: false, error: 'Branch ID is required for this role' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUsername = await db.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = await db.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Verify branch exists for non-admin roles
    if (role !== 'ADMIN' && branchId) {
      const branch = await db.branch.findUnique({
        where: { id: branchId },
      });

      if (!branch) {
        return NextResponse.json(
          { success: false, error: 'Branch not found' },
          { status: 404 }
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.user.create({
      data: {
        username,
        email,
        passwordHash,
        name,
        role,
        branchId: role === 'ADMIN' ? null : branchId,
        isActive: true,
      },
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
      user,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
