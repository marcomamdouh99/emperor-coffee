// Sync Utility Functions for POS System
// Handles version comparison, change detection, and conflict resolution

import { db } from './db';
import { SyncDirection, SyncStatus } from '@prisma/client';

// ============================================
// Type Definitions
// ============================================

export interface SyncData {
  categories?: any[];
  menuItems?: any[];
  ingredients?: any[];
  recipes?: any[];
  variantTypes?: any[];
  variantOptions?: any[];
  menuItemVariants?: any[];
  users?: any[];
}

export interface SyncStatusInfo {
  branchId: string;
  branchName: string;
  lastSyncAt: Date | null;
  pendingUploads: number; // Orders not yet synced
  pendingDownloads: {
    menu: boolean;
    pricing: boolean;
    recipe: boolean;
    ingredient: boolean;
    users: boolean;
  };
  currentVersions: {
    menuVersion: number;
    pricingVersion: number;
    recipeVersion: number;
    ingredientVersion: number;
    userVersion: number;
  };
  latestVersions: {
    menuVersion: number;
    pricingVersion: number;
    recipeVersion: number;
    ingredientVersion: number;
    userVersion: number;
  };
}

export interface SyncResult {
  success: boolean;
  direction: SyncDirection;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  conflicts: number;
  error?: string;
  syncHistoryId?: string;
}

export interface ConflictData {
  id: string;
  entityType: string;
  entityId: string;
  conflictReason: string;
  branchPayload: any;
  centralPayload: any;
  detectedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

// ============================================
// Version Management
// ============================================

/**
 * Compare two version numbers
 * @returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
export function compareVersions(v1: number, v2: number): number {
  if (v1 < v2) return -1;
  if (v1 > v2) return 1;
  return 0;
}

/**
 * Increment a specific version field
 */
export async function incrementVersion(
  branchId: string,
  versionField: 'menuVersion' | 'pricingVersion' | 'recipeVersion' | 'ingredientVersion' | 'userVersion'
): Promise<number> {
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { [versionField]: true }
  });

  if (!branch) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  const newVersion = (branch[versionField] as number) + 1;

  await db.branch.update({
    where: { id: branchId },
    data: { [versionField]: newVersion }
  });

  return newVersion;
}

/**
 * Get the latest version across all branches for a specific field
 */
export async function getLatestVersion(
  versionField: 'menuVersion' | 'pricingVersion' | 'recipeVersion' | 'ingredientVersion' | 'userVersion'
): Promise<number> {
  const result = await db.branch.aggregate({
    _max: { [versionField]: true }
  });

  return (result._max[versionField] as number) || 1;
}

// ============================================
// Sync Status
// ============================================

/**
 * Get comprehensive sync status for a branch
 */
export async function getSyncStatus(branchId: string): Promise<SyncStatusInfo> {
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      branchName: true,
      lastSyncAt: true,
      menuVersion: true,
      pricingVersion: true,
      recipeVersion: true,
      ingredientVersion: true,
      userVersion: true
    }
  });

  if (!branch) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  // Count unsynced orders
  const pendingUploads = await db.order.count({
    where: {
      branchId,
      synced: false
    }
  });

  // Get latest versions across all branches
  const [latestMenu, latestPricing, latestRecipe, latestIngredient, latestUser] = await Promise.all([
    getLatestVersion('menuVersion'),
    getLatestVersion('pricingVersion'),
    getLatestVersion('recipeVersion'),
    getLatestVersion('ingredientVersion'),
    getLatestVersion('userVersion')
  ]);

  return {
    branchId: branch.id,
    branchName: branch.branchName,
    lastSyncAt: branch.lastSyncAt,
    pendingUploads,
    pendingDownloads: {
      menu: compareVersions(branch.menuVersion, latestMenu) < 0,
      pricing: compareVersions(branch.pricingVersion, latestPricing) < 0,
      recipe: compareVersions(branch.recipeVersion, latestRecipe) < 0,
      ingredient: compareVersions(branch.ingredientVersion, latestIngredient) < 0,
      users: compareVersions(branch.userVersion, latestUser) < 0
    },
    currentVersions: {
      menuVersion: branch.menuVersion,
      pricingVersion: branch.pricingVersion,
      recipeVersion: branch.recipeVersion,
      ingredientVersion: branch.ingredientVersion,
      userVersion: branch.userVersion
    },
    latestVersions: {
      menuVersion: latestMenu,
      pricingVersion: latestPricing,
      recipeVersion: latestRecipe,
      ingredientVersion: latestIngredient,
      userVersion: latestUser
    }
  };
}

