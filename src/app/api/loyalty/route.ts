import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Loyalty configuration
const LOYALTY_CONFIG = {
  pointsPerCurrency: 0.01, // 0.01 points per currency unit (10 points per 1000)
  pointsValue: 1, // Each point is worth 1 currency unit
  tiers: {
    BRONZE: { minPoints: 0, discount: 0, name: 'Bronze' },
    SILVER: { minPoints: 20, discount: 5, name: 'Silver' }, // 20 points = 2000 EGP spent
    GOLD: { minPoints: 50, discount: 10, name: 'Gold' },    // 50 points = 5000 EGP spent
    PLATINUM: { minPoints: 100, discount: 15, name: 'Platinum' }, // 100 points = 10000 EGP spent
  },
};

// Calculate tier based on points
function calculateTier(points: number): string {
  if (points >= 100) return 'PLATINUM';
  if (points >= 50) return 'GOLD';
  if (points >= 20) return 'SILVER';
  return 'BRONZE';
}

// Schema for earning points
const earnPointsSchema = z.object({
  customerId: z.string().min(1),
  orderId: z.string().optional(),
  amount: z.number().positive(),
});

// Schema for redeeming points
const redeemPointsSchema = z.object({
  customerId: z.string().min(1),
  points: z.number().positive(),
  orderId: z.string().optional(),
});

// Schema for adjusting points
const adjustPointsSchema = z.object({
  customerId: z.string().min(1),
  points: z.number(), // Can be positive or negative, including decimals
  notes: z.string().optional(),
});

// GET /api/loyalty - Get loyalty info for a customer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const phone = searchParams.get('phone');

    let customer;

    if (customerId) {
      customer = await db.customer.findUnique({
        where: { id: customerId },
        include: {
          loyaltyTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });
    } else if (phone) {
      customer = await db.customer.findUnique({
        where: { phone },
        include: {
          loyaltyTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Calculate tier based on current points
    const tier = calculateTier(customer.loyaltyPoints);
    const tierInfo = LOYALTY_CONFIG.tiers[tier as keyof typeof LOYALTY_CONFIG.tiers];

    // Calculate points value
    const pointsValue = customer.loyaltyPoints * LOYALTY_CONFIG.pointsValue;

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
        tier: tier,
        totalSpent: customer.totalSpent,
        orderCount: customer.orderCount,
      },
      tierInfo: {
        ...tierInfo,
        currentPoints: customer.loyaltyPoints,
        nextTierPoints: tier === 'PLATINUM' ? null :
          LOYALTY_CONFIG.tiers[
            ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'][
              ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].indexOf(tier) + 1
            ] as keyof typeof LOYALTY_CONFIG.tiers
          ]?.minPoints || null,
      },
      pointsValue,
      transactions: customer.loyaltyTransactions,
    });
  } catch (error) {
    console.error('Error fetching loyalty info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loyalty info' },
      { status: 500 }
    );
  }
}

// POST /api/loyalty - Process loyalty action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'earn') {
      const validatedData = earnPointsSchema.parse(body);
      const points = validatedData.amount * LOYALTY_CONFIG.pointsPerCurrency;

      if (points <= 0) {
        return NextResponse.json(
          { error: 'No points to earn' },
          { status: 400 }
        );
      }

      // Update customer points and stats
      const customer = await db.customer.update({
        where: { id: validatedData.customerId },
        data: {
          loyaltyPoints: { increment: points },
          totalSpent: { increment: validatedData.amount },
          orderCount: { increment: 1 },
          tier: calculateTier(
            (await db.customer.findUnique({
              where: { id: validatedData.customerId },
            }))!.loyaltyPoints + points
          ),
        },
      });

      // Create loyalty transaction
      const transaction = await db.loyaltyTransaction.create({
        data: {
          customerId: validatedData.customerId,
          points,
          type: 'EARNED',
          orderId: validatedData.orderId,
          amount: validatedData.amount,
        },
      });

      return NextResponse.json({
        success: true,
        pointsEarned: points,
        totalPoints: customer.loyaltyPoints,
        tier: customer.tier,
        transaction,
      });
    } else if (action === 'redeem') {
      const validatedData = redeemPointsSchema.parse(body);

      // Check customer has enough points
      const customer = await db.customer.findUnique({
        where: { id: validatedData.customerId },
      });

      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      if (customer.loyaltyPoints < validatedData.points) {
        return NextResponse.json(
          { error: 'Insufficient points', available: customer.loyaltyPoints },
          { status: 400 }
        );
      }

      // Deduct points
      const updatedCustomer = await db.customer.update({
        where: { id: validatedData.customerId },
        data: {
          loyaltyPoints: { decrement: validatedData.points },
          tier: calculateTier(customer.loyaltyPoints - validatedData.points),
        },
      });

      // Create loyalty transaction
      const transaction = await db.loyaltyTransaction.create({
        data: {
          customerId: validatedData.customerId,
          points: -validatedData.points,
          type: 'REDEEMED',
          orderId: validatedData.orderId,
        },
      });

      // Calculate discount value
      const discountValue = validatedData.points * LOYALTY_CONFIG.pointsValue;

      return NextResponse.json({
        success: true,
        pointsRedeemed: validatedData.points,
        discountValue,
        remainingPoints: updatedCustomer.loyaltyPoints,
        tier: updatedCustomer.tier,
        transaction,
      });
    } else if (action === 'adjust') {
      const validatedData = adjustPointsSchema.parse(body);

      const customer = await db.customer.findUnique({
        where: { id: validatedData.customerId },
      });

      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      const newPoints = customer.loyaltyPoints + validatedData.points;
      if (newPoints < 0) {
        return NextResponse.json(
          { error: 'Cannot reduce points below zero' },
          { status: 400 }
        );
      }

      const updatedCustomer = await db.customer.update({
        where: { id: validatedData.customerId },
        data: {
          loyaltyPoints: newPoints,
          tier: calculateTier(newPoints),
        },
      });

      const transaction = await db.loyaltyTransaction.create({
        data: {
          customerId: validatedData.customerId,
          points: validatedData.points,
          type: 'ADJUSTMENT',
          notes: validatedData.notes,
        },
      });

      return NextResponse.json({
        success: true,
        pointsAdjusted: validatedData.points,
        totalPoints: updatedCustomer.loyaltyPoints,
        tier: updatedCustomer.tier,
        transaction,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error processing loyalty action:', error);
    return NextResponse.json(
      { error: 'Failed to process loyalty action' },
      { status: 500 }
    );
  }
}
