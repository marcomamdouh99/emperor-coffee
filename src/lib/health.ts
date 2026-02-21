/**
 * Health check and monitoring utilities
 */

import { db, checkHealth as checkDbHealth } from '@/lib/db';
import { getCacheStats, getCacheHitRate } from '@/lib/cache';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: {
      status: 'healthy' | 'unhealthy'
      latency?: number
      message: string
    }
    cache: {
      status: 'healthy' | 'unhealthy'
      stats: {
        hits: number
        misses: number
        size: number
        hitRate: number
      }
    }
    memory: {
      status: 'healthy' | 'warning' | 'unhealthy'
      usage: {
        used: number
        total: number
        percentage: number
      }
    }
    disk?: {
      status: 'healthy' | 'warning' | 'unhealthy'
      usage: {
        used: number
        total: number
        percentage: number
      }
    }
  }
}

// Track application start time
const startTime = Date.now();

/**
 * Get application uptime in seconds
 */
function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

/**
 * Check database health with latency measurement
 */
async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy'
  latency?: number
  message: string
}> {
  const start = Date.now();
  const isHealthy = await checkDbHealth();
  const latency = Date.now() - start;

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    latency,
    message: isHealthy ? 'Database connection successful' : 'Database connection failed',
  };
}

/**
 * Check cache health
 */
function checkCacheHealth() {
  const stats = getCacheStats();
  const hitRate = getCacheHitRate();

  return {
    status: hitRate > 0.1 ? 'healthy' : 'warning',
    stats: {
      hits: stats.hits,
      misses: stats.misses,
      size: stats.size,
      hitRate,
    },
  };
}

/**
 * Check memory health
 */
function checkMemoryHealth() {
  // Check if running in browser (Node.js environment check)
  if (typeof process === 'undefined' || typeof process.memoryUsage !== 'function') {
    return {
      status: 'healthy' as const,
      usage: {
        used: 0,
        total: 0,
        percentage: 0,
      },
    };
  }

  const usage = process.memoryUsage();
  const totalMemory = 2 * 1024 * 1024 * 1024; // Assume 2GB max
  const percentage = (usage.heapUsed / totalMemory) * 100;

  let status: 'healthy' | 'warning' | 'unhealthy' = 'healthy';
  if (percentage > 90) {
    status = 'unhealthy';
  } else if (percentage > 75) {
    status = 'warning';
  }

  return {
    status,
    usage: {
      used: usage.heapUsed,
      total: totalMemory,
      percentage,
    },
  };
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<SystemHealth> {
  const [dbHealth, cacheHealth, memoryHealth] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(checkCacheHealth()),
    Promise.resolve(checkMemoryHealth()),
  ]);

  // Determine overall system status
  const checks = [dbHealth, cacheHealth, memoryHealth];
  const unhealthyChecks = checks.filter(c => c.status === 'unhealthy');
  const degradedChecks = checks.filter(c => c.status === 'warning');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyChecks.length > 0) {
    overallStatus = 'unhealthy';
  } else if (degradedChecks.length > 0) {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    checks: {
      database: dbHealth,
      cache: cacheHealth,
      memory: memoryHealth,
    },
  };
}

/**
 * Get basic health check result
 */
export function getBasicHealth(): HealthCheckResult {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };
}

/**
 * Get metrics for monitoring dashboard
 */
export interface SystemMetrics {
  uptime: number
  database: {
    status: string
    latency?: number
  }
  cache: {
    hits: number
    misses: number
    size: number
    hitRate: number
  }
  memory: {
    heapUsed: number
    heapTotal: number
    percentage: number
  }
  timestamp: string
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const dbStart = Date.now();
  const dbHealthy = await checkDbHealth();
  const dbLatency = Date.now() - dbStart;

  const cacheStats = getCacheStats();

  const memoryUsage = typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
    ? process.memoryUsage()
    : { heapUsed: 0, heapTotal: 0 };

  return {
    uptime: getUptime(),
    database: {
      status: dbHealthy ? 'connected' : 'disconnected',
      latency: dbLatency,
    },
    cache: {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      size: cacheStats.size,
      hitRate: getCacheHitRate(),
    },
    memory: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      percentage: (memoryUsage.heapUsed / (memoryUsage.heapTotal || 1)) * 100,
    },
    timestamp: new Date().toISOString(),
  };
}
