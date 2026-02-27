/**
 * Data Expiration and Cleanup Service
 * Manages TTL (Time To Live) for cached data and automatic cleanup
 * Prevents storage bloat and ensures data freshness
 */

export interface CachePolicy {
  entityType: string;
  ttl: number; // Time to live in milliseconds
  maxEntries?: number; // Maximum number of entries to keep
  priority: 'high' | 'medium' | 'low';
}

export interface CacheEntry {
  key: string;
  entityType: string;
  data: any;
  timestamp: number;
  ttl: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

class DataExpirationService {
  private cache: Map<string, CacheEntry> = new Map();
  private policies: Map<string, CachePolicy> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private storageKey = 'data_expiration_cache';
  private initialized: boolean = false;

  constructor() {
    // Initialize with default cache policies
    this.setDefaultPolicies();
    // Load cache from storage only after DOM is ready
    if (typeof window !== 'undefined') {
      // Defer loading until after component mount
      setTimeout(() => {
        this.loadCacheFromStorage();
        this.startCleanupInterval();
      }, 100);
    }
  }

  /**
   * Set default cache policies for different entity types
   */
  private setDefaultPolicies(): void {
    const policies: CachePolicy[] = [
      // Menu data - High priority, long TTL (changes infrequently)
      {
        entityType: 'menu_items',
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxEntries: 1000,
        priority: 'high',
      },
      {
        entityType: 'categories',
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxEntries: 100,
        priority: 'high',
      },
      {
        entityType: 'recipes',
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxEntries: 500,
        priority: 'high',
      },

      // Inventory data - High priority, medium TTL
      {
        entityType: 'ingredients',
        ttl: 12 * 60 * 60 * 1000, // 12 hours
        maxEntries: 500,
        priority: 'high',
      },
      {
        entityType: 'inventory',
        ttl: 1 * 60 * 60 * 1000, // 1 hour (changes frequently)
        maxEntries: 100,
        priority: 'high',
      },

      // Customer data - Medium priority, long TTL
      {
        entityType: 'customers',
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxEntries: 10000,
        priority: 'medium',
      },
      {
        entityType: 'customer_addresses',
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxEntries: 20000,
        priority: 'medium',
      },

      // Order data - Low priority, short TTL (large dataset)
      {
        entityType: 'orders',
        ttl: 1 * 60 * 60 * 1000, // 1 hour
        maxEntries: 500,
        priority: 'low',
      },

      // Shift data - Low priority, short TTL
      {
        entityType: 'shifts',
        ttl: 2 * 60 * 60 * 1000, // 2 hours
        maxEntries: 100,
        priority: 'low',
      },

      // Delivery data - Medium priority
      {
        entityType: 'delivery_areas',
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxEntries: 50,
        priority: 'medium',
      },
      {
        entityType: 'couriers',
        ttl: 12 * 60 * 60 * 1000, // 12 hours
        maxEntries: 100,
        priority: 'medium',
      },

      // Settings - High priority, long TTL
      {
        entityType: 'receipt_settings',
        ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
        maxEntries: 1,
        priority: 'high',
      },
      {
        entityType: 'tables',
        ttl: 6 * 60 * 60 * 1000, // 6 hours
        maxEntries: 100,
        priority: 'high',
      },

      // Promo codes - Medium priority
      {
        entityType: 'promo_codes',
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxEntries: 500,
        priority: 'medium',
      },

      // Waste logs - Low priority
      {
        entityType: 'waste_logs',
        ttl: 3 * 24 * 60 * 60 * 1000, // 3 days
        maxEntries: 200,
        priority: 'low',
      },

      // Daily expenses - Low priority
      {
        entityType: 'daily_expenses',
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxEntries: 100,
        priority: 'low',
      },
    ];

    policies.forEach(policy => {
      this.policies.set(policy.entityType, policy);
    });
  }

  /**
   * Set custom cache policy for an entity type
   */
  setPolicy(entityType: string, policy: Partial<CachePolicy>): void {
    const existing = this.policies.get(entityType);
    this.policies.set(entityType, {
      ...existing,
      ...policy,
      entityType,
    } as CachePolicy);
  }

  /**
   * Cache data with TTL
   */
  async cache(key: string, entityType: string, data: any, customTTL?: number): Promise<void> {
    const policy = this.policies.get(entityType);

    if (!policy) {
      console.warn(`[DataExpiration] No policy for entity type: ${entityType}, using default`);
      // Use default policy with 1 hour TTL
      this.policies.set(entityType, {
        entityType,
        ttl: 1 * 60 * 60 * 1000,
        priority: 'medium',
      });
    }

    const finalPolicy = this.policies.get(entityType)!;
    const ttl = customTTL || finalPolicy.ttl;
    const now = Date.now();

    const entry: CacheEntry = {
      key,
      entityType,
      data,
      timestamp: now,
      ttl,
      expiresAt: now + ttl,
      accessCount: 1,
      lastAccessed: now,
    };

    this.cache.set(key, entry);

    // Check if we need to enforce max entries
    if (finalPolicy.maxEntries) {
      await this.enforceMaxEntries(entityType, finalPolicy.maxEntries);
    }

    // Persist to storage
    await this.persistCacheToStorage();
  }

  /**
   * Get cached data
   */
  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      console.log(`[DataExpiration] Cache entry expired: ${key}`);
      this.cache.delete(key);
      await this.persistCacheToStorage();
      return null;
    }

