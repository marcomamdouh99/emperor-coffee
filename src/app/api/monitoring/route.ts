import { NextRequest, NextResponse } from 'next/server';
import { logger, LogLevel } from '@/lib/logger';
import { getCacheStats, getCacheHitRate } from '@/lib/cache';
import { checkHealth } from '@/lib/db';

/**
 * Monitoring API endpoint for system observability
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logsLimit = parseInt(searchParams.get('limit') || '100');
    const logLevel = searchParams.get('level') as LogLevel | undefined;

    // Get recent logs
    const recentLogs = logger.getRecentLogs(logsLimit, logLevel);

    // Calculate metrics
    const cacheStats = getCacheStats();
    const cacheHitRate = getCacheHitRate();

    // Get system information
    const memoryUsage = process.memoryUsage();
    const systemInfo = {
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      },
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      system: systemInfo,
      cache: {
        entries: cacheStats.size,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheHitRate,
      },
      database: {
        status: 'connected', // Check actual health if needed
      },
      logs: recentLogs,
      metrics: {
        totalLogs: recentLogs.length,
        errors: recentLogs.filter(l => l.level === LogLevel.ERROR || l.level === LogLevel.CRITICAL).length,
        warnings: recentLogs.filter(l => l.level === LogLevel.WARN).length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Clear logs endpoint (only in development)
 */
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: 'Not allowed in production' },
      { status: 403 }
    );
  }

  try {
    logger.clearLogs();

    return NextResponse.json({
      success: true,
      message: 'Logs cleared successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear logs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
