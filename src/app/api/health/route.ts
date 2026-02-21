import { NextResponse } from 'next/server';
import { performHealthCheck, getBasicHealth, getSystemMetrics } from '@/lib/health';
import { db } from '@/lib/db';

/**
 * Basic health check endpoint
 * Use this for load balancers and uptime monitoring
 */
export async function GET() {
  try {
    // Debug logging
    console.log('[HEALTH] Working directory:', process.cwd());
    console.log('[HEALTH] DATABASE_URL:', process.env.DATABASE_URL);
    console.log('[HEALTH] __dirname:', __dirname);
    console.log('[HEALTH] Node version:', process.version);

    const basicHealth = getBasicHealth();

    return NextResponse.json(basicHealth, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 503 }
    );
  }
}

/**
 * Detailed health check endpoint
 * Returns detailed status of all system components
 */
export async function POST() {
  try {
    const health = await performHealthCheck();

    const statusCode = health.status === 'healthy'
      ? 200
      : health.status === 'degraded'
      ? 200
      : 503;

    return NextResponse.json(health, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Detailed health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        checks: {
          database: { status: 'unhealthy', message: 'Health check failed' },
          cache: {
            status: 'unhealthy',
            stats: { hits: 0, misses: 0, size: 0, hitRate: 0 },
          },
          memory: { status: 'unhealthy', usage: { used: 0, total: 0, percentage: 0 } },
        },
      },
      { status: 503 }
    );
  }
}
// Force rebuild
