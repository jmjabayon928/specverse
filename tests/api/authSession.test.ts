/**
 * Regression test: GET /api/backend/auth/session returns correct platform/admin scope fields
 * when platform admin is DB-true.
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { assertUnauthenticated } from '../helpers/httpAsserts'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

const isUserPlatformAdminMock = jest.fn().mockResolvedValue(false)

const defaultContext = {
  accountId: 1,
  roleId: 1,
  roleName: 'Admin',
  permissions: ['ACCOUNT_VIEW', 'DATASHEET_VIEW'],
  isOwner: false,
  ownerUserId: null,
}

const getAccountContextForUser = jest.fn().mockResolvedValue(defaultContext)
const getAccountContextForUserAndAccount = jest.fn().mockResolvedValue(null)
const getDefaultAccountId = jest.fn().mockResolvedValue(1)
const getActiveAccountId = jest.fn().mockResolvedValue(1)
const getStoredActiveAccountId = jest.fn().mockResolvedValue(null)
const clearActiveAccount = jest.fn().mockResolvedValue(undefined)

// Mock platformAdminPort before authMiddleware so it's available
jest.mock('../../src/backend/database/platformAdminPort', () => ({
  isUserPlatformAdmin: (...args: unknown[]) => isUserPlatformAdminMock(...args),
}))

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { createAuthMiddlewareMock, parseTokenFromReq, makeUserFromToken } = jest.requireActual('../helpers/authMiddlewareMock')
  const { AppError } = jest.requireActual('../../src/backend/errors/AppError')
  const mock = createAuthMiddlewareMock({ actual, mode: 'token' })
  
  // Override verifyToken to set isSuperadmin based on platform admin check
  const verifyTokenHandler = async (req: unknown, _res: unknown, next: (err?: unknown) => void): Promise<void> => {
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
    
    // Use the mocked functions directly (they're hoisted)
    const { isUserPlatformAdmin } = require('../../src/backend/database/platformAdminPort')
    const { getAccountContextForUser } = require('../../src/backend/database/accountContextQueries')
    
    // Check if user is platform admin
    const isPlatformAdmin = await isUserPlatformAdmin(claims.userId)
    
    // Get account context (mocked)
    const accountContext = await getAccountContextForUser(claims.userId)
    
    const r = req as Record<string, unknown>
    ;(r as Record<string, unknown>)['user'] = {
      userId: claims.userId,
      accountId: accountContext?.accountId ?? claims.accountId,
      roleId: accountContext?.roleId ?? claims.roleId,
      role: accountContext?.roleName ?? claims.role,
      permissions: accountContext?.permissions ?? claims.permissions ?? [],
      isOwner: accountContext?.isOwner ?? claims.isOwner ?? false,
      ownerUserId: accountContext?.ownerUserId ?? null,
      email: 'admin@example.com',
      name: 'Admin User',
      isSuperadmin: isPlatformAdmin,
    }
    
    next()
  }
  
  return { ...mock, verifyToken: verifyTokenHandler }
})

jest.mock('../../src/backend/database/accountContextQueries', () => ({
  getAccountContextForUser,
  getAccountContextForUserAndAccount,
  getDefaultAccountId,
  getActiveAccountId,
}))

jest.mock('../../src/backend/repositories/userActiveAccountRepository', () => ({
  getActiveAccountId: (...args: unknown[]) => getStoredActiveAccountId(...args),
  clearActiveAccount: (...args: unknown[]) => clearActiveAccount(...args),
}))

import app from '../../src/backend/app'

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '1h' })
}

beforeEach(() => {
  jest.clearAllMocks()
  isUserPlatformAdminMock.mockResolvedValue(false)
  getAccountContextForUser.mockResolvedValue(defaultContext)
  getStoredActiveAccountId.mockResolvedValue(null)
})

describe('GET /api/backend/auth/session', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/backend/auth/session')
    assertUnauthenticated(res)
  })

  it('returns 200 with platform admin scope fields when user is platform admin', async () => {
    isUserPlatformAdminMock.mockResolvedValueOnce(true)
    getAccountContextForUser.mockResolvedValueOnce({
      accountId: 1,
      roleId: 1,
      roleName: 'Admin',
      permissions: ['ACCOUNT_VIEW', 'DATASHEET_VIEW'],
      isOwner: true,
      ownerUserId: 1,
    })

    const token = makeToken({
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .get('/api/backend/auth/session')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('isSuperadmin', true)
    expect(res.body).toHaveProperty('isPlatformAdmin', true)
    expect(typeof res.body.isPlatformAdmin).toBe('boolean')
    expect(res.body).toHaveProperty('permissionsCount')
    expect(typeof res.body.permissionsCount).toBe('number')
    expect(res.body.permissionsCount).toBe(2)
    expect(res.body).toHaveProperty('isOwner')
    expect(typeof res.body.isOwner).toBe('boolean')
    expect(res.body.isOwner).toBe(true)
    expect(res.body).toHaveProperty('accountId', 1)
    expect(res.body).toHaveProperty('roleName', 'Admin')
  })
})
