/**
 * Storage Quota Monitor
 * Monitors IndexedDB and overall storage usage
 * Alerts when approaching quota limits
 */

export interface StorageStats {
  usage: number; // Bytes used
  quota: number; // Total quota in bytes
  percentage: number; // Percentage used (0-100)
  isNearLimit: boolean; // True if > 80%
  isCritical: boolean; // True if > 95%
}

export interface StorageAlert {
  type: 'warning' | 'critical' | 'info';
  message: string;
  percentage: number;
  timestamp: number;
}

type AlertCallback = (alert: StorageAlert) => void;

class StorageMonitor {
  private callbacks: AlertCallback[] = [];
  private alerts: StorageAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCheckTime: number = 0;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly WARNING_THRESHOLD = 80; // 80%
  private readonly CRITICAL_THRESHOLD = 95; // 95%

  /**
   * Register a callback to receive storage alerts
   */
  onAlert(callback: AlertCallback): () => void {
    this.callbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Get current storage statistics
   */
  async getStorageStats(): Promise<StorageStats | null> {
    if (!navigator.storage || !navigator.storage.estimate) {
      console.warn('[StorageMonitor] Storage API not available');
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 1;

      return {
        usage,
        quota,
        percentage: (usage / quota) * 100,
        isNearLimit: (usage / quota) * 100 >= this.WARNING_THRESHOLD,
        isCritical: (usage / quota) * 100 >= this.CRITICAL_THRESHOLD,
      };
    } catch (error) {
      console.error('[StorageMonitor] Failed to get storage estimate:', error);
      return null;
    }
  }

  /**
   * Check storage and trigger alerts if needed
   */
  async checkStorage(): Promise<StorageStats | null> {
    const stats = await this.getStorageStats();

    if (!stats) {
      return null;
    }

    this.lastCheckTime = Date.now();

    // Check for critical condition
    if (stats.isCritical) {
      const alert: StorageAlert = {
        type: 'critical',
        message: 'Storage critically full. Old data will be automatically cleaned up.',
        percentage: stats.percentage,
        timestamp: Date.now(),
      };
      this.alerts.push(alert);
      this.notifyCallbacks(alert);
      await this.emergencyCleanup();
    }
    // Check for warning condition
    else if (stats.isNearLimit && !this.recentlyAlerted('warning')) {
      const alert: StorageAlert = {
        type: 'warning',
        message: 'Storage nearly full. Please sync data to free up space.',
        percentage: stats.percentage,
        timestamp: Date.now(),
      };
      this.alerts.push(alert);
      this.notifyCallbacks(alert);
    }

    return stats;
  }

  /**
   * Start monitoring storage periodically
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      console.warn('[StorageMonitor] Already monitoring');
      return;
    }

    console.log('[StorageMonitor] Starting storage monitoring (every 5 minutes)');
    this.monitoringInterval = setInterval(() => {
      this.checkStorage();
    }, this.CHECK_INTERVAL);

    // Initial check
    this.checkStorage();
  }

  /**
   * Stop monitoring storage
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[StorageMonitor] Stopped storage monitoring');
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(maxAge: number = 60 * 60 * 1000): StorageAlert[] {
    const now = Date.now();
    return this.alerts.filter(alert => now - alert.timestamp < maxAge);
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    this.alerts = this.alerts.filter(alert => now - alert.timestamp < maxAge);
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(alert: StorageAlert): void {
    this.callbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('[StorageMonitor] Error in alert callback:', error);
      }
    });
  }

  /**
   * Check if an alert was recently sent
   */
  private recentlyAlerted(type: StorageAlert['type'], age: number = 5 * 60 * 1000): boolean {
    const now = Date.now();
    return this.alerts.some(
      alert =>
        alert.type === type &&
        now - alert.timestamp < age
    );
  }

  /**
   * Emergency cleanup when storage is critically full
   */
  private async emergencyCleanup(): Promise<void> {
    console.warn('[StorageMonitor] Running emergency cleanup...');

    try {
      const { getLocalStorageService } = await import('@/lib/storage/local-storage');
      const localStorageService = getLocalStorageService();
      await localStorageService.init();

      // Clean up old orders (older than 1 hour)
      const allOrders = await localStorageService.getAllOrders();
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      const oldOrders = allOrders.filter((order: any) => {
        const orderTime = new Date(order.orderTimestamp || order.createdAt).getTime();
        return orderTime < oneHourAgo;
      });

      if (oldOrders.length > 0) {
        console.log(`[StorageMonitor] Emergency cleanup: Removing ${oldOrders.length} old orders`);
        for (const order of oldOrders) {
          await localStorageService.delete('orders', order.id);
        }
      }

      // Clean up old sync operations (keep only last 100)
      const allOps = await localStorageService.getAllOperations();
      if (allOps.length > 100) {
        const opsToDelete = allOps.slice(100);
        console.log(`[StorageMonitor] Emergency cleanup: Removing ${opsToDelete.length} old sync operations`);
        for (const op of opsToDelete) {
          await localStorageService.deleteOperation(op.id);
        }
      }

      console.log('[StorageMonitor] Emergency cleanup completed');
    } catch (error) {
      console.error('[StorageMonitor] Emergency cleanup failed:', error);
    }
  }

  /**
   * Get formatted storage info for display
   */
  async getFormattedStorageInfo(): Promise<string> {
    const stats = await this.getStorageStats();

    if (!stats) {
      return 'Storage monitoring not available';
    }

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    return `Using ${formatBytes(stats.usage)} of ${formatBytes(stats.quota)} (${stats.percentage.toFixed(1)}%)`;
  }

  /**
   * Force a storage check now
   */
  async forceCheck(): Promise<StorageStats | null> {
    return this.checkStorage();
  }
}

// Export singleton instance
const storageMonitor = new StorageMonitor();

export default storageMonitor;
export { StorageMonitor, type StorageStats, type StorageAlert };
