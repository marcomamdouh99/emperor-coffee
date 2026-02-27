/**
 * Storage Quota Monitoring
 * Monitors IndexedDB and overall storage usage, provides alerts when approaching limits
 */

interface StorageUsage {
  totalQuota: number; // Total storage quota in bytes
  used: number; // Used storage in bytes
  available: number; // Available storage in bytes
  usagePercentage: number; // Usage as percentage (0-100)
}

interface StorageAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  usagePercentage: number;
  timestamp: number;
  acknowledged: boolean;
}

interface StoreUsage {
  storeName: string;
  count: number;
  estimatedSize: number;
}

class StorageQuotaMonitor {
  private alerts: Map<string, StorageAlert> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
  private readonly WARNING_THRESHOLD = 70; // Warning at 70%
  private readonly CRITICAL_THRESHOLD = 90; // Critical at 90%
  private listeners: Array<(usage: StorageUsage) => void> = [];

  // Alert thresholds
  private readonly thresholds = {
    INFO: 50, // Info at 50%
    WARNING: 70, // Warning at 70%
    CRITICAL: 90, // Critical at 90%
  };

  /**
   * Start monitoring storage usage
   */
  startMonitoring(): void {
    if (this.checkInterval) {
      console.warn('[StorageQuotaMonitor] Already monitoring');
      return;
    }

    console.log('[StorageQuotaMonitor] Starting storage monitoring');
    this.checkUsage(); // Initial check

    this.checkInterval = setInterval(() => {
      this.checkUsage();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop monitoring storage usage
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[StorageQuotaMonitor] Stopped storage monitoring');
    }
  }

  /**
   * Check current storage usage and generate alerts if needed
   */
  async checkUsage(): Promise<StorageUsage | null> {
    if (typeof navigator === 'undefined' || !navigator.storage) {
      console.warn('[StorageQuotaMonitor] Storage API not available');
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage: StorageUsage = {
        totalQuota: estimate.quota || 0,
        used: estimate.usage || 0,
        available: (estimate.quota || 0) - (estimate.usage || 0),
        usagePercentage: estimate.quota
          ? Math.round(((estimate.usage || 0) / estimate.quota) * 100)
          : 0,
      };

      console.log('[StorageQuotaMonitor] Storage usage:', {
        used: this.formatBytes(usage.used),
        available: this.formatBytes(usage.available),
        total: this.formatBytes(usage.totalQuota),
        percentage: `${usage.usagePercentage}%`,
      });

      // Check thresholds and generate alerts
      this.checkThresholds(usage);

      // Notify listeners
      this.notifyListeners(usage);

      return usage;
    } catch (error) {
      console.error('[StorageQuotaMonitor] Error checking usage:', error);
      return null;
    }
  }

  /**
   * Check usage thresholds and generate alerts
   */
  private checkThresholds(usage: StorageUsage): void {
    const percentage = usage.usagePercentage;

    // Critical alert
    if (percentage >= this.thresholds.CRITICAL) {
      this.createAlert('critical', percentage);
    }
    // Warning alert
    else if (percentage >= this.thresholds.WARNING) {
      this.createAlert('warning', percentage);
    }
    // Info alert
    else if (percentage >= this.thresholds.INFO) {
      this.createAlert('info', percentage);
    }
  }

  /**
   * Create a storage alert
   */
  private createAlert(level: 'info' | 'warning' | 'critical', usagePercentage: number): void {
    const id = `alert_${level}_${Date.now()}`;

    // Check if we already have an unacknowledged alert of this level
    const existingAlert = Array.from(this.alerts.values()).find(
      (a) => a.level === level && !a.acknowledged
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: StorageAlert = {
      id,
      level,
      message: this.getAlertMessage(level, usagePercentage),
      usagePercentage,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.set(id, alert);
    console.warn(`[StorageQuotaMonitor] ${level.toUpperCase()} Alert: ${alert.message}`);
  }

  /**
   * Get alert message based on level
   */
  private getAlertMessage(level: string, usagePercentage: number): string {
    switch (level) {
      case 'critical':
        return `Storage critically low! ${usagePercentage}% used. Clear old data immediately to prevent issues.`;
      case 'warning':
        return `Storage usage is ${usagePercentage}%. Consider clearing old data or increasing storage quota.`;
      case 'info':
        return `Storage usage is ${usagePercentage}%. Monitor usage to avoid running out of space.`;
      default:
        return `Storage usage: ${usagePercentage}%`;
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(): StorageAlert[] {
    return Array.from(this.alerts.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): StorageAlert[] {
    return this.getAlerts().filter((a) => !a.acknowledged);
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): StorageAlert[] {
    return this.getAlerts().filter((a) => a.level === 'critical' && !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.alerts.set(alertId, alert);
    }
  }

  /**
   * Acknowledge all alerts
   */
  acknowledgeAllAlerts(): void {
    for (const [id, alert] of this.alerts.entries()) {
      alert.acknowledged = true;
      this.alerts.set(id, alert);
    }
  }

  /**
   * Clear acknowledged alerts older than 24 hours
   */
  clearOldAlerts(): void {
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.acknowledged && now - alert.timestamp > twentyFourHours) {
        this.alerts.delete(id);
      }
    }
  }

  /**
   * Add a listener for storage usage updates
   */
  addListener(listener: (usage: StorageUsage) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(listener: (usage: StorageUsage) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of storage usage
   */
  private notifyListeners(usage: StorageUsage): void {
    for (const listener of this.listeners) {
      try {
        listener(usage);
      } catch (error) {
        console.error('[StorageQuotaMonitor] Error in listener:', error);
      }
    }
  }

  /**
   * Get detailed breakdown by store (requires IndexedDB access)
   */
  async getStoreUsage(): Promise<StoreUsage[]> {
    // This is a rough estimate. For accurate results, you would need to
    // iterate through each store and calculate actual sizes.
    // For now, we'll return a placeholder structure.

    const stores = [
      'sync_operations',
      'sync_state',
      'menu_items',
      'categories',
      'ingredients',
      'recipes',
      'users',
      'orders',
      'shifts',
      'waste_logs',
      'branches',
      'delivery_areas',
      'customers',
      'customer_addresses',
      'couriers',
      'receipt_settings',
      'tables',
      'daily_expenses',
      'promo_codes',
      'inventory',
      'temp_id_mappings',
    ];

    // Try to get counts from IndexedDB
    const storeUsage: StoreUsage[] = [];

    if (typeof indexedDB !== 'undefined') {
      try {
        const request = indexedDB.open('emperor-pos-db', 3);

        await new Promise<void>((resolve, reject) => {
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        const db = request.result;

        for (const storeName of stores) {
          try {
            const count = await new Promise<number>((resolve, reject) => {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              const countRequest = store.count();
              countRequest.onsuccess = () => resolve(countRequest.result || 0);
              countRequest.onerror = () => reject(countRequest.error);
            });

            // Estimate size (rough: ~500 bytes per record average)
            const estimatedSize = count * 500;

            storeUsage.push({
              storeName,
              count,
              estimatedSize,
            });
          } catch (error) {
            console.warn(`[StorageQuotaMonitor] Error getting count for ${storeName}:`, error);
          }
        }

        db.close();
      } catch (error) {
        console.error('[StorageQuotaMonitor] Error accessing IndexedDB:', error);
      }
    }

    return storeUsage.sort((a, b) => b.estimatedSize - a.estimatedSize);
  }

  /**
   * Get storage recommendations based on usage
   */
  getRecommendations(usage: StorageUsage): string[] {
    const recommendations: string[] = [];

    if (usage.usagePercentage >= this.thresholds.CRITICAL) {
      recommendations.push(
        '🚨 Clear old sync operations that have already been processed',
        '🚨 Clear expired cache entries from data expiration service',
        '🚨 Archive completed orders older than 30 days',
        '🚨 Consider reducing cache TTL settings',
        '🚨 Contact administrator to increase storage quota'
      );
    } else if (usage.usagePercentage >= this.thresholds.WARNING) {
      recommendations.push(
        '⚠️ Review and clear old data',
        '⚠️ Check for duplicate or orphaned records',
        '⚠️ Reduce cache TTL for less critical data',
        '⚠️ Monitor usage trends'
      );
    } else if (usage.usagePercentage >= this.thresholds.INFO) {
      recommendations.push(
        'ℹ️ Storage usage is normal',
        'ℹ️ Regular maintenance recommended'
      );
    }

    return recommendations;
  }

  /**
   * Format bytes to human-readable format
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get current usage summary
   */
  async getSummary(): Promise<{
    usage: StorageUsage | null;
    alerts: StorageAlert[];
    storeUsage: StoreUsage[];
    recommendations: string[];
  }> {
    const usage = await this.checkUsage();
    const alerts = this.getAlerts();
    const storeUsage = await this.getStoreUsage();
    const recommendations = usage ? this.getRecommendations(usage) : [];

    return {
      usage,
      alerts,
      storeUsage,
      recommendations,
    };
  }
}

// Export singleton instance
export const storageQuotaMonitor = new StorageQuotaMonitor();

export { StorageQuotaMonitor };
export default storageQuotaMonitor;
