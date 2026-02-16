/**
 * Phase 2 integration: Rejected sheet — POST valueset succeeds and bumpRejectedToModifiedDraftFilled is called.
 * Real route + controller + valueSetService + valueSetQueries; mock only db (poolPromise), sheetAccessService, filledSheetService (details + bump spy).
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import { PERMISSIONS } from '../../src/constants/permissions'

type ReqWithUser = Request & {
  user?: { userId: number; roleId: number; role: string; permissions: string[]; accountId: number }
}

globalThis.setImmediate ??= ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
  setTimeout(fn, 0, ...args)) as unknown as typeof setImmediate

const TEST_ACCOUNT_ID = 1
const testSheetId = 42

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

const FILLED_PERMISSIONS = [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT]
process.env.JWT_SECRET ??= 'secret'

const queryLog: string[] = []
const mockRequest = {
  input(_name: string, _type: unknown, _value: unknown) {
    return this
  },
  async query(sql: string) {
    queryLog.push(sql)
    if (sql.includes('ValueContexts') && sql.includes('ContextID')) {
      return { recordset: [{ ContextID: 1 }] }
    }
    if (sql.includes('INSERT') && sql.includes('InformationValueSets') && sql.includes('OUTPUT')) {
      return { recordset: [{ ValueSetID: 1 }] }
    }
    return { recordset: [] }
  },
}
const mockPool = {
  request() {
    return mockRequest
  },
}

const mockSheetBelongsToAccount = jest.fn().mockResolvedValue(true)
const mockGetFilledSheetDetailsById = jest.fn()
const mockBumpRejectedToModifiedDraftFilled = jest.fn().mockResolvedValue(undefined)

jest.mock('../../src/backend/config/db', () => {
  const mssql = require('mssql')
  return {
    poolPromise: Promise.resolve(mockPool),
    sql: mssql,
    dbConfig: {},
  }
})

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: (...args: unknown[]) => mockSheetBelongsToAccount(...args),
}))

jest.mock('../../src/backend/services/filledSheetService', () => ({
  fetchAllFilled: jest.fn(),
  fetchReferenceOptions: jest.fn(),
  getFilledSheetDetailsById: (...args: unknown[]) => mockGetFilledSheetDetailsById(...args),
  createFilledSheet: jest.fn(),
  updateFilledSheet: jest.fn(),
  verifyFilledSheet: jest.fn(),
  approveFilledSheet: jest.fn(),
  bumpRejectedToModifiedDraftFilled: (...args: unknown[]) => mockBumpRejectedToModifiedDraftFilled(...args),
  doesEquipmentTagExist: jest.fn(),
  getFilledSheetTemplateId: jest.fn(),
  getLatestApprovedTemplateId: jest.fn(),
  getAttachmentsForSheet: jest.fn(),
  deleteAttachmentById: jest.fn(),
  listSheetAttachments: jest.fn(),
  deleteSheetAttachmentLink: jest.fn(),
  getNotesForSheet: jest.fn(),
  createNoteForSheet: jest.fn(),
  updateNoteForSheet: jest.fn(),
  deleteNoteForSheet: jest.fn(),
  exportPDF: jest.fn(),
  exportExcel: jest.fn(),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
  getUserPermissions: jest.fn().mockResolvedValue([]),
}))

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
      ;(req as ReqWithUser).user = {
        userId: decoded.userId,
        roleId: 1,
        role: 'Admin',
        permissions: decoded.permissions ?? [PERMISSIONS.DATASHEET_EDIT],
        accountId,
      }
      next()
    } catch {
      next(new AppError('Invalid or expired session', 403))
    }
  },
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalVerifyToken: (_req: Request, _res: Response, next: NextFunction) => next(),
  verifyTokenOnly: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

function toHttpError(err: unknown): { statusCode: number; message: string } {
  const statusCode =
    err != null &&
    typeof err === 'object' &&
    'statusCode' in err &&
    typeof (err as Record<string, unknown>).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 500
  let message = 'Internal Server Error'
  if (err instanceof Error) message = err.message
  else if (err != null && typeof err === 'object' && 'message' in err && typeof (err as Record<string, unknown>).message === 'string') {
    message = (err as { message: string }).message
  }
  return { statusCode, message }
}

function buildTestApp(): express.Application {
  const sheetRoutes = require('../../src/backend/routes/sheetRoutes').default
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/sheets', sheetRoutes)
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const httpErr = toHttpError(err)
    res.status(httpErr.statusCode).json({ error: httpErr.message })
  })
  return app
}

describe('Rejected sheet: POST valueset succeeds and bump is called', () => {
  const authCookie = createAuthCookie(FILLED_PERMISSIONS)

  beforeEach(() => {
    jest.clearAllMocks()
    queryLog.length = 0
    mockSheetBelongsToAccount.mockResolvedValue(true)
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { status: 'Rejected', sheetId: testSheetId },
    })
    mockBumpRejectedToModifiedDraftFilled.mockResolvedValue(undefined)
  })

  it('POST Requirement valueset returns 201 and bumpRejectedToModifiedDraftFilled is called', async () => {
    const app = buildTestApp()
    const res = await request(app)
      .post(`/api/backend/sheets/${testSheetId}/valuesets`)
      .set('Cookie', [authCookie])
      .send({ context: 'Requirement' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('valueSetId', 1)
    expect(res.body.context).toBe('Requirement')

    expect(mockBumpRejectedToModifiedDraftFilled).toHaveBeenCalledWith(testSheetId, 1)
    const insertQueries = queryLog.filter(q => q.includes('INSERT') && q.includes('InformationValueSets'))
    expect(insertQueries.length).toBeGreaterThanOrEqual(1)
  })
})
