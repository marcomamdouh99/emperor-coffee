// Local Loyalty Manager for Offline Operations
// Handles loyalty point operations when offline

export interface LoyaltyPointsResult {
  success: boolean;
  pointsAwarded: number;
  newBalance: number;
  error?: string;
}

/**
 * Award loyalty points to a customer for an order (offline mode)
 * This function stores the operation locally and will sync when online
 */
export async function awardLoyaltyPointsOffline(
  customerId: string,
  orderId: string,
  amount: number,
  pointsPerCurrency: number = 1
): Promise<LoyaltyPointsResult> {
  try {
    // Calculate points to award
    const pointsToAward = Math.floor(amount * pointsPerCurrency);

    // Store the operation in local storage for later sync
    if (typeof window !== 'undefined' && window.localStorage) {
      const pendingOperations = JSON.parse(
        localStorage.getItem('pendingLoyaltyOperations') || '[]'
      );

      pendingOperations.push({
        id: `loyalty-${Date.now()}`,
        customerId,
        orderId,
        pointsAwarded: pointsToAward,
        timestamp: new Date().toISOString(),
        operation: 'AWARD_POINTS',
        synced: false,
      });

      localStorage.setItem(
        'pendingLoyaltyOperations',
        JSON.stringify(pendingOperations)
      );

      console.log(
        `[LocalLoyalty] Awarded ${pointsToAward} points to customer ${customerId} for order ${orderId}`
      );
    }

    return {
      success: true,
      pointsAwarded: pointsToAward,
      newBalance: pointsToAward, // This would be updated from server
    };
  } catch (error: any) {
    console.error('[LocalLoyalty] Error awarding points:', error);
    return {
      success: false,
      pointsAwarded: 0,
      newBalance: 0,
      error: error.message,
    };
  }
}

/**
 * Redeem loyalty points for a discount (offline mode)
 */
export async function redeemLoyaltyPointsOffline(
  customerId: string,
  pointsToRedeem: number,
  orderId: string
): Promise<LoyaltyPointsResult> {
  try {
    // Store the operation in local storage for later sync
    if (typeof window !== 'undefined' && window.localStorage) {
      const pendingOperations = JSON.parse(
        localStorage.getItem('pendingLoyaltyOperations') || '[]'
      );

      pendingOperations.push({
        id: `loyalty-${Date.now()}`,
        customerId,
        orderId,
        pointsRedeemed: pointsToRedeem,
        timestamp: new Date().toISOString(),
        operation: 'REDEEM_POINTS',
        synced: false,
      });

      localStorage.setItem(
        'pendingLoyaltyOperations',
        JSON.stringify(pendingOperations)
      );

      console.log(
        `[LocalLoyalty] Redeemed ${pointsToRedeem} points from customer ${customerId} for order ${orderId}`
      );
    }

    return {
      success: true,
      pointsAwarded: -pointsToRedeem,
      newBalance: -pointsToRedeem,
    };
  } catch (error: any) {
    console.error('[LocalLoyalty] Error redeeming points:', error);
    return {
      success: false,
      pointsAwarded: 0,
      newBalance: 0,
      error: error.message,
    };
  }
}

/**
 * Get pending loyalty operations that need to be synced
 */
export function getPendingLoyaltyOperations(): any[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const pendingOperations = JSON.parse(
        localStorage.getItem('pendingLoyaltyOperations') || '[]'
      );
      return pendingOperations.filter((op: any) => !op.synced);
    } catch (error) {
      console.error('[LocalLoyalty] Error reading pending operations:', error);
      return [];
    }
  }
  return [];
}

/**
 * Clear synced loyalty operations from local storage
 */
export function clearSyncedLoyaltyOperations(operationIds: string[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const pendingOperations = JSON.parse(
        localStorage.getItem('pendingLoyaltyOperations') || '[]'
      );

      const updatedOperations = pendingOperations.filter(
        (op: any) => !operationIds.includes(op.id)
      );

      localStorage.setItem(
        'pendingLoyaltyOperations',
        JSON.stringify(updatedOperations)
      );
    } catch (error) {
      console.error('[LocalLoyalty] Error clearing synced operations:', error);
    }
  }
}