    // Update access count and last accessed time
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Check if cache entry exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      await this.persistCacheToStorage();
      return false;
    }

    return true;
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    await this.persistCacheToStorage();
  }

  /**
   * Clear all cache entries for an entity type
   */
  async clearByEntityType(entityType: string): Promise<number> {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.entityType === entityType) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      await this.persistCacheToStorage();
    }

    console.log(`[DataExpiration] Cleared ${count} entries for ${entityType}`);
    return count;
  }

  /**
   * Clear all expired entries
   */
  async clearExpired(): Promise<number> {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      await this.persistCacheToStorage();
      console.log(`[DataExpiration] Cleared ${count} expired entries`);
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    const count = this.cache.size;
    this.cache.clear();
    await this.persistCacheToStorage();
    console.log(`[DataExpiration] Cleared all ${count} cache entries`);
  }

  /**
   * Enforce max entries limit for an entity type
   */
  private async enforceMaxEntries(entityType: string, maxEntries: number): Promise<void> {
    const entries = Array.from(this.cache.entries())
      .filter(([_key, entry]) => entry.entityType === entityType)
      .sort(([_keyA, a], [_keyB, b]) => {
        // Sort by last accessed (oldest first)
        return a.lastAccessed - b.lastAccessed;
      });

    if (entries.length <= maxEntries) {
      return;
    }

    // Delete oldest entries
    const toDelete = entries.slice(0, entries.length - maxEntries);
    for (const [key] of toDelete) {
      this.cache.delete(key);
    }

    console.log(`[DataExpiration] Enforced max entries for ${entityType}: deleted ${toDelete.length} oldest entries`);
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, 5 * 60 * 1000);

    console.log('[DataExpiration] Cleanup interval started (5 minutes)');
  }

  /**
   * Stop automatic cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[DataExpiration] Cleanup interval stopped');
    }
  }

  /**
   * Perform cleanup
   */
  async cleanup(): Promise<{
    expiredRemoved: number;
    totalEntries: number;
    totalSize: number;
  }> {
    // Clear expired entries
    const expiredRemoved = await this.clearExpired();

    // Enforce max entries for all entity types
    for (const [entityType, policy] of this.policies.entries()) {
      if (policy.maxEntries) {
        await this.enforceMaxEntries(entityType, policy.maxEntries);
      }
    }

    const totalEntries = this.cache.size;
    const totalSize = await this.getCacheSize();

    return {
      expiredRemoved,
      totalEntries,
      totalSize,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    byEntityType: Record<string, number>;
    byPriority: Record<string, number>;
    expiredCount: number;
    memoryEstimate: string;
  } {
    const now = Date.now();
    const byEntityType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let expiredCount = 0;

    for (const [_, entry] of this.cache.entries()) {
      // Count by entity type
      byEntityType[entry.entityType] = (byEntityType[entry.entityType] || 0) + 1;

      // Count by priority
      const policy = this.policies.get(entry.entityType);
      const priority = policy?.priority || 'medium';
      byPriority[priority] = (byPriority[priority] || 0) + 1;

      // Count expired
      if (now > entry.expiresAt) {
        expiredCount++;
      }
    }

    // Estimate memory size (rough calculation)
    const memoryEstimate = Math.round(JSON.stringify(Array.from(this.cache.entries())).length / 1024) + ' KB';

    return {
      totalEntries: this.cache.size,
      byEntityType,
      byPriority,
      expiredCount,
      memoryEstimate,
    };
  }

  /**
   * Get cache size estimate
   */
  private async getCacheSize(): Promise<number> {
    const cacheString = JSON.stringify(Array.from(this.cache.entries()));
    return cacheString.length;
  }

  /**
   * Persist cache to localStorage
   */
  private async persistCacheToStorage(): Promise<void> {
    // Guard against SSR or missing localStorage
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const cacheArray = Array.from(this.cache.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(cacheArray));
    } catch (error) {
      console.error('[DataExpiration] Failed to persist cache to storage:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadCacheFromStorage(): void {
    // Guard against SSR or missing localStorage
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const cached = localStorage.getItem(this.storageKey);
      if (cached) {
        const cacheArray = JSON.parse(cached);
        this.cache = new Map(cacheArray);
        console.log(`[DataExpiration] Loaded ${this.cache.size} cache entries from storage`);
      }
      this.initialized = true;
    } catch (error) {
      console.error('[DataExpiration] Failed to load cache from storage:', error);
      this.initialized = true;
    }
  }

  /**
   * Get all entries for an entity type
   */
  async getEntriesByEntityType(entityType: string): Promise<CacheEntry[]> {
    return Array.from(this.cache.values()).filter(entry => entry.entityType === entityType);
  }

  /**
   * Manually refresh TTL for an entry
   */
  async refreshTTL(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (!entry) {
      return;
    }

    const policy = this.policies.get(entry.entityType);
    const ttl = policy?.ttl || 1 * 60 * 60 * 1000;

    entry.timestamp = Date.now();
    entry.expiresAt = entry.timestamp + ttl;
    entry.lastAccessed = entry.timestamp;

    this.cache.set(key, entry);
    await this.persistCacheToStorage();
  }
}

// Export singleton instance
export const dataExpirationService = new DataExpirationService();

export { DataExpirationService };
export default dataExpirationService;
