/**
 * Platform admins API: auth (401/403), list (200), revoke (200/404), audit.
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { AppError } from '../../src/backend/errors/AppError'
import {
  createAuthMiddlewareMock,
  parseTokenFromReq,
  makeUserFromToken,
} from '../helpers/authMiddlewareMock'
import {
  assertUnauthenticated,
  assertForbidden,
  assertNotFound,
  assertValidationError,
} from '../helpers/httpAsserts'
import { makeTokenPayload } from '../helpers/fixtures'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

const isActivePlatformAdminMock = jest.fn().mockResolvedValue(false)
const listActivePlatformAdminsMock = jest.fn().mockResolvedValue([])
const revokePlatformAdminMock = jest.fn().mockResolvedValue(false)
const grantPlatformAdminMock = jest.fn().mockResolvedValue('inserted' as const)

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const mock = createAuthMiddlewareMock({ actual, mode: 'token' })
  const verifyTokenOnly = (req: unknown, _res: unknown, next: (err?: unknown) => void): void => {
    const token = parseTokenFromReq(req as Parameters<typeof parseTokenFromReq>[0])
    if (!token) {
      next(new AppError('Unauthorized - No token', 401))
      return
    }
    const claims = makeUserFromToken(token)
    if (!claims) {
      next(new AppError('Unauthorized - Invalid token', 401))
      return
    }
    ;(req as Record<string, unknown>).user = { userId: claims.userId }
    next()
  }
  return { ...mock, verifyTokenOnly }
})

jest.mock('../../src/backend/database/platformAdminQueries', () => ({
  isActivePlatformAdmin: (...args: unknown[]) => isActivePlatformAdminMock(...args),
  listActivePlatformAdmins: (...args: unknown[]) => listActivePlatformAdminsMock(...args),
  revokePlatformAdmin: (...args: unknown[]) => revokePlatformAdminMock(...args),
  grantPlatformAdmin: (...args: unknown[]) => grantPlatformAdminMock(...args),
}))

const logAuditActionMock = jest.fn().mockResolvedValue(undefined)
jest.mock('../../src/backend/utils/logAuditAction', () => ({
  logAuditAction: (...args: unknown[]) => logAuditActionMock(...args),
}))

import app from '../../src/backend/app'

function makeToken(payload: { userId: number; accountId?: number }): string {
  return jwt.sign(
    makeTokenPayload({ userId: payload.userId, accountId: payload.accountId ?? 1 }),
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
}

const basePath = '/api/backend/platform/admins'

beforeEach(() => {
  jest.clearAllMocks()
  isActivePlatformAdminMock.mockResolvedValue(false)
  listActivePlatformAdminsMock.mockResolvedValue([])
  revokePlatformAdminMock.mockResolvedValue(false)
  grantPlatformAdminMock.mockResolvedValue('inserted')
})

describe('Platform admins API', () => {
  describe('GET /platform/admins', () => {
    it('returns 401 when no token', async () => {
      const res = await request(app).get(basePath)
      assertUnauthenticated(res)
      expect(listActivePlatformAdminsMock).not.toHaveBeenCalled()
    })

    it('returns 403 when token ok but user is not platform admin', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(false)
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .get(basePath)
        .set('Authorization', `Bearer ${token}`)
      assertForbidden(res, /Platform admin access required/)
      expect(isActivePlatformAdminMock).toHaveBeenCalledWith(1)
      expect(listActivePlatformAdminsMock).not.toHaveBeenCalled()
    })

    it('returns 200 and list when user is platform admin', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(true)
      const rows = [
        {
          userId: 1,
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          createdByUserId: null,
          revokedAt: null,
          revokedByUserId: null,
        },
      ]
      listActivePlatformAdminsMock.mockResolvedValueOnce(rows)
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .get(basePath)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].userId).toBe(1)
      expect(res.body[0].isActive).toBe(true)
      expect(res.body[0].createdAt).toBeDefined()
      expect(res.body[0].revokedAt).toBeNull()
      expect(isActivePlatformAdminMock).toHaveBeenCalledWith(1)
      expect(listActivePlatformAdminsMock).toHaveBeenCalled()
    })
  })

  describe('POST /platform/admins/:userId/revoke', () => {
    it('returns 401 when no token', async () => {
      const res = await request(app).post(`${basePath}/2/revoke`)
      assertUnauthenticated(res)
      expect(revokePlatformAdminMock).not.toHaveBeenCalled()
    })

    it('returns 403 when token ok but user is not platform admin', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(false)
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .post(`${basePath}/2/revoke`)
        .set('Authorization', `Bearer ${token}`)
      assertForbidden(res, /Platform admin access required/)
      expect(revokePlatformAdminMock).not.toHaveBeenCalled()
    })

    it('returns 400 when userId param is invalid', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(true)
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .post(`${basePath}/0/revoke`)
        .set('Authorization', `Bearer ${token}`)
      assertValidationError(res)
      expect(revokePlatformAdminMock).not.toHaveBeenCalled()
    })

    it('returns 400 when attempting to revoke own platform admin access', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(true)
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .post(`${basePath}/1/revoke`)
        .set('Authorization', `Bearer ${token}`)
      assertValidationError(res, /Cannot revoke your own/)
      expect(revokePlatformAdminMock).not.toHaveBeenCalled()
    })

    it('returns 404 when target exists but already inactive', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(true)
      revokePlatformAdminMock.mockResolvedValueOnce(false)
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .post(`${basePath}/2/revoke`)
        .set('Authorization', `Bearer ${token}`)
      assertNotFound(res)
      expect(revokePlatformAdminMock).toHaveBeenCalledWith({
        targetUserId: 2,
        revokedByUserId: 1,
      })
      expect(logAuditActionMock).not.toHaveBeenCalled()
    })

    it('returns 200 when revoke succeeds and calls logAuditAction', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(true)
      revokePlatformAdminMock.mockResolvedValueOnce(true)
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .post(`${basePath}/2/revoke`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ok: true })
      expect(revokePlatformAdminMock).toHaveBeenCalledWith({
        targetUserId: 2,
        revokedByUserId: 1,
      })
      expect(logAuditActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLATFORM_ADMIN_REVOKE',
          performedBy: 1,
          tableName: 'PlatformAdmins',
          recordId: 2,
          statusCode: 200,
          changes: expect.objectContaining({ targetUserId: 2, revokedByUserId: 1 }),
        })
      )
    })
  })

  describe('POST /platform/admins/:userId/grant', () => {
    // 409 when target already active; same contract when INSERT hits duplicate key (mapping in grantPlatformAdmin).
    it('returns 400 when userId param is invalid', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(true)
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .post(`${basePath}/0/grant`)
        .set('Authorization', `Bearer ${token}`)
      assertValidationError(res)
      expect(grantPlatformAdminMock).not.toHaveBeenCalled()
    })

    it('returns 409 when target is already active platform admin (or INSERT duplicate key in query)', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(true)
      grantPlatformAdminMock.mockResolvedValueOnce('already_active')
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .post(`${basePath}/2/grant`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(409)
      expect(res.body?.message).toMatch(/already a platform admin/)
      expect(logAuditActionMock).not.toHaveBeenCalled()
    })

    it('returns 201 when grantPlatformAdmin returns inserted', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(true)
      grantPlatformAdminMock.mockResolvedValueOnce('inserted')
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .post(`${basePath}/2/grant`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(201)
      expect(res.body).toEqual({ ok: true, result: 'inserted' })
      expect(grantPlatformAdminMock).toHaveBeenCalledWith({
        targetUserId: 2,
        grantedByUserId: 1,
      })
      expect(logAuditActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLATFORM_ADMIN_GRANT',
          performedBy: 1,
          tableName: 'PlatformAdmins',
          recordId: 2,
          statusCode: 201,
          changes: expect.objectContaining({
            targetUserId: 2,
            grantedByUserId: 1,
            result: 'inserted',
          }),
        })
      )
    })

    it('returns 200 when grantPlatformAdmin returns reactivated', async () => {
      isActivePlatformAdminMock.mockResolvedValueOnce(true)
      grantPlatformAdminMock.mockResolvedValueOnce('reactivated')
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .post(`${basePath}/2/grant`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ok: true, result: 'reactivated' })
      expect(logAuditActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLATFORM_ADMIN_GRANT',
          performedBy: 1,
          tableName: 'PlatformAdmins',
          recordId: 2,
          statusCode: 200,
          changes: expect.objectContaining({
            targetUserId: 2,
            grantedByUserId: 1,
            result: 'reactivated',
          }),
        })
      )
    })
  })
})
