/**
 * Simple in-memory cache with TTL support
 * Can be upgraded to Redis for distributed caching
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
}

class Cache {
  private store: Map<string, CacheEntry<any>>
  private stats: CacheStats
  private maxSize: number
  private defaultTTL: number

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) {
    this.store = new Map()
    this.stats = { hits: 0, misses: 0, size: 0 }
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL // 5 minutes default
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.stats.size--
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return entry.data as T
  }

  /**
   * Set value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    // Evict old entries if at capacity
    if (this.store.size >= this.maxSize) {
      this.evictExpired()
      if (this.store.size >= this.maxSize) {
        // Still at capacity, remove oldest entry
        const firstKey = this.store.keys().next().value
        if (firstKey) {
          this.store.delete(firstKey)
          this.stats.size--
        }
      }
    }

    const entry: CacheEntry<T> = {
      data: value,
      expiresAt: Date.now() + ttl
    }

    this.store.set(key, entry)
    this.stats.size++
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const existed = this.store.delete(key)
    if (existed) {
      this.stats.size--
    }
    return existed
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.store.clear()
    this.stats.size = 0
  }

  /**
   * Evict expired entries
   */
  private evictExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
        this.stats.size--
      }
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern)
    let count = 0
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key)
        this.stats.size--
        count++
      }
    }
    return count
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Calculate hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses
    return total > 0 ? this.stats.hits / total : 0
  }
}

// Create singleton cache instance
const cache = new Cache(
  1000, // max 1000 entries
  300000 // 5 minutes default TTL
)

/**
 * Cache helpers
 */
export const cacheKeys = {
  menuItems: (branchId?: string) => `menu:items:${branchId || 'all'}`,
  menuItem: (id: string) => `menu:item:${id}`,
  categories: (branchId?: string) => `categories:${branchId || 'all'}`,
  ingredients: (branchId?: string) => `ingredients:${branchId || 'all'}`,
  branches: () => `branches:all`,
  branch: (id: string) => `branch:${id}`,
  users: (branchId?: string) => `users:${branchId || 'all'}`,
  customers: () => `customers:all`,
  inventory: (branchId: string) => `inventory:${branchId}`,
}

/**
 * Cache middleware function
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300000
): Promise<T> {
  // Try to get from cache
  const cached = cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  const data = await fetcher()

  // Store in cache
  cache.set(key, data, ttl)

  return data
}

/**
 * Invalidate cache key
 */
export function invalidateCache(key: string): void {
  cache.delete(key)
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCachePattern(pattern: string): number {
  return cache.invalidatePattern(pattern)
}

/**
 * Clear all cache (use carefully)
 */
export function clearAllCache(): void {
  cache.clear()
}

/**
 * Get cache statistics (for monitoring)
 */
export function getCacheStats(): CacheStats {
  return cache.getStats()
}

/**
 * Get cache hit rate (for monitoring)
 */
export function getCacheHitRate(): number {
  return cache.getHitRate()
}
