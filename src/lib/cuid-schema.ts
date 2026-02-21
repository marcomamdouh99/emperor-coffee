import { z } from 'zod'

/**
 * CUID (Collision-resistant Unique Identifier) schema validation
 * Format: 25 character lowercase alphanumeric string
 */
export const cuidSchema = z.string()
  .min(25)
  .max(25)
  .regex(/^[a-z0-9]+$/)
