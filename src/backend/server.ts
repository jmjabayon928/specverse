// src/backend/server.ts
import dotenv from 'dotenv'
import app from './app'
import { poolPromise } from './config/db'

dotenv.config()

const PORT = process.env.PORT || 5000

async function startServer(): Promise<void> {
  await poolPromise

  app.listen(PORT, () => {
    console.log(`✅ Backend server running at http://localhost:${PORT}`)
  })
}

startServer().catch(err => {
  console.error('⛔ Backend startup failed:', err)
  process.exit(1)
})
