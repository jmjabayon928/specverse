/**
 * Phase 2.5 Bundle 4 Step 1f: Layout account scoping.
 * - Cross-tenant GET layout returns 404
 * - Cross-tenant renderLayout returns 404
 * - listLayouts returns only caller account layouts
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'

process.env.JWT_SECRET ??= 'secret'

const baseUser = {
  userId: 1,
  roleId: 1,
  role: 'Admin',
  permissions: ['DATASHEET_VIEW', 'DATASHEET_EDIT'] as string[],
}

jest.mock('../../src/backend/middleware/authMiddleware', () => ({
  verifyToken: (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.token ?? req.headers.authorization?.split(' ')[1]
    if (!token) {
      next(new AppError('Unauthorized - No token', 401))
      return
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as {
        userId: number
        accountId?: number
        permissions?: string[]
      }
      req.user = {
        ...baseUser,
        userId: decoded.userId,
        accountId: decoded.accountId,
        permissions: decoded.permissions ?? baseUser.permissions,
      }
      next()
    } catch {
      next(new AppError('Invalid token', 403))
    }
  },
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalVerifyToken: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/services/layoutService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/layoutService')>(
      '../../src/backend/services/layoutService'
    )
  return {
    ...actual,
    layoutBelongsToAccount: jest.fn().mockResolvedValue(true),
    getLayoutBundle: jest.fn().mockResolvedValue({ layoutId: 1, templateId: 1 }),
    listLayouts: jest.fn().mockResolvedValue([]),
    getSheetIdBySubId: jest.fn().mockResolvedValue(1),
    getLayoutIdByRegionId: jest.fn().mockResolvedValue(1),
    getLayoutIdByBlockId: jest.fn().mockResolvedValue(1),
    renderLayout: jest.fn().mockResolvedValue({ layoutId: 1, sheetId: 1, body: [] }),
  }
})

function makeToken(payload: { userId: number; accountId?: number }) {
  return jwt.sign(
    {
      userId: payload.userId,
      email: 'test@example.com',
      role: 'Admin',
      permissions: baseUser.permissions,
      accountId: payload.accountId,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
}

const layoutService = () =>
  require('../../src/backend/services/layoutService') as typeof import('../../src/backend/services/layoutService') & {
    layoutBelongsToAccount: jest.Mock
    getLayoutBundle: jest.Mock
    listLayouts: jest.Mock
  }
const sheetAccessService = () =>
  require('../../src/backend/services/sheetAccessService') as typeof import('../../src/backend/services/sheetAccessService') & {
    sheetBelongsToAccount: jest.Mock
  }

describe('Layouts account scope (Step 1f)', () => {
  beforeEach(() => {
    layoutService().layoutBelongsToAccount.mockResolvedValue(true)
    sheetAccessService().sheetBelongsToAccount.mockResolvedValue(true)
    layoutService().listLayouts.mockResolvedValue([])
  })

  it('GET /api/backend/layouts/:layoutId returns 404 when layout is in another account', async () => {
    const token = makeToken({ userId: 1, accountId: 1 })
    layoutService().layoutBelongsToAccount.mockResolvedValue(false)

    const res = await request(app)
      .get('/api/backend/layouts/999')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(404)
    expect(res.body?.error ?? res.text).toMatch(/not found/i)
    expect(layoutService().layoutBelongsToAccount).toHaveBeenCalledWith(999, 1)
  })

  it('GET /api/backend/layouts/:layoutId/render returns 404 when sheet or layout is in another account', async () => {
    const token = makeToken({ userId: 1, accountId: 1 })
    sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

    const res = await request(app)
      .get('/api/backend/layouts/999/render?sheetId=1&uom=SI&lang=eng')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(404)
    expect(res.body?.error ?? res.text).toMatch(/not found/i)
    expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(1, 1)
  })

  it('listLayouts is called with accountId and returns only account layouts', async () => {
    const token = makeToken({ userId: 1, accountId: 42 })
    layoutService().listLayouts.mockResolvedValue([
      { LayoutID: 10, TemplateID: 1, PaperSize: 'A4', Orientation: 'portrait' },
    ])

    const res = await request(app)
      .get('/api/backend/layouts')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    expect(layoutService().listLayouts).toHaveBeenCalledWith(42, {
      templateId: null,
      clientId: null,
    })
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ LayoutID: 10 })
  })
})