/**
 * Get sync status for all branches
 */
export async function getAllBranchesSyncStatus(): Promise<SyncStatusInfo[]> {
  const branches = await db.branch.findMany({
    select: {
      id: true,
      branchName: true,
      lastSyncAt: true,
      menuVersion: true,
      pricingVersion: true,
      recipeVersion: true,
      ingredientVersion: true,
      userVersion: true
    }
  });

  const statusPromises = branches.map(branch => getSyncStatus(branch.id));
  return Promise.all(statusPromises);
}

// ============================================
// Sync History Management
// ============================================

/**
 * Create a sync history record
 */
export async function createSyncHistory(
  branchId: string,
  direction: SyncDirection,
  recordsAffected: number = 0
): Promise<string> {
  const syncHistory = await db.syncHistory.create({
    data: {
      branchId,
      syncDirection: direction,
      recordsAffected,
      syncStartedAt: new Date(),
      status: SyncStatus.SUCCESS
    }
  });

  return syncHistory.id;
}

/**
 * Update sync history with completion details
 */
export async function updateSyncHistory(
  syncHistoryId: string,
  status: SyncStatus,
  recordsAffected?: number,
  errorDetails?: string
): Promise<void> {
  await db.syncHistory.update({
    where: { id: syncHistoryId },
    data: {
      syncCompletedAt: new Date(),
      status,
      recordsAffected,
      errorDetails
    }
  });
}

/**
 * Get sync history for a branch
 */
export async function getSyncHistory(
  branchId?: string,
  limit: number = 50
) {
  const where = branchId ? { branchId } : {};

  return db.syncHistory.findMany({
    where,
    include: {
      branch: {
        select: {
          id: true,
          branchName: true
        }
      }
    },
    orderBy: {
      syncStartedAt: 'desc'
    },
    take: limit
  });
}

// ============================================
// Conflict Detection and Resolution
// ============================================

/**
 * Detect conflicts for a specific entity
 */
export async function detectConflict(
  branchId: string,
  entityType: string,
  entityId: string,
  branchData: any,
  centralData: any
): Promise<boolean> {
  // Check if conflict already exists and is unresolved
  const existingConflict = await db.syncConflict.findFirst({
    where: {
      branchId,
      entityType,
      entityId,
      resolvedAt: null
    }
  });

  if (existingConflict) {
    return true;
  }

  // Compare data to detect conflicts
  const hasConflict = !isDataEqual(branchData, centralData);

  if (hasConflict) {
    await db.syncConflict.create({
      data: {
        branchId,
        entityType,
        entityId,
        conflictReason: 'Data mismatch between branch and central',
        branchPayload: JSON.stringify(branchData),
        centralPayload: JSON.stringify(centralData),
        detectedAt: new Date()
      }
    });
  }

  return hasConflict;
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'ACCEPT_BRANCH' | 'ACCEPT_CENTRAL' | 'MANUAL_MERGE',
  resolvedBy: string
): Promise<void> {
  await db.syncConflict.update({
    where: { id: conflictId },
    data: {
      resolvedAt: new Date(),
      resolvedBy,
      resolution
    }
  });
}

/**
 * Get unresolved conflicts for a branch
 */
export async function getUnresolvedConflicts(branchId?: string): Promise<ConflictData[]> {
  const where: any = {
    resolvedAt: null
  };

  if (branchId) {
    where.branchId = branchId;
  }

  const conflicts = await db.syncConflict.findMany({
    where,
    include: {
      branch: {
        select: {
          id: true,
          branchName: true
        }
      }
    },
    orderBy: {
      detectedAt: 'desc'
    }
  });

  return conflicts.map(conflict => ({
    id: conflict.id,
    entityType: conflict.entityType,
    entityId: conflict.entityId,
    conflictReason: conflict.conflictReason,
    branchPayload: conflict.branchPayload ? JSON.parse(conflict.branchPayload) : null,
    centralPayload: conflict.centralPayload ? JSON.parse(conflict.centralPayload) : null,
    detectedAt: conflict.detectedAt,
    resolvedAt: conflict.resolvedAt,
    resolvedBy: conflict.resolvedBy
  }));
}

/**
 * Check for conflicts in data before syncing
 */
