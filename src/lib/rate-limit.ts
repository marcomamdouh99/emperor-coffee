/**
 * Simple in-memory rate limiter for API endpoints
 * Note: For production with multiple servers, use Redis-based rate limiting
 */

import { NextResponse } from 'next/server'

interface RateLimitStore {
  count: number
  resetTime: number
}

const rateLimitStores = new Map<string, RateLimitStore>()

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: Date
}

/**
 * Check if request should be rate limited
 * @param identifier - Unique identifier (IP, userId, or session ID)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const store = rateLimitStores.get(identifier)

  // First request or window expired
  if (!store || now > store.resetTime) {
    const newStore: RateLimitStore = {
      count: 1,
      resetTime: now + config.windowMs
    }
    rateLimitStores.set(identifier, newStore)
    
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(newStore.resetTime)
    }
  }

  // Check if within window and under limit
  if (now < store.resetTime && store.count < config.maxRequests) {
    store.count++
    rateLimitStores.set(identifier, store)
    
    return {
      success: true,
      remaining: config.maxRequests - store.count,
      resetAt: new Date(store.resetTime)
    }
  }

  // Rate limit exceeded
  return {
    success: false,
    remaining: 0,
    resetAt: new Date(store.resetTime)
  }
}

/**
 * Rate limiter middleware for API routes
 * @param config - Rate limit configuration
 */
export function rateLimit(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    request: Request,
    context?: { params?: any }
  ): Promise<NextResponse> {
    // Get identifier from IP address
    const ip = request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown'
    
    // Create unique identifier combining IP and path
    const identifier = `${ip}:${request.nextUrl.pathname}`
    
    const result = checkRateLimit(identifier, config)
    
    // Add rate limit headers to response
    const headers = new Headers({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    })

    // If rate limited, return 429 Too Many Requests
    if (!result.success) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter: result.resetAt.toISOString()
        }),
        {
          status: 429,
          headers,
        }
      )
    }

    // Set headers on successful request
    return new NextResponse(null, {
      headers,
    })
  }
}

/**
 * Preset rate limit configurations
 */
export const rateLimits = {
  // Login: 5 attempts per minute
  login: {
    maxRequests: 5,
    windowMs: 60 * 1000
  },
  
  // General API: 100 requests per minute
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000
  },
  
  // Sensitive operations: 10 requests per minute
  sensitive: {
    maxRequests: 10,
    windowMs: 60 * 1000
  }
}
