/**
 * PATCH /status, POST /transfer-ownership, DELETE / (owner-only)
 */
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import accountGovernanceRoutes from '../../src/backend/routes/accountGovernanceRoutes'
import { errorHandler } from '../../src/backend/middleware/errorHandler'
import { assertForbidden } from '../helpers/httpAsserts'
import {
  USER_ID_1,
  USER_ID_2,
  USER_ID_99,
  USER_ID_999,
  ACCOUNT_ID_1,
  ACCOUNT_ID_5,
  MEMBER_ID_10,
  MEMBER_ID_20,
  ROLE_ID_ADMIN,
  ROLE_ID_NON_ADMIN,
  ROLE_ADMIN,
  ROLE_ENGINEER,
  makeTokenPayload,
  makeAccount,
  makeMember,
  makeAccountContext,
  FIXED_DATE,
} from '../helpers/fixtures'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

const defaultContext = makeAccountContext({
  accountId: ACCOUNT_ID_1,
  roleId: ROLE_ID_ADMIN,
  roleName: ROLE_ADMIN,
  permissions: [],
  isOwner: true,
  ownerUserId: USER_ID_1,
})

const getAccountContextForUser = jest.fn().mockResolvedValue(defaultContext)
const getAccountContextForUserAndAccount = jest.fn().mockResolvedValue(null)
const getDefaultAccountId = jest.fn().mockResolvedValue(ACCOUNT_ID_1)
const getActiveAccountId = jest.fn().mockResolvedValue(ACCOUNT_ID_5)
const getStoredActiveAccountId = jest.fn().mockResolvedValue(null)
const clearActiveAccount = jest.fn().mockResolvedValue(undefined)

const getAccountById = jest.fn().mockResolvedValue(null)
const updateAccount = jest.fn().mockResolvedValue(null)
const updateAccountOwner = jest.fn().mockResolvedValue(undefined)
const getMemberByAccountAndUser = jest.fn().mockResolvedValue(null)
const setMemberIsOwner = jest.fn().mockResolvedValue(undefined)
const clearAccountMemberOwnerFlags = jest.fn().mockResolvedValue(undefined)

jest.mock('../../src/backend/database/accountContextQueries', () => ({
  getAccountContextForUser: (...args: unknown[]) => getAccountContextForUser(...args),
  getAccountContextForUserAndAccount: (...args: unknown[]) => getAccountContextForUserAndAccount(...args),
  getDefaultAccountId: (...args: unknown[]) => getDefaultAccountId(...args),
  getActiveAccountId: (...args: unknown[]) => getActiveAccountId(...args),
}))

jest.mock('../../src/backend/repositories/userActiveAccountRepository', () => ({
  getActiveAccountId: (...args: unknown[]) => getStoredActiveAccountId(...args),
  setActiveAccount: jest.fn().mockResolvedValue(undefined),
  clearActiveAccount: (...args: unknown[]) => clearActiveAccount(...args),
}))

jest.mock('../../src/backend/repositories/accountsRepository', () => ({
  getAccountById: (...args: unknown[]) => getAccountById(...args),
  updateAccount: (...args: unknown[]) => updateAccount(...args),
  updateAccountOwner: (...args: unknown[]) => updateAccountOwner(...args),
}))

jest.mock('../../src/backend/repositories/accountMembersRepository', () => ({
  getMemberByAccountAndUser: (...args: unknown[]) => getMemberByAccountAndUser(...args),
  setMemberIsOwner: (...args: unknown[]) => setMemberIsOwner(...args),
  clearAccountMemberOwnerFlags: (...args: unknown[]) => clearAccountMemberOwnerFlags(...args),
}))

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '1h' })
}

function createApp(): express.Express {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/account-governance', accountGovernanceRoutes)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  jest.clearAllMocks()
  getAccountContextForUser.mockResolvedValue(defaultContext)
  getStoredActiveAccountId.mockResolvedValue(null)
})

