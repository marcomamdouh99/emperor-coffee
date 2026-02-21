import { NextRequest, NextResponse } from 'next/server';
import { getSystemMetrics } from '@/lib/health';

/**
 * Get system metrics for monitoring dashboard
 */
export async function GET(request: NextRequest) {
  try {
    // Check if request is from authorized source (optional security measure)
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && !authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const metrics = await getSystemMetrics();

    return NextResponse.json(metrics, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Metrics fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch metrics',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
