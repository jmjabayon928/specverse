// src/backend/config/db.ts
import sql from 'mssql'
import dotenv from 'dotenv'

dotenv.config()

const MAX_DB_CONNECT_ATTEMPTS = 3
const DB_RETRY_DELAY_MS = 2000

// Decide trustServerCertificate based on the current environment.
// In production, HOST_ENVIRONMENT must be explicitly set.
const getTrustServerCertificate = (): boolean => {
  const env = process.env.HOST_ENVIRONMENT

  if (env === 'local') {
    return true
  }

  if (env === 'render' || env === 'vercel') {
    return false
  }

  const nodeEnv = process.env.NODE_ENV

  if (nodeEnv === 'production') {
    throw new Error(
      'HOST_ENVIRONMENT must be set to "local", "render", or "vercel" when NODE_ENV=production',
    )
  }

  console.warn(
    '⚠️ HOST_ENVIRONMENT is not set or unknown, defaulting trustServerCertificate to true',
  )

  return true
}

// Strongly typed config using mssql's config interface
const dbConfig: sql.config = {
  user: process.env.DB_USER ?? '',
  password: process.env.DB_PASSWORD ?? '',
  server: process.env.DB_SERVER ?? '',
  database: process.env.DB_DATABASE ?? '',
  options: {
    encrypt: true,
    enableArithAbort: true,
    trustServerCertificate: getTrustServerCertificate(),
  },
}

if (!dbConfig.user || !dbConfig.password || !dbConfig.server || !dbConfig.database) {
  throw new Error('⛔ Missing required database environment variables. Check your .env file.')
}

const wait = (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

const connectWithRetry = async (
  config: sql.config,
  attemptsLeft: number,
): Promise<sql.ConnectionPool> => {
  try {
    const connectionPool = await new sql.ConnectionPool(config).connect()
    if (process.env.NODE_ENV !== 'test') {
      console.log('✅ Connected to SQL Server')
    }
    return connectionPool
  } catch (error) {
    if (attemptsLeft <= 1) {
      console.error('⛔ Database connection failed after multiple attempts:', error)
      throw error
    }

    const attemptNumber = MAX_DB_CONNECT_ATTEMPTS - attemptsLeft + 1
    console.warn(
      `⚠️ Database connection failed (attempt ${attemptNumber}), retrying in ${DB_RETRY_DELAY_MS}ms`,
    )

    await wait(DB_RETRY_DELAY_MS)
    return connectWithRetry(config, attemptsLeft - 1)
  }
}

// Keep a promise-based export for existing callers that expect poolPromise.
// NOTE: No top-level await (tsx/esbuild CJS limitation). Callers can `await poolPromise`.
const poolPromise: Promise<sql.ConnectionPool> = connectWithRetry(
  dbConfig,
  MAX_DB_CONNECT_ATTEMPTS,
)

export { poolPromise, dbConfig }

// Re-export mssql under a single namespace to avoid multiple imports elsewhere.
export * as sql from 'mssql'
