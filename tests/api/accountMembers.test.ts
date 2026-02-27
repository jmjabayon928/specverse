/**
 * GET /api/backend/account-members, PATCH .../role, PATCH .../status
 * - GET requires ACCOUNT_VIEW and is scoped to active account
 * - PATCH role/status reject cross-account (404) and last-admin (403); happy paths succeed
 */
import request from 'supertest'
import { assertForbidden, assertNotFound, assertValidationError } from '../helpers/httpAsserts'

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
const countActiveOwnersInAccount = jest.fn().mockResolvedValue(1)
const updateMemberRoleRepo = jest.fn().mockResolvedValue(undefined)
const updateMemberStatusRepo = jest.fn().mockResolvedValue(undefined)

const getAccountById = jest.fn().mockResolvedValue(null)

jest.mock('../../src/backend/repositories/accountsRepository', () => ({
  ...jest.requireActual('../../src/backend/repositories/accountsRepository'),
  getAccountById: (...args: unknown[]) => getAccountById(...args),
}))

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
  countActiveOwnersInAccount: (...args: unknown[]) => countActiveOwnersInAccount(...args),
  updateMemberRole: (...args: unknown[]) => updateMemberRoleRepo(...args),
  updateMemberStatus: (...args: unknown[]) => updateMemberStatusRepo(...args),
}))

const loadSessionData = jest.fn()
const revokeSession = jest.fn()
jest.mock('../../src/backend/services/authSessionsService', () => ({
  getSidFromRequest: (req: { cookies?: { sid?: string } }) => req.cookies?.sid ?? null,
  loadSessionData: (...args: unknown[]) => loadSessionData(...args),
  revokeSession: (...args: unknown[]) => revokeSession(...args),
}))

import app from '../../src/backend/app'

function makeSid(): string {
  return 'test-sid-' + Math.random().toString(36).slice(2)
}

