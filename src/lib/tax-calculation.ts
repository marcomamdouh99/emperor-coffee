/**
 * Tax Calculation Utilities
 * Handles order-level tax calculations for Egyptian Tax System (ETA)
 */

/**
 * Calculate tax amount for an order
 * @param subtotal - Order subtotal before tax
 * @param taxRate - Tax rate (e.g., 0.14 for 14% VAT)
 *returns Tax amount to be added to the order
 */
export function calculateTaxAmount(
  subtotal: number,
  taxRate: number
): number {
  // Calculate tax: subtotal * taxRate
  const taxAmount = subtotal * taxRate;
  
  // Round to 2 decimal places (standard for currency)
  return Math.round(taxAmount * 100) / 100;
}

/**
 * Calculate total amount with tax
 * @param subtotal - Order subtotal before tax
 * @param taxAmount - Calculated tax amount
 * @param deliveryFee - Delivery fee
 * @param loyaltyDiscount - Loyalty discount
 * @param promoDiscount - Promo code discount
 * @returns Total amount including tax
 */
export function calculateTotalAmount(
  subtotal: number,
  taxAmount: number,
  deliveryFee: number,
  loyaltyDiscount: number,
  promoDiscount: number
): number {
  return subtotal + taxAmount + (deliveryFee || 0) - (loyaltyDiscount || 0) - (promoDiscount || 0);
}

/**
 * Check if a branch has tax enabled
 * @param branch - Branch object from database
 * @returns boolean indicating if tax is enabled
 */
export function isBranchTaxEnabled(branch: { taxEnabled?: boolean }): boolean {
  return branch.taxEnabled === true;
}

/**
 * Get tax rate from branch
 * @param branch - Branch object from database
 * @returns Tax rate (default 0.14 for 14% VAT)
 */
export function getBranchTaxRate(branch: { taxRate?: number }): number {
  return branch.taxRate ?? 0.14;
}

/**
 * Calculate tax for an order based on branch settings
 * @param subtotal - Order subtotal
 * @param branch - Branch object with tax settings
 * @returns Object with taxAmount and taxEnabled
 */
export function calculateOrderTax(
  subtotal: number,
  branch: { taxEnabled?: boolean; taxRate?: number }
): { taxAmount: number; taxEnabled: boolean } {
  const taxEnabled = isBranchTaxEnabled(branch);
  
  if (!taxEnabled) {
    return {
      taxAmount: 0,
      taxEnabled: false
    };
  }
  
  const taxRate = getBranchTaxRate(branch);
  const taxAmount = calculateTaxAmount(subtotal, taxRate);
  
  return {
    taxAmount,
    taxEnabled
  };
}
