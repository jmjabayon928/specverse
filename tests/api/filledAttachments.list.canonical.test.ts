import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import type { SheetAttachmentDTO } from '@/domain/datasheets/sheetTypes'

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
  requirePermission: (_permissionKey: string) => (_req: Request, _res: Response, next: NextFunction) => next(),
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
    },
  }
})

const canonicalAttachments: SheetAttachmentDTO[] = [
  {
    sheetAttachmentId: 10,
    orderIndex: 1,
    isFromTemplate: true,
    linkedFromSheetId: 42,
    cloneOnCreate: false,
    id: 100,
    originalName: 'from-template.pdf',
    storedName: 'from-template.pdf',
    contentType: 'application/pdf',
    fileSizeBytes: 1024,
    storageProvider: 'local',
    storagePath: 'attachments/from-template.pdf',
    sha256: null,
    uploadedBy: 7,
    uploadedByName: 'Template Owner',
    uploadedAt: new Date().toISOString(),
    isViewable: true,
    fileUrl: '/files/from-template.pdf',
  },
]

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
  getUserPermissions: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
  getAuditLogsForRecord: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../src/backend/services/templateService', () => ({
  addSheetAttachment: jest.fn(),
}))

jest.mock('../../src/backend/services/filledSheetService', () => {
  const listSheetAttachments = jest.fn(
    async (_sheetId: number): Promise<SheetAttachmentDTO[]> => canonicalAttachments,
  )

  return {
    fetchAllFilled: jest.fn(),
    fetchReferenceOptions: jest.fn(),
    getFilledSheetDetailsById: jest.fn(),
    createFilledSheet: jest.fn(),
    updateFilledSheet: jest.fn(),
    verifyFilledSheet: jest.fn(),
    approveFilledSheet: jest.fn(),
    doesEquipmentTagExist: jest.fn(),
    getAttachmentsForSheet: jest.fn().mockResolvedValue([]),
    deleteAttachmentById: jest.fn().mockResolvedValue(undefined),
    getNotesForSheet: jest.fn(),
    createNoteForSheet: jest.fn(),
    updateNoteForSheet: jest.fn(),
    deleteNoteForSheet: jest.fn(),
    exportPDF: jest.fn(),
    exportExcel: jest.fn(),
    listSheetAttachments,
    deleteSheetAttachmentLink: jest.fn(),
  }
})
jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: (sheetId: number, accountId: number) =>
    Promise.resolve(sheetId === 123 && accountId === 1),
}))

jest.mock('multer', () => {
  const multer = (() => ({
    single: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  })) as any

  multer.diskStorage = () => ({})
  return multer
})

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const filledSheetRoutes = require('../../src/backend/routes/filledSheetRoutes').default

  const app = express()
  app.use(cookieParser())
  app.use('/api/backend/filledsheets', filledSheetRoutes)
  return app
}

describe('Filled sheet attachments list - canonical', () => {
  it('returns canonical attachments including isFromTemplate and linkedFromSheetId by default', async () => {
    const app = buildTestApp()
    const authCookie = createAuthCookie(['DATASHEET_VIEW'])

    const res = await request(app)
      .get('/api/backend/filledsheets/123/attachments')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const first = res.body[0] as SheetAttachmentDTO
    expect(first.isFromTemplate).toBe(true)
    expect(first.linkedFromSheetId).toBe(42)
  })
})

