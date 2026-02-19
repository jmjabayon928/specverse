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
  connectionTimeout: 30000,
  requestTimeout: 30000,
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

function shouldLogInstrumentsDebug(): boolean {
  return process.env.DEBUG_INSTRUMENTS === '1'
}

const connectWithRetry = async (
  config: sql.config,
  attemptsLeft: number,
): Promise<sql.ConnectionPool> => {
  try {
    const connectionPool = await new sql.ConnectionPool(config).connect()
    if (process.env.NODE_ENV !== 'test') {
      console.log('✅ Connected to SQL Server')
      if (shouldLogInstrumentsDebug()) {
        const effectiveConnectionTimeout = config.connectionTimeout ?? '(default)'
        const effectiveRequestTimeout = config.requestTimeout ?? '(default)'
        const effectivePoolMax = config.pool?.max ?? '(default)'
        console.log(
          `[db.ts] Pool config: encrypt=${config.options?.encrypt} trustServerCertificate=${config.options?.trustServerCertificate} ` +
          `connectionTimeout=${effectiveConnectionTimeout} requestTimeout=${effectiveRequestTimeout} ` +
          `pool.max=${effectivePoolMax}`
        )
      }
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

// Lazy pool: connect only when first used (e.g. first API request), not at import/build time.
let cachedPool: Promise<sql.ConnectionPool> | null = null

function getPool(): Promise<sql.ConnectionPool> {
  if (!cachedPool) {
    cachedPool = connectWithRetry(dbConfig, MAX_DB_CONNECT_ATTEMPTS)
  }
  return cachedPool
}

// Export a thenable so existing `await poolPromise` still works; connection happens on first use.
const poolPromise: Promise<sql.ConnectionPool> = new Proxy(
  {} as Promise<sql.ConnectionPool>,
  {
    get(_target, prop: string | symbol) {
      const p = getPool()
      const promiseObj = p as unknown as Record<string | symbol, unknown>
      const value = promiseObj[prop]

      if (typeof value === 'function') {
        return (value as (...args: unknown[]) => unknown).bind(p)
      }

      return value
    },
  },
)

export { poolPromise, dbConfig }

// Re-export mssql under a single namespace to avoid multiple imports elsewhere.
export * as sql from 'mssql'
