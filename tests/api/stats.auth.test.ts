import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'

// Jest runs in jsdom in this repo; Express/router expects setImmediate in Node-like env.
globalThis.setImmediate ??= ((fn: (...args: any[]) => void, ...args: any[]) =>
  setTimeout(fn, 0, ...args)) as any

function createAuthCookie(permissions: string[]): string {
  const token = jwt.sign(
    {
      userId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'Admin',
      profilePic: null,
      permissions,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' },
  )

  return `token=${token}`
}

process.env.JWT_SECRET ??= 'secret'

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/controllers/statsController', () => ({
  getDatasheetsByStatus: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getTemplatesCreatedOverTime: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  pendingVerificationsHandler: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  activeUsersByRoleHandler: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  inventoryStockLevels: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getEstimationTotals: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  fetchDatasheetLifecycleStats: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  fetchVerificationBottlenecks: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  fetchTemplateUsageTrends: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  fetchTeamPerformanceRadar: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  fetchFieldCompletionTrends: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
}))

function buildTestApp() {
  const statsRoutes = require('../../src/backend/routes/statsRoutes').default

  const app = express()
  app.use(cookieParser())
  app.use('/api/backend/stats', statsRoutes)
  return app
}

describe('Stats auth', () => {
  it('returns 401 when unauthenticated', async () => {
    const app = buildTestApp()
    const res = await request(app).get('/api/backend/stats/datasheets-by-status')
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 when authenticated', async () => {
    const app = buildTestApp()

    const authCookie = createAuthCookie(['DASHBOARD_VIEW'])
    const res = await request(app)
      .get('/api/backend/stats/datasheets-by-status')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
  })
})

