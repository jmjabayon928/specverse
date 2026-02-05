import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import { errorHandler } from '../../src/backend/middleware/errorHandler'
import { PERMISSIONS } from '../../src/constants/permissions'

globalThis.setImmediate ??= ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
  setTimeout(fn, 0, ...args)) as unknown as typeof setImmediate

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
    { expiresIn: '1h' }
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

const mockGetInventoryContributionFromDB = jest.fn()
jest.mock('../../src/backend/services/reportsService', () => {
  const actual = jest.requireActual('../../src/backend/services/reportsService') as Record<string, unknown>
  return {
    ...actual,
    getInventoryContributionFromDB: (...args: unknown[]) => mockGetInventoryContributionFromDB(...args),
  }
})

function buildTestApp() {
  const reportsRoutes = require('../../src/backend/routes/reportsRoutes').default
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/reports', reportsRoutes)
  app.use(errorHandler)
  return app
}

describe('GET /api/backend/reports/inventory-contribution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetInventoryContributionFromDB.mockResolvedValue([
      { categoryName: 'Pipes', items: [{ itemName: 'Steel Pipe', quantity: 100 }] },
      { categoryName: 'Valves', items: [] },
    ])
  })

  it('returns 401 when unauthenticated', async () => {
    const app = buildTestApp()
    const res = await request(app).get('/api/backend/reports/inventory-contribution')
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 and array with categoryName and items for each element', async () => {
    const app = buildTestApp()
    const authCookie = createAuthCookie([PERMISSIONS.DASHBOARD_VIEW])

    const res = await request(app)
      .get('/api/backend/reports/inventory-contribution')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    res.body.forEach((el: { categoryName: unknown; items: unknown }) => {
      expect(typeof el.categoryName).toBe('string')
      expect(Array.isArray(el.items)).toBe(true)
    })
  })

  it('returns empty items array for category with no items', async () => {
    mockGetInventoryContributionFromDB.mockResolvedValueOnce([
      { categoryName: 'Empty', items: [] },
    ])
    const app = buildTestApp()
    const authCookie = createAuthCookie([PERMISSIONS.DASHBOARD_VIEW])

    const res = await request(app)
      .get('/api/backend/reports/inventory-contribution')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].categoryName).toBe('Empty')
    expect(res.body[0].items).toEqual([])
  })
})
