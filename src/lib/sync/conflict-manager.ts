/**
 * Conflict Manager for Offline Sync
 * Handles detection, resolution, and storage of sync conflicts
 * Supports multiple resolution strategies: LAST_WRITE_WINS, MANUAL, MERGE
 */

export enum ConflictType {
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  CONCURRENT_UPDATE = 'CONCURRENT_UPDATE',
  DELETED_MODIFIED = 'DELETED_MODIFIED',
  MODIFIED_DELETED = 'MODIFIED_DELETED',
  DUPLICATE_ENTITY = 'DUPLICATE_ENTITY',
}

export enum ResolutionStrategy {
  LAST_WRITE_WINS = 'LAST_WRITE_WINS',
  MANUAL = 'MANUAL',
  MERGE = 'MERGE',
  KEEP_LOCAL = 'KEEP_LOCAL',
  KEEP_REMOTE = 'KEEP_REMOTE',
}

export interface Conflict {
  id: string;
  entityType: string;
  entityId: string;
  conflictType: ConflictType;
  localData: any;
  remoteData: any;
  localVersion: number;
  remoteVersion: number;
  localTimestamp: number;
  remoteTimestamp: number;
  operationType: string;
  resolved: boolean;
  resolutionStrategy?: ResolutionStrategy;
  resolvedData?: any;
  resolvedAt?: number;
  resolvedBy?: string;
  createdAt: number;
}

export interface ConflictResolution {
  conflictId: string;
  strategy: ResolutionStrategy;
  resolvedData?: any;
  resolvedAt: number;
  resolvedBy: string;
}

class ConflictManager {
  private conflicts: Map<string, Conflict> = new Map();
  private conflictResolvers: Map<ConflictType, ResolutionStrategy> = new Map();

  constructor() {
    // Set default resolution strategies
    this.setDefaultStrategies();
  }

  /**
   * Set default resolution strategies for different conflict types
   */
  private setDefaultStrategies(): void {
    this.conflictResolvers.set(ConflictType.VERSION_MISMATCH, ResolutionStrategy.LAST_WRITE_WINS);
    this.conflictResolvers.set(ConflictType.CONCURRENT_UPDATE, ResolutionStrategy.LAST_WRITE_WINS);
    this.conflictResolvers.set(ConflictType.DELETED_MODIFIED, ResolutionStrategy.KEEP_REMOTE);
    this.conflictResolvers.set(ConflictType.MODIFIED_DELETED, ResolutionStrategy.KEEP_LOCAL);
    this.conflictResolvers.set(ConflictType.DUPLICATE_ENTITY, ResolutionStrategy.MERGE);
  }

  /**
   * Detect conflicts between local and remote data
   */
  async detectConflict(
    entityType: string,
    entityId: string,
    localData: any,
    remoteData: any,
    operationType: string
  ): Promise<Conflict | null> {
    // If no remote data exists, no conflict
    if (!remoteData) {
      return null;
    }

    // Get versions and timestamps
    const localVersion = localData.version || localData.updatedAt || 0;
    const remoteVersion = remoteData.version || remoteData.updatedAt || 0;
    const localTimestamp = localData.updatedAt ? new Date(localData.updatedAt).getTime() : Date.now();
    const remoteTimestamp = remoteData.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;

    // Detect conflict type
    let conflictType: ConflictType | null = null;

    // Check for version mismatch
    if (localVersion && remoteVersion && localVersion !== remoteVersion) {
      conflictType = ConflictType.VERSION_MISMATCH;
    }
    // Check for concurrent updates (same version but different data)
    else if (this.hasDataChanged(localData, remoteData)) {
      conflictType = ConflictType.CONCURRENT_UPDATE;
    }

    // If no conflict detected, return null
    if (!conflictType) {
      return null;
    }

    // Create conflict object
    const conflict: Conflict = {
      id: `conflict_${entityType}_${entityId}_${Date.now()}`,
      entityType,
      entityId,
      conflictType,
      localData,
      remoteData,
      localVersion,
      remoteVersion,
      localTimestamp,
      remoteTimestamp,
      operationType,
      resolved: false,
      createdAt: Date.now(),
    };

    // Store conflict
    this.conflicts.set(conflict.id, conflict);

    console.log(`[ConflictManager] Conflict detected: ${conflictType} for ${entityType}:${entityId}`);

    return conflict;
  }

