/**
 * Input Sanitization Utilities
 * Prevents XSS, SQL injection, and other injection attacks
 */

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(unsafeHtml: string): string {
  if (!unsafeHtml) {
    return ''
  }

  return unsafeHtml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&#x27;/g, "'")
}

/**
 * Sanitize input strings for database queries
 * Prevents SQL injection
 */
export function sanitizeInput(input: string): string {
  if (!input) {
    return ''
  }

  // Remove potentially harmful characters
  let sanitized = input
    .replace(/[<>"'&]/g, '') // Remove HTML tags
    .replace(/[;{}()]/g, '')     // Remove common SQL operators
    .replace(/[|\\*]/g, '')     // Remove wildcard operators
    .trim()

  return sanitized
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  if (!email) {
    return ''
  }

  const lowerEmail = email.toLowerCase().trim()
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(lowerEmail) ? lowerEmail : ''
}

/**
 * Sanitize phone numbers
 */
export function sanitizePhone(phone: string): string {
  if (!phone) {
    return ''
  }

  // Remove all non-numeric characters except +
  let sanitized = phone.replace(/[^\+]/g, '').trim()
  return sanitized
}

/**
 * Sanitize branch IDs and similar identifiers
 */
export function sanitizeId(id: string): string {
  if (!id) {
    return ''
  }

  // Allow only alphanumeric, hyphens, and underscores
  const sanitized = id
    .replace(/[^a-z0-9_-]/gi, '')
  .slice(0, 50) // Limit length
  .trim()

  return sanitized
}

/**
 * Sanitize search queries
 */
export function sanitizeSearch(query: string): string {
  if (!query) {
    return ''
  }

  // Remove special characters that could break SQL LIKE queries
  const sanitized = query
    .replace(/[^\s%'"\\;\\]/g, ' ')
    .slice(0, 100) // Limit search length
  .trim()

  return sanitized
}

/**
 * Sanitize file paths to prevent directory traversal
 */
export function sanitizePath(path: string): string {
  if (!path) {
    return ''
  }

  // Prevent directory traversal attacks
  const normalized = path
    .replace(/\.\.\//g, '/')
    .replace(/\\/g, '/')

  return normalized
}

/**
 * Sanitize currency amounts
 */
export function sanitizeCurrency(amount: string): string {
  if (!amount) {
    return ''
  }

  // Remove everything except numbers, decimal, and minus
  const sanitized = amount
    .replace(/[^0-9.-]/g, '')
  .trim()

  return sanitized
}

/**
 * Generic sanitization helper that applies appropriate sanitization based on field type
 */
export function sanitizeField(value: string, type: 'text' | 'email' | 'phone' | 'id' | 'search' | 'path' | 'currency' | 'number'): string {
  if (value === null || value === undefined) {
    return ''
  }

  switch (type) {
    case 'email':
      return sanitizeEmail(value)
    case 'phone':
      return sanitizePhone(value)
    case 'id':
      return sanitizeId(value)
    case 'search':
      return sanitizeSearch(value)
    case 'path':
      return sanitizePath(value)
    case 'currency':
      return sanitizeCurrency(value)
    case 'number':
      return sanitizeInput(String(value))
    case 'text':
    default:
      return sanitizeInput(value)
  }
}