describe('PATCH /api/backend/account-governance/status', () => {
  it('returns 200 and updates status when owner', async () => {
    updateAccount.mockResolvedValueOnce(
      makeAccount({
        accountId: ACCOUNT_ID_1,
        accountName: 'Acme',
        slug: 'acme',
        isActive: false,
        ownerUserId: USER_ID_1,
      })
    )
    const token = makeToken(
      makeTokenPayload({
        userId: USER_ID_1,
        roleId: ROLE_ID_ADMIN,
        role: ROLE_ADMIN,
        email: 'owner@example.com',
        name: 'Owner',
        profilePic: null,
        permissions: [],
      })
    )
    const app = createApp()
    const res = await request(app)
      .patch('/api/backend/account-governance/status')
      .set('Cookie', [`token=${token}`])
      .send({ isActive: false })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isActive: false })
    expect(updateAccount).toHaveBeenCalledWith(ACCOUNT_ID_1, { isActive: false })
  })

  it('returns 403 when user is not owner', async () => {
    getAccountContextForUser.mockResolvedValueOnce(
      makeAccountContext({
        accountId: ACCOUNT_ID_1,
        roleId: ROLE_ID_NON_ADMIN,
        roleName: ROLE_ENGINEER,
        permissions: [],
        isOwner: false,
        ownerUserId: USER_ID_99,
      })
    )
    const token = makeToken(
      makeTokenPayload({
        userId: USER_ID_1,
        roleId: ROLE_ID_NON_ADMIN,
        role: ROLE_ENGINEER,
        email: 'e@example.com',
        name: 'Engineer',
        profilePic: null,
        permissions: [],
      })
    )
    const app = createApp()
    const res = await request(app)
      .patch('/api/backend/account-governance/status')
      .set('Cookie', [`token=${token}`])
      .send({ isActive: true })
    assertForbidden(res)
    expect(res.body.message).toBe('Owner access required')
    expect(updateAccount).not.toHaveBeenCalled()
  })

  it('returns 400 when isActive missing', async () => {
    const token = makeToken(
      makeTokenPayload({
        userId: USER_ID_1,
        roleId: ROLE_ID_ADMIN,
        role: ROLE_ADMIN,
        email: 'owner@example.com',
        name: 'Owner',
        profilePic: null,
        permissions: [],
      })
    )
    const app = createApp()
    const res = await request(app)
      .patch('/api/backend/account-governance/status')
      .set('Cookie', [`token=${token}`])
      .send({})
    expect(res.status).toBe(400)
  })
})