export async function checkForConflicts(
  branchId: string,
  entityType: string,
  entities: any[]
): Promise<boolean> {
  for (const entity of entities) {
    const existing = await getEntityByType(entityType, entity.id);

    if (existing && !isDataEqual(entity, existing)) {
      await detectConflict(branchId, entityType, entity.id, entity, existing);
      return true;
    }
  }

  return false;
}

// ============================================
// Data Retrieval Helpers
// ============================================

/**
 * Get entity by type and ID
 */
async function getEntityByType(entityType: string, entityId: string): Promise<any> {
  switch (entityType) {
    case 'MenuItem':
      return db.menuItem.findUnique({ where: { id: entityId } });
    case 'Ingredient':
      return db.ingredient.findUnique({ where: { id: entityId } });
    case 'Recipe':
      return db.recipe.findUnique({ where: { id: entityId } });
    case 'Category':
      return db.category.findUnique({ where: { id: entityId } });
    case 'User':
      return db.user.findUnique({ where: { id: entityId } });
    case 'BranchInventory':
      return db.branchInventory.findUnique({ where: { id: entityId } });
    default:
      return null;
  }
}

/**
 * Compare two objects for equality (deep comparison)
 */
function isDataEqual(obj1: any, obj2: any): boolean {
  // Handle null/undefined
  if (obj1 === null || obj1 === undefined) return obj1 === obj2;
  if (obj2 === null || obj2 === undefined) return obj1 === obj2;

  // Handle primitive types
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return obj1 === obj2;
  }

  // Handle arrays
  if (Array.isArray(obj1) || Array.isArray(obj2)) {
    if (!Array.isArray(obj1) || !Array.isArray(obj2)) return false;
    if (obj1.length !== obj2.length) return false;
    return obj1.every((item, index) => isDataEqual(item, obj2[index]));
  }

  // Handle objects
  const keys1 = Object.keys(obj1).filter(key => !['createdAt', 'updatedAt', 'lastSyncAt'].includes(key));
  const keys2 = Object.keys(obj2).filter(key => !['createdAt', 'updatedAt', 'lastSyncAt'].includes(key));

  if (keys1.length !== keys2.length) return false;

  return keys1.every(key => {
    if (!keys2.includes(key)) return false;
    return isDataEqual(obj1[key], obj2[key]);
  });
}

// ============================================
// Data Serialization for Sync
// ============================================

/**
 * Serialize data for sync (remove sensitive/internal fields)
 */
export function serializeForSync(data: any, entityType: string): any {
  const sensitiveFields = ['passwordHash', 'id', 'branchId'];

  if (Array.isArray(data)) {
    return data.map(item => serializeForSync(item, entityType));
  }

  const serialized = { ...data };

  // Remove sensitive fields
  sensitiveFields.forEach(field => {
    delete serialized[field];
  });

  // Remove timestamp fields (they will be recalculated)
  delete serialized.createdAt;
  delete serialized.updatedAt;

  return serialized;
}

/**
 * Calculate data hash for change detection
 */
export function calculateDataHash(data: any): string {
  const serialized = JSON.stringify(data, Object.keys(data).sort());
  // Simple hash function (in production, use a proper crypto hash)
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

// ============================================
// Update Branch Last Sync Time
// ============================================

/**
 * Update branch's last sync timestamp
 */
export async function updateBranchLastSync(branchId: string): Promise<void> {
  await db.branch.update({
    where: { id: branchId },
    data: { lastSyncAt: new Date() }
  });
}

// ============================================
// Batch Operations for Sync
// ============================================

/**
 * Batch update entities with conflict detection
 */
export async function batchUpdateWithConflictDetection<T>(
  branchId: string,
  entityType: string,
  entities: T[],
  updateFn: (entity: T) => Promise<any>
): Promise<{ succeeded: number; failed: number; conflicts: number }> {
  let succeeded = 0;
  let failed = 0;
  let conflicts = 0;

  for (const entity of entities) {
    try {
      // Check for conflicts
      const hasConflict = await checkForConflicts(branchId, entityType, [entity]);

      if (hasConflict) {
        conflicts++;
        continue;
      }

      // Perform update
      await updateFn(entity);
      succeeded++;
    } catch (error) {
      console.error(`Error updating ${entityType}:`, error);
      failed++;
    }
  }

  return { succeeded, failed, conflicts };
}

// ============================================
// Export Types
// ============================================

export type { SyncDirection, SyncStatus };
