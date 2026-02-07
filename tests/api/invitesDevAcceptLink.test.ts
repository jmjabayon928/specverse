/**
 * DEV-only endpoint: POST /api/backend/invites/:id/dev-accept-link
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

const getByIdAndAccount = jest.fn().mockResolvedValue(null)
const updateTokenAndIncrementSend = jest.fn().mockResolvedValue(undefined)
const findByTokenHash = jest.fn().mockResolvedValue(null)
const setStatusAcceptedIfPending = jest.fn().mockResolvedValue(true)
const getMemberByAccountAndUser = jest.fn().mockResolvedValue(null)
const insertAccountMember = jest.fn().mockResolvedValue(undefined)
const updateMemberRole = jest.fn().mockResolvedValue(undefined)
const updateMemberStatus = jest.fn().mockResolvedValue(undefined)
const setActiveAccountRepo = jest.fn().mockResolvedValue(undefined)
const getUserByEmail = jest.fn().mockResolvedValue(null)
const getAccountNameById = jest.fn().mockResolvedValue('Test Account')
const logAuditAction = jest.fn().mockResolvedValue(undefined)
const createUser = jest.fn().mockResolvedValue(999)
const updateUser = jest.fn().mockResolvedValue(undefined)

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
  createInvite: jest.fn(),
  findPendingByAccountAndEmail: jest.fn(),
  listPendingByAccount: jest.fn(),
  findByTokenHash: (...args: unknown[]) => findByTokenHash(...args),
  getByIdAndAccount: (...args: unknown[]) => getByIdAndAccount(...args),
  updateTokenAndIncrementSend: (...args: unknown[]) => updateTokenAndIncrementSend(...args),
  setStatusRevoked: jest.fn(),
  setStatusAcceptedIfPending: (...args: unknown[]) => setStatusAcceptedIfPending(...args),
  setStatusDeclined: jest.fn(),
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
  listRoleIdsAndNames: jest.fn().mockResolvedValue([{ roleId: 1, roleName: 'Admin' }, { roleId: 2, roleName: 'Viewer' }]),
}))

jest.mock('../../src/backend/repositories/accountsRepository', () => ({
  getAccountNameById: (...args: unknown[]) => getAccountNameById(...args),
  listAccountsForUser: jest.fn(),
}))

jest.mock('../../src/backend/utils/logAuditAction', () => ({
  logAuditAction: (...args: unknown[]) => logAuditAction(...args),
}))

jest.mock('../../src/backend/services/email/devEmailSender', () => ({
  devEmailSender: { sendInviteEmail: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('../../src/backend/services/usersService', () => ({
  createUser: (...args: unknown[]) => createUser(...args),
  updateUser: (...args: unknown[]) => updateUser(...args),
}))

import app from '../../src/backend/app'

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '1h' })
}

const pendingInviteRow = {
  inviteId: 1,
  accountId: 1,
  accountName: 'Test Account',
  email: 'devlink@example.com',
  roleId: 2,
  roleName: 'Viewer',
  status: 'Pending' as const,
  expiresAt: new Date(Date.now() + 86400000),
  tokenHash: '',
  invitedByUserId: 1,
  inviterName: 'Admin',
  createdAt: new Date(),
  updatedAt: new Date(),
  acceptedByUserId: null,
  acceptedAt: null,
  revokedByUserId: null,
  revokedAt: null,
  sendCount: 1,
  lastSentAt: null as Date | null,
}

beforeEach(() => {
  jest.clearAllMocks()
  getAccountContextForUser.mockResolvedValue(defaultContext)
  getStoredActiveAccountId.mockResolvedValue(null)
  checkUserPermission.mockResolvedValue(true)
  getByIdAndAccount.mockResolvedValue(null)
  findByTokenHash.mockResolvedValue(null)
  getUserByEmail.mockResolvedValue(null)
  getMemberByAccountAndUser.mockResolvedValue(null)
  setStatusAcceptedIfPending.mockResolvedValue(true)
  createUser.mockResolvedValue(999)
  getAccountNameById.mockResolvedValue('Test Account')
})

describe('POST /api/backend/invites/:id/dev-accept-link', () => {
  it('returns 404 when NODE_ENV is production', async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    getByIdAndAccount.mockResolvedValueOnce(pendingInviteRow)
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
      .post('/api/backend/invites/1/dev-accept-link')
      .set('Cookie', [`token=${token}`])

    process.env.NODE_ENV = prev
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ message: 'Not found' })
    expect(updateTokenAndIncrementSend).not.toHaveBeenCalled()
  })

  it('returns 200 with acceptUrl and token works for accept-public when NODE_ENV is development', async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    getByIdAndAccount.mockResolvedValue({ ...pendingInviteRow })
    let capturedTokenHash: string | null = null
    updateTokenAndIncrementSend.mockImplementation(
      (inviteId: number, tokenHash: string, _expiresAt: Date) => {
        capturedTokenHash = tokenHash
        return Promise.resolve()
      },
    )
    findByTokenHash.mockImplementation((hash: string) => {
      if (capturedTokenHash !== null && hash === capturedTokenHash) {
        return Promise.resolve({ ...pendingInviteRow })
      }
      return Promise.resolve(null)
    })

    const adminToken = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'admin@example.com',
      name: 'Admin',
      profilePic: null,
      permissions: ['ACCOUNT_USER_MANAGE'],
    })

    const linkRes = await request(app)
      .post('/api/backend/invites/1/dev-accept-link')
      .set('Cookie', [`token=${adminToken}`])

    expect(linkRes.status).toBe(200)
    expect(linkRes.body).toHaveProperty('acceptUrl')
    expect(linkRes.body.acceptUrl).toMatch(/\/invite\/accept\?token=/)
    expect(updateTokenAndIncrementSend).toHaveBeenCalledWith(1, expect.any(String), expect.any(Date))

    const tokenMatch = linkRes.body.acceptUrl.match(/[?&]token=([^&]+)/)
    expect(tokenMatch).toBeTruthy()
    const plainToken = tokenMatch != null ? decodeURIComponent(tokenMatch[1]) : ''

    const acceptRes = await request(app)
      .post('/api/backend/invites/accept-public')
      .send({
        token: plainToken,
        firstName: 'Dev',
        lastName: 'User',
        password: 'SecurePass1!',
      })

    expect(acceptRes.status).toBe(200)
    expect(acceptRes.body).toMatchObject({ accountId: 1, accountName: 'Test Account' })
    expect(setStatusAcceptedIfPending).toHaveBeenCalledWith(1, 999)
    expect(insertAccountMember).toHaveBeenCalledWith(1, 999, 2)
    expect(setActiveAccountRepo).toHaveBeenCalledWith(999, 1)

    process.env.NODE_ENV = prev
  })

  it('returns 404 when invite not found (development)', async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
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
      .post('/api/backend/invites/999/dev-accept-link')
      .set('Cookie', [`token=${token}`])

    process.env.NODE_ENV = prev
    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not found/i)
    expect(updateTokenAndIncrementSend).not.toHaveBeenCalled()
  })

  it('returns 410 when invite is not Pending (development)', async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    getByIdAndAccount.mockResolvedValue({ ...pendingInviteRow, status: 'Accepted' })
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
      .post('/api/backend/invites/1/dev-accept-link')
      .set('Cookie', [`token=${token}`])

    process.env.NODE_ENV = prev
    expect(res.status).toBe(410)
    expect(res.body.message).toMatch(/no longer valid/i)
    expect(updateTokenAndIncrementSend).not.toHaveBeenCalled()
  })

  it('returns 410 when invite is expired (development)', async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    getByIdAndAccount.mockResolvedValue({
      ...pendingInviteRow,
      expiresAt: new Date(Date.now() - 86400000),
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
      .post('/api/backend/invites/1/dev-accept-link')
      .set('Cookie', [`token=${token}`])

    process.env.NODE_ENV = prev
    expect(res.status).toBe(410)
    expect(res.body.message).toMatch(/expired/i)
    expect(updateTokenAndIncrementSend).not.toHaveBeenCalled()
  })
})
