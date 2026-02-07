/**
 * GET /api/backend/roles — minimal roles list for UI dropdown (account member management)
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

const defaultContext = {
  accountId: 1,
  roleId: 1,
  roleName: 'Admin',
  permissions: ['ACCOUNT_VIEW'],
}

const getAccountContextForUser = jest.fn().mockResolvedValue(defaultContext)
const getAccountContextForUserAndAccount = jest.fn().mockResolvedValue(null)
const getDefaultAccountId = jest.fn().mockResolvedValue(1)
const getActiveAccountId = jest.fn().mockResolvedValue(5)
const getStoredActiveAccountId = jest.fn().mockResolvedValue(null)
const setActiveAccountRepo = jest.fn().mockResolvedValue(undefined)
const clearActiveAccount = jest.fn().mockResolvedValue(undefined)

const checkUserPermission = jest.fn().mockResolvedValue(true)

const listRoleIdsAndNames = jest.fn().mockResolvedValue([
  { roleId: 1, roleName: 'Admin' },
  { roleId: 2, roleName: 'Manager' },
  { roleId: 3, roleName: 'Engineer' },
  { roleId: 4, roleName: 'Viewer' },
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

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: (...args: unknown[]) => checkUserPermission(...args),
}))

jest.mock('../../src/backend/repositories/rolesRepository', () => ({
  listRoleIdsAndNames: (...args: unknown[]) => listRoleIdsAndNames(...args),
}))

import app from '../../src/backend/app'

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '1h' })
}

beforeEach(() => {
  jest.clearAllMocks()
  getAccountContextForUser.mockResolvedValue(defaultContext)
  getStoredActiveAccountId.mockResolvedValue(null)
  checkUserPermission.mockResolvedValue(true)
  listRoleIdsAndNames.mockResolvedValue([
    { roleId: 1, roleName: 'Admin' },
    { roleId: 2, roleName: 'Manager' },
    { roleId: 3, roleName: 'Engineer' },
    { roleId: 4, roleName: 'Viewer' },
  ])
})

describe('GET /api/backend/roles', () => {
  it('returns 401 when no token', async () => {
    const res = await request(app).get('/api/backend/roles')
    expect(res.status).toBe(401)
    expect(listRoleIdsAndNames).not.toHaveBeenCalled()
  })

  it('returns 200 and roles array including Admin and Manager', async () => {
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: ['ACCOUNT_VIEW'],
    })

    const res = await request(app)
      .get('/api/backend/roles')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    expect(res.body.roles).toBeDefined()
    expect(Array.isArray(res.body.roles)).toBe(true)
    const names = res.body.roles.map((r: { roleName: string }) => r.roleName)
    expect(names).toContain('Admin')
    expect(names).toContain('Manager')
    expect(listRoleIdsAndNames).toHaveBeenCalledTimes(1)
  })

  it('excludes deprecated roles (repo returns only non-deprecated)', async () => {
    listRoleIdsAndNames.mockResolvedValueOnce([
      { roleId: 1, roleName: 'Admin' },
      { roleId: 2, roleName: 'Manager' },
    ])

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: ['ACCOUNT_VIEW'],
    })

    const res = await request(app)
      .get('/api/backend/roles')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    const names = res.body.roles.map((r: { roleName: string }) => r.roleName)
    expect(names).not.toContain('Supervisor (Deprecated)')
    expect(names).toContain('Admin')
    expect(names).toContain('Manager')
  })

  it('returns 403 when user lacks ACCOUNT_VIEW', async () => {
    getAccountContextForUser.mockResolvedValueOnce({
      accountId: 1,
      roleId: 2,
      roleName: 'Engineer',
      permissions: [],
    })
    checkUserPermission.mockResolvedValueOnce(false)
    const token = makeToken({
      userId: 1,
      roleId: 2,
      role: 'Engineer',
      email: 'e@example.com',
      name: 'Engineer',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .get('/api/backend/roles')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(403)
    expect(listRoleIdsAndNames).not.toHaveBeenCalled()
  })
})
