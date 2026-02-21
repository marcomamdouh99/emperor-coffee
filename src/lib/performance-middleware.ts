import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { apiLogger } from '@/lib/logger';

/**
 * Performance tracking middleware
 * Logs API request duration and status codes for monitoring
 */

export async function performanceMiddleware(request: NextRequest) {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  const method = request.method;
  const url = request.nextUrl.pathname;

  // Add request ID to headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  // Create modified request with request ID
  const modifiedRequest = new Request(request.url, {
    method: request.method,
    headers: requestHeaders,
    body: request.body,
  });

  // Let request proceed
  const response = NextResponse.next(modifiedRequest);

  // Intercept response to log metrics
  return response.then(async (res) => {
    const duration = Date.now() - start;
    const status = res.status;

    // Log API request metrics
    apiLogger.apiRequest(method, url, status, duration, undefined, requestId);

    // Add performance headers
    const responseHeaders = new Headers(res.headers);
    responseHeaders.set('x-request-id', requestId);
    responseHeaders.set('x-response-time', duration.toString());
    responseHeaders.set('server-timing', `api;dur=${duration}`);

    // Return modified response
    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
      statusText: res.statusText,
    });
  });
}

/**
 * Create a performance logger wrapper for API routes
 */
export function withPerformanceTracking<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return async (...args: Parameters<T>) => {
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    try {
      const response = await handler(...args);
      const duration = Date.now() - start;
      const status = response.status;

      // Extract method and URL from request
      const request = args[0] as NextRequest;
      const method = request.method;
      const url = request.nextUrl.pathname;

      // Log metrics
      apiLogger.apiRequest(method, url, status, duration, undefined, requestId);

      // Add performance headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('x-request-id', requestId);
      responseHeaders.set('x-response-time', duration.toString());
      responseHeaders.set('server-timing', `api;dur=${duration}`);

      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
        statusText: response.statusText,
      }) as any;
    } catch (error: any) {
      const duration = Date.now() - start;
      const request = args[0] as NextRequest;
      const method = request.method;
      const url = request.nextUrl.pathname;

      // Log error
      apiLogger.error(`${method} ${url} failed`, error, {
        duration,
      });

      // Return error response
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          requestId,
        },
        {
          status: 500,
          headers: {
            'x-request-id': requestId,
            'x-response-time': duration.toString(),
          },
        }
      );
    }
  };
}
