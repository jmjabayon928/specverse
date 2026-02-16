/**
 * Phase 2 correctness: Revision list and get (200, pagination, snapshot); cross-account 404.
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import { PERMISSIONS } from '../../src/constants/permissions'

const TEST_ACCOUNT_ID = 1
const testSheetId = 999
const mockRevisionId = 1001

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
      const accountId = decoded.accountId !== undefined ? decoded.accountId : TEST_ACCOUNT_ID
      req.user = {
        id: 1,
        userId: decoded.userId,
        accountId,
        role: 'Admin',
        roleId: 1,
        email: 'test@example.com',
        name: 'Test User',
        profilePic: undefined,
        permissions: decoded.permissions ?? [],
      }
      next()
    } catch {
      next(new AppError('Invalid or expired session', 403))
    }
  },
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}))

const FILLED_PERMISSIONS = [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT]

process.env.JWT_SECRET ??= 'secret'

function createAuthCookie(permissions: string[]): string {
  const token = jwt.sign(
    {
      id: 1,
      userId: 1,
      accountId: TEST_ACCOUNT_ID,
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

const mockListRevisionsPaged = jest.fn()
const mockGetRevisionById = jest.fn()
const mockSheetBelongsToAccount = jest.fn()

jest.mock('../../src/backend/database/sheetRevisionQueries', () => ({
  ...jest.requireActual<typeof import('../../src/backend/database/sheetRevisionQueries')>(
    '../../src/backend/database/sheetRevisionQueries'
  ),
  listRevisionsPaged: (...args: unknown[]) => mockListRevisionsPaged(...args),
  getRevisionById: (...args: unknown[]) => mockGetRevisionById(...args),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: (sheetId: number, accountId: number) =>
    mockSheetBelongsToAccount(sheetId, accountId),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const filledSheetRoutes = require('../../src/backend/routes/filledSheetRoutes').default
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { errorHandler } = require('../../src/backend/middleware/errorHandler')
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/filledsheets', filledSheetRoutes)
  app.use(errorHandler)
  return app
}

describe('Filled sheet revisions list and get', () => {
  const authCookie = createAuthCookie(FILLED_PERMISSIONS)

  beforeEach(() => {
    jest.clearAllMocks()
    mockSheetBelongsToAccount.mockImplementation((sheetId: number, accountId: number) =>
      Promise.resolve(sheetId === testSheetId && accountId === TEST_ACCOUNT_ID)
    )
    mockListRevisionsPaged.mockResolvedValue({
      total: 1,
      rows: [
        {
          revisionId: mockRevisionId,
          revisionNumber: 1,
          createdAt: new Date(),
          createdBy: 1,
          createdByName: 'Test User',
          status: 'Draft',
          comment: null,
          systemRevisionNum: 1,
          systemRevisionAt: new Date(),
        },
      ],
    })
    mockGetRevisionById.mockResolvedValue({
      revisionId: mockRevisionId,
      revisionNumber: 1,
      createdAt: new Date(),
      createdBy: 1,
      createdByName: 'Test User',
      status: 'Draft',
      comment: null,
      snapshot: { sheetName: 'Test', subsheets: [] },
      systemRevisionNum: 1,
      systemRevisionAt: new Date(),
    })
  })

  it('GET /revisions returns 200 with pagination fields', async () => {
    const app = buildTestApp()
    const res = await request(app)
      .get(`/api/backend/filledsheets/${testSheetId}/revisions?page=1&pageSize=20`)
      .set('Cookie', [authCookie])

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('page')
    expect(res.body).toHaveProperty('pageSize')
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('rows')
    expect(Array.isArray(res.body.rows)).toBe(true)
    expect(mockListRevisionsPaged).toHaveBeenCalledWith(testSheetId, 1, 20)
  })

  it('GET /revisions/:revisionId returns 200 with snapshot', async () => {
    const app = buildTestApp()
    const res = await request(app)
      .get(`/api/backend/filledsheets/${testSheetId}/revisions/${mockRevisionId}`)
      .set('Cookie', [authCookie])

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('revisionId')
    expect(res.body).toHaveProperty('snapshot')
    expect(typeof res.body.snapshot).toBe('object')
    expect(mockGetRevisionById).toHaveBeenCalledWith(testSheetId, mockRevisionId)
  })

  it('Cross-account list returns 404', async () => {
    mockSheetBelongsToAccount.mockResolvedValue(false)

    const app = buildTestApp()
    const res = await request(app)
      .get(`/api/backend/filledsheets/${testSheetId}/revisions`)
      .set('Cookie', [authCookie])

    expect(res.status).toBe(404)
    expect(mockListRevisionsPaged).not.toHaveBeenCalled()
  })

  it('Cross-account get revision returns 404', async () => {
    mockSheetBelongsToAccount.mockResolvedValue(false)

    const app = buildTestApp()
    const res = await request(app)
      .get(`/api/backend/filledsheets/${testSheetId}/revisions/${mockRevisionId}`)
      .set('Cookie', [authCookie])

    expect(res.status).toBe(404)
    expect(mockGetRevisionById).not.toHaveBeenCalled()
  })
})
