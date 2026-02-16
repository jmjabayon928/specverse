/**
 * Phase 2 correctness: Revision restore - Draft succeeds; Approved/Verified blocked 409; cross-account 404.
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

const validRestoreSnapshot = {
  sheetName: 'Test Sheet',
  sheetDesc: 'Test Desc',
  clientDocNum: 1,
  clientProjectNum: 1,
  companyDocNum: 1,
  companyProjectNum: 1,
  areaId: 1,
  packageName: 'Test Package',
  revisionNum: 1,
  revisionDate: '2026-01-01',
  preparedById: 1,
  preparedByDate: '2026-01-01',
  itemLocation: 'Test Location',
  requiredQty: 1,
  equipmentName: 'Test Equipment',
  equipmentTagNum: 'TAG-001',
  serviceName: 'Test Service',
  manuId: 1,
  suppId: 1,
  equipSize: 1,
  categoryId: 1,
  clientId: 1,
  projectId: 1,
  subsheets: [
    {
      name: 'Test Subsheet',
      fields: [
        {
          id: 1,
          label: 'Test Field',
          infoType: 'varchar' as const,
          sortOrder: 0,
          required: false,
          value: 'Test Value',
        },
      ],
    },
  ],
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

const FILLED_PERMISSIONS = [
  PERMISSIONS.DATASHEET_VIEW,
  PERMISSIONS.DATASHEET_EDIT,
  PERMISSIONS.DATASHEET_VERIFY,
  PERMISSIONS.DATASHEET_APPROVE,
]

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
const mockUpdateFilledSheet = jest.fn()
const mockGetFilledSheetDetailsById = jest.fn()
const mockCreateRevision = jest.fn()
const mockSheetBelongsToAccount = jest.fn()

jest.mock('../../src/backend/database/sheetRevisionQueries', () => ({
  ...jest.requireActual<typeof import('../../src/backend/database/sheetRevisionQueries')>(
    '../../src/backend/database/sheetRevisionQueries'
  ),
  listRevisionsPaged: (...args: unknown[]) => mockListRevisionsPaged(...args),
  getRevisionById: (...args: unknown[]) => mockGetRevisionById(...args),
  createRevision: (...args: unknown[]) => mockCreateRevision(...args),
  getNextRevisionNumber: jest.fn().mockResolvedValue(1),
}))

jest.mock('../../src/backend/services/filledSheetService', () => ({
  updateFilledSheet: (...args: unknown[]) => mockUpdateFilledSheet(...args),
  getFilledSheetDetailsById: (...args: unknown[]) => mockGetFilledSheetDetailsById(...args),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: (sheetId: number, accountId: number) =>
    mockSheetBelongsToAccount(sheetId, accountId),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../src/backend/config/db', () => {
  const MockTransaction = class {
    begin = () => Promise.resolve()
    commit = () => Promise.resolve()
    rollback = () => Promise.resolve()
  }
  return {
    poolPromise: Promise.resolve({}),
    sql: {
      Transaction: MockTransaction,
      Int: 1,
      NVarChar: (n: number) => n,
      MAX: 9999,
      DateTime2: () => 0,
      Date: () => 0,
    },
  }
})

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

describe('Filled sheet revision restore', () => {
  const authCookie = createAuthCookie(FILLED_PERMISSIONS)

  beforeEach(() => {
    jest.clearAllMocks()
    mockSheetBelongsToAccount.mockResolvedValue(true)
    mockListRevisionsPaged.mockResolvedValue({ total: 1, rows: [] })
    mockGetRevisionById.mockResolvedValue({
      revisionId: mockRevisionId,
      revisionNumber: 1,
      createdAt: new Date(),
      createdBy: 1,
      createdByName: 'Test User',
      status: 'Draft',
      comment: null,
      snapshot: validRestoreSnapshot,
      systemRevisionNum: 1,
      systemRevisionAt: new Date(),
    })
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { ...validRestoreSnapshot, sheetId: testSheetId, status: 'Draft' },
    })
    mockUpdateFilledSheet.mockResolvedValue({ sheetId: testSheetId })
    mockCreateRevision.mockResolvedValue(mockRevisionId + 1)
  })

  it('Draft sheet restore succeeds 200 and creates new revision', async () => {
    const app = buildTestApp()
    const res = await request(app)
      .post(`/api/backend/filledsheets/${testSheetId}/revisions/${mockRevisionId}/restore`)
      .set('Cookie', [authCookie])
      .send({ comment: 'Restored' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('sheetId', testSheetId)
    expect(res.body).toHaveProperty('newRevisionId')
    expect(res.body).toHaveProperty('restoredFromRevisionId', mockRevisionId)
    expect(mockUpdateFilledSheet).toHaveBeenCalled()
    expect(mockCreateRevision).toHaveBeenCalled()
  })

  it('Approved sheet restore blocked 409', async () => {
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { ...validRestoreSnapshot, sheetId: testSheetId, status: 'Approved' },
    })
    mockUpdateFilledSheet.mockRejectedValue(
      new AppError('Filled sheet can only be edited when status is Draft, Modified Draft, or Rejected.', 409)
    )

    const app = buildTestApp()
    const res = await request(app)
      .post(`/api/backend/filledsheets/${testSheetId}/revisions/${mockRevisionId}/restore`)
      .set('Cookie', [authCookie])
      .send({ comment: 'Restore' })

    expect(res.status).toBe(409)
  })

  it('Verified sheet restore blocked 409', async () => {
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { ...validRestoreSnapshot, sheetId: testSheetId, status: 'Verified' },
    })
    mockUpdateFilledSheet.mockRejectedValue(
      new AppError('Filled sheet can only be edited when status is Draft, Modified Draft, or Rejected.', 409)
    )

    const app = buildTestApp()
    const res = await request(app)
      .post(`/api/backend/filledsheets/${testSheetId}/revisions/${mockRevisionId}/restore`)
      .set('Cookie', [authCookie])
      .send({ comment: 'Restore' })

    expect(res.status).toBe(409)
  })

  it('Cross-account restore returns 404', async () => {
    mockSheetBelongsToAccount.mockResolvedValue(false)

    const app = buildTestApp()
    const res = await request(app)
      .post(`/api/backend/filledsheets/${testSheetId}/revisions/${mockRevisionId}/restore`)
      .set('Cookie', [authCookie])
      .send({ comment: 'Restore' })

    expect(res.status).toBe(404)
    expect(mockGetRevisionById).not.toHaveBeenCalled()
  })
})
