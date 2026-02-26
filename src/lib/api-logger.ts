/**
 * API performance logger
 * Tracks response times, error rates, and request patterns
 */

export interface ApiLog {
  timestamp: string
  method: string
  path: string
  statusCode: number
  responseTime: number
  userAgent?: string
  ip?: string
}

class ApiPerformanceLogger {
  private logs: ApiLog[] = [];
  private maxLogs: number = 1000;
  private stats: {
    totalRequests: number
    totalResponseTime: number
    errorCount: number
    slowRequests: number
  } = {
    totalRequests: 0,
    totalResponseTime: 0,
    errorCount: 0,
    slowRequests: 0,
  };

  /**
   * Log an API request
   */
  log(log: ApiLog): void {
    this.logs.push(log);
    this.updateStats(log);

    // Keep logs under limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log slow requests (> 1 second)
    if (log.responseTime > 1000) {
      console.warn(`[PERFORMANCE] Slow request detected: ${log.method} ${log.path} - ${log.responseTime}ms`);
    }

    // Log errors
    if (log.statusCode >= 400) {
      console.error(`[API] Error response: ${log.method} ${log.path} - ${log.statusCode}`);
    }
  }

  /**
   * Update statistics
   */
  private updateStats(log: ApiLog): void {
    this.stats.totalRequests++;
    this.stats.totalResponseTime += log.responseTime;

    if (log.statusCode >= 400) {
      this.stats.errorCount++;
    }

    if (log.responseTime > 1000) {
      this.stats.slowRequests++;
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 100): ApiLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const avgResponseTime = this.stats.totalRequests > 0
      ? this.stats.totalResponseTime / this.stats.totalRequests
      : 0;

    const errorRate = this.stats.totalRequests > 0
      ? (this.stats.errorCount / this.stats.totalRequests) * 100
      : 0;

    const slowRate = this.stats.totalRequests > 0
      ? (this.stats.slowRequests / this.stats.totalRequests) * 100
      : 0;

    return {
      ...this.stats,
      avgResponseTime,
      errorRate,
      slowRate,
      errorRatePercentage: errorRate.toFixed(2) + '%',
      slowRatePercentage: slowRate.toFixed(2) + '%',
    };
  }

  /**
   * Get logs by path
   */
  getLogsByPath(path: string): ApiLog[] {
    return this.logs.filter(log => log.path.includes(path));
  }

  /**
   * Get error logs only
   */
  getErrorLogs(): ApiLog[] {
    return this.logs.filter(log => log.statusCode >= 400);
  }

  /**
   * Get slow logs only
   */
  getSlowLogs(thresholdMs: number = 1000): ApiLog[] {
    return this.logs.filter(log => log.responseTime > thresholdMs);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get logs for specific time range
   */
  getLogsInRange(startTime: Date, endTime: Date): ApiLog[] {
    return this.logs.filter(
      log => new Date(log.timestamp) >= startTime && new Date(log.timestamp) <= endTime
    );
  }
}

// Singleton instance
const logger = new ApiPerformanceLogger();

/**
 * Get logger instance
 */
export function getApiLogger(): ApiPerformanceLogger {
  return logger;
}

/**
 * Middleware wrapper for API response time tracking
 */
export function withApiPerformanceLogging(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const startTime = Date.now();

    try {
      const response = await handler(request);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Clone response to log headers
      const url = new URL(request.url);
      const path = url.pathname;

      // Get IP address
      const ip = request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown';

      // Get user agent
      const userAgent = request.headers.get('user-agent') || undefined;

      logger.log({
        timestamp: new Date().toISOString(),
        method: request.method,
        path,
        statusCode: response.status,
        responseTime,
        userAgent,
        ip,
      });

      // Add performance header
      const headers = new Headers(response.headers);
      headers.set('X-Response-Time', responseTime.toString());

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const url = new URL(request.url);
      const path = url.pathname;

      logger.log({
        timestamp: new Date().toISOString(),
        method: request.method,
        path,
        statusCode: 500,
        responseTime,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      });

      throw error;
    }
  };
}

/**
 * Get performance logs endpoint data
 */
export function getPerformanceReport() {
  return {
    recent: logger.getRecentLogs(50),
    stats: logger.getStats(),
    errors: logger.getErrorLogs().slice(-20),
    slow: logger.getSlowLogs().slice(-20),
  };
}
