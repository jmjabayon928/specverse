/**
 * PATCH /status, POST /transfer-ownership, DELETE / (owner-only)
 */
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import accountGovernanceRoutes from '../../src/backend/routes/accountGovernanceRoutes'
import { errorHandler } from '../../src/backend/middleware/errorHandler'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

const defaultContext = {
  accountId: 1,
  roleId: 1,
  roleName: 'Admin',
  permissions: [],
  isOwner: true,
  ownerUserId: 1,
}

const getAccountContextForUser = jest.fn().mockResolvedValue(defaultContext)
const getAccountContextForUserAndAccount = jest.fn().mockResolvedValue(null)
const getDefaultAccountId = jest.fn().mockResolvedValue(1)
const getActiveAccountId = jest.fn().mockResolvedValue(5)
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
    updateAccount.mockResolvedValueOnce({
      accountId: 1,
      accountName: 'Acme',
      slug: 'acme',
      isActive: false,
      ownerUserId: 1,
    })
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'owner@example.com',
      name: 'Owner',
      profilePic: null,
      permissions: [],
    })
    const app = createApp()
    const res = await request(app)
      .patch('/api/backend/account-governance/status')
      .set('Cookie', [`token=${token}`])
      .send({ isActive: false })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isActive: false })
    expect(updateAccount).toHaveBeenCalledWith(1, { isActive: false })
  })

  it('returns 403 when user is not owner', async () => {
    getAccountContextForUser.mockResolvedValueOnce({
      accountId: 1,
      roleId: 2,
      roleName: 'Engineer',
      permissions: [],
      isOwner: false,
      ownerUserId: 99,
    })
    const token = makeToken({
      userId: 1,
      roleId: 2,
      role: 'Engineer',
      email: 'e@example.com',
      name: 'Engineer',
      profilePic: null,
      permissions: [],
    })
    const app = createApp()
    const res = await request(app)
      .patch('/api/backend/account-governance/status')
      .set('Cookie', [`token=${token}`])
      .send({ isActive: true })
    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Owner access required')
    expect(updateAccount).not.toHaveBeenCalled()
  })

  it('returns 400 when isActive missing', async () => {
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'owner@example.com',
      name: 'Owner',
      profilePic: null,
      permissions: [],
    })
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
    getAccountById.mockResolvedValueOnce({
      accountId: 1,
      accountName: 'Acme',
      slug: 'acme',
      isActive: true,
      ownerUserId: 1,
    })
    getMemberByAccountAndUser.mockResolvedValueOnce({
      accountMemberId: 20,
      userId: 2,
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'Owner',
      roleId: 2,
      roleName: 'Admin',
      isActive: true,
      isOwner: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    getMemberByAccountAndUser.mockResolvedValueOnce({
      accountMemberId: 10,
      userId: 1,
      email: 'old@example.com',
      firstName: 'Old',
      lastName: 'Owner',
      roleId: 1,
      roleName: 'Admin',
      isActive: true,
      isOwner: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'owner@example.com',
      name: 'Owner',
      profilePic: null,
      permissions: [],
    })
    const app = createApp()
    const res = await request(app)
      .post('/api/backend/account-governance/transfer-ownership')
      .set('Cookie', [`token=${token}`])
      .send({ targetUserId: 2 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ownerUserId: 2 })
    expect(updateAccountOwner).toHaveBeenCalledWith(1, 2, expect.anything())
    expect(clearAccountMemberOwnerFlags).toHaveBeenCalledWith(1, expect.anything())
    expect(setMemberIsOwner).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when target is already owner', async () => {
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'owner@example.com',
      name: 'Owner',
      profilePic: null,
      permissions: [],
    })
    const app = createApp()
    const res = await request(app)
      .post('/api/backend/account-governance/transfer-ownership')
      .set('Cookie', [`token=${token}`])
      .send({ targetUserId: 1 })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already the owner/i)
    expect(updateAccountOwner).not.toHaveBeenCalled()
  })

  it('returns 404 when target is not a member', async () => {
    getMemberByAccountAndUser.mockReset()
    getMemberByAccountAndUser.mockResolvedValue(null)
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'owner@example.com',
      name: 'Owner',
      profilePic: null,
      permissions: [],
    })
    const app = createApp()
    const res = await request(app)
      .post('/api/backend/account-governance/transfer-ownership')
      .set('Cookie', [`token=${token}`])
      .send({ targetUserId: 999 })
    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not a member/i)
    expect(updateAccountOwner).not.toHaveBeenCalled()
  })

  it('returns 400 when targetUserId missing', async () => {
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'owner@example.com',
      name: 'Owner',
      profilePic: null,
      permissions: [],
    })
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
    updateAccount.mockResolvedValueOnce({
      accountId: 1,
      accountName: 'Acme',
      slug: 'acme',
      isActive: false,
      ownerUserId: 1,
    })
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'owner@example.com',
      name: 'Owner',
      profilePic: null,
      permissions: [],
    })
    const app = createApp()
    const res = await request(app)
      .delete('/api/backend/account-governance')
      .set('Cookie', [`token=${token}`])
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ isActive: false })
    expect(updateAccount).toHaveBeenCalledWith(1, { isActive: false })
  })

  it('returns 403 when user is not owner', async () => {
    getAccountContextForUser.mockResolvedValueOnce({
      accountId: 1,
      roleId: 2,
      roleName: 'Engineer',
      permissions: [],
      isOwner: false,
      ownerUserId: 99,
    })
    const token = makeToken({
      userId: 1,
      roleId: 2,
      role: 'Engineer',
      email: 'e@example.com',
      name: 'Engineer',
      profilePic: null,
      permissions: [],
    })
    const app = createApp()
    const res = await request(app)
      .delete('/api/backend/account-governance')
      .set('Cookie', [`token=${token}`])
    expect(res.status).toBe(403)
    expect(updateAccount).not.toHaveBeenCalled()
  })
})
