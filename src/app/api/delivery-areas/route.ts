import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/delivery-areas
 * Returns all delivery areas
 */
export async function GET(request: NextRequest) {
  try {
    const areas = await db.deliveryArea.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      areas,
    });
  } catch (error) {
    console.error('Error fetching delivery areas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delivery areas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/delivery-areas
 * Create a new delivery area
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, fee } = body;

    if (!name || fee === undefined || fee === null) {
      return NextResponse.json(
        { error: 'Name and fee are required' },
        { status: 400 }
      );
    }

    const newArea = await db.deliveryArea.create({
      data: {
        name,
        fee: parseFloat(fee),
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        area: newArea,
        message: 'Delivery area created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating delivery area:', error);
    return NextResponse.json(
      { error: 'Failed to create delivery area' },
      { status: 500 }
    );
  }
}
