// tests/api/imports.test.ts
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
import { assertUnauthenticated, assertForbidden, assertNotFound, assertValidationError } from '../helpers/httpAsserts'

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
  optionalVerifyToken: (req: Request, _res: Response, next: NextFunction) => next(),
  verifyTokenOnly: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const mockInsertImportJob = jest.fn()
const mockGetImportJobById = jest.fn()
const mockTrySetJobRunning = jest.fn()
const mockUpdateImportJob = jest.fn()
const mockInsertImportErrorsBatch = jest.fn()
const mockInsertImportError = jest.fn()
const mockInsertImportProvenanceBatch = jest.fn()
const mockInsertImportErrorsBatchInTransaction = jest.fn()
const mockInsertImportRecordProvenance = jest.fn()
const mockInsertImportUnmappedField = jest.fn()
const mockGetImportErrorsByJobId = jest.fn()
const mockGetImportUnmappedFieldsByJobId = jest.fn()
const mockGetCustomFieldDefinitionByAccountAndKey = jest.fn()
const mockUpsertCustomFieldDefinition = jest.fn()
const mockUpsertCustomFieldValue = jest.fn()
const mockUpsertCustomFieldValuesBatch = jest.fn()
const mockUpsertAsset = jest.fn()
const mockGetAssetsByTagNorms = jest.fn()
const mockParseFile = jest.fn()

jest.mock('../../src/backend/database/importJobQueries', () => ({
  insertImportJob: (...args: unknown[]) => mockInsertImportJob(...args),
  getImportJobById: (...args: unknown[]) => mockGetImportJobById(...args),
  trySetJobRunning: (...args: unknown[]) => mockTrySetJobRunning(...args),
  updateImportJob: (...args: unknown[]) => mockUpdateImportJob(...args),
}))

jest.mock('../../src/backend/database/importRecordQueries', () => ({
  insertImportError: (...args: unknown[]) => mockInsertImportError(...args),
  insertImportErrorsBatch: (...args: unknown[]) => mockInsertImportErrorsBatch(...args),
  insertImportProvenanceBatch: (...args: unknown[]) => mockInsertImportProvenanceBatch(...args),
  insertImportErrorsBatchInTransaction: (...args: unknown[]) => mockInsertImportErrorsBatchInTransaction(...args),
  insertImportRecordProvenance: (...args: unknown[]) => mockInsertImportRecordProvenance(...args),
  insertImportUnmappedField: (...args: unknown[]) => mockInsertImportUnmappedField(...args),
  getImportErrorsByJobId: (...args: unknown[]) => mockGetImportErrorsByJobId(...args),
  getImportUnmappedFieldsByJobId: (...args: unknown[]) => mockGetImportUnmappedFieldsByJobId(...args),
}))

jest.mock('../../src/backend/database/customFieldQueries', () => ({
  getCustomFieldDefinitionByAccountAndKey: (...args: unknown[]) =>
    mockGetCustomFieldDefinitionByAccountAndKey(...args),
  upsertCustomFieldDefinition: (...args: unknown[]) => mockUpsertCustomFieldDefinition(...args),
  upsertCustomFieldValue: (...args: unknown[]) => mockUpsertCustomFieldValue(...args),
  upsertCustomFieldValuesBatch: (...args: unknown[]) => mockUpsertCustomFieldValuesBatch(...args),
}))

jest.mock('../../src/backend/repositories/assetsRepository', () => ({
  upsertAsset: (...args: unknown[]) => mockUpsertAsset(...args),
  getAssetsByTagNorms: (...args: unknown[]) => mockGetAssetsByTagNorms(...args),
}))

const mockValidateFile = jest.fn()
jest.mock('../../src/backend/utils/fileParser', () => ({
  parseFile: (...args: unknown[]) => mockParseFile(...args),
  validateFile: (...args: unknown[]) => mockValidateFile(...args),
  truncateSourceValue: jest.fn((v: string | null | undefined) => {
    if (!v) return null
    const str = String(v)
    if (str.length <= 2000) return str
    return str.substring(0, 2000) + '... [truncated]'
  }),
}))

const mockTransactionRequest = jest.fn()
const mockTransaction = {
  begin: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  request: jest.fn().mockReturnValue({
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockResolvedValue({ recordset: [] }),
  }),
}

