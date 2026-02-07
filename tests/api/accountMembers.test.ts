/**
 * GET /api/backend/account-members, PATCH .../role, PATCH .../status
 * - GET requires ACCOUNT_VIEW and is scoped to active account
 * - PATCH role/status reject cross-account (404) and last-admin (403); happy paths succeed
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

const defaultContext = {
  accountId: 1,
  roleId: 1,
  roleName: 'Admin',
  permissions: ['ACCOUNT_VIEW', 'ACCOUNT_ROLE_MANAGE', 'ACCOUNT_USER_MANAGE'],
}

const getAccountContextForUser = jest.fn().mockResolvedValue(defaultContext)
const getAccountContextForUserAndAccount = jest.fn().mockResolvedValue(null)
const getDefaultAccountId = jest.fn().mockResolvedValue(1)
const getActiveAccountId = jest.fn().mockResolvedValue(5)
const getStoredActiveAccountId = jest.fn().mockResolvedValue(null)
const setActiveAccountRepo = jest.fn().mockResolvedValue(undefined)
const clearActiveAccount = jest.fn().mockResolvedValue(undefined)

const checkUserPermission = jest.fn().mockResolvedValue(true)

const listMembersRepo = jest.fn().mockResolvedValue([])
const getMemberInAccount = jest.fn().mockResolvedValue(null)
const countActiveAdminsInAccount = jest.fn().mockResolvedValue(1)
const updateMemberRoleRepo = jest.fn().mockResolvedValue(undefined)
const updateMemberStatusRepo = jest.fn().mockResolvedValue(undefined)

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

jest.mock('../../src/backend/repositories/accountMembersRepository', () => ({
  listMembers: (...args: unknown[]) => listMembersRepo(...args),
  getMemberInAccount: (...args: unknown[]) => getMemberInAccount(...args),
  countActiveAdminsInAccount: (...args: unknown[]) => countActiveAdminsInAccount(...args),
  updateMemberRole: (...args: unknown[]) => updateMemberRoleRepo(...args),
  updateMemberStatus: (...args: unknown[]) => updateMemberStatusRepo(...args),
}))

import app from '../../src/backend/app'

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '1h' })
}

const sampleMember = {
  accountMemberId: 10,
  userId: 2,
  email: 'member@example.com',
  firstName: 'Member',
  lastName: 'User',
  roleId: 2,
  roleName: 'Engineer',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

beforeEach(() => {
  jest.clearAllMocks()
  getAccountContextForUser.mockResolvedValue(defaultContext)
  getStoredActiveAccountId.mockResolvedValue(null)
  checkUserPermission.mockResolvedValue(true)
  listMembersRepo.mockResolvedValue([
    {
      ...sampleMember,
      createdAt: sampleMember.createdAt.toISOString(),
      updatedAt: sampleMember.updatedAt.toISOString(),
    },
  ])
})

describe('GET /api/backend/account-members', () => {
  it('requires ACCOUNT_VIEW and returns members scoped to active account', async () => {
    getAccountContextForUser.mockResolvedValueOnce({
      accountId: 1,
      roleId: 2,
      roleName: 'Viewer',
      permissions: [],
    })
    const token = makeToken({
      userId: 1,
      roleId: 2,
      role: 'Viewer',
      email: 'viewer@example.com',
      name: 'Viewer',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .get('/api/backend/account-members')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    expect(res.body.members).toBeDefined()
    expect(listMembersRepo).toHaveBeenCalledWith(1)
    expect(checkUserPermission).toHaveBeenCalledWith(1, 1, 'ACCOUNT_VIEW')
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
      .get('/api/backend/account-members')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(403)
  })

  it('returns 409 when no active account selected (safety net)', async () => {
    const { listMembers } = await import('../../src/backend/controllers/accountMembersController')
    const req = {
      user: { userId: 1 },
    } as unknown as import('express').Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as import('express').Response
    const next = jest.fn()

    await listMembers(req, res, next)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ message: 'No active account selected' })
    expect(next).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/backend/account-members/:id/role', () => {
  it('succeeds when member in account and not last admin', async () => {
    getMemberInAccount
      .mockResolvedValueOnce({ ...sampleMember, roleName: 'Engineer' })
      .mockResolvedValueOnce({ ...sampleMember, roleId: 1, roleName: 'Admin' })
    countActiveAdminsInAccount.mockResolvedValue(2)

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin',
      profilePic: null,
      permissions: ['ACCOUNT_ROLE_MANAGE'],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/10/role')
      .set('Cookie', [`token=${token}`])
      .send({ roleId: 1 })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accountMemberId: 10, roleId: 1, roleName: 'Admin' })
    expect(updateMemberRoleRepo).toHaveBeenCalledWith(1, 10, 1)
  })

  it('returns 404 when member not in active account', async () => {
    getMemberInAccount.mockResolvedValue(null)

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin',
      profilePic: null,
      permissions: ['ACCOUNT_ROLE_MANAGE'],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/999/role')
      .set('Cookie', [`token=${token}`])
      .send({ roleId: 2 })

    expect(res.status).toBe(404)
    expect(updateMemberRoleRepo).not.toHaveBeenCalled()
  })

  it('returns 403 when demoting last active Admin', async () => {
    getMemberInAccount.mockResolvedValue({ ...sampleMember, roleName: 'Admin', roleId: 1 })
    countActiveAdminsInAccount.mockResolvedValue(1)

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin',
      profilePic: null,
      permissions: ['ACCOUNT_ROLE_MANAGE'],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/10/role')
      .set('Cookie', [`token=${token}`])
      .send({ roleId: 2 })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/last.*admin|demote/i)
    expect(updateMemberRoleRepo).not.toHaveBeenCalled()
  })

  it('returns 400 when roleId missing', async () => {
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin',
      profilePic: null,
      permissions: ['ACCOUNT_ROLE_MANAGE'],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/10/role')
      .set('Cookie', [`token=${token}`])
      .send({})

    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/backend/account-members/:id/status', () => {
  it('succeeds when member in account and not last admin', async () => {
    getMemberInAccount
      .mockResolvedValueOnce({ ...sampleMember, isActive: true })
      .mockResolvedValueOnce({ ...sampleMember, isActive: false })
    countActiveAdminsInAccount.mockResolvedValue(2)

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin',
      profilePic: null,
      permissions: ['ACCOUNT_USER_MANAGE'],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`token=${token}`])
      .send({ isActive: false })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accountMemberId: 10, isActive: false })
    expect(updateMemberStatusRepo).toHaveBeenCalledWith(1, 10, false)
  })

  it('returns 404 when member not in active account', async () => {
    getMemberInAccount.mockResolvedValue(null)

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin',
      profilePic: null,
      permissions: ['ACCOUNT_USER_MANAGE'],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/999/status')
      .set('Cookie', [`token=${token}`])
      .send({ isActive: false })

    expect(res.status).toBe(404)
    expect(updateMemberStatusRepo).not.toHaveBeenCalled()
  })

  it('returns 403 when deactivating last active Admin', async () => {
    getMemberInAccount.mockResolvedValue({ ...sampleMember, roleName: 'Admin', isActive: true })
    countActiveAdminsInAccount.mockResolvedValue(1)

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin',
      profilePic: null,
      permissions: ['ACCOUNT_USER_MANAGE'],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`token=${token}`])
      .send({ isActive: false })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/last.*admin|deactivate/i)
    expect(updateMemberStatusRepo).not.toHaveBeenCalled()
  })

  it('returns 400 when isActive missing', async () => {
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin',
      profilePic: null,
      permissions: ['ACCOUNT_USER_MANAGE'],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`token=${token}`])
      .send({})

    expect(res.status).toBe(400)
  })
})
