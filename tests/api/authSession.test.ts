/**
 * Regression test: GET /api/backend/auth/session returns correct platform/admin scope fields
 * when platform admin is DB-true.
 */
import request from 'supertest'
import { assertUnauthenticated } from '../helpers/httpAsserts'

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

const loadSessionData = jest.fn()
jest.mock('../../src/backend/services/authSessionsService', () => ({
  getSidFromRequest: jest.fn((req: { cookies?: { sid?: string } }) => req.cookies?.sid ?? null),
  loadSessionData: (...args: unknown[]) => loadSessionData(...args),
  revokeSession: jest.fn(),
}))

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { AppError } = jest.requireActual('../../src/backend/errors/AppError')
  
  // Override verifyToken to use session data
  const verifyTokenHandler = async (req: unknown, _res: unknown, next: (err?: unknown) => void): Promise<void> => {
    const { getSidFromRequest } = require('../../src/backend/services/authSessionsService')
    const sid = getSidFromRequest(req as Parameters<typeof getSidFromRequest>[0])
    if (!sid) {
      next(new AppError('Unauthorized - No session', 401))
      return
    }
    
    const sessionData = await loadSessionData(sid)
    if (!sessionData) {
      next(new AppError('Unauthorized - Invalid session', 401))
      return
    }
    
    // Use the mocked functions directly (they're hoisted)
    const { isUserPlatformAdmin } = require('../../src/backend/database/platformAdminPort')
    const { getAccountContextForUser } = require('../../src/backend/database/accountContextQueries')
    
    // Check if user is platform admin
    const isPlatformAdmin = await isUserPlatformAdmin(sessionData.userId)
    
    // Get account context (mocked) - this simulates attachAccountContext behavior
    const accountCtx = await getAccountContextForUser(sessionData.userId)
    
    const r = req as Record<string, unknown>
    ;(r as Record<string, unknown>)['user'] = {
      userId: sessionData.userId,
      accountId: accountCtx?.accountId ?? sessionData.accountId,
      roleId: accountCtx?.roleId ?? sessionData.roleId,
      role: accountCtx?.roleName ?? sessionData.role,
      permissions: accountCtx?.permissions ?? sessionData.permissions ?? [],
      isOwner: accountCtx?.isOwner ?? false,
      ownerUserId: accountCtx?.ownerUserId ?? null,
      email: sessionData.email,
      name: sessionData.name,
      profilePic: sessionData.profilePic ?? undefined,
      isSuperadmin: isPlatformAdmin,
    }
    
    next()
  }
  
  return { ...actual, verifyToken: verifyTokenHandler }
})

jest.mock('../../src/backend/database/accountContextQueries', () => ({
  getAccountContextForUser,
  getAccountContextForUserAndAccount,
  getDefaultAccountId,
  getActiveAccountId,
}))

const getUserById = jest.fn()
jest.mock('../../src/backend/services/usersService', () => ({
  getUserById: (...args: unknown[]) => getUserById(...args),
}))

jest.mock('../../src/backend/repositories/userActiveAccountRepository', () => ({
  getActiveAccountId: (...args: unknown[]) => getStoredActiveAccountId(...args),
  clearActiveAccount: (...args: unknown[]) => clearActiveAccount(...args),
}))

import app from '../../src/backend/app'

function makeSid(): string {
  return 'test-sid-' + Math.random().toString(36).substring(7)
}

beforeEach(() => {
  jest.clearAllMocks()
  isUserPlatformAdminMock.mockResolvedValue(false)
  getAccountContextForUser.mockResolvedValue(defaultContext)
  getStoredActiveAccountId.mockResolvedValue(null)
  getUserById.mockResolvedValue({
    UserID: 1,
    FirstName: 'Admin',
    LastName: 'User',
    Email: 'admin@example.com',
    RoleID: 1,
    RoleName: 'Admin',
    ProfilePic: null,
  })
  loadSessionData.mockResolvedValue({
    userId: 1,
    accountId: 1,
    roleId: 1,
    role: 'Admin',
    email: 'admin@example.com',
    name: 'Admin User',
    profilePic: null,
    permissions: [],
    isSuperadmin: false,
  })
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
    getUserById.mockResolvedValueOnce({
      UserID: 1,
      FirstName: 'Admin',
      LastName: 'User',
      Email: 'admin@example.com',
      RoleID: 1,
      RoleName: 'Admin',
      ProfilePic: null,
    })

    const sid = makeSid()
    loadSessionData.mockResolvedValueOnce({
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin User',
      profilePic: null,
      permissions: [],
      isSuperadmin: true,
    })

    const res = await request(app)
      .get('/api/backend/auth/session')
      .set('Cookie', [`sid=${sid}`])

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
