/**
 * Sync Configuration Service
 * Tracks sync state for each entity type to enable incremental sync
 * Reduces payload size by only syncing changed/new data
 */

export interface EntitySyncState {
  entityType: string;
  lastSyncTimestamp: number;
  lastSyncVersion?: number;
  totalCount: number;
  lastSyncId?: string;
  syncEnabled: boolean;
}

export interface SyncConfig {
  branchId: string;
  entityStates: Map<string, EntitySyncState>;
  lastFullSync: number;
  lastIncrementalSync: number;
}

class SyncConfigService {
  private config: SyncConfig | null = null;
  private storageKey = 'sync_config';
  private dbVersionKey = 'db_version';

  /**
   * Initialize sync configuration
   */
  async initialize(branchId: string): Promise<SyncConfig> {
    if (this.config && this.config.branchId === branchId) {
      return this.config;
    }

    // Load from storage
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.config = {
          ...parsed,
          entityStates: new Map(Object.entries(parsed.entityStates)),
        };
      } catch (error) {
        console.error('[SyncConfigService] Failed to load config:', error);
      }
    }

    // Initialize if not exists or branch changed
    if (!this.config || this.config.branchId !== branchId) {
      this.config = {
        branchId,
        entityStates: this.getDefaultEntityStates(),
        lastFullSync: 0,
        lastIncrementalSync: 0,
      };
      await this.saveToStorage();
    }

    console.log('[SyncConfigService] Initialized for branch:', branchId);
    return this.config;
  }

  /**
   * Get default entity sync states
   */
  private getDefaultEntityStates(): Map<string, EntitySyncState> {
    const entities = [
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
    ];

    const states = new Map<string, EntitySyncState>();

    entities.forEach(entity => {
      states.set(entity, {
        entityType: entity,
        lastSyncTimestamp: 0,
        lastSyncVersion: undefined,
        totalCount: 0,
        lastSyncId: undefined,
        syncEnabled: true,
      });
    });

    return states;
  }

  /**
   * Update sync state for an entity
   */
  async updateEntityState(
    entityType: string,
    updates: Partial<EntitySyncState>
  ): Promise<void> {
    if (!this.config) {
      console.warn('[SyncConfigService] Config not initialized');
      return;
    }

    const currentState = this.config.entityStates.get(entityType);
    if (!currentState) {
      console.warn(`[SyncConfigService] Unknown entity type: ${entityType}`);
      return;
    }

    const newState = { ...currentState, ...updates };
    this.config.entityStates.set(entityType, newState);

    // Update timestamps
    const now = Date.now();
    this.config.lastIncrementalSync = now;

    await this.saveToStorage();

    console.log(`[SyncConfigService] Updated ${entityType}:`, updates);
  }

  /**
   * Get sync state for an entity
   */
  getEntityState(entityType: string): EntitySyncState | undefined {
    return this.config?.entityStates.get(entityType);
  }

  /**
   * Get all entity states
   */
  getAllEntityStates(): Map<string, EntitySyncState> {
    return new Map(this.config?.entityStates.entries() || []);
  }

  /**
   * Check if entity needs sync
   */
  needsSync(entityType: string, force: boolean = false): boolean {
    const state = this.getEntityState(entityType);

    if (!state || !state.syncEnabled) {
      return false;
    }

    if (force) {
      return true;
    }

    // If never synced, needs sync
    if (state.lastSyncTimestamp === 0) {
      return true;
    }

    // If last sync was more than 1 hour ago, needs sync
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return state.lastSyncTimestamp < oneHourAgo;
  }

  /**
   * Get entities that need sync
   */
  getEntitiesNeedingSync(force: boolean = false): string[] {
    const entities: string[] = [];

    for (const [entityType] of this.getAllEntityStates().entries()) {
      if (this.needsSync(entityType, force)) {
        entities.push(entityType);
      }
    }

    return entities;
  }

  /**
   * Mark entity as fully synced
   */
  async markFullySynced(entityType: string, totalCount: number, lastId?: string): Promise<void> {
    await this.updateEntityState(entityType, {
      lastSyncTimestamp: Date.now(),
      totalCount,
      lastSyncId,
    });
  }

  /**
   * Mark entity as incrementally synced
   */
  async markIncrementallySynced(
    entityType: string,
    itemsCount: number,
    newestTimestamp?: number,
    newestId?: string
  ): Promise<void> {
    const state = this.getEntityState(entityType);

    await this.updateEntityState(entityType, {
      lastSyncTimestamp: newestTimestamp || Date.now(),
      totalCount: (state?.totalCount || 0) + itemsCount,
      lastSyncId: newestId,
    });
  }

  /**
   * Get incremental sync parameters
   */
  getIncrementalSyncParams(entityType: string): {
    sinceDate: Date;
    lastId?: string;
    limit: number;
  } {
    const state = this.getEntityState(entityType);

    // Default limit for incremental sync
    const limit = 100;

    // Use last sync timestamp as sinceDate
    const sinceDate = state?.lastSyncTimestamp
      ? new Date(state.lastSyncTimestamp)
      : new Date(0); // All time if never synced

    return {
      sinceDate,
      lastId: state?.lastSyncId,
      limit,
    };
  }

  /**
   * Reset sync state for all entities (full sync needed)
   */
  async resetAll(): Promise<void> {
    if (!this.config) {
      return;
    }

    this.config.entityStates = this.getDefaultEntityStates();
    this.config.lastFullSync = 0;
    this.config.lastIncrementalSync = 0;

    await this.saveToStorage();

    console.log('[SyncConfigService] All sync states reset');
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    totalEntities: number;
    syncedEntities: number;
    unsyncedEntities: number;
    byEntity: Record<string, {
      synced: boolean;
      lastSync: string;
      count: number;
    }>;
  } {
    const states = this.getAllEntityStates();
    const totalEntities = states.size;
    let syncedEntities = 0;

    const byEntity: Record<string, any> = {};

    for (const [entityType, state] of states.entries()) {
      const isSynced = state.lastSyncTimestamp > 0;
      if (isSynced) {
        syncedEntities++;
      }

      byEntity[entityType] = {
        synced: isSynced,
        lastSync: state.lastSyncTimestamp
          ? new Date(state.lastSyncTimestamp).toISOString()
          : 'Never',
        count: state.totalCount,
      };
    }

    return {
      totalEntities,
      syncedEntities,
      unsyncedEntities: totalEntities - syncedEntities,
      byEntity,
    };
  }

  /**
   * Save config to localStorage
   */
  private async saveToStorage(): Promise<void> {
    if (!this.config) {
      return;
    }

    try {
      const serialized = {
        ...this.config,
        entityStates: Object.fromEntries(this.config.entityStates),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(serialized));
    } catch (error) {
      console.error('[SyncConfigService] Failed to save config:', error);
    }
  }

  /**
   * Export config to JSON
   */
  exportConfig(): string {
    if (!this.config) {
      return '{}';
    }

    return JSON.stringify(
      {
        ...this.config,
        entityStates: Object.fromEntries(this.config.entityStates),
      },
      null,
      2
    );
  }

  /**
   * Import config from JSON
   */
  importConfig(json: string): void {
    try {
      const parsed = JSON.parse(json);
      this.config = {
        ...parsed,
        entityStates: new Map(Object.entries(parsed.entityStates)),
      };
    } catch (error) {
      console.error('[SyncConfigService] Failed to import config:', error);
    }
  }
}

// Export singleton instance
export const syncConfigService = new SyncConfigService();

export { SyncConfigService };
export default syncConfigService;