  /**
   * Check if data has changed between local and remote
   */
  private hasDataChanged(localData: any, remoteData: any): boolean {
    // Compare key fields (excluding metadata)
    const excludeFields = ['id', 'version', 'updatedAt', 'createdAt', 'synced'];

    const localKeys = Object.keys(localData).filter(k => !excludeFields.includes(k));
    const remoteKeys = Object.keys(remoteData).filter(k => !excludeFields.includes(k));

    // If keys differ, data has changed
    if (JSON.stringify(localKeys.sort()) !== JSON.stringify(remoteKeys.sort())) {
      return true;
    }

    // Compare values
    for (const key of localKeys) {
      if (JSON.stringify(localData[key]) !== JSON.stringify(remoteData[key])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolve a conflict using specified strategy
   */
  async resolveConflict(
    conflictId: string,
    strategy: ResolutionStrategy,
    resolvedBy: string = 'system'
  ): Promise<Conflict> {
    const conflict = this.conflicts.get(conflictId);

    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    if (conflict.resolved) {
      console.warn(`[ConflictManager] Conflict already resolved: ${conflictId}`);
      return conflict;
    }

    let resolvedData: any;

    switch (strategy) {
      case ResolutionStrategy.LAST_WRITE_WINS:
        resolvedData = this.lastWriteWins(conflict);
        break;

      case ResolutionStrategy.KEEP_LOCAL:
        resolvedData = conflict.localData;
        break;

      case ResolutionStrategy.KEEP_REMOTE:
        resolvedData = conflict.remoteData;
        break;

      case ResolutionStrategy.MERGE:
        resolvedData = this.mergeData(conflict);
        break;

      case ResolutionStrategy.MANUAL:
        // Manual resolution requires user input - mark as pending
        conflict.resolved = false;
        conflict.resolutionStrategy = ResolutionStrategy.MANUAL;
        this.conflicts.set(conflictId, conflict);
        return conflict;

      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }

    // Mark conflict as resolved
    conflict.resolved = true;
    conflict.resolutionStrategy = strategy;
    conflict.resolvedData = resolvedData;
    conflict.resolvedAt = Date.now();
    conflict.resolvedBy = resolvedBy;

    this.conflicts.set(conflictId, conflict);

    console.log(`[ConflictManager] Conflict resolved: ${conflictId} using ${strategy}`);

    return conflict;
  }

  /**
   * Last-write-wins strategy
   */
  private lastWriteWins(conflict: Conflict): any {
    // Use the data with the most recent timestamp
    return conflict.localTimestamp > conflict.remoteTimestamp
      ? conflict.localData
      : conflict.remoteData;
  }

  /**
   * Merge data strategy
   */
  private mergeData(conflict: Conflict): any {
    // Simple merge: prefer local data, but keep remote if local field is undefined/null
    const merged = { ...conflict.remoteData };

    for (const key of Object.keys(conflict.localData)) {
      // Overwrite with local data unless it's undefined/null
      if (conflict.localData[key] !== undefined && conflict.localData[key] !== null) {
        merged[key] = conflict.localData[key];
      }
    }

    // Update version and timestamp
    merged.version = Math.max(conflict.localVersion, remoteVersion) + 1;
    merged.updatedAt = new Date().toISOString();

    return merged;
  }

  /**
   * Auto-resolve conflicts using default strategies
   */
  async autoResolveConflicts(): Promise<Conflict[]> {
    const resolvedConflicts: Conflict[] = [];

    for (const [conflictId, conflict] of this.conflicts.entries()) {
      if (conflict.resolved) {
        continue;
      }

      const defaultStrategy = this.conflictResolvers.get(conflict.conflictType);

      if (defaultStrategy && defaultStrategy !== ResolutionStrategy.MANUAL) {
        try {
          const resolved = await this.resolveConflict(conflictId, defaultStrategy, 'auto-resolver');
          resolvedConflicts.push(resolved);
        } catch (error) {
          console.error(`[ConflictManager] Auto-resolve failed for ${conflictId}:`, error);
        }
      }
    }

    return resolvedConflicts;
  }

  /**
   * Get all conflicts
   */
  getAllConflicts(): Conflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Get unresolved conflicts
   */
  getUnresolvedConflicts(): Conflict[] {
    return this.getAllConflicts().filter(c => !c.resolved);
  }

  /**
   * Get conflicts by entity type
   */
  getConflictsByEntityType(entityType: string): Conflict[] {
    return this.getAllConflicts().filter(c => c.entityType === entityType);
  }

  /**
   * Get conflict by ID
   */
  getConflict(conflictId: string): Conflict | undefined {
    return this.conflicts.get(conflictId);
  }

  /**
   * Clear resolved conflicts
   */
  clearResolvedConflicts(): void {
    for (const [id, conflict] of this.conflicts.entries()) {
      if (conflict.resolved) {
        this.conflicts.delete(id);
      }
    }
  }

  /**
   * Clear all conflicts
   */
  clearAllConflicts(): void {
    this.conflicts.clear();
  }

  /**
   * Get conflict statistics
   */
  getConflictStats(): {
    total: number;
    unresolved: number;
    resolved: number;
    byType: Record<ConflictType, number>;
  } {
    const all = this.getAllConflicts();
    const unresolved = all.filter(c => !c.resolved);
    const resolved = all.filter(c => c.resolved);

    const byType: Record<string, number> = {};
    for (const conflict of all) {
      byType[conflict.conflictType] = (byType[conflict.conflictType] || 0) + 1;
    }

    return {
      total: all.length,
      unresolved: unresolved.length,
      resolved: resolved.length,
      byType: byType as Record<ConflictType, number>,
    };
  }

  /**
   * Set custom resolution strategy for a conflict type
   */
  setResolutionStrategy(conflictType: ConflictType, strategy: ResolutionStrategy): void {
    this.conflictResolvers.set(conflictType, strategy);
  }

  /**
   * Export conflicts to JSON
   */
  exportConflicts(): string {
    const conflicts = Array.from(this.conflicts.values());
    return JSON.stringify(conflicts, null, 2);
  }

  /**
   * Import conflicts from JSON
   */
  importConflicts(json: string): void {
    const conflicts: Conflict[] = JSON.parse(json);
    for (const conflict of conflicts) {
      this.conflicts.set(conflict.id, conflict);
    }
  }
}

// Export singleton instance
export const conflictManager = new ConflictManager();

export { ConflictManager };
export default conflictManager;
