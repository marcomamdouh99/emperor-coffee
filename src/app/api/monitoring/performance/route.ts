import { NextRequest, NextResponse } from 'next/server';
import { getPerformanceReport } from '@/lib/api-logger';

/**
 * Get API performance metrics and logs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const type = searchParams.get('type'); // 'recent', 'errors', 'slow', 'stats'

    const report = getPerformanceReport();
    let data;

    switch (type) {
      case 'recent':
        data = report.recent.slice(0, limit);
        break;
      case 'errors':
        data = report.errors.slice(0, limit);
        break;
      case 'slow':
        data = report.slow.slice(0, limit);
        break;
      case 'stats':
        data = report.stats;
        break;
      default:
        data = report;
    }

    return NextResponse.json(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Performance metrics fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch performance metrics',
      },
      { status: 500 }
    );
  }
}
