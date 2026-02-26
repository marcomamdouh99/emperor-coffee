import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const period = searchParams.get('period');
    const costCategoryId = searchParams.get('costCategoryId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const costs = await db.branchCost.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(period ? { period } : {}),
        ...(costCategoryId ? { costCategoryId } : {}),
      },
      orderBy: [
        { period: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      include: {
        branch: {
          select: { id: true, branchName: true },
        },
        costCategory: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    return NextResponse.json({ costs });
  } catch (error: any) {
    console.error('Get costs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, costCategoryId, amount, period, notes } = body;

    if (!branchId || !costCategoryId || !amount || !period) {
      return NextResponse.json(
        { error: 'Missing required fields: branchId, costCategoryId, amount, period' },
        { status: 400 }
      );
    }

    // Validate period format (YYYY-MM)
    const periodRegex = /^\d{4}-\d{2}$/;
    if (!periodRegex.test(period)) {
      return NextResponse.json(
        { error: 'Period must be in format YYYY-MM (e.g., 2025-01)' },
        { status: 400 }
      );
    }

    // Validate branch exists
    const branch = await db.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Validate cost category exists
    const costCategory = await db.costCategory.findUnique({
      where: { id: costCategoryId },
    });

    if (!costCategory) {
      return NextResponse.json(
        { error: 'Cost category not found' },
        { status: 404 }
      );
    }

    const cost = await db.branchCost.create({
      data: {
        branchId,
        costCategoryId,
        amount: parseFloat(amount),
        period,
        notes: notes || null,
      },
      include: {
        branch: {
          select: { id: true, branchName: true },
        },
        costCategory: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      cost,
    });
  } catch (error: any) {
    console.error('Create cost error:', error);
    return NextResponse.json(
      { error: 'Failed to create cost' },
      { status: 500 }
    );
  }
}
