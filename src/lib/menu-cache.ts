/**
 * In-memory cache for menu data
 * This cache persists across component unmounts/remounts (until page refresh)
 */

interface MenuCacheData {
  menuItems: any[] | null;
  categories: any[] | null;
  timestamp: number;
}

class MenuCache {
  private cache: MenuCacheData = {
    menuItems: null,
    categories: null,
    timestamp: 0,
  };

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if cached data is still valid
   */
  private isValid(): boolean {
    return Date.now() - this.cache.timestamp < this.CACHE_TTL;
  }

  /**
   * Get cached menu items
   */
  getMenuItems(): any[] | null {
    if (this.isValid() && this.cache.menuItems) {
      console.log('[MenuCache] Returning cached menu items');
      return this.cache.menuItems;
    }
    return null;
  }

  /**
   * Get cached categories
   */
  getCategories(): any[] | null {
    if (this.isValid() && this.cache.categories) {
      console.log('[MenuCache] Returning cached categories');
      return this.cache.categories;
    }
    return null;
  }

  /**
   * Set menu items in cache
   */
  setMenuItems(items: any[]): void {
    this.cache.menuItems = items;
    this.cache.timestamp = Date.now();
    console.log('[MenuCache] Cached menu items:', items.length, 'items');
  }

  /**
   * Set categories in cache
   */
  setCategories(categories: any[]): void {
    this.cache.categories = categories;
    this.cache.timestamp = Date.now();
    console.log('[MenuCache] Cached categories:', categories.length, 'categories');
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache = {
      menuItems: null,
      categories: null,
      timestamp: 0,
    };
    console.log('[MenuCache] Cache cleared');
  }

  /**
   * Invalidate cache (force refetch next time)
   */
  invalidate(): void {
    this.cache.timestamp = 0;
    console.log('[MenuCache] Cache invalidated');
  }
}

// Export singleton instance
export const menuCache = new MenuCache();
