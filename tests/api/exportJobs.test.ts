// tests/api/exportJobs.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import { errorHandler } from '../../src/backend/middleware/errorHandler'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret'

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
        role?: string
        roleId?: number
        permissions?: string[]
      }
      req.user = {
        userId: decoded.userId,
        ...(decoded.accountId !== undefined && { accountId: decoded.accountId }),
        role: decoded.role ?? 'Engineer',
        roleId: decoded.roleId ?? 1,
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
  requirePermission: (permissionKey: string) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.permissions?.includes(permissionKey)) {
      next(new AppError('Permission denied', 403))
      return
    }
    next()
  },
  optionalVerifyToken: (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.token ?? req.headers.authorization?.split(' ')[1]
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as {
          userId: number
          accountId?: number
          role?: string
          roleId?: number
          permissions?: string[]
        }
        req.user = {
          userId: decoded.userId,
          ...(decoded.accountId !== undefined && { accountId: decoded.accountId }),
          role: decoded.role ?? 'Engineer',
          roleId: decoded.roleId ?? 1,
          email: 'test@example.com',
          name: 'Test User',
          profilePic: undefined,
          permissions: decoded.permissions ?? [],
        }
      } catch {
        // leave req.user unset
      }
    }
    next()
  },
  verifyTokenOnly: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

globalThis.setImmediate ??= ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
  setTimeout(fn, 0, ...args)) as unknown as typeof setImmediate