const mockPoolRequest = jest.fn()
jest.mock('../../src/backend/config/db', () => ({
  poolPromise: Promise.resolve({
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] }),
    }),
  }),
  sql: {
    Transaction: jest.fn().mockImplementation(() => mockTransaction),
    Int: jest.fn(),
    NVarChar: jest.fn((len?: number) => ({ length: len })),
    MAX: Symbol('MAX'),
    DateTime2: jest.fn(),
  },
}))

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../src/backend/routes/importsRoutes')
  const router = mod.default ?? mod
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/imports', router)
  app.use(errorHandler)
  return app
}

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

function defaultImportJobRow(overrides: Partial<{
  ImportJobID: number
  AccountID: number
  JobStatus: string
  ParamsJson: string | null
}> = {}) {
  return {
    ImportJobID: 123,
    AccountID: 1,
    JobStatus: 'preview_complete',
    JobMode: 'preview',
    SourceFileName: 'test.xlsx',
    SourceFileSha256: 'abc123',
    StartedByUserID: 1,
    StartedAt: null as Date | null,
    CompletedAt: null as Date | null,
    TotalRows: 2,
    CreatedCount: null as number | null,
    UpdatedCount: null as number | null,
    SkippedCount: null as number | null,
    ErrorCount: null as number | null,
    ParamsJson: JSON.stringify({
      rows: [
        { rowIndex: 2, data: { 'AssetTag': 'PT-001', 'AssetName': 'Pressure Transmitter' } },
        { rowIndex: 3, data: { 'AssetTag': 'PT-002', 'AssetName': 'Pressure Transmitter 2' } },
      ],
      headers: ['AssetTag', 'AssetName'],
      fileHash: 'abc123',
    }),
    ErrorSummary: null as string | null,
    CreatedAt: new Date(),
    UpdatedAt: null as Date | null,
    ...overrides,
  }
}

