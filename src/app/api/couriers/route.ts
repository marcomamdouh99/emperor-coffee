import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch all couriers with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const includeStats = searchParams.get('includeStats') === 'true';

    const where: any = {};
    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    }

    const couriers = await db.courier.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            branchName: true,
          },
        },
        ...(includeStats ? {
          _count: {
            select: { orders: true },
          },
        } : {}),
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ couriers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching couriers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch couriers' },
      { status: 500 }
    );
  }
}

// POST - Create new courier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, branchId, isActive } = body;

    if (!name || !branchId) {
      return NextResponse.json(
        { error: 'Name and branchId are required' },
        { status: 400 }
      );
    }

    const courier = await db.courier.create({
      data: {
        name,
        phone: phone || null,
        branchId,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        branch: {
          select: {
            id: true,
            branchName: true,
          },
        },
      },
    });

    return NextResponse.json({ courier }, { status: 201 });
  } catch (error) {
    console.error('Error creating courier:', error);
    return NextResponse.json(
      { error: 'Failed to create courier' },
      { status: 500 }
    );
  }
}
