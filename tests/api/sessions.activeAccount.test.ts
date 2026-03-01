/**
 * Integration tests: POST /api/backend/sessions/active-account
 * - Success: updates store (setActiveAccount called with userId, accountId)
 * - Reject: not a member -> 403
 */
import request from 'supertest'

const defaultContext = {
  accountId: 1,
  roleId: 1,
  roleName: 'Admin',
  permissions: [] as string[],
}

const getAccountContextForUser = jest.fn().mockResolvedValue(defaultContext)
const getAccountContextForUserAndAccount = jest.fn().mockResolvedValue(null)
const getDefaultAccountId = jest.fn().mockResolvedValue(1)
const getActiveAccountId = jest.fn().mockResolvedValue(5)

const getStoredActiveAccountId = jest.fn().mockResolvedValue(null)
const setActiveAccountRepo = jest.fn().mockResolvedValue(undefined)
const clearActiveAccount = jest.fn().mockResolvedValue(undefined)

jest.mock('../../src/backend/database/accountContextQueries', () => ({
  getAccountContextForUser,
  getAccountContextForUserAndAccount,
  getDefaultAccountId,
  getActiveAccountId,
}))

jest.mock('../../src/backend/repositories/userActiveAccountRepository', () => ({
  getActiveAccountId: (...args: unknown[]) => getStoredActiveAccountId(...args),
  setActiveAccount: (...args: unknown[]) => setActiveAccountRepo(...args),
  clearActiveAccount: (...args: unknown[]) => clearActiveAccount(...args),
}))

const loadSessionData = jest.fn()
jest.mock('../../src/backend/services/authSessionsService', () => ({
  getSidFromRequest: jest.fn((req: { cookies?: { sid?: string } }) => req.cookies?.sid ?? null),
  loadSessionData: (...args: unknown[]) => loadSessionData(...args),
  revokeSession: jest.fn(),
}))

const getUserById = jest.fn()
jest.mock('../../src/backend/services/usersService', () => ({
  getUserById: (...args: unknown[]) => getUserById(...args),
}))

import app from '../../src/backend/app'

function makeSid(): string {
  return 'test-sid-' + Math.random().toString(36).substring(7)
}

beforeEach(() => {
  jest.clearAllMocks()
  getAccountContextForUser.mockResolvedValue(defaultContext)
  getStoredActiveAccountId.mockResolvedValue(null)
  setActiveAccountRepo.mockResolvedValue(undefined)
  clearActiveAccount.mockResolvedValue(undefined)
  getUserById.mockResolvedValue({
    UserID: 1,
    FirstName: 'Test',
    LastName: 'User',
    Email: 'u@example.com',
    RoleID: 1,
    RoleName: 'Admin',
    ProfilePic: null,
  })
  loadSessionData.mockResolvedValue({
    userId: 1,
    accountId: 1,
    roleId: 1,
    role: 'Admin',
    email: 'u@example.com',
    name: 'User',
    profilePic: null,
    permissions: [],
    isSuperadmin: false,
  })
})

describe('POST /api/backend/sessions/active-account', () => {
  it('returns 204 and updates store when user has active membership', async () => {
    getAccountContextForUserAndAccount.mockResolvedValueOnce({
      accountId: 2,
      roleId: 2,
      roleName: 'Engineer',
      permissions: ['DATASHEET_VIEW'],
    })

    const sid = makeSid()
    loadSessionData.mockResolvedValueOnce({
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
      isSuperadmin: false,
    })

    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .set('Cookie', [`sid=${sid}`])
      .send({ accountId: 2 })

    expect(res.status).toBe(204)
    expect(setActiveAccountRepo).toHaveBeenCalledTimes(1)
    expect(setActiveAccountRepo).toHaveBeenCalledWith(1, 2)
  })

  it('returns 403 when user is not a member of the account', async () => {
    getAccountContextForUserAndAccount.mockResolvedValueOnce(null)

    const sid = makeSid()
    loadSessionData.mockResolvedValueOnce({
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
      isSuperadmin: false,
    })

    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .set('Cookie', [`sid=${sid}`])
      .send({ accountId: 999 })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/not a member|inactive/i)
    expect(setActiveAccountRepo).not.toHaveBeenCalled()
  })

  it('returns 401 when no session', async () => {
    loadSessionData.mockResolvedValueOnce(null)
    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .send({ accountId: 1 })

    expect(res.status).toBe(401)
    expect(setActiveAccountRepo).not.toHaveBeenCalled()
  })

  it('returns 400 when accountId missing', async () => {
    const sid = makeSid()
    const fullSession = {
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null as string | null,
      permissions: [] as string[],
      isSuperadmin: false,
    }
    loadSessionData.mockReset()
    loadSessionData.mockResolvedValue(fullSession)

    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .set('Cookie', [`sid=${sid}`])
      .send({})

    expect(res.status).toBe(400)
    expect(setActiveAccountRepo).not.toHaveBeenCalled()
  })

  it('returns 400 when accountId is not a positive number', async () => {
    const sid = makeSid()
    loadSessionData.mockResolvedValueOnce({
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
      isSuperadmin: false,
    })

    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .set('Cookie', [`sid=${sid}`])
      .send({ accountId: 0 })

    expect(res.status).toBe(400)
    expect(setActiveAccountRepo).not.toHaveBeenCalled()
  })
})
