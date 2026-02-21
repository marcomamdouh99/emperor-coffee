/**
 * Session Management Utilities
 * Secure session-based authentication using HTTP-only cookies
 */

import { cookies } from 'next/headers'
import crypto from 'crypto'

export interface SessionData {
  userId: string
  username: string
  email: string
  name?: string
  role: 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER'
  branchId?: string
  expiresAt: number
}

const SESSION_COOKIE_NAME = 'pos_session'
const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8 hours in milliseconds

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Create a secure session and set cookie
 */
export async function createSession(sessionData: Omit<SessionData, 'expiresAt'>): Promise<SessionData> {
  const expiresAt = Date.now() + SESSION_DURATION
  const sessionToken = generateSessionToken()

  const cookieStore = await cookies()
  
  const data: SessionData = {
    ...sessionData,
    expiresAt
  }

  // Set HTTP-only secure cookie
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000, // Convert to seconds
    path: '/',
  })

  return data
}

/**
 * Get current session from cookie
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (!sessionCookie) {
    return null
  }

  try {
    const session: SessionData = JSON.parse(sessionCookie.value)
    
    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      return null
    }

    return session
  } catch (error) {
    console.error('Error parsing session cookie:', error)
    return null
  }
}

/**
 * Clear session (logout)
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  
  cookieStore.delete(SESSION_COOKIE_NAME)
  
  // Also clear any legacy cookies
  cookieStore.delete('user')
  cookieStore.delete('isLoggedIn')
}

/**
 * Validate session exists and is not expired
 */
export async function validateSession(): Promise<boolean> {
  const session = await getSession()
  return session !== null && Date.now() < session.expiresAt
}

/**
 * Get session cookie name (for use in API routes)
 */
export { SESSION_COOKIE_NAME }
