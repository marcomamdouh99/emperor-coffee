import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCached, invalidateCachePattern } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const cacheKey = `branches:all:${includeInactive ? 'include-inactive' : 'active-only'}`;

    const branches = await getCached(cacheKey, async () => {
      return await db.branch.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { branchName: 'asc' },
        select: {
          id: true,
          branchName: true,
          licenseKey: true,
          isActive: true,
          licenseExpiresAt: true,
          lastSyncAt: true,
          menuVersion: true,
          createdAt: true,
        },
      });
    }, 300000); // 5 minute cache

    return NextResponse.json({
      success: true,
      branches,
    });
  } catch (error) {
    console.error('Get branches error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch branches' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchName, licenseKey, licenseExpiresAt } = body;

    if (!branchName || !licenseKey || !licenseExpiresAt) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if branch name or license key already exists
    const existingBranch = await db.branch.findFirst({
      where: {
        OR: [
          { branchName },
          { licenseKey },
        ],
      },
    });

    if (existingBranch) {
      return NextResponse.json(
        { success: false, error: 'Branch name or license key already exists' },
        { status: 400 }
      );
    }

    const branch = await db.branch.create({
      data: {
        branchName,
        licenseKey,
        licenseExpiresAt: new Date(licenseExpiresAt),
        isActive: true,
      },
    });

    // Invalidate branches cache
    invalidateCachePattern('^branches:');

    return NextResponse.json({
      success: true,
      branch,
    });
  } catch (error) {
    console.error('Create branch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create branch' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, branchName, licenseKey, licenseExpiresAt, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    // Check if branch exists
    const existingBranch = await db.branch.findUnique({
      where: { id },
    });

    if (!existingBranch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Check for duplicate branch name or license key
    if (branchName || licenseKey) {
      const duplicateBranch = await db.branch.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                branchName ? { branchName } : {},
                licenseKey ? { licenseKey } : {},
              ].filter(Boolean),
            },
          ],
        },
      });

      if (duplicateBranch) {
        return NextResponse.json(
          { success: false, error: 'Branch name or license key already exists' },
          { status: 400 }
        );
      }
    }

    const branch = await db.branch.update({
      where: { id },
      data: {
        ...(branchName && { branchName }),
        ...(licenseKey && { licenseKey }),
        ...(licenseExpiresAt && { licenseExpiresAt: new Date(licenseExpiresAt) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Invalidate branches cache
    invalidateCachePattern('^branches:');

    return NextResponse.json({
      success: true,
      branch,
    });
  } catch (error) {
    console.error('Update branch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update branch' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Branch ID is required' },
        { status: 400 }
      );
    }

    // Check if branch exists
    const existingBranch = await db.branch.findUnique({
      where: { id },
    });

    if (!existingBranch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Delete branch
    await db.branch.delete({
      where: { id },
    });

    // Invalidate branches cache
    invalidateCachePattern('^branches:');

    return NextResponse.json({
      success: true,
      message: 'Branch deleted successfully',
    });
  } catch (error) {
    console.error('Delete branch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete branch' },
      { status: 500 }
    );
  }
}