describe('Imports API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAssetsByTagNorms.mockResolvedValue(new Map())
    mockGetImportErrorsByJobId.mockResolvedValue([])
    mockGetImportUnmappedFieldsByJobId.mockResolvedValue([])
    mockTransaction.begin.mockResolvedValue(undefined)
    mockTransaction.commit.mockResolvedValue(undefined)
    mockTransaction.rollback.mockResolvedValue(undefined)
    mockTransaction.request.mockReturnValue({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] }),
    })
  })

  describe('POST /api/backend/imports/preview', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = buildTestApp()
      const res = await request(app)
        .post('/api/backend/imports/preview')
        .attach('file', Buffer.from('test'), 'test.csv')
      assertUnauthenticated(res)
    })

    it('returns 400 when no file uploaded', async () => {
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [])
      const res = await request(app)
        .post('/api/backend/imports/preview')
        .set('Cookie', [cookie])
      expect(res.statusCode).toBe(400)
      expect(res.body.message || res.body.error).toMatch(/No file|file required/i)
    })

    it('creates preview job and returns preview data', async () => {
      const tmpDir = path.join(os.tmpdir(), 'import-test')
      await fs.mkdir(tmpDir, { recursive: true })
      const testFile = path.join(tmpDir, 'test.csv')
      await fs.writeFile(testFile, 'AssetTag,AssetName\nPT-001,Pressure Transmitter', 'utf8')

      mockParseFile.mockResolvedValue({
        rows: [
          { rowIndex: 2, data: { 'AssetTag': 'PT-001', 'AssetName': 'Pressure Transmitter' } },
        ],
        headers: ['AssetTag', 'AssetName'],
      })
      mockInsertImportJob.mockResolvedValue(123)
      mockUpdateImportJob.mockResolvedValue(undefined)
      mockInsertImportErrorsBatch.mockResolvedValue(undefined)
      mockInsertImportUnmappedField.mockResolvedValue(1)

      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/preview')
        .set('Cookie', [cookie])
        .attach('file', testFile, 'test.csv')

      await fs.unlink(testFile).catch(() => {})

      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        jobId: 123,
        preview: expect.objectContaining({
          totalRows: expect.any(Number),
          validRows: expect.any(Number),
          errors: expect.any(Array),
          sampleRows: expect.any(Array),
        }),
      })
      expect(mockInsertImportJob).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 1,
          jobStatus: 'preview_created',
          startedByUserID: 1,
        })
      )
    })

    it('returns 413 when file size exceeds limit', async () => {
      mockValidateFile.mockImplementationOnce(() => {
        throw new Error('File size exceeds maximum allowed size of 10MB')
      })
      const tmpDir = path.join(os.tmpdir(), 'import-test')
      await fs.mkdir(tmpDir, { recursive: true })
      const testFile = path.join(tmpDir, 'large.csv')
      await fs.writeFile(testFile, 'AssetTag,AssetName\nPT-001,Test', 'utf8')

      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/preview')
        .set('Cookie', [cookie])
        .attach('file', testFile, 'large.csv')

      await fs.unlink(testFile).catch(() => {})

      expect(res.statusCode).toBe(413)
      expect(res.body.message || res.body.error).toMatch(/size exceeds|maximum allowed/i)
    })

    it('returns 400 when row count exceeds limit', async () => {
      const tmpDir = path.join(os.tmpdir(), 'import-test')
      await fs.mkdir(tmpDir, { recursive: true })
      const testFile = path.join(tmpDir, 'many-rows.csv')
      // Create CSV with > 2000 rows
      const header = 'AssetTag,AssetName\n'
      const rows = Array.from({ length: 2001 }, (_, i) => `PT-${i},Test ${i}`).join('\n')
      await fs.writeFile(testFile, header + rows, 'utf8')

      mockParseFile.mockRejectedValueOnce(new Error('Row count exceeds maximum allowed rows of 2000'))

      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/preview')
        .set('Cookie', [cookie])
        .attach('file', testFile, 'many-rows.csv')

      await fs.unlink(testFile).catch(() => {})

      expect(res.statusCode).toBe(400)
      expect(res.body.message || res.body.error).toMatch(/row count|2000/i)
    })

    it('truncates oversized source values in errors', async () => {
      const tmpDir = path.join(os.tmpdir(), 'import-test')
      await fs.mkdir(tmpDir, { recursive: true })
      const testFile = path.join(tmpDir, 'test.csv')
      await fs.writeFile(testFile, 'AssetTag,AssetName\n,' + 'x'.repeat(3000), 'utf8')

      mockParseFile.mockResolvedValue({
        rows: [
          { rowIndex: 2, data: { 'AssetTag': '', 'AssetName': 'x'.repeat(3000) } },
        ],
        headers: ['AssetTag', 'AssetName'],
      })
      mockInsertImportJob.mockResolvedValue(123)
      mockInsertImportErrorsBatch.mockResolvedValue(undefined)
      mockInsertImportUnmappedField.mockResolvedValue(1)
      mockUpdateImportJob.mockResolvedValue(undefined)

      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/preview')
        .set('Cookie', [cookie])
        .attach('file', testFile, 'test.csv')

      await fs.unlink(testFile).catch(() => {})

      expect(res.statusCode).toBe(200)
      // Verify truncation was called
      expect(mockInsertImportErrorsBatch).toHaveBeenCalled()
      const errorCalls = mockInsertImportErrorsBatch.mock.calls
      if (errorCalls.length > 0 && errorCalls[0][0].length > 0) {
        const firstError = errorCalls[0][0][0]
        expect(firstError.errorMessage.length).toBeLessThanOrEqual(2000)
      }
    })
  })

  describe('POST /api/backend/imports/run', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = buildTestApp()
      const res = await request(app)
        .post('/api/backend/imports/run')
        .send({ jobId: 123 })
      assertUnauthenticated(res)
    })

    it('returns 404 when job does not exist', async () => {
      mockGetImportJobById.mockResolvedValueOnce(null)
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/run')
        .set('Cookie', [cookie])
        .send({ jobId: 999 })
      assertNotFound(res)
    })

    it('returns 404 when job belongs to different account (tenant isolation)', async () => {
      mockGetImportJobById.mockResolvedValueOnce(
        defaultImportJobRow({ AccountID: 2 })
      )
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/run')
        .set('Cookie', [cookie])
        .send({ jobId: 123 })
      assertNotFound(res)
      expect(mockUpsertAsset).not.toHaveBeenCalled()
    })

    it('returns 400 when guarded transition fails (job not preview_complete)', async () => {
      mockGetImportJobById
        .mockResolvedValueOnce(defaultImportJobRow({ AccountID: 1, JobStatus: 'preview_complete' }))
        .mockResolvedValueOnce(defaultImportJobRow({ AccountID: 1, JobStatus: 'running' }))
      mockTrySetJobRunning.mockResolvedValueOnce(0)
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/run')
        .set('Cookie', [cookie])
        .send({ jobId: 123 })
      expect(res.statusCode).toBe(400)
      expect(res.body.message || res.body.error).toMatch(/not in preview_complete/i)
    })

    it('processes import successfully (idempotency test)', async () => {
      const jobRow = defaultImportJobRow({ AccountID: 1 })
      mockGetImportJobById.mockResolvedValueOnce(jobRow)
      mockTrySetJobRunning.mockResolvedValueOnce(1)
      mockUpdateImportJob.mockResolvedValue(undefined)
      mockGetImportUnmappedFieldsByJobId.mockResolvedValueOnce([])
      mockGetImportErrorsByJobId.mockResolvedValueOnce([])
      mockUpsertAsset
        .mockResolvedValueOnce({ assetId: 100, action: 'created' })
        .mockResolvedValueOnce({ assetId: 101, action: 'created' })
      mockInsertImportProvenanceBatch.mockResolvedValue(undefined)
      mockInsertImportErrorsBatchInTransaction.mockResolvedValue(undefined)
      mockUpsertCustomFieldValuesBatch.mockResolvedValue(undefined)

      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/run')
        .set('Cookie', [cookie])
        .send({ jobId: 123, options: { skipErrors: false, createCustomFields: true } })

      expect(res.statusCode).toBe(200)
      expect(mockGetImportJobById).toHaveBeenCalledWith(123)
      expect(res.body.status).toBe('succeeded')
    })

    it('processes 500 rows with single getAssetsByTagNorms and chunked batch inserts', async () => {
      const RUN_CHUNK_SIZE = 200
      const totalRows = 500
      const rows = Array.from({ length: totalRows }, (_, i) => ({
        rowIndex: i + 2,
        data: { 'AssetTag': `PT-${i + 1}`, 'AssetName': `Asset ${i + 1}` } as Record<string, string | null>,
      }))
      const jobRow = defaultImportJobRow({
        AccountID: 1,
        ParamsJson: JSON.stringify({
          rows,
          headers: ['AssetTag', 'AssetName'],
          fileHash: 'abc123',
        }),
      })
      mockGetImportJobById.mockResolvedValueOnce(jobRow)
      mockTrySetJobRunning.mockResolvedValueOnce(1)
      mockUpdateImportJob.mockResolvedValue(undefined)
      mockGetImportUnmappedFieldsByJobId.mockResolvedValueOnce([])
      mockGetImportErrorsByJobId.mockResolvedValueOnce([])
      mockUpsertAsset.mockResolvedValue({ assetId: 1, action: 'created' })
      mockInsertImportProvenanceBatch.mockResolvedValue(undefined)
      mockInsertImportErrorsBatchInTransaction.mockResolvedValue(undefined)
      mockUpsertCustomFieldValuesBatch.mockResolvedValue(undefined)

      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/run')
        .set('Cookie', [cookie])
        .send({ jobId: 123 })

      expect(res.statusCode).toBe(200)
      expect(res.body.status).toBe('succeeded')
      expect(res.body.totalRows).toBe(totalRows)
      expect(mockGetAssetsByTagNorms).toHaveBeenCalledTimes(1)
      const expectedChunks = Math.ceil(totalRows / RUN_CHUNK_SIZE)
      expect(mockInsertImportProvenanceBatch).toHaveBeenCalledTimes(expectedChunks)
      expect(mockInsertImportErrorsBatchInTransaction).toHaveBeenCalledTimes(expectedChunks)
      expect(mockUpsertCustomFieldValuesBatch).toHaveBeenCalledTimes(expectedChunks)
    })

    it('returns 400 on second run (double-run guard)', async () => {
      const jobRow = defaultImportJobRow({ AccountID: 1 })
      mockGetImportJobById
        .mockResolvedValueOnce(jobRow)
        .mockResolvedValueOnce(defaultImportJobRow({ AccountID: 1, JobStatus: 'succeeded' }))
        .mockResolvedValueOnce(defaultImportJobRow({ AccountID: 1, JobStatus: 'succeeded' }))
      mockTrySetJobRunning.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
      mockUpdateImportJob.mockResolvedValue(undefined)
      mockGetImportUnmappedFieldsByJobId.mockResolvedValue([])
      mockGetImportErrorsByJobId.mockResolvedValue([])
      mockUpsertAsset.mockResolvedValue({ assetId: 100, action: 'created' })
      mockInsertImportProvenanceBatch.mockResolvedValue(undefined)
      mockInsertImportErrorsBatchInTransaction.mockResolvedValue(undefined)
      mockUpsertCustomFieldValuesBatch.mockResolvedValue(undefined)
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const run = () =>
        request(app)
          .post('/api/backend/imports/run')
          .set('Cookie', [cookie])
          .send({ jobId: 123 })
      const first = await run()
      expect(first.statusCode).toBe(200)
      const second = await run()
      expect(second.statusCode).toBe(400)
      expect(second.body.message || second.body.error).toMatch(/not in preview_complete/i)
    })

    it('handles skipErrors=true and continues on errors', async () => {
      const jobRow = defaultImportJobRow({ AccountID: 1 })
      mockGetImportJobById.mockResolvedValueOnce(jobRow)
      mockTrySetJobRunning.mockResolvedValueOnce(1)
      mockGetImportErrorsByJobId.mockResolvedValueOnce([
        { ImportErrorID: 1, AccountID: 1, ImportJobID: 123, SourceRowNumber: 2, SourceColumnName: 'AssetTag', SourceValue: null, ErrorCode: 'REQUIRED', ErrorMessage: 'Required', Severity: 'error', CreatedAt: new Date() },
      ])
      mockGetImportUnmappedFieldsByJobId.mockResolvedValueOnce([])
      mockUpdateImportJob.mockResolvedValue(undefined)
      mockUpsertAsset.mockResolvedValue({ assetId: 100, action: 'created' })
      mockInsertImportProvenanceBatch.mockResolvedValue(undefined)
      mockInsertImportErrorsBatchInTransaction.mockResolvedValue(undefined)
      mockUpsertCustomFieldValuesBatch.mockResolvedValue(undefined)

      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/run')
        .set('Cookie', [cookie])
        .send({ jobId: 123, options: { skipErrors: true } })

      expect(mockGetImportErrorsByJobId).toHaveBeenCalledWith(123, 1)
      expect(res.statusCode).toBe(200)
    })

    it('returns 404 when trySetJobRunning returns 0 and job no longer exists', async () => {
      mockGetImportJobById.mockResolvedValueOnce(defaultImportJobRow({ AccountID: 1 }))
      mockTrySetJobRunning.mockResolvedValueOnce(0)
      mockGetImportJobById.mockResolvedValueOnce(null)
      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/run')
        .set('Cookie', [cookie])
        .send({ jobId: 123 })
      assertNotFound(res)
    })

    it('returns 400 when preview data is missing (determinism guard)', async () => {
      const jobRow = defaultImportJobRow({
        AccountID: 1,
        ParamsJson: JSON.stringify({
          fileName: 'test.xlsx',
          fileHash: 'abc123',
          // Missing rows
        }),
      })
      mockGetImportJobById.mockResolvedValueOnce(jobRow)

      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/run')
        .set('Cookie', [cookie])
        .send({ jobId: 123 })

      expect(res.statusCode).toBe(400)
      expect(res.body.message || res.body.error).toMatch(/No rows|Preview data/i)
    })

    it('returns 400 when fileHash is missing (sanity guard)', async () => {
      const jobRow = defaultImportJobRow({
        AccountID: 1,
        ParamsJson: JSON.stringify({
          fileName: 'test.xlsx',
          rows: [{ rowIndex: 2, data: { AssetTag: 'PT-001' } }],
          headers: ['AssetTag'],
          // Missing fileHash
        }),
      })
      mockGetImportJobById.mockResolvedValueOnce(jobRow)

      const app = buildTestApp()
      const cookie = createAuthCookie(1, 'Engineer', [], 1)
      const res = await request(app)
        .post('/api/backend/imports/run')
        .set('Cookie', [cookie])
        .send({ jobId: 123 })

      expect(res.statusCode).toBe(400)
      expect(res.body.message || res.body.error).toMatch(/file hash|missing/i)
    })
  })
})
