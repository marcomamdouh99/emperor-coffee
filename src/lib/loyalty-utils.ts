import { db } from '@/lib/db';

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

/**
 * Award loyalty points to a customer for an order
 * This is a server-side function that directly updates the database
 */
export async function awardLoyaltyPoints(customerId: string, orderId: string, amount: number) {
  console.log('[LoyaltyUtils] Awarding loyalty points:', { customerId, orderId, amount });

  // Validate amount
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  // Calculate points
  const points = amount * LOYALTY_CONFIG.pointsPerCurrency;

  if (points <= 0) {
    throw new Error('No points to earn');
  }

  // Check if customer exists
  const existingCustomer = await db.customer.findUnique({
    where: { id: customerId },
  });

  if (!existingCustomer) {
    throw new Error('Customer not found');
  }

  // Update customer points and stats
  const newTier = calculateTier(existingCustomer.loyaltyPoints + points);

  const customer = await db.customer.update({
    where: { id: customerId },
    data: {
      loyaltyPoints: { increment: points },
      totalSpent: { increment: amount },
      orderCount: { increment: 1 },
      tier: newTier,
    },
  });

  // Create loyalty transaction
  const transaction = await db.loyaltyTransaction.create({
    data: {
      customerId,
      points,
      type: 'EARNED',
      orderId,
      amount,
    },
  });

  console.log('[LoyaltyUtils] Loyalty points awarded successfully:', {
    pointsEarned: points,
    totalPoints: customer.loyaltyPoints,
    tier: customer.tier,
    transactionId: transaction.id,
  });

  return {
    success: true,
    pointsEarned: points,
    totalPoints: customer.loyaltyPoints,
    tier: customer.tier,
    transaction,
  };
}
