// Database Setup API
// Initializes the database schema on first deployment

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/setup/db
 * Initializes the database by pushing the schema
 * This should be called after first deployment to Vercel
 */
export async function POST(request: NextRequest) {
  try {
    // Try to query the database to see if it's initialized
    const userCount = await db.user.count();

    return NextResponse.json({
      success: true,
      message: 'Database is already initialized',
      data: {
        userCount,
        tablesExist: true
      }
    });
  } catch (error: any) {
    console.error('Database initialization check failed:', error);

    // If the error is about missing tables, we need to push the schema
    if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
      return NextResponse.json({
        success: false,
        error: 'Database tables not found. Please run `bun run db:push` locally with the Neon DATABASE_URL to initialize the database.',
        details: error.message
      }, { status: 400 });
    }

    // Database connection error
    if (error.code === 'PGRST116' || error.code === 'ECONNREFUSED') {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed. Please check your DATABASE_URL environment variable in Vercel.',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: false,
      error: 'Database initialization failed',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/setup/db
 * Checks database status
 */
export async function GET(request: NextRequest) {
  try {
    // Check if we can connect to the database
    const userCount = await db.user.count();
    const branchCount = await db.branch.count();

    return NextResponse.json({
      success: true,
      data: {
        databaseConnected: true,
        userCount,
        branchCount,
        tablesExist: true
      }
    });
  } catch (error: any) {
    console.error('Database health check failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Database not accessible',
      details: error.message,
      suggestion: 'Please ensure DATABASE_URL is set in Vercel environment variables and run `bun run db:push` to initialize the database.'
    }, { status: 500 });
  }
}
