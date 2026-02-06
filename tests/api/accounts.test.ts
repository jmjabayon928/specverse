/**
 * GET /api/backend/accounts — returns only my accounts + activeAccountId
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

const listAccountsForUserRepo = jest.fn().mockResolvedValue([
  { accountId: 1, accountName: 'Default Account', slug: 'default', isActive: true, roleName: 'Admin' },
  { accountId: 2, accountName: 'Other Account', slug: 'other', isActive: true, roleName: 'Engineer' },
])

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

jest.mock('../../src/backend/repositories/accountsRepository', () => ({
  listAccountsForUser: (...args: unknown[]) => listAccountsForUserRepo(...args),
}))

import app from '../../src/backend/app'

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '1h' })
}

beforeEach(() => {
  jest.clearAllMocks()
  getAccountContextForUser.mockResolvedValue(defaultContext)
  getStoredActiveAccountId.mockResolvedValue(null)
  listAccountsForUserRepo.mockResolvedValue([
    { accountId: 1, accountName: 'Default Account', slug: 'default', isActive: true, roleName: 'Admin' },
    { accountId: 2, accountName: 'Other Account', slug: 'other', isActive: true, roleName: 'Engineer' },
  ])
})

describe('GET /api/backend/accounts', () => {
  it('returns only my accounts and activeAccountId', async () => {
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
      .get('/api/backend/accounts')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    expect(res.body.accounts).toHaveLength(2)
    expect(res.body.accounts[0]).toMatchObject({
      accountId: 1,
      accountName: 'Default Account',
      slug: 'default',
      isActive: true,
      roleName: 'Admin',
    })
    expect(res.body.activeAccountId).toBe(1)
    expect(listAccountsForUserRepo).toHaveBeenCalledWith(1)
  })

  it('returns 403 when no token', async () => {
    const res = await request(app).get('/api/backend/accounts')
    expect(res.status).toBe(401)
  })

  it('excludes inactive accounts from list (regression)', async () => {
    listAccountsForUserRepo.mockResolvedValueOnce([
      { accountId: 1, accountName: 'Active Account', slug: 'active', isActive: true, roleName: 'Admin' },
      { accountId: 2, accountName: 'Inactive Account', slug: 'inactive', isActive: false, roleName: 'Viewer' },
    ])

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
      .get('/api/backend/accounts')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    expect(res.body.accounts).toHaveLength(1)
    expect(res.body.accounts[0]).toMatchObject({ accountId: 1, isActive: true, accountName: 'Active Account' })
  })
})
