// Debug API to diagnose login issues

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug
 * Returns debug information about the environment
 */
export async function GET(request: NextRequest) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    databaseUrlPrefix: process.env.DATABASE_URL?.split('://')[0],
    databaseUrlHost: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0],
    hasPrismaClient: false,
    nodeVersion: process.version,
    nextVersion: '16.x',
    databaseProvider: process.env.DATABASE_URL?.includes('postgresql') ? 'PostgreSQL' : process.env.DATABASE_URL?.includes('sqlite') ? 'SQLite' : 'Unknown'
  };

  try {
    // Try to import Prisma
    const prismaModule = await import('@prisma/client');
    debugInfo.hasPrismaClient = !!prismaModule.PrismaClient;

    // Test database connection
    const { db } = await import('@/lib/db');
    const result = await db.$queryRaw`SELECT 1 as test`;
    debugInfo.databaseConnection = 'OK';
    debugInfo.databaseResult = result;
  } catch (error: any) {
    debugInfo.databaseConnection = 'FAILED';
    debugInfo.databaseError = error.message;
    debugInfo.databaseErrorCode = error.code;
  }

  return NextResponse.json(debugInfo);
}

/**
 * POST /api/debug/login
 * Tests the database with a query without bcrypt
 */
export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    const { db } = await import('@/lib/db');

    // Try to find user without bcrypt
    const user = await db.user.findUnique({
      where: { username }
    });

    return NextResponse.json({
      success: true,
      userFound: !!user,
      user: user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        branchId: user.branchId
      } : null
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      stack: error.stack
    }, { status: 500 });
  }
}
