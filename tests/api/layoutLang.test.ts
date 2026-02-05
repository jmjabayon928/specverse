/**
 * Layout render accepts lang=en and lang=eng (normalized to eng).
 * @jest-environment node
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import { PERMISSIONS } from '../../src/constants/permissions'

function createAuthCookie(permissions: string[]): string {
  const token = jwt.sign(
    {
      userId: 1,
      accountId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'Admin',
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as { userId: number; accountId?: number; permissions?: string[] }
      const accountId = decoded.accountId !== undefined ? decoded.accountId : TEST_ACCOUNT_ID
      req.user = {
        userId: decoded.userId,
        accountId,
        roleId: 1,
        role: 'Admin',
        permissions: decoded.permissions ?? [PERMISSIONS.DATASHEET_VIEW],
      }
      next()
    } catch {
      next(new AppError('Invalid token', 403))
    }
  },
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalVerifyToken: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/services/layoutService', () => ({
  ...jest.requireActual('../../src/backend/services/layoutService'),
  layoutBelongsToAccount: jest.fn().mockResolvedValue(true),
  renderLayout: jest.fn().mockResolvedValue({
    layoutId: 1,
    sheetId: 1,
    uom: 'SI',
    lang: 'eng',
    header: { equipmentTag: null, equipmentName: null, project: null, fields: [] },
    body: [],
  }),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const layoutService = require('../../src/backend/services/layoutService') as {
  renderLayout: jest.Mock
}

function buildLayoutApp() {
  const layoutRoutes = require('../../src/backend/routes/layoutRoutes').default
  const authMiddleware = require('../../src/backend/middleware/authMiddleware')
  const app = express()
  app.use(cookieParser())
  app.use('/api/backend/layouts', authMiddleware.verifyToken, layoutRoutes)
  return app
}

describe('Layout render lang', () => {
  beforeEach(() => {
    layoutService.renderLayout.mockClear()
  })

  it('accepts lang=en and normalizes to eng', async () => {
    const app = buildLayoutApp()
    const res = await request(app)
      .get('/api/backend/layouts/1/render?sheetId=1&uom=SI&lang=en')
      .set('Cookie', [createAuthCookie([PERMISSIONS.DATASHEET_VIEW])])

    expect(res.status).toBe(200)
    expect(layoutService.renderLayout).toHaveBeenCalledWith(
      expect.objectContaining({ layoutId: 1, sheetId: 1, uom: 'SI', lang: 'eng' })
    )
  })

  it('accepts lang=eng', async () => {
    const app = buildLayoutApp()
    const res = await request(app)
      .get('/api/backend/layouts/1/render?sheetId=1&uom=SI&lang=eng')
      .set('Cookie', [createAuthCookie([PERMISSIONS.DATASHEET_VIEW])])

    expect(res.status).toBe(200)
    expect(layoutService.renderLayout).toHaveBeenCalledWith(
      expect.objectContaining({ layoutId: 1, sheetId: 1, uom: 'SI', lang: 'eng' })
    )
  })
})
