import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import type { Request, Response, NextFunction } from 'express'
import { PERMISSIONS } from '../../src/constants/permissions'
import { AppError } from '../../src/backend/errors/AppError'

// Jest runs in jsdom in this repo; Express/router expects setImmediate in Node-like env.
// Reuse the same polyfill pattern as other API route tests.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
globalThis.setImmediate ??=
  ((fn: (...args: any[]) => void, ...args: any[]) =>
    // eslint-disable-next-line no-new-func
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

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
  getAuditLogsForRecord: jest.fn().mockResolvedValue([]),
}))

// Always allow permission checks to pass in these focused header tests.
jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

// Mock filled sheet export service so we don't touch the real database or filesystem.
jest.mock('../../src/backend/services/filledSheetService', () => {
  const exportsDir = path.resolve(process.cwd(), 'public', 'exports')
  const dummyPath = path.join(exportsDir, 'sheet_9.pdf')

  return {
    exportPDF: jest.fn().mockResolvedValue({
      filePath: dummyPath,
      fileName: 'FilledSheet-Client-Sample-RevNo-1-SI-eng.pdf',
    }),
    exportExcel: jest.fn().mockResolvedValue({
      filePath: path.join(exportsDir, 'sheet_9.xlsx'),
      fileName: 'FilledSheet-Client-Sample-RevNo-1-SI-eng.xlsx',
    }),
  }
})

// Mock template export service similarly.
jest.mock('../../src/backend/services/templateService', () => {
  const exportsDir = path.resolve(process.cwd(), 'public', 'exports')
  const dummyPdf = path.join(exportsDir, 'template_1.pdf')
  const dummyXlsx = path.join(exportsDir, 'template_1.xlsx')

  return {
    exportTemplatePDF: jest.fn().mockResolvedValue({
      filePath: dummyPdf,
      fileName: 'Template-Client-Sample-RevNo-1-SI-eng.pdf',
    }),
    exportTemplateExcel: jest.fn().mockResolvedValue({
      filePath: dummyXlsx,
      fileName: 'Template-Client-Sample-RevNo-1-SI-eng.xlsx',
    }),
  }
})

function buildFilledExportApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const filledRoutes = require('../../src/backend/routes/filledSheetRoutes').default

  const app = express()
  app.use(cookieParser())
  app.use('/api/backend/filledsheets', filledRoutes)
  return app
}

function buildTemplateExportApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const templateRoutes = require('../../src/backend/routes/templateRoutes').default

  const app = express()
  app.use(cookieParser())
  app.use('/api/backend/templates', templateRoutes)
  return app
}

describe('Export headers', () => {
  it('sets Content-Disposition filename for filled sheet Excel export', async () => {
    const app = buildFilledExportApp()
    const authCookie = createAuthCookie(['PERMISSIONS.DATASHEET_VIEW', PERMISSIONS.DATASHEET_EXPORT])

    const res = await request(app)
      .get('/api/backend/filledsheets/export/123/excel?uom=SI&lang=eng')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    const disposition = res.header['content-disposition'] ?? ''
    expect(disposition).toContain('attachment')
    expect(disposition).toMatch(/filename\*\=UTF-8''/i)
  })

  it('sets Content-Disposition filename for template PDF export', async () => {
    const app = buildTemplateExportApp()
    const authCookie = createAuthCookie(['PERMISSIONS.DATASHEET_VIEW', PERMISSIONS.DATASHEET_EXPORT])

    const res = await request(app)
      .get('/api/backend/templates/export/456/pdf?uom=SI&lang=eng')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    const disposition = res.header['content-disposition'] ?? ''
    expect(disposition).toContain('attachment')
    expect(disposition).toMatch(/filename\*\=UTF-8''/i)
  })
})

