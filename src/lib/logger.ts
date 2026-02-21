/**
 * Structured logging utility for production monitoring
 * Supports different log levels and structured output
 */

import { getCacheStats as getCacheStatsFromCache, getCacheHitRate as getCacheHitRateFromCache } from '@/lib/cache';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    endpoint?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
  };
  metadata?: Record<string, any>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  performance?: {
    duration?: number;
    memory?: number;
    databaseTime?: number;
    cacheTime?: number;
  };
}

class Logger {
  private context: string;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  constructor(context: string = 'app') {
    this.context = context;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    metadata?: LogEntry['metadata'],
    error?: LogEntry['error'],
    performance?: LogEntry['performance'],
    contextData?: LogEntry['context']
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: contextData,
      metadata,
      error,
      performance,
    };

    // Store in memory (for log retrieval)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    return entry;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: LogEntry['metadata']) {
    const entry = this.createEntry(LogLevel.DEBUG, message, metadata);
    this.output(entry);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: LogEntry['metadata']) {
    const entry = this.createEntry(LogLevel.INFO, message, metadata);
    this.output(entry);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogEntry['metadata']) {
    const entry = this.createEntry(LogLevel.WARN, message, metadata);
    this.output(entry);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: LogEntry['metadata']) {
    const entry = this.createEntry(
      LogLevel.ERROR,
      message,
      metadata,
      error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      undefined
    );
    this.output(entry);
  }

  /**
   * Log critical message
   */
  critical(message: string, error?: Error, metadata?: LogEntry['metadata']) {
    const entry = this.createEntry(
      LogLevel.CRITICAL,
      message,
      metadata,
      error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      undefined
    );
    this.output(entry);
  }

  /**
   * Log API request
   */
  apiRequest(
    method: string,
    endpoint: string,
    statusCode?: number,
    duration?: number,
    userId?: string,
    requestId?: string
  ) {
    const performance = {
      duration,
    };

    this.info(`${method} ${endpoint}`, {
      context: {
        method,
        endpoint,
        userId,
        requestId,
      },
      metadata: {
        statusCode,
      },
      performance,
    });
  }

  /**
   * Log database query
   */
  databaseQuery(
    query: string,
    duration: number,
    success: boolean,
    error?: any
  ) {
    const performance = {
      databaseTime: duration,
    };

    if (success) {
      this.info(`Database query: ${query}`, {
        metadata: { queryType: query },
        performance,
      });
    } else {
      this.error(`Database query failed: ${query}`, error, {
        metadata: { queryType: query },
        performance,
      });
    }
  }

  /**
   * Log cache operation
   */
  cacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'invalidate',
    key?: string,
    duration?: number
  ) {
    const performance = {
      cacheTime: duration,
    };

    this.debug(`Cache ${operation}${key ? `: ${key}` : ''}`, {
      metadata: { operation, key },
      performance,
    });
  }

  /**
   * Log performance metrics
   */
  performance(
    metricName: string,
    value: number,
    unit?: string,
    metadata?: LogEntry['metadata']
  ) {
    this.info(`Performance: ${metricName} = ${value}${unit ? unit : ''}`, {
      metadata,
    });
  }

  /**
   * Create request logger with context
   */
  createRequestLogger(
    method: string,
    endpoint: string,
    requestId?: string
  ): {
    start: () => void;
    end: (statusCode: number) => void;
  } {
    const startTime = Date.now();

    return {
      start: () => {
        this.info(`Request started: ${method} ${endpoint}`, {
          context: { method, endpoint, requestId },
        });
      },
      end: (statusCode: number) => {
        const duration = Date.now() - startTime;
        this.apiRequest(method, endpoint, statusCode, duration, undefined, requestId);
      },
    };
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry) {
    const logData = {
      timestamp: entry.timestamp,
      level: entry.level,
      context: this.context,
      message: entry.message,
      ...entry.context,
      ...entry.metadata,
      ...(entry.error && { error: entry.error }),
      ...(entry.performance && { performance: entry.performance }),
    };

    // Console output
    if (process.env.NODE_ENV === 'development') {
      const color = this.getConsoleColor(entry.level);
      const prefix = `[${entry.level.toUpperCase()}] [${this.context}]`;
      console.log(color, prefix, entry.message, logData);
    } else {
      // Production: structured JSON output
      console.log(JSON.stringify(logData));
    }
  }

  /**
   * Get console color for log level
   */
  private getConsoleColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '\x1b[36m'; // Cyan
      case LogLevel.INFO:
        return '\x1b[32m'; // Green
      case LogLevel.WARN:
        return '\x1b[33m'; // Yellow
      case LogLevel.ERROR:
        return '\x1b[31m'; // Red
      case LogLevel.CRITICAL:
        return '\x1b[35m'; // Magenta
      default:
        return '\x1b[0m'; // Reset
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 100, level?: LogLevel): LogEntry[] {
    let filtered = this.logs;
    
    if (level) {
      filtered = this.logs.filter(log => log.level === level);
    }

    return filtered.slice(-count);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

/**
 * Default logger instances
 */
export const logger = new Logger('app');
export const apiLogger = new Logger('api');
export const dbLogger = new Logger('database');
export const cacheLogger = new Logger('cache');
export const authLogger = new Logger('auth');

/**
 * Log levels enum
 */
export { LogLevel };
export { type LogEntry };
