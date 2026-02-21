/**
 * Pagination utilities for API responses
 */

export interface PaginationParams {
  page?: string | number
  limit?: string | number
  offset?: string | number
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

/**
 * Parse and validate pagination parameters
 */
export function parsePaginationParams(params: PaginationParams): {
  page: number
  limit: number
  offset: number
} {
  let page = 1
  let limit = 50
  let offset = 0

  if (params.page) {
    page = typeof params.page === 'string' ? parseInt(params.page, 10) : params.page
  }

  if (params.limit) {
    limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : params.limit
  }

  if (params.offset) {
    offset = typeof params.offset === 'string' ? parseInt(params.offset, 10) : params.offset
  }

  // Validate limits
  if (limit < 1) limit = 10
  if (limit > 1000) limit = 1000 // Maximum limit to prevent abuse
  if (page < 1) page = 1
  if (offset < 0) offset = 0

  return { page, limit, offset }
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  total: number,
  page: number,
  limit: number,
  offset: number
) {
  const totalPages = Math.ceil(total / limit)
  const hasNext = offset + limit < total
  const hasPrevious = offset > 0 || page > 1

  return {
    total,
    page,
    limit,
    totalPages: totalPages || 1,
    hasNext,
    hasPrevious,
  }
}

/**
 * Build paginated response
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  offset: number
): PaginationResult<T> {
  return {
    data,
    pagination: calculatePagination(total, page, limit, offset),
  }
}

/**
 * Default pagination options for different resource types
 */
export const defaultPagination = {
  orders: { limit: 50, maxLimit: 200 },
  customers: { limit: 100, maxLimit: 500 },
  products: { limit: 100, maxLimit: 500 },
  users: { limit: 50, maxLimit: 200 },
  inventory: { limit: 50, maxLimit: 200 },
  reports: { limit: 100, maxLimit: 500 },
}
