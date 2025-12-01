// src/backend/config/db.ts
import sql from 'mssql'
import dotenv from 'dotenv'

dotenv.config()

// 🔍 Determine trustServerCertificate dynamically
function getTrustServerCertificate(): boolean {
  const env = process.env.HOST_ENVIRONMENT

  switch (env) {
    case 'local':
      return true
    case 'render':
    case 'vercel':
      return false
    default:
      console.warn('⚠️ Unknown HOST_ENVIRONMENT, defaulting to trustServerCertificate: true')
      return true
  }
}

const dbConfig = {
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

// ✅ Top-level await instead of promise chain
let pool: sql.ConnectionPool

try {
  pool = await new sql.ConnectionPool(dbConfig).connect()
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ Connected to SQL Server')
  }
} catch (err) {
  console.error('⛔ Database Connection Failed:', err)
  throw err
}

// Export the pool promise for backwards compatibility (if needed)
const poolPromise = Promise.resolve(pool)

export { poolPromise, dbConfig }

// ⚡ Recommended modern re-export style (fixing the warning)
export * as sql from 'mssql'
