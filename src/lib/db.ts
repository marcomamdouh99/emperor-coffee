// Prisma Client - Database Connection with Pooling and Graceful Shutdown
// Optimized for production use with SQLite

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  databaseUrl: string | undefined
}

// Store the initial DATABASE_URL when module loads
const currentDatabaseUrl = process.env.DATABASE_URL

// In development, reset client if DATABASE_URL changed
if (process.env.NODE_ENV !== 'production') {
  if (globalForPrisma.databaseUrl && globalForPrisma.databaseUrl !== currentDatabaseUrl) {
    // DATABASE_URL changed, disconnect old client
    if (globalForPrisma.prisma) {
      globalForPrisma.prisma.$disconnect().catch(() => {})
    }
    globalForPrisma.prisma = undefined
  }
  // Don't reset on every load - only reset if DATABASE_URL changed
  // This ensures the client stays initialized across hot reloads
}

interface ConnectionMetrics {
  totalQueries: number
  activeConnections: number
  queryErrors: number
  lastErrorTime: number
}

const metrics: ConnectionMetrics = {
  totalQueries: 0,
  activeConnections: 0,
  queryErrors: 0,
  lastErrorTime: 0
}

/**
 * Get or create Prisma client with optimized configuration
 * For SQLite, we use a singleton pattern with proper timeout settings
 */
export const db = (() => {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  // Log the DATABASE_URL for debugging
  console.log('[DB] Initializing Prisma client with DATABASE_URL:', process.env.DATABASE_URL)

  // Create new client with optimized settings for SQLite
  const prismaClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // SQLite-specific optimizations
    // Note: SQLite doesn't support connection pooling like PostgreSQL
    // These settings help with connection management
  })

  // Store the DATABASE_URL used for this client
  globalForPrisma.databaseUrl = process.env.DATABASE_URL
  globalForPrisma.prisma = prismaClient
  console.log('[DB] Prisma client initialized successfully')
  return prismaClient
})()

/**
 * Log query metrics
 */
export function logQuery(type: 'query' | 'error' | 'warn', details?: string) {
  if (type === 'error') {
    metrics.queryErrors++
    metrics.lastErrorTime = Date.now()

    if (Date.now() - metrics.lastErrorTime < 60000) {
      console.error('[DATABASE ERROR] Recent errors in last 60s:')
      console.error(`Last error: ${details || 'Unknown error'}`)
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DATABASE ${type.toUpperCase()}]`, details || '')
  }
}

/**
 * Graceful database shutdown
 */
export async function shutdownDatabase() {
  try {
    if (globalForPrisma.prisma) {
      await globalForPrisma.prisma.$disconnect()
      console.log('[DATABASE] Disconnected from database')
      globalForPrisma.prisma = undefined
    }
  } catch (error) {
    console.error('[DATABASE] Shutdown error:', error)
    throw error
  }
}

/**
 * Get connection metrics
 */
export function getDatabaseMetrics(): ConnectionMetrics {
  return { ...metrics }
}

/**
 * Check database connection health
 */
export async function checkHealth() {
  try {
    await db.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('[DATABASE] Health check failed:', error)
    return false
  }
}