describe('POST /api/backend/account-governance/transfer-ownership', () => {
  it('returns 200 and transfers when target is active member', async () => {
    getAccountById.mockResolvedValueOnce(
      makeAccount({
        accountId: ACCOUNT_ID_1,
        accountName: 'Acme',
        slug: 'acme',
        isActive: true,
        ownerUserId: USER_ID_1,
      })
    )
    getMemberByAccountAndUser.mockResolvedValueOnce(
      makeMember({
        accountMemberId: MEMBER_ID_20,
        userId: USER_ID_2,
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'Owner',
        roleId: ROLE_ID_NON_ADMIN,
        roleName: ROLE_ADMIN,
        isActive: true,
        isOwner: false,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      })
    )
    getMemberByAccountAndUser.mockResolvedValueOnce(
      makeMember({
        accountMemberId: MEMBER_ID_10,
        userId: USER_ID_1,
        email: 'old@example.com',
        firstName: 'Old',
        lastName: 'Owner',
        roleId: ROLE_ID_ADMIN,
        roleName: ROLE_ADMIN,
        isActive: true,
        isOwner: true,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      })
    )
    const token = makeToken(
      makeTokenPayload({
        userId: USER_ID_1,
        roleId: ROLE_ID_ADMIN,
        role: ROLE_ADMIN,
        email: 'owner@example.com',
        name: 'Owner',
        profilePic: null,
        permissions: [],
      })
    )
    const app = createApp()
    const res = await request(app)
      .post('/api/backend/account-governance/transfer-ownership')
      .set('Cookie', [`token=${token}`])
      .send({ targetUserId: USER_ID_2 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ownerUserId: USER_ID_2 })
    expect(updateAccountOwner).toHaveBeenCalledWith(ACCOUNT_ID_1, USER_ID_2, expect.anything())
    expect(clearAccountMemberOwnerFlags).toHaveBeenCalledWith(ACCOUNT_ID_1, expect.anything())
    expect(setMemberIsOwner).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when target is already owner', async () => {
    const token = makeToken(
      makeTokenPayload({
        userId: USER_ID_1,
        roleId: ROLE_ID_ADMIN,
        role: ROLE_ADMIN,
        email: 'owner@example.com',
        name: 'Owner',
        profilePic: null,
        permissions: [],
      })
    )
    const app = createApp()
    const res = await request(app)
      .post('/api/backend/account-governance/transfer-ownership')
      .set('Cookie', [`token=${token}`])
      .send({ targetUserId: USER_ID_1 })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already the owner/i)
    expect(updateAccountOwner).not.toHaveBeenCalled()
  })

  it('returns 404 when target is not a member', async () => {
    getMemberByAccountAndUser.mockReset()
    getMemberByAccountAndUser.mockResolvedValue(null)
    const token = makeToken(
      makeTokenPayload({
        userId: USER_ID_1,
        roleId: ROLE_ID_ADMIN,
        role: ROLE_ADMIN,
        email: 'owner@example.com',
        name: 'Owner',
        profilePic: null,
        permissions: [],
      })
    )
    const app = createApp()
    const res = await request(app)
      .post('/api/backend/account-governance/transfer-ownership')
      .set('Cookie', [`token=${token}`])
      .send({ targetUserId: USER_ID_999 })
    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not a member/i)
    expect(updateAccountOwner).not.toHaveBeenCalled()
  })

  it('returns 400 when targetUserId missing', async () => {
    const token = makeToken(
      makeTokenPayload({
        userId: USER_ID_1,
        roleId: ROLE_ID_ADMIN,
        role: ROLE_ADMIN,
        email: 'owner@example.com',
        name: 'Owner',
        profilePic: null,
        permissions: [],
      })
    )
    const app = createApp()
    const res = await request(app)
      .post('/api/backend/account-governance/transfer-ownership')
      .set('Cookie', [`token=${token}`])
      .send({})
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/backend/account-governance', () => {
  it('returns 200 and soft-deletes when owner', async () => {
    updateAccount.mockResolvedValueOnce(
      makeAccount({
        accountId: ACCOUNT_ID_1,
        accountName: 'Acme',
        slug: 'acme',
        isActive: false,
        ownerUserId: USER_ID_1,
      })
    )
    const token = makeToken(
      makeTokenPayload({
        userId: USER_ID_1,
        roleId: ROLE_ID_ADMIN,
        role: ROLE_ADMIN,
        email: 'owner@example.com',
        name: 'Owner',
        profilePic: null,
        permissions: [],
      })
    )
    const app = createApp()
    const res = await request(app)
      .delete('/api/backend/account-governance')
      .set('Cookie', [`token=${token}`])
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isActive: false })
    expect(updateAccount).toHaveBeenCalledWith(ACCOUNT_ID_1, { isActive: false })
  })

  it('returns 403 when user is not owner', async () => {
    getAccountContextForUser.mockResolvedValueOnce(
      makeAccountContext({
        accountId: ACCOUNT_ID_1,
        roleId: ROLE_ID_NON_ADMIN,
        roleName: ROLE_ENGINEER,
        permissions: [],
        isOwner: false,
        ownerUserId: USER_ID_99,
      })
    )
    const token = makeToken(
      makeTokenPayload({
        userId: USER_ID_1,
        roleId: ROLE_ID_NON_ADMIN,
        role: ROLE_ENGINEER,
        email: 'e@example.com',
        name: 'Engineer',
        profilePic: null,
        permissions: [],
      })
    )
    const app = createApp()
    const res = await request(app)
      .delete('/api/backend/account-governance')
      .set('Cookie', [`token=${token}`])
    assertForbidden(res)
    expect(updateAccount).not.toHaveBeenCalled()
  })
})
