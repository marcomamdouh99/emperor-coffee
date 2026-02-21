// Conflict Resolution API
// Resolve individual sync conflicts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveConflict as resolveConflictUtil } from '@/lib/sync-utils';

/**
 * POST /api/sync/conflicts/[id]/resolve
 * Body:
 * - resolution: 'ACCEPT_BRANCH' | 'ACCEPT_CENTRAL' | 'MANUAL_MERGE' (required)
 * - resolvedBy: string (required) - Username or ID of person resolving
 * - mergedData: any (optional) - If MANUAL_MERGE, contains the merged data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conflictId = params.id;
    const body = await request.json();
    const { resolution, resolvedBy, mergedData } = body;

    // Validate inputs
    if (!resolution || !['ACCEPT_BRANCH', 'ACCEPT_CENTRAL', 'MANUAL_MERGE'].includes(resolution)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Valid resolution required: ACCEPT_BRANCH, ACCEPT_CENTRAL, or MANUAL_MERGE'
        },
        { status: 400 }
      );
    }

    if (!resolvedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'resolvedBy is required'
        },
        { status: 400 }
      );
    }

    // Get the conflict
    const conflict = await db.syncConflict.findUnique({
      where: { id: conflictId },
      include: {
        branch: true
      }
    });

    if (!conflict) {
      return NextResponse.json(
        { success: false, error: 'Conflict not found' },
        { status: 404 }
      );
    }

    // Check if already resolved
    if (conflict.resolvedAt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Conflict already resolved',
          data: {
            resolvedAt: conflict.resolvedAt,
            resolvedBy: conflict.resolvedBy,
            resolution: conflict.resolution
          }
        },
        { status: 400 }
      );
    }

    // Resolve the conflict
    await resolveConflictUtil(conflictId, resolution, resolvedBy);

    // If MANUAL_MERGE with mergedData, apply the merged data
    if (resolution === 'MANUAL_MERGE' && mergedData) {
      await applyMergedData(conflict.entityType, conflict.entityId, mergedData);
    } else if (resolution === 'ACCEPT_BRANCH' && conflict.branchPayload) {
      // Apply branch data
      const branchData = JSON.parse(conflict.branchPayload as string);
      await applyMergedData(conflict.entityType, conflict.entityId, branchData);
    }
    // If ACCEPT_CENTRAL, no action needed - central data is already in place

    // Get updated conflict
    const updatedConflict = await db.syncConflict.findUnique({
      where: { id: conflictId },
      include: {
        branch: {
          select: {
            id: true,
            branchName: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Conflict resolved successfully',
      data: {
        id: updatedConflict?.id,
        entityType: updatedConflict?.entityType,
        entityId: updatedConflict?.entityId,
        resolution: updatedConflict?.resolution,
        resolvedAt: updatedConflict?.resolvedAt,
        resolvedBy: updatedConflict?.resolvedBy,
        branch: updatedConflict?.branch
      }
    });
  } catch (error: any) {
    console.error('[Conflict Resolution Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to resolve conflict'
      },
      { status: 500 }
    );
  }
}

/**
 * Apply merged/resolved data to the entity
 */
async function applyMergedData(entityType: string, entityId: string, data: any): Promise<void> {
  switch (entityType) {
    case 'MenuItem': {
      const { id, createdAt, updatedAt, ...updateData } = data;
      await db.menuItem.update({
        where: { id: entityId },
        data: updateData
      });
      break;
    }

    case 'Ingredient': {
      const { id, createdAt, updatedAt, ...updateData } = data;
      await db.ingredient.update({
        where: { id: entityId },
        data: updateData
      });
      break;
    }

    case 'Recipe': {
      const { id, createdAt, updatedAt, menuItem, ingredient, variant, ...updateData } = data;
      await db.recipe.update({
        where: { id: entityId },
        data: updateData
      });
      break;
    }

    case 'User': {
      const { id, createdAt, updatedAt, passwordHash, ...updateData } = data;
      await db.user.update({
        where: { id: entityId },
        data: updateData
      });
      break;
    }

    case 'BranchInventory': {
      const { id, createdAt, updatedAt, branch, ingredient, modifier, transferItemsAsSource, transferItemsAsTarget, ...updateData } = data;
      await db.branchInventory.update({
        where: { id: entityId },
        data: updateData
      });
      break;
    }

    default:
      console.warn(`Unknown entity type for merge: ${entityType}`);
  }
}
