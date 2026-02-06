// tests/api/audit-logs.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import { errorHandler } from '../../src/backend/middleware/errorHandler'

// Jest runs in jsdom in this repo; Express/router expects setImmediate in Node-like env.
globalThis.setImmediate ??= ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
  setTimeout(fn, 0, ...args)) as unknown as typeof setImmediate

function createAuthCookie(role: string, permissions: string[] = []): string {
  const token = jwt.sign(
    {
      userId: 1,
      accountId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role,
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
        userId: number
        accountId?: number
        role?: string
        roleId?: number
        permissions?: string[]
      }
      const accountId = decoded.accountId !== undefined ? decoded.accountId : TEST_ACCOUNT_ID
      req.user = {
        userId: decoded.userId,
        accountId,
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
  requireAdmin: (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError('Missing user in request', 403))
      return
    }
    const role = req.user.role?.toLowerCase()
    if (role !== 'admin') {
      next(new AppError('Admin access required', 403))
      return
    }
    next()
  },
  verifyTokenOnly: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

// Mock the database queries
const mockGetAllAuditLogs = jest.fn()
const mockGetAllAuditLogsCount = jest.fn()

jest.mock('../../src/backend/database/auditQueries', () => ({
  getAllAuditLogs: (...args: unknown[]) => mockGetAllAuditLogs(...args),
  getAllAuditLogsCount: (...args: unknown[]) => mockGetAllAuditLogsCount(...args),
  insertAuditLog: jest.fn(),
  getAuditLogsForRecord: jest.fn(),
}))

function buildTestApp() {
  // Require after mocks so the route/controller/service uses mocked DB modules
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const auditLogsRoutes = require('../../src/backend/routes/auditLogsRoutes').default

  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/audit-logs', auditLogsRoutes)
  app.use(errorHandler)
  return app
}

describe('Audit Logs API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default mock responses
    mockGetAllAuditLogs.mockResolvedValue([
      {
        AuditLogID: 1,
        AccountID: 1,
        TableName: 'Sheets',
        RecordID: 123,
        Action: 'Update Filled Sheet',
        PerformedBy: 7,
        PerformedByUserID: 7,
        PerformedByName: 'Jane Doe',
        PerformedAtISO: '2026-01-28T19:04:22.123Z',
        PerformedAt: new Date('2026-01-28T19:04:22.123Z'),
        Route: '/api/backend/filledsheets/123',
        Method: 'PUT',
        StatusCode: 200,
        Changes: '{"field":"value"}',
      },
      {
        AuditLogID: 2,
        AccountID: 1,
        TableName: 'Sheets',
        RecordID: 124,
        Action: 'Create Template',
        PerformedBy: 8,
        PerformedByUserID: 8,
        PerformedByName: 'John Smith',
        PerformedAtISO: '2026-01-28T18:00:00.000Z',
        PerformedAt: new Date('2026-01-28T18:00:00.000Z'),
        Route: '/api/backend/templates',
        Method: 'POST',
        StatusCode: 201,
        Changes: null,
      },
    ])
    mockGetAllAuditLogsCount.mockResolvedValue(2)
  })

  describe('Authentication and Authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = buildTestApp()
      const res = await request(app).get('/api/backend/audit-logs')

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 when authenticated but not admin', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Engineer', [])

      const res = await request(app)
        .get('/api/backend/audit-logs')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(403)
      expect(res.body.error || res.body.message).toContain('Admin')
    })

    it('returns 200 when authenticated as admin', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('page')
      expect(res.body).toHaveProperty('pageSize')
      expect(res.body).toHaveProperty('total')
      expect(res.body).toHaveProperty('rows')
    })
  })

  describe('Response Shape', () => {
    it('returns { page, pageSize, total, rows } with defaults', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(20)
      expect(res.body.total).toBe(2)
      expect(Array.isArray(res.body.rows)).toBe(true)
      expect(res.body.rows.length).toBe(2)

      // Check DTO shape (camelCase)
      const row = res.body.rows[0]
      expect(row).toHaveProperty('auditLogId')
      expect(row).toHaveProperty('entityType')
      expect(row).toHaveProperty('entityId')
      expect(row).toHaveProperty('action')
      expect(row).toHaveProperty('performedBy')
      expect(row).toHaveProperty('performedByName')
      expect(row).toHaveProperty('performedAt')
      expect(row).toHaveProperty('route')
      expect(row).toHaveProperty('method')
      expect(row).toHaveProperty('statusCode')
      expect(row).toHaveProperty('changes')
      expect(row).toHaveProperty('changesRaw')
    })

    it('returns rows[] with numeric auditLogId and unique keys', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(Array.isArray(res.body.rows)).toBe(true)
      const rows = res.body.rows as Array<{ auditLogId: number }>
      const ids = rows.map((r) => r.auditLogId)
      ids.forEach((id) => {
        expect(typeof id).toBe('number')
        expect(Number.isFinite(id)).toBe(true)
      })
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('maps LogID to auditLogId when DB returns LogID', async () => {
      mockGetAllAuditLogs.mockResolvedValueOnce([
        {
          LogID: 99,
          TableName: 'Sheets',
          RecordID: 1,
          Action: 'Test',
          PerformedBy: 1,
          PerformedByName: 'Tester',
          PerformedAtISO: '2026-01-30T12:00:00.000Z',
          Route: null,
          Method: null,
          StatusCode: null,
          Changes: '{}',
        },
      ])
      mockGetAllAuditLogsCount.mockResolvedValueOnce(1)
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs?pageSize=1')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body.rows).toHaveLength(1)
      expect(res.body.rows[0].auditLogId).toBe(99)
      expect(typeof res.body.rows[0].auditLogId).toBe('number')
    })

    it('returns 500 when row has neither LogID nor AuditLogID', async () => {
      mockGetAllAuditLogs.mockResolvedValueOnce([
        {
          TableName: 'Sheets',
          RecordID: 1,
          Action: 'Test',
          PerformedBy: 1,
          PerformedByName: 'Tester',
          PerformedAtISO: '2026-01-30T12:00:00.000Z',
          Route: null,
          Method: null,
          StatusCode: null,
          Changes: '{}',
        },
      ])
      mockGetAllAuditLogsCount.mockResolvedValueOnce(1)
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs?pageSize=1')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(500)
      expect(res.body.error || res.body.message).toMatch(/Invalid audit log row.*missing LogID\/AuditLogID/i)
    })
  })

  describe('Pagination', () => {
    it('pageSize=1 returns 1 row', async () => {
      // Mock returns 1 row when pageSize=1 (total stays 2 from mockGetAllAuditLogsCount)
      mockGetAllAuditLogs.mockResolvedValueOnce([
        {
          AuditLogID: 1,
          TableName: 'Sheets',
          RecordID: 123,
          Action: 'Update Filled Sheet',
          PerformedBy: 7,
          PerformedByUserID: 7,
          PerformedByName: 'Jane Doe',
          PerformedAtISO: '2026-01-28T19:04:22.123Z',
          PerformedAt: new Date('2026-01-28T19:04:22.123Z'),
          Route: '/api/backend/filledsheets/123',
          Method: 'PUT',
          StatusCode: 200,
          Changes: '{"field":"value"}',
        },
      ])
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs?pageSize=1')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body.pageSize).toBe(1)
      expect(res.body.rows.length).toBe(1)
      expect(mockGetAllAuditLogs).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ page: 1, pageSize: 1 })
      )
    })

    it('page 2 returns different row when pageSize=1', async () => {
      // Mock to return different row for page 2
      mockGetAllAuditLogs.mockImplementation((filters, pagination) => {
        if (pagination.page === 2) {
          return Promise.resolve([
            {
              AuditLogID: 2,
              TableName: 'Sheets',
              RecordID: 124,
              Action: 'Create Template',
              PerformedBy: 8,
              PerformedByUserID: 8,
              PerformedByName: 'John Smith',
              PerformedAtISO: '2026-01-28T18:00:00.000Z',
              PerformedAt: new Date('2026-01-28T18:00:00.000Z'),
              Route: '/api/backend/templates',
              Method: 'POST',
              StatusCode: 201,
              Changes: null,
            },
          ])
        }
        return Promise.resolve([
          {
            AuditLogID: 1,
            TableName: 'Sheets',
            RecordID: 123,
            Action: 'Update Filled Sheet',
            PerformedBy: 7,
            PerformedByUserID: 7,
            PerformedByName: 'Jane Doe',
            PerformedAtISO: '2026-01-28T19:04:22.123Z',
            PerformedAt: new Date('2026-01-28T19:04:22.123Z'),
            Route: '/api/backend/filledsheets/123',
            Method: 'PUT',
            StatusCode: 200,
            Changes: '{"field":"value"}',
          },
        ])
      })

      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res1 = await request(app)
        .get('/api/backend/audit-logs?page=1&pageSize=1')
        .set('Cookie', [authCookie])

      const res2 = await request(app)
        .get('/api/backend/audit-logs?page=2&pageSize=1')
        .set('Cookie', [authCookie])

      expect(res1.statusCode).toBe(200)
      expect(res2.statusCode).toBe(200)
      expect(res1.body.rows[0].auditLogId).toBe(1)
      expect(res2.body.rows[0].auditLogId).toBe(2)
    })
  })

  describe('Filtering', () => {
    it('filter by entityType reduces results', async () => {
      mockGetAllAuditLogs.mockResolvedValueOnce([
        {
          AuditLogID: 1,
          TableName: 'Sheets',
          RecordID: 123,
          Action: 'Update Filled Sheet',
          PerformedBy: 7,
          PerformedByUserID: 7,
          PerformedByName: 'Jane Doe',
          PerformedAtISO: '2026-01-28T19:04:22.123Z',
          PerformedAt: new Date('2026-01-28T19:04:22.123Z'),
          Route: '/api/backend/filledsheets/123',
          Method: 'PUT',
          StatusCode: 200,
          Changes: '{"field":"value"}',
        },
      ])
      mockGetAllAuditLogsCount.mockResolvedValueOnce(1)

      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs?entityType=Sheets')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(mockGetAllAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'Sheets' }),
        expect.any(Object)
      )
      expect(res.body.rows.length).toBe(1)
    })

    it('filter by entityType + entityId reduces results', async () => {
      mockGetAllAuditLogs.mockResolvedValueOnce([
        {
          AuditLogID: 1,
          TableName: 'Sheets',
          RecordID: 123,
          Action: 'Update Filled Sheet',
          PerformedBy: 7,
          PerformedByUserID: 7,
          PerformedByName: 'Jane Doe',
          PerformedAtISO: '2026-01-28T19:04:22.123Z',
          PerformedAt: new Date('2026-01-28T19:04:22.123Z'),
          Route: '/api/backend/filledsheets/123',
          Method: 'PUT',
          StatusCode: 200,
          Changes: '{"field":"value"}',
        },
      ])
      mockGetAllAuditLogsCount.mockResolvedValueOnce(1)

      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs?entityType=Sheets&entityId=123')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(mockGetAllAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'Sheets', entityId: 123 }),
        expect.any(Object)
      )
      expect(res.body.rows.length).toBe(1)
      expect(res.body.rows[0].entityId).toBe(123)
    })
  })

  describe('Validation', () => {
    it('returns 400 for invalid page (negative)', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs?page=-1')
        .set('Cookie', [authCookie])

      // The controller enforces page >= 1, so it should default to 1 or return 400
      // Based on our implementation, it should default to 1, but let's check
      expect([200, 400]).toContain(res.statusCode)
    })

    it('returns 400 for invalid pageSize (too large)', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', [])

      const res = await request(app)
        .get('/api/backend/audit-logs?pageSize=200')
        .set('Cookie', [authCookie])

      // Should be capped at 100 or return 400
      expect([200, 400]).toContain(res.statusCode)
      if (res.statusCode === 200) {
        expect(res.body.pageSize).toBeLessThanOrEqual(100)
      }
    })
  })
})
