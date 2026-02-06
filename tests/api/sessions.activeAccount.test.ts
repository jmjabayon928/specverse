/**
 * Integration tests: POST /api/backend/sessions/active-account
 * - Success: updates store (setActiveAccount called with userId, accountId)
 * - Reject: not a member -> 403
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

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

import app from '../../src/backend/app'

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '1h' })
}

beforeEach(() => {
  jest.clearAllMocks()
  getAccountContextForUser.mockResolvedValue(defaultContext)
  getStoredActiveAccountId.mockResolvedValue(null)
  setActiveAccountRepo.mockResolvedValue(undefined)
  clearActiveAccount.mockResolvedValue(undefined)
})

describe('POST /api/backend/sessions/active-account', () => {
  it('returns 204 and updates store when user has active membership', async () => {
    getAccountContextForUserAndAccount.mockResolvedValueOnce({
      accountId: 2,
      roleId: 2,
      roleName: 'Engineer',
      permissions: ['DATASHEET_VIEW'],
    })

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .set('Cookie', [`token=${token}`])
      .send({ accountId: 2 })

    expect(res.status).toBe(204)
    expect(setActiveAccountRepo).toHaveBeenCalledTimes(1)
    expect(setActiveAccountRepo).toHaveBeenCalledWith(1, 2)
  })

  it('returns 403 when user is not a member of the account', async () => {
    getAccountContextForUserAndAccount.mockResolvedValueOnce(null)

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .set('Cookie', [`token=${token}`])
      .send({ accountId: 999 })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/not a member|inactive/i)
    expect(setActiveAccountRepo).not.toHaveBeenCalled()
  })

  it('returns 401 when no token', async () => {
    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .send({ accountId: 1 })

    expect(res.status).toBe(401)
    expect(setActiveAccountRepo).not.toHaveBeenCalled()
  })

  it('returns 400 when accountId missing', async () => {
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .set('Cookie', [`token=${token}`])
      .send({})

    expect(res.status).toBe(400)
    expect(setActiveAccountRepo).not.toHaveBeenCalled()
  })

  it('returns 400 when accountId is not a positive number', async () => {
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/sessions/active-account')
      .set('Cookie', [`token=${token}`])
      .send({ accountId: 0 })

    expect(res.status).toBe(400)
    expect(setActiveAccountRepo).not.toHaveBeenCalled()
  })
})
