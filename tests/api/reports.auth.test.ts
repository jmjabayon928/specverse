import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'

// Jest runs in jsdom in this repo; Express/router expects setImmediate in Node-like env.
globalThis.setImmediate ??= ((fn: (...args: any[]) => void, ...args: any[]) =>
  setTimeout(fn, 0, ...args)) as any

function createAuthCookie(permissions: string[]): string {
  const token = jwt.sign(
    {
      id: 1,
      userId: 1,
      accountId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'Admin',
      roleId: 1,
      profilePic: null,
      permissions,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' },
  )

  return `token=${token}`
}

const TEST_ACCOUNT_ID = 1

process.env.JWT_SECRET ??= 'secret'

jest.mock('../../src/backend/middleware/authMiddleware', () => ({
  verifyToken: (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.token ?? req.headers.authorization?.split(' ')[1]
    if (!token) {
      next(new AppError('Unauthorized - No token', 401))
      return
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as {
        id?: number
        userId: number
        accountId?: number
        role?: string
        roleId?: number
        permissions?: string[]
        profilePic?: string | null
      }
      const accountId = decoded.accountId !== undefined ? decoded.accountId : TEST_ACCOUNT_ID
      req.user = {
        id: decoded.id ?? decoded.userId,
        userId: decoded.userId,
        accountId,
        role: decoded.role ?? 'Engineer',
        roleId: decoded.roleId ?? 1,
        permissions: decoded.permissions ?? [],
        profilePic: decoded.profilePic ?? undefined,
      }
      next()
    } catch {
      next(new AppError('Invalid or expired session', 403))
    }
  },
  optionalVerifyToken: (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.token ?? req.headers.authorization?.split(' ')[1]
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as {
          id?: number
          userId: number
          accountId?: number
          role?: string
          roleId?: number
          permissions?: string[]
          profilePic?: string | null
        }
        const accountId = decoded.accountId !== undefined ? decoded.accountId : TEST_ACCOUNT_ID
        req.user = {
          id: decoded.id ?? decoded.userId,
          userId: decoded.userId,
          accountId,
          role: decoded.role ?? 'Engineer',
          roleId: decoded.roleId ?? 1,
          permissions: decoded.permissions ?? [],
          profilePic: decoded.profilePic ?? undefined,
        }
      } catch {
        // leave req.user unset
      }
    }
    next()
  },
  requirePermission: (permissionKey: string) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.permissions?.includes(permissionKey)) {
      next(new AppError('Permission denied', 403))
      return
    }
    next()
  },
}))

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