/** Builds an authenticated cookie; always includes accountId (default 1) so the auth mock sets req.user.accountId. */
function createAuthCookie(
  userId: number,
  role: string,
  permissions: string[] = [],
  accountId: number = 1
): string {
  const token = jwt.sign(
    {
      id: userId,
      userId,
      accountId,
      email: 'test@example.com',
      fullName: 'Test User',
      role,
      roleId: 1,
      profilePic: null,
      permissions,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
  return `token=${token}`
}

const mockInsertExportJob = jest.fn()
const mockGetExportJobById = jest.fn()
const mockUpdateExportJobResetForRetry = jest.fn()
const mockGetInventoryTransactionsPaged = jest.fn()
const mockResolveExportFilePath = jest.fn()
const mockCancelExportJob = jest.fn()
const mockCleanupExpiredExportJobs = jest.fn()

jest.mock('../../src/backend/database/exportJobQueries', () => ({
  insertExportJob: (...args: unknown[]) => mockInsertExportJob(...args),
  getExportJobById: (...args: unknown[]) => mockGetExportJobById(...args),
  updateExportJobRunning: jest.fn(),
  updateExportJobCompleted: jest.fn(),
  updateExportJobFailed: jest.fn(),
  updateExportJobCancelled: jest.fn(),
  updateExportJobResetForRetry: (...args: unknown[]) =>
    mockUpdateExportJobResetForRetry(...args),
  listExportJobsForCleanup: jest.fn(),
}))

jest.mock('../../src/backend/database/inventoryTransactionQueries', () => ({
  getInventoryTransactionsPaged: (...args: unknown[]) =>
    mockGetInventoryTransactionsPaged(...args),
  getInventoryTransactionsForCsv: jest.fn(),
  getInventoryTransactions: jest.fn(),
  addInventoryTransaction: jest.fn(),
  getAllInventoryTransactions: jest.fn(),
  getAllInventoryMaintenanceLogs: jest.fn(),
  getAllInventoryAuditLogs: jest.fn(),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn((userId: number, _permissionKey: string) => {
    if (userId === 1) return Promise.resolve(true)
    return Promise.resolve(false)
  }),
}))

jest.mock('../../src/backend/services/exportJobService', () => {
  const actual = jest.requireActual(
    '../../src/backend/services/exportJobService'
  ) as Record<string, unknown>
  return {
    ...actual,
    resolveExportFilePath: (...args: unknown[]) =>
      mockResolveExportFilePath(...args),
    cancelExportJob: (...args: unknown[]) => mockCancelExportJob(...args),
    cleanupExpiredExportJobs: (...args: unknown[]) =>
      mockCleanupExpiredExportJobs(...args),
  }
})

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../src/backend/routes/exportJobsRoutes')
  const router = mod.default ?? mod
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/exports/jobs', router)
  app.use(errorHandler)
  return app
}

function defaultJobRow(overrides: Partial<{
  Id: number
  CreatedBy: number
  Status: string
  FilePath: string | null
  FileName: string | null
  ExpiresAt: Date | null
  ErrorMessage: string | null
  CompletedAt: Date | null
}> = {}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return {
    Id: 123,
    JobType: 'inventory_transactions_csv',
    Status: 'queued',
    Progress: 0,
    ParamsJson: '{}',
    CreatedBy: 1,
    CreatedAt: now,
    StartedAt: null as Date | null,
    CompletedAt: null as Date | null,
    ExpiresAt: expiresAt,
    ErrorMessage: null as string | null,
    FileName: null as string | null,
    FilePath: null as string | null,
    ...overrides,
  }
}

describe('Export Jobs API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetInventoryTransactionsPaged.mockResolvedValue({ total: 100, rows: [] })
    mockInsertExportJob.mockResolvedValue(123)
    mockGetExportJobById.mockResolvedValue(defaultJobRow())
  })

  describe('POST /api/backend/exports/jobs', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = buildTestApp()
      const res = await request(app)
        .post('/api/backend/exports/jobs')
        .send({ jobType: 'inventory_transactions_csv', params: {} })
      expect(res.statusCode).toBe(401)
    })

    it('returns 403 when authenticated without INVENTORY_VIEW', async () => {
      const app = buildTestApp()
      const cookie = createAuthCookie(2, 'Viewer', [])
      const res = await request(app)
        .post('/api/backend/exports/jobs')
        .set('Cookie', [cookie])
        .send({ jobType: 'inventory_transactions_csv', params: {} })
      expect(res.statusCode).toBe(403)
    })

    it('creates job and returns 201 with jobId when pre-check passes', async () => {
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .post('/api/backend/exports/jobs')
        .set('Cookie', [cookie])
        .send({ jobType: 'inventory_transactions_csv', params: {} })
      expect(res.statusCode).toBe(201)
      expect(res.body).toMatchObject({
        jobId: 123,
        status: 'queued',
        createdAt: expect.any(String),
      })
      expect(mockGetInventoryTransactionsPaged).toHaveBeenCalled()
      expect(mockInsertExportJob).toHaveBeenCalled()
    })

    it('returns 413 when pre-check exceeds 10k rows', async () => {
      mockGetInventoryTransactionsPaged.mockResolvedValueOnce({
        total: 10001,
        rows: [],
      })
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .post('/api/backend/exports/jobs')
        .set('Cookie', [cookie])
        .send({ jobType: 'inventory_transactions_csv', params: {} })
      expect(res.statusCode).toBe(413)
      expect(res.body.message).toContain('10,000')
      expect(mockInsertExportJob).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/backend/exports/jobs/:jobId', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = buildTestApp()
      const res = await request(app).get('/api/backend/exports/jobs/123')
      expect(res.statusCode).toBe(401)
    })

    it('returns 200 with status for owner', async () => {
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .get('/api/backend/exports/jobs/123')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        jobId: 123,
        jobType: 'inventory_transactions_csv',
        status: 'queued',
        progress: 0,
        createdAt: expect.any(String),
      })
    })

    it('returns 403 for non-owner (non-admin)', async () => {
      mockGetExportJobById.mockResolvedValueOnce(defaultJobRow({ CreatedBy: 1 }))
      const app = buildTestApp()
      const cookie = createAuthCookie(2, 'Viewer', [])
      const res = await request(app)
        .get('/api/backend/exports/jobs/123')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(403)
    })

    it('returns 200 for admin when viewing another user job', async () => {
      mockGetExportJobById.mockResolvedValueOnce(defaultJobRow({ CreatedBy: 1 }))
      const app = buildTestApp()
      const cookie = createAuthCookie(2, 'admin', [])
      const res = await request(app)
        .get('/api/backend/exports/jobs/123')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(200)
      expect(res.body.jobId).toBe(123)
    })

    it('returns 404 when job does not exist', async () => {
      mockGetExportJobById.mockResolvedValueOnce(null)
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .get('/api/backend/exports/jobs/999')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(404)
    })
  })

  describe('GET /api/backend/exports/jobs/:jobId/download', () => {
    it('returns 401 when no token and no session', async () => {
      const app = buildTestApp()
      const res = await request(app).get(
        '/api/backend/exports/jobs/123/download'
      )
      expect(res.statusCode).toBe(401)
      expect(res.body.message).toMatch(/Unauthorized|Missing/)
    })

    it('returns 403 when token jobId does not match request jobId', async () => {
      const { generateDownloadToken } = jest.requireActual<{
        generateDownloadToken: (jobId: number, userId: number) => string
      }>('../../src/backend/services/exportJobService')
      const token = generateDownloadToken(123, 1)
      const app = buildTestApp()
      const res = await request(app).get(
        `/api/backend/exports/jobs/999/download?token=${encodeURIComponent(token)}`
      )
      expect(res.statusCode).toBe(403)
      expect(res.body.message).toMatch(/Invalid|expired|Permission/)
    })

    it('returns 403 when token is valid but user is not job owner', async () => {
      const { generateDownloadToken } = jest.requireActual<{
        generateDownloadToken: (jobId: number, userId: number) => string
      }>('../../src/backend/services/exportJobService')
      const token = generateDownloadToken(123, 2)
      mockGetExportJobById.mockResolvedValueOnce(defaultJobRow({ CreatedBy: 1 }))
      const app = buildTestApp()
      const res = await request(app).get(
        `/api/backend/exports/jobs/123/download?token=${encodeURIComponent(token)}`
      )
      expect(res.statusCode).toBe(403)
      expect(res.body.message).toMatch(/Permission/)
    })

    it('returns 410 when export expired or file missing', async () => {
      mockResolveExportFilePath.mockResolvedValueOnce(null)
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .get('/api/backend/exports/jobs/123/download')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(410)
      expect(res.body.message).toMatch(/expired|no longer available/)
    })

    it('returns 200 and file when completed and not expired (session)', async () => {
      const tmpDir = path.join(os.tmpdir(), 'export-jobs-test')
      await fs.mkdir(tmpDir, { recursive: true })
      const absolutePath = path.join(tmpDir, 'inventory-transactions-123.csv')
      await fs.writeFile(absolutePath, 'Transaction ID,Item ID\n1,10', 'utf8')
      mockResolveExportFilePath.mockResolvedValueOnce({
        absolutePath,
        fileName: 'inventory-transactions-123.csv',
      })
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .get('/api/backend/exports/jobs/123/download')
        .set('Cookie', [cookie])
      await fs.unlink(absolutePath).catch(() => {})
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-disposition']).toContain(
        'inventory-transactions-123.csv'
      )
    })
  })

  describe('GET /api/backend/exports/jobs/:jobId/download-url', () => {
    it('returns downloadUrl and fileName when completed and not expired', async () => {
      mockResolveExportFilePath.mockResolvedValueOnce({
        absolutePath: '/tmp/test.csv',
        fileName: 'inventory-transactions-123.csv',
      })
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .get('/api/backend/exports/jobs/123/download-url')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        downloadUrl: expect.any(String),
        fileName: 'inventory-transactions-123.csv',
      })
      expect(res.body.downloadUrl).toContain('token=')
    })
  })

  describe('POST /api/backend/exports/jobs/:jobId/cancel', () => {
    it('returns 200 and updated status when job is queued', async () => {
      mockGetExportJobById.mockResolvedValueOnce(
        defaultJobRow({ Status: 'queued', CreatedBy: 1 })
      )
      mockCancelExportJob.mockResolvedValueOnce(true)
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .post('/api/backend/exports/jobs/123/cancel')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(200)
      expect(mockCancelExportJob).toHaveBeenCalledWith(123)
    })

    it('returns 403 for non-owner', async () => {
      mockGetExportJobById.mockResolvedValueOnce(defaultJobRow({ CreatedBy: 1 }))
      const app = buildTestApp()
      const cookie = createAuthCookie(2, 'Viewer', [])
      const res = await request(app)
        .post('/api/backend/exports/jobs/123/cancel')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(403)
      expect(mockCancelExportJob).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/backend/exports/jobs/:jobId/retry', () => {
    it('returns 404 when job does not exist', async () => {
      mockGetExportJobById.mockResolvedValueOnce(null)
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .post('/api/backend/exports/jobs/999/retry')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(404)
      expect(mockUpdateExportJobResetForRetry).not.toHaveBeenCalled()
    })

    it('returns 403 for non-owner', async () => {
      mockGetExportJobById.mockResolvedValueOnce(
        defaultJobRow({ Status: 'failed', CreatedBy: 1 })
      )
      const app = buildTestApp()
      const cookie = createAuthCookie(2, 'Viewer', [])
      const res = await request(app)
        .post('/api/backend/exports/jobs/123/retry')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(403)
      expect(mockUpdateExportJobResetForRetry).not.toHaveBeenCalled()
    })

    it('returns 400 when job is completed (not retryable)', async () => {
      mockGetExportJobById
        .mockResolvedValueOnce(
          defaultJobRow({ Status: 'completed', CreatedBy: 1 })
        )
        .mockResolvedValueOnce(
          defaultJobRow({ Status: 'completed', CreatedBy: 1 })
        )
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .post('/api/backend/exports/jobs/123/retry')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(400)
      expect(res.body.message).toMatch(/cannot be retried|only failed/)
      expect(mockUpdateExportJobResetForRetry).not.toHaveBeenCalled()
    })

    it('returns 400 when job is running (not retryable)', async () => {
      mockGetExportJobById.mockResolvedValueOnce(
        defaultJobRow({ Status: 'running', CreatedBy: 1 })
      )
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .post('/api/backend/exports/jobs/123/retry')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(400)
      expect(mockUpdateExportJobResetForRetry).not.toHaveBeenCalled()
    })

    it('returns 200 and resets job when failed and owner (real retry path)', async () => {
      const completedAt = new Date()
      const expiresAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)
      const failedRow = defaultJobRow({
        Status: 'failed',
        CreatedBy: 1,
        ErrorMessage: 'Export failed',
        FileName: 'old-export.csv',
        FilePath: 'jobs/old-export.csv',
        CompletedAt: completedAt,
        ExpiresAt: expiresAt,
      })
      const rowAfterReset = defaultJobRow({
        Status: 'queued',
        CreatedBy: 1,
      })
      mockGetExportJobById
        .mockResolvedValueOnce(failedRow)
        .mockResolvedValueOnce(failedRow)
        .mockResolvedValueOnce(rowAfterReset)
      mockUpdateExportJobResetForRetry.mockResolvedValueOnce(undefined)
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .post('/api/backend/exports/jobs/123/retry')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        jobId: 123,
        jobType: 'inventory_transactions_csv',
        status: 'queued',
      })
      expect(mockUpdateExportJobResetForRetry).toHaveBeenCalledTimes(1)
      expect(mockUpdateExportJobResetForRetry).toHaveBeenCalledWith(123)
    })
  })

  describe('POST /api/backend/exports/jobs/cleanup', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = buildTestApp()
      const res = await request(app).post('/api/backend/exports/jobs/cleanup')
      expect(res.statusCode).toBe(401)
    })

    it('returns 403 when not admin', async () => {
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [PERMISSIONS.INVENTORY_VIEW])
      const res = await request(app)
        .post('/api/backend/exports/jobs/cleanup')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(403)
    })

    it('returns 200 with deletedFiles when admin', async () => {
      mockCleanupExpiredExportJobs.mockResolvedValueOnce({ deletedFiles: 2 })
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'admin', [])
      const res = await request(app)
        .post('/api/backend/exports/jobs/cleanup')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        message: 'Cleanup completed',
        deletedFiles: 2,
      })
    })
  })
})