const defaultSessionData = {
  userId: 1,
  accountId: 1,
  roleId: 1,
  role: 'Admin',
  email: 'u@example.com',
  name: 'User',
  profilePic: null as string | null,
  permissions: ['ACCOUNT_VIEW', 'ACCOUNT_ROLE_MANAGE', 'ACCOUNT_USER_MANAGE'],
  isSuperadmin: false,
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
  isOwner: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

beforeEach(() => {
  jest.clearAllMocks()
  loadSessionData.mockResolvedValue(defaultSessionData)
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
  countActiveOwnersInAccount.mockResolvedValue(1)
  getAccountById.mockResolvedValue(null)
})

describe('GET /api/backend/account-members', () => {
  it('requires ACCOUNT_VIEW and returns members scoped to active account', async () => {
    getAccountContextForUser.mockResolvedValueOnce({
      accountId: 1,
      roleId: 2,
      roleName: 'Viewer',
      permissions: [],
    })
    loadSessionData.mockResolvedValueOnce({
      ...defaultSessionData,
      roleId: 2,
      role: 'Viewer',
      permissions: [],
    })
    const sid = makeSid()

    const res = await request(app)
      .get('/api/backend/account-members')
      .set('Cookie', [`sid=${sid}`])

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
    loadSessionData.mockResolvedValueOnce({
      ...defaultSessionData,
      roleId: 2,
      role: 'Engineer',
      permissions: [],
    })
    const sid = makeSid()

    const res = await request(app)
      .get('/api/backend/account-members')
      .set('Cookie', [`sid=${sid}`])

    assertForbidden(res)
  })

  it('returns members with isOwner when present', async () => {
    listMembersRepo.mockResolvedValueOnce([
      {
        ...sampleMember,
        isOwner: true,
        createdAt: sampleMember.createdAt.toISOString(),
        updatedAt: sampleMember.updatedAt.toISOString(),
      },
    ])
    loadSessionData.mockResolvedValueOnce({
      ...defaultSessionData,
      permissions: ['ACCOUNT_VIEW'],
    })
    const sid = makeSid()
    const res = await request(app)
      .get('/api/backend/account-members')
      .set('Cookie', [`sid=${sid}`])
    expect(res.status).toBe(200)
    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].isOwner).toBe(true)
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

    loadSessionData.mockResolvedValueOnce({
      ...defaultSessionData,
      permissions: ['ACCOUNT_ROLE_MANAGE'],
    })
    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/10/role')
      .set('Cookie', [`sid=${sid}`])
      .send({ roleId: 1 })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accountMemberId: 10, roleId: 1, roleName: 'Admin' })
    expect(updateMemberRoleRepo).toHaveBeenCalledWith(1, 10, 1)
  })

  it('returns 404 when member not in active account', async () => {
    getMemberInAccount.mockResolvedValue(null)

    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/999/role')
      .set('Cookie', [`sid=${sid}`])
      .send({ roleId: 2 })

    assertNotFound(res)
    expect(updateMemberRoleRepo).not.toHaveBeenCalled()
  })

  it('returns 403 when demoting last active Admin', async () => {
    getMemberInAccount.mockResolvedValue({ ...sampleMember, roleName: 'Admin', roleId: 1 })
    countActiveAdminsInAccount.mockResolvedValue(1)

    loadSessionData.mockResolvedValueOnce({
      ...defaultSessionData,
      permissions: ['ACCOUNT_ROLE_MANAGE'],
    })
    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/10/role')
      .set('Cookie', [`sid=${sid}`])
      .send({ roleId: 2 })

    assertForbidden(res, /last.*admin|demote/i)
    expect(updateMemberRoleRepo).not.toHaveBeenCalled()
  })

  it('returns 400 when roleId missing', async () => {
    loadSessionData.mockResolvedValueOnce({
      ...defaultSessionData,
      permissions: ['ACCOUNT_ROLE_MANAGE'],
    })
    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/10/role')
      .set('Cookie', [`sid=${sid}`])
      .send({})

    assertValidationError(res)
  })

  it('returns 403 when changing account owner role', async () => {
    getMemberInAccount.mockResolvedValue({
      ...sampleMember,
      userId: 2,
      roleName: 'Admin',
      roleId: 1,
    })
    getAccountById.mockResolvedValueOnce({
      accountId: 1,
      accountName: 'Acme',
      slug: 'acme',
      isActive: true,
      ownerUserId: 2,
    })
    countActiveAdminsInAccount.mockResolvedValue(2)

    loadSessionData.mockResolvedValueOnce({
      ...defaultSessionData,
      permissions: ['ACCOUNT_ROLE_MANAGE'],
    })
    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/10/role')
      .set('Cookie', [`sid=${sid}`])
      .send({ roleId: 2 })

    assertForbidden(res, /transfer ownership|owner's role/i)
    expect(updateMemberRoleRepo).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/backend/account-members/:id/status', () => {
  it('succeeds when member in account and not last admin', async () => {
    getMemberInAccount
      .mockResolvedValueOnce({ ...sampleMember, isActive: true })
      .mockResolvedValueOnce({ ...sampleMember, isActive: false })
    countActiveAdminsInAccount.mockResolvedValue(2)

    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`sid=${sid}`])
      .send({ isActive: false })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accountMemberId: 10, isActive: false })
    expect(updateMemberStatusRepo).toHaveBeenCalledWith(1, 10, false)
  })

  it('returns 404 when member not in active account', async () => {
    getMemberInAccount.mockResolvedValue(null)

    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/999/status')
      .set('Cookie', [`sid=${sid}`])
      .send({ isActive: false })

    assertNotFound(res)
    expect(updateMemberStatusRepo).not.toHaveBeenCalled()
  })

  it('returns 403 when deactivating last active Admin', async () => {
    getMemberInAccount.mockResolvedValue({ ...sampleMember, roleName: 'Admin', isActive: true })
    countActiveAdminsInAccount.mockResolvedValue(1)

    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`sid=${sid}`])
      .send({ isActive: false })

    assertForbidden(res, /last.*admin|deactivate/i)
    expect(updateMemberStatusRepo).not.toHaveBeenCalled()
  })

  it('returns 400 when isActive missing', async () => {
    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`sid=${sid}`])
      .send({})

    assertValidationError(res)
  })

  it('returns 403 when deactivating last active Owner', async () => {
    getMemberInAccount.mockResolvedValue({
      ...sampleMember,
      roleName: 'Admin',
      isActive: true,
      isOwner: true,
    })
    countActiveAdminsInAccount.mockResolvedValue(2)
    countActiveOwnersInAccount.mockResolvedValue(1)

    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`sid=${sid}`])
      .send({ isActive: false })

    assertForbidden(res, /last.*owner|deactivate/i)
    expect(updateMemberStatusRepo).not.toHaveBeenCalled()
  })

  it('returns 403 when deactivating canonical account owner', async () => {
    getMemberInAccount.mockResolvedValue({
      ...sampleMember,
      userId: 2,
      isActive: true,
      isOwner: true,
    })
    getAccountById.mockResolvedValueOnce({
      accountId: 1,
      accountName: 'Acme',
      slug: 'acme',
      isActive: true,
      ownerUserId: 2,
    })
    countActiveAdminsInAccount.mockResolvedValue(2)
    countActiveOwnersInAccount.mockResolvedValue(2)

    const sid = makeSid()

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`sid=${sid}`])
      .send({ isActive: false })

    assertForbidden(res, 'Cannot deactivate the account owner; transfer ownership first.')
    expect(updateMemberStatusRepo).not.toHaveBeenCalled()
  })
})
