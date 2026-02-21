import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// GET /api/days/[id]
// Get day details
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const dayId = (await params).id;

    const day = await db.day.findUnique({
      where: { id: dayId },
      include: {
        openedByUser: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        },
        closedByUser: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        },
        shifts: {
          include: {
            cashier: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },
            orders: {
              include: {
                items: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                    phone: true
                  }
                }
              }
            }
          }
        },
        branch: {
          select: {
            id: true,
            branchName: true
          }
        }
      }
    });

    if (!day) {
      return NextResponse.json(
        { success: false, error: 'Day not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      day
    });
  } catch (error: any) {
    console.error('[Get Day API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get day' },
      { status: 500 }
    );
  }
}
