import { z } from 'zod'
import { cuidSchema } from '@/lib/cuid-schema'

// Order item validation
export const orderItemSchema = z.object({
  menuItemId: z.string().min(1).max(50),  // Accept any valid ID format
  quantity: z.number().int().positive().min(1).max(99),
  menuItemVariantId: z.string().min(1).max(50).nullable().optional(),  // Accept string, null, or undefined
  specialInstructions: z.string().max(500).nullable().optional()  // Item notes/special requests
})

// Order validation
export const orderCreateSchema = z.object({
  branchId: cuidSchema,
  cashierId: cuidSchema,
  items: z.array(orderItemSchema).min(1).max(50),
  paymentMethod: z.enum(['cash', 'card', 'digital_wallet']),
  orderType: z.enum(['dine-in', 'take-away', 'delivery']).default('take-away'),
  tableId: z.string().min(1).optional(), // For dine-in orders linked to a table
  deliveryAddress: z.string().max(500).optional(),
  deliveryAreaId: z.string().min(1).regex(/^[-a-z0-9_]+$/).optional(), // Allow hyphens and underscores
  deliveryFee: z.number().min(0).optional(),
  customerId: z.string().min(1).optional(), // Accept any valid string, not just CUID
  customerAddressId: z.string().min(1).optional(), // Accept any valid string, not just CUID
  customerPhone: z.string().regex(/^[0-9+ ]{6,14}$/).optional(),
  customerName: z.string().max(100).optional(),
  courierId: z.string().min(1).optional(), // Accept any valid string, not just CUID
  loyaltyPointsRedeemed: z.number().min(0).optional(), // Points being redeemed
  loyaltyDiscount: z.number().min(0).optional(), // Discount amount (same as points redeemed, 1pt = 1EGP)
  promoCodeId: z.string().min(1).optional(), // Applied promo code ID
  promoDiscount: z.number().min(0).optional(), // Promo discount amount
  orderNumber: z.number().int().positive().optional(),
  cardReferenceNumber: z.string().max(100).nullable().optional(), // Card transaction reference number
  paymentMethodDetail: z.enum(['CARD', 'INSTAPAY', 'MOBILE_WALLET']).nullable().optional() // Card payment detail type
}).passthrough() // Allow extra fields like subtotal, total, taxRate

// User validation
export const userCreateSchema = z.object({
  username: z.string()
    .min(3).max(30)
    .regex(/^[a-z0-9_]+$/i),
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/^(?=.*[A-Z])(?=.*[a-z0-9])/),
  name: z.string().max(100).optional(),
  role: z.enum(['ADMIN', 'BRANCH_MANAGER', 'CASHIER']),
  branchId: cuidSchema.optional()
})

// Login validation
export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1)
})

// Change password validation
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8)
    .regex(/^(?=.*[A-Z])(?=.*[a-z0-9])/),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

// Branch validation
export const branchCreateSchema = z.object({
  branchName: z.string().min(2).max(100),
  licenseKey: z.string().min(5).max(50),
  licenseExpiresAt: z.string().datetime()
})

// MenuItem validation
export const menuItemCreateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100).optional(),
  categoryId: cuidSchema.optional(),
  price: z.number().positive().min(0.01).max(9999.99),
  taxRate: z.number().min(0).max(1).default(0.14),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional(),
  hasVariants: z.boolean().optional()
})

// Ingredient validation
export const ingredientCreateSchema = z.object({
  name: z.string().min(1).max(100),
  unit: z.string().min(1).max(20),
  costPerUnit: z.number().positive(),
  reorderThreshold: z.number().nonnegative()
})

// Shift validation
export const shiftOpenSchema = z.object({
  branchId: cuidSchema,
  cashierId: cuidSchema,
  openingCash: z.number().nonnegative(),
  notes: z.string().max(500).optional()
})

export const shiftCloseSchema = z.object({
  notes: z.string().max(500).optional(),
  paymentBreakdown: z.object({
    cash: z.number().min(0),
    card: z.number().min(0),
    other: z.number().min(0),
    total: z.number().min(0)
  }).optional()
})

// Category validation
export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().nonnegative().optional()
})

export const categoryUpdateSchema = categoryCreateSchema.partial()

// Customer validation
export const customerCreateSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^[0-9+ ]{6,14}$/),
  email: z.string().email().optional(),
  address: z.string().max(500).optional()
})

export const customerUpdateSchema = customerCreateSchema.partial()

// Delivery area validation
export const deliveryAreaCreateSchema = z.object({
  name: z.string().min(1).max(100),
  branchId: cuidSchema,
  deliveryFee: z.number().nonnegative(),
  minOrderAmount: z.number().nonnegative().optional(),
  estimatedDeliveryTime: z.number().int().positive().optional(),
  isActive: z.boolean().optional()
})

export const deliveryAreaUpdateSchema = deliveryAreaCreateSchema.partial()

// Cost category validation
export const costCategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
})

// Branch cost validation
export const branchCostCreateSchema = z.object({
  branchId: cuidSchema,
  costCategoryId: cuidSchema,
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  costDate: z.string().datetime().optional()
})

export const branchCostUpdateSchema = branchCostCreateSchema.partial()

// Generic validation response
export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors: z.ZodIssue[]
}

/**
 * Validate request body against schema
 */
export function validateRequest<T>(
  schema: z.ZodType<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues  // Zod v4 uses 'issues' instead of 'errors'
    }
  }

  return {
    success: true,
    data: result.data
  }
}

/**
 * Format Zod errors for API responses
 */
export function formatZodErrors(errors: z.ZodIssue[]): string {
  return errors.map(err => {
    const path = err.path.join('.')
    const message = err.message
    return `${path}: ${message}`
  }).join(', ')
}
