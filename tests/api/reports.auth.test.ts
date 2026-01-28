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

jest.mock('../../src/backend/controllers/reportsController', () => ({
  getEstimationCostBreakdown: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getVendorQuotesByEstimationId: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getEstimateVsActualByEstimationId: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getSupplierComparisonData: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getInventoryForecastData: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getInventoryContribution: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getRejectedTemplatesData: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getRejectedFilledSheetsOverTime: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getTemplateWorkflowSankey: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({ nodes: [], links: [] }),
  getFilledSheetWorkflowSankey: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({ nodes: [], links: [] }),
}))

function buildTestApp() {
  const reportsRoutes = require('../../src/backend/routes/reportsRoutes').default

  const app = express()
  app.use(cookieParser())
  app.use('/api/backend/reports', reportsRoutes)
  return app
}

describe('Reports auth', () => {
  it('returns 401 when unauthenticated', async () => {
    const app = buildTestApp()
    const res = await request(app).get('/api/backend/reports/estimation-cost')
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 when authenticated', async () => {
    const app = buildTestApp()

    const authCookie = createAuthCookie(['DASHBOARD_VIEW'])
    const res = await request(app)
      .get('/api/backend/reports/estimation-cost')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
  })
})

