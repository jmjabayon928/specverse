/**
 * Invites API: POST /, GET /, POST /:id/resend, POST /:id/revoke,
 * GET /by-token, POST /accept, POST /decline
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

const defaultContext = {
  accountId: 1,
  roleId: 1,
  roleName: 'Admin',
  permissions: ['ACCOUNT_VIEW', 'ACCOUNT_USER_MANAGE'],
}

const getAccountContextForUser = jest.fn().mockResolvedValue(defaultContext)
const getAccountContextForUserAndAccount = jest.fn().mockResolvedValue(null)
const getDefaultAccountId = jest.fn().mockResolvedValue(1)
const getActiveAccountId = jest.fn().mockResolvedValue(5)
const getStoredActiveAccountId = jest.fn().mockResolvedValue(null)
const clearActiveAccount = jest.fn().mockResolvedValue(undefined)
const checkUserPermission = jest.fn().mockResolvedValue(true)

const createInviteRepo = jest.fn()
const findPendingByAccountAndEmail = jest.fn().mockResolvedValue(null)
const listPendingByAccount = jest.fn().mockResolvedValue([])
const listByAccount = jest.fn().mockResolvedValue([])
const findByTokenHash = jest.fn().mockResolvedValue(null)
const getByIdAndAccount = jest.fn().mockResolvedValue(null)
const updateTokenAndIncrementSend = jest.fn().mockResolvedValue(undefined)
const setStatusRevoked = jest.fn().mockResolvedValue(undefined)
const setStatusAcceptedIfPending = jest.fn().mockResolvedValue(true)
const setStatusDeclined = jest.fn().mockResolvedValue(undefined)

const getMemberByAccountAndUser = jest.fn().mockResolvedValue(null)
const insertAccountMember = jest.fn().mockResolvedValue(undefined)
const updateMemberRole = jest.fn().mockResolvedValue(undefined)
const updateMemberStatus = jest.fn().mockResolvedValue(undefined)
const setActiveAccountRepo = jest.fn().mockResolvedValue(undefined)
const getUserByEmail = jest.fn().mockResolvedValue(null)
const listRoleIdsAndNames = jest.fn().mockResolvedValue([{ roleId: 1, roleName: 'Admin' }, { roleId: 2, roleName: 'Viewer' }])
const getAccountNameById = jest.fn().mockResolvedValue('Test Account')
const logAuditAction = jest.fn().mockResolvedValue(undefined)
const sendInviteEmail = jest.fn().mockResolvedValue(undefined)

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

jest.mock('../../src/backend/repositories/invitesRepository', () => ({
  createInvite: (...args: unknown[]) => createInviteRepo(...args),
  findPendingByAccountAndEmail: (...args: unknown[]) => findPendingByAccountAndEmail(...args),
  listPendingByAccount: (...args: unknown[]) => listPendingByAccount(...args),
  listByAccount: (...args: unknown[]) => listByAccount(...args),
  findByTokenHash: (...args: unknown[]) => findByTokenHash(...args),
  getByIdAndAccount: (...args: unknown[]) => getByIdAndAccount(...args),
  updateTokenAndIncrementSend: (...args: unknown[]) => updateTokenAndIncrementSend(...args),
  setStatusRevoked: (...args: unknown[]) => setStatusRevoked(...args),
  setStatusAcceptedIfPending: (...args: unknown[]) => setStatusAcceptedIfPending(...args),
  setStatusDeclined: (...args: unknown[]) => setStatusDeclined(...args),
}))

jest.mock('../../src/backend/repositories/accountMembersRepository', () => ({
  getMemberByAccountAndUser: (...args: unknown[]) => getMemberByAccountAndUser(...args),
  insertAccountMember: (...args: unknown[]) => insertAccountMember(...args),
  updateMemberRole: (...args: unknown[]) => updateMemberRole(...args),
  updateMemberStatus: (...args: unknown[]) => updateMemberStatus(...args),
  listMembers: jest.fn(),
  getMemberInAccount: jest.fn(),
  countActiveAdminsInAccount: jest.fn(),
}))

jest.mock('../../src/backend/database/userQueries', () => ({
  getUserByEmail: (...args: unknown[]) => getUserByEmail(...args),
}))

jest.mock('../../src/backend/repositories/rolesRepository', () => ({
  listRoleIdsAndNames: (...args: unknown[]) => listRoleIdsAndNames(...args),
}))

jest.mock('../../src/backend/repositories/accountsRepository', () => ({
  getAccountNameById: (...args: unknown[]) => getAccountNameById(...args),
  listAccountsForUser: jest.fn(),
}))

jest.mock('../../src/backend/utils/logAuditAction', () => ({
  logAuditAction: (...args: unknown[]) => logAuditAction(...args),
}))

jest.mock('../../src/backend/services/email/devEmailSender', () => ({
  devEmailSender: { sendInviteEmail: (...args: unknown[]) => sendInviteEmail(...args) },
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
  findPendingByAccountAndEmail.mockResolvedValue(null)
  listPendingByAccount.mockResolvedValue([])
  listByAccount.mockResolvedValue([])
  findByTokenHash.mockResolvedValue(null)
  getByIdAndAccount.mockResolvedValue(null)
  getUserByEmail.mockResolvedValue(null)
  listRoleIdsAndNames.mockResolvedValue([{ roleId: 1, roleName: 'Admin' }, { roleId: 2, roleName: 'Viewer' }])
  getAccountNameById.mockResolvedValue('Test Account')
})

describe('POST /api/backend/invites', () => {
  it('returns 201 when creating new invite with ACCOUNT_USER_MANAGE', async () => {
    createInviteRepo.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      email: 'new@example.com',
      roleId: 2,
      createdAt: new Date('2024-01-01'),
    })
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
      .post('/api/backend/invites')
      .set('Cookie', [`token=${token}`])
      .send({ email: 'new@example.com', roleId: 2 })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ email: 'new@example.com', roleId: 2, resent: false })
    expect(sendInviteEmail).toHaveBeenCalled()
    expect(logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invite.created', recordId: 1 }),
    )
  })

  it('returns 200 and resent when pending invite exists', async () => {
    findPendingByAccountAndEmail.mockResolvedValue({
      inviteId: 5,
      accountId: 1,
      email: 'pending@example.com',
      roleId: 2,
      status: 'Pending',
      createdAt: new Date('2024-01-01'),
    })
    listPendingByAccount.mockResolvedValue([
      {
        inviteId: 5,
        email: 'pending@example.com',
        roleId: 2,
        roleName: 'Viewer',
        invitedByUserId: 1,
        inviterName: 'Admin',
        sendCount: 2,
        lastSentAt: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(),
      },
    ])
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
      .post('/api/backend/invites')
      .set('Cookie', [`token=${token}`])
      .send({ email: 'pending@example.com', roleId: 1 })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ resent: true, roleId: 2, roleName: 'Viewer' })
    expect(updateTokenAndIncrementSend).toHaveBeenCalled()
    expect(logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invite.resent' }),
    )
  })

  it('returns 403 when user lacks ACCOUNT_USER_MANAGE', async () => {
    getAccountContextForUser.mockResolvedValueOnce({
      accountId: 1,
      roleId: 2,
      roleName: 'Viewer',
      permissions: [],
    })
    checkUserPermission.mockResolvedValue(false)
    const token = makeToken({
      userId: 1,
      roleId: 2,
      role: 'Viewer',
      email: 'v@example.com',
      name: 'Viewer',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/invites')
      .set('Cookie', [`token=${token}`])
      .send({ email: 'x@example.com', roleId: 2 })

    expect(res.status).toBe(403)
    expect(createInviteRepo).not.toHaveBeenCalled()
  })

  it('returns 400 when email missing', async () => {
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
      .post('/api/backend/invites')
      .set('Cookie', [`token=${token}`])
      .send({ roleId: 2 })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/email/i)
  })

  it('returns 409 when user already member', async () => {
    getUserByEmail.mockResolvedValue({ UserID: 99 })
    getMemberByAccountAndUser.mockResolvedValue({ accountMemberId: 10, userId: 99 })
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
      .post('/api/backend/invites')
      .set('Cookie', [`token=${token}`])
      .send({ email: 'member@example.com', roleId: 2 })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already a member/i)
    expect(createInviteRepo).not.toHaveBeenCalled()
  })
})

describe('GET /api/backend/invites', () => {
  it('returns 200 and list when user has ACCOUNT_USER_MANAGE', async () => {
    listByAccount.mockResolvedValue([
      {
        inviteId: 1,
        accountId: 1,
        email: 'a@example.com',
        roleId: 2,
        tokenHash: 'x'.repeat(64),
        status: 'Pending',
        roleName: 'Viewer',
        expiresAt: new Date(Date.now() + 86400000),
        invitedByUserId: 1,
        inviterName: 'Admin',
        sendCount: 1,
        lastSentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        acceptedByUserId: null,
        acceptedAt: null,
        revokedByUserId: null,
        revokedAt: null,
        accountName: 'Test Account',
      },
    ])
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
      .get('/api/backend/invites')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    expect(res.body.invites).toHaveLength(1)
    expect(res.body.invites[0]).toMatchObject({
      inviteId: 1,
      email: 'a@example.com',
      roleId: 2,
      roleName: 'Viewer',
      status: 'Pending',
      resolvedStatus: 'Pending',
    })
    expect(listByAccount).toHaveBeenCalledWith(1, 'pending')
  })

  it('returns 403 when user lacks permission', async () => {
    getAccountContextForUser.mockResolvedValueOnce({
      accountId: 1,
      roleId: 2,
      roleName: 'Viewer',
      permissions: [],
    })
    checkUserPermission.mockResolvedValue(false)
    const token = makeToken({
      userId: 1,
      roleId: 2,
      role: 'Viewer',
      email: 'v@example.com',
      name: 'Viewer',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .get('/api/backend/invites')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(403)
  })
})

describe('POST /api/backend/invites/:id/resend', () => {
  it('returns 200 when invite is Pending and in account', async () => {
    getByIdAndAccount.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      email: 'a@example.com',
      status: 'Pending',
    })
    listPendingByAccount.mockResolvedValue([
      {
        inviteId: 1,
        email: 'a@example.com',
        roleId: 2,
        roleName: 'Viewer',
        expiresAt: new Date(),
        invitedByUserId: 1,
        inviterName: 'Admin',
        sendCount: 2,
        lastSentAt: new Date(),
        createdAt: new Date(),
      },
    ])
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
      .post('/api/backend/invites/1/resend')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    expect(updateTokenAndIncrementSend).toHaveBeenCalledWith(1, expect.any(String), expect.any(Date))
    expect(sendInviteEmail).toHaveBeenCalled()
  })

  it('returns 404 when invite not in account', async () => {
    getByIdAndAccount.mockResolvedValue(null)
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
      .post('/api/backend/invites/999/resend')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(404)
    expect(updateTokenAndIncrementSend).not.toHaveBeenCalled()
  })
})

describe('POST /api/backend/invites/:id/revoke', () => {
  it('returns 204 when invite is Pending', async () => {
    getByIdAndAccount.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      email: 'a@example.com',
      status: 'Pending',
    })
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
      .post('/api/backend/invites/1/revoke')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(204)
    expect(setStatusRevoked).toHaveBeenCalledWith(1, 1)
    expect(logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invite.revoked' }),
    )
  })

  it('returns 404 when invite not found', async () => {
    getByIdAndAccount.mockResolvedValue(null)
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
      .post('/api/backend/invites/999/revoke')
      .set('Cookie', [`token=${token}`])

    expect(res.status).toBe(404)
    expect(setStatusRevoked).not.toHaveBeenCalled()
  })
})

describe('GET /api/backend/invites/by-token', () => {
  it('returns 200 with accountName and status when token valid', async () => {
    findByTokenHash.mockResolvedValue({
      accountName: 'Acme',
      status: 'Pending',
      expiresAt: new Date(Date.now() + 86400000),
    })

    const res = await request(app).get('/api/backend/invites/by-token?token=abc123')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accountName: 'Acme', status: 'pending' })
    expect(res.body.expiresAt).toBeDefined()
  })

  it('returns 404 when token invalid', async () => {
    findByTokenHash.mockResolvedValue(null)

    const res = await request(app).get('/api/backend/invites/by-token?token=bad')

    expect(res.status).toBe(404)
  })

  it('returns 400 when token missing', async () => {
    const res = await request(app).get('/api/backend/invites/by-token')

    expect(res.status).toBe(400)
  })
})

describe('POST /api/backend/invites/accept', () => {
  it('returns 200 and creates member when email matches', async () => {
    findByTokenHash.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      accountName: 'Test Account',
      email: 'invited@example.com',
      roleId: 2,
      roleName: 'Viewer',
      status: 'Pending',
      expiresAt: new Date(Date.now() + 86400000),
    })
    getMemberByAccountAndUser.mockResolvedValue(null)
    const token = makeToken({
      userId: 99,
      roleId: 2,
      role: 'Viewer',
      email: 'invited@example.com',
      name: 'Invited',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/invites/accept')
      .set('Cookie', [`token=${token}`])
      .send({ token: 'secret-token' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accountId: 1, accountName: 'Test Account' })
    expect(setStatusAcceptedIfPending).toHaveBeenCalledWith(1, 99)
    expect(insertAccountMember).toHaveBeenCalledWith(1, 99, 2)
    expect(setActiveAccountRepo).toHaveBeenCalledWith(99, 1)
    expect(logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invite.accepted' }),
    )
  })

  it('returns 403 when email does not match', async () => {
    findByTokenHash.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      accountName: 'Test',
      email: 'invited@example.com',
      roleId: 2,
      status: 'Pending',
      expiresAt: new Date(Date.now() + 86400000),
    })
    const token = makeToken({
      userId: 99,
      roleId: 2,
      role: 'Viewer',
      email: 'other@example.com',
      name: 'Other',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/invites/accept')
      .set('Cookie', [`token=${token}`])
      .send({ token: 'secret-token' })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/sign in with the email/i)
    expect(insertAccountMember).not.toHaveBeenCalled()
    expect(setStatusAcceptedIfPending).not.toHaveBeenCalled()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/backend/invites/accept')
      .send({ token: 'secret-token' })

    expect(res.status).toBe(401)
  })

  it('returns 409 when user is already an active member', async () => {
    findByTokenHash.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      accountName: 'Test',
      email: 'invited@example.com',
      roleId: 2,
      status: 'Pending',
      expiresAt: new Date(Date.now() + 86400000),
    })
    getMemberByAccountAndUser.mockResolvedValue({
      accountMemberId: 10,
      userId: 99,
      email: 'invited@example.com',
      roleId: 1,
      roleName: 'Admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      firstName: null,
      lastName: null,
    })
    const token = makeToken({
      userId: 99,
      roleId: 2,
      role: 'Viewer',
      email: 'invited@example.com',
      name: 'Invited',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/invites/accept')
      .set('Cookie', [`token=${token}`])
      .send({ token: 'secret-token' })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already an active member/i)
    expect(setStatusAcceptedIfPending).not.toHaveBeenCalled()
  })

  it('returns 410 when invite already accepted (double-accept)', async () => {
    findByTokenHash.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      accountName: 'Test',
      email: 'invited@example.com',
      roleId: 2,
      status: 'Pending',
      expiresAt: new Date(Date.now() + 86400000),
    })
    getMemberByAccountAndUser.mockResolvedValue(null)
    setStatusAcceptedIfPending.mockResolvedValueOnce(false)
    const token = makeToken({
      userId: 99,
      roleId: 2,
      role: 'Viewer',
      email: 'invited@example.com',
      name: 'Invited',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/invites/accept')
      .set('Cookie', [`token=${token}`])
      .send({ token: 'secret-token' })

    expect(res.status).toBe(410)
    expect(res.body.message).toMatch(/no longer valid/i)
    expect(insertAccountMember).not.toHaveBeenCalled()
  })

  it('returns 410 when invite expired', async () => {
    findByTokenHash.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      accountName: 'Test',
      email: 'invited@example.com',
      roleId: 2,
      status: 'Pending',
      expiresAt: new Date(Date.now() - 86400000),
    })
    const token = makeToken({
      userId: 99,
      roleId: 2,
      role: 'Viewer',
      email: 'invited@example.com',
      name: 'Invited',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/invites/accept')
      .set('Cookie', [`token=${token}`])
      .send({ token: 'secret-token' })

    expect(res.status).toBe(410)
    expect(res.body.message).toMatch(/expired/i)
  })

  it('returns 200 when JWT payload omits role field', async () => {
    findByTokenHash.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      accountName: 'Test Account',
      email: 'invited@example.com',
      roleId: 2,
      roleName: 'Viewer',
      status: 'Pending',
      expiresAt: new Date(Date.now() + 86400000),
    })
    getMemberByAccountAndUser.mockResolvedValue(null)
    const token = makeToken({
      userId: 99,
      roleId: 2,
      email: 'invited@example.com',
      name: 'Invited',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/invites/accept')
      .set('Cookie', [`token=${token}`])
      .send({ token: 'secret-token' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accountId: 1, accountName: 'Test Account' })
    expect(setStatusAcceptedIfPending).toHaveBeenCalledWith(1, 99)
    expect(insertAccountMember).toHaveBeenCalledWith(1, 99, 2)
    expect(setActiveAccountRepo).toHaveBeenCalledWith(99, 1)
  })
})

describe('POST /api/backend/invites/decline', () => {
  it('returns 204 when token valid (anonymous decline does not audit)', async () => {
    findByTokenHash.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      email: 'a@example.com',
      status: 'Pending',
      expiresAt: new Date(Date.now() + 86400000),
    })

    const res = await request(app)
      .post('/api/backend/invites/decline')
      .send({ token: 'decline-token' })

    expect(res.status).toBe(204)
    expect(setStatusDeclined).toHaveBeenCalledWith(1)
    expect(logAuditAction).not.toHaveBeenCalled()
  })

  it('returns 404 when token invalid', async () => {
    findByTokenHash.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/backend/invites/decline')
      .send({ token: 'bad' })

    expect(res.status).toBe(404)
  })

  it('returns 400 when token missing', async () => {
    const res = await request(app).post('/api/backend/invites/decline').send({})

    expect(res.status).toBe(400)
  })

  it('returns 403 when authenticated user email does not match invite email', async () => {
    findByTokenHash.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      email: 'invited@example.com',
      status: 'Pending',
      expiresAt: new Date(Date.now() + 86400000),
    })
    const token = makeToken({
      userId: 99,
      roleId: 2,
      role: 'Viewer',
      email: 'other@example.com',
      name: 'Other',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/invites/decline')
      .set('Cookie', [`token=${token}`])
      .send({ token: 'decline-token' })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/sign in with the email address/i)
    expect(setStatusDeclined).not.toHaveBeenCalled()
  })

  it('returns 204 when authenticated user email matches invite email', async () => {
    findByTokenHash.mockResolvedValue({
      inviteId: 1,
      accountId: 1,
      email: 'invited@example.com',
      status: 'Pending',
      expiresAt: new Date(Date.now() + 86400000),
    })
    const token = makeToken({
      userId: 99,
      roleId: 2,
      role: 'Viewer',
      email: 'invited@example.com',
      name: 'Invited',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/invites/decline')
      .set('Cookie', [`token=${token}`])
      .send({ token: 'decline-token' })

    expect(res.status).toBe(204)
    expect(setStatusDeclined).toHaveBeenCalledWith(1)
  })
})
