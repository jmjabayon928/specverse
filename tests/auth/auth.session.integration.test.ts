/**
 * Integration test: login sets cookie, session requires it, logout clears it.
 * - POST /api/backend/auth/login sets Set-Cookie: sid=... with expected flags
 * - GET /api/backend/auth/session returns 401 without cookie
 * - GET /api/backend/auth/session returns 200 with cookie from login
 * - POST /api/backend/auth/logout clears cookie; session returns 401 again
 */
import request from 'supertest'

const getAccountContextForUser = jest.fn().mockResolvedValue({
  accountId: 1,
  roleId: 1,
  roleName: 'Admin',
  permissions: ['ACCOUNT_VIEW'],
})

let mockUserRecord: {
  UserID: number
  FirstName: string
  LastName: string
  Email: string
  PasswordHash: string
  RoleID: number
  ProfilePic: string | null
  RoleName: string
} | null = null

jest.mock('../../src/backend/config/db', () => {
  const mssql = require('mssql')
  return {
    sql: mssql,
    poolPromise: Promise.resolve({
      request: () => ({
        input: jest.fn().mockReturnThis(),
        query: () =>
          Promise.resolve({
            recordset: mockUserRecord != null ? [mockUserRecord] : [],
          }),
      }),
    }),
  }
})

jest.mock('../../src/backend/database/accountContextQueries', () => ({
  getAccountContextForUser: (...args: unknown[]) => getAccountContextForUser(...args),
  getAccountContextForUserAndAccount: jest.fn(),
  getDefaultAccountId: jest.fn(),
  getActiveAccountId: jest.fn(),
}))

jest.mock('../../src/backend/database/platformAdminPort', () => ({
  isUserPlatformAdmin: jest.fn().mockResolvedValue(false),
}))

jest.mock('../../src/backend/repositories/userActiveAccountRepository', () => ({
  getActiveAccountId: jest.fn().mockResolvedValue(null),
  clearActiveAccount: jest.fn().mockResolvedValue(undefined),
}))

const bcryptCompare = jest.fn()
jest.mock('bcryptjs', () => ({
  compare: (...args: unknown[]) => bcryptCompare(...args),
}))

jest.mock('../../src/backend/services/passwordHasher', () => ({
  verifyPassword: jest.fn(),
  hashPassword: jest.fn(),
}))

const loadSessionData = jest.fn()
const revokeSession = jest.fn()
jest.mock('../../src/backend/services/authSessionsService', () => ({
  getSidFromRequest: (req: { cookies?: { sid?: string } }) => req.cookies?.sid ?? null,
  loadSessionData: (...args: unknown[]) => loadSessionData(...args),
  revokeSession: (...args: unknown[]) => revokeSession(...args),
}))

import app from '../../src/backend/app'
import { assertUnauthenticated } from '../helpers/httpAsserts'

function getSidFromSetCookie(setCookie: string[] | undefined): string | null {
  if (!setCookie || !Array.isArray(setCookie) || setCookie.length === 0) return null
  const first = setCookie[0]
  const match = /sid=([^;]+)/.exec(first)
  return match ? match[1] : null
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUserRecord = {
    UserID: 1,
    FirstName: 'Test',
    LastName: 'User',
    Email: 'session@example.com',
    PasswordHash: '$2b$10$abcdefghijklmnopqrstuv',
    RoleID: 1,
    ProfilePic: null,
    RoleName: 'Admin',
  }
  getAccountContextForUser.mockResolvedValue({
    accountId: 1,
    roleId: 1,
    roleName: 'Admin',
    permissions: ['ACCOUNT_VIEW'],
  })
  bcryptCompare.mockResolvedValue(true)
  revokeSession.mockResolvedValue(undefined)
  loadSessionData.mockImplementation((sid: string) =>
    Promise.resolve(
      sid
        ? {
            userId: 1,
            accountId: 1,
            roleId: 1,
            role: 'Admin',
            email: 'session@example.com',
            name: 'Test User',
            profilePic: null,
            permissions: ['ACCOUNT_VIEW'],
            isSuperadmin: false,
          }
        : null,
    ),
  )
})

describe('auth session integration', () => {
  it('POST /api/backend/auth/login sets Set-Cookie: sid=... with expected flags', async () => {
    const res = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'session@example.com', password: 'secret123' })

    expect(res.status).toBe(200)
    const setCookie = res.headers['set-cookie']
    expect(setCookie).toBeDefined()
    expect(Array.isArray(setCookie)).toBe(true)
    expect(setCookie!.length).toBeGreaterThan(0)
    const cookieStr = setCookie![0]
    expect(cookieStr).toMatch(/^sid=[^;]+/)
    expect(cookieStr).toContain('Path=/')
    expect(cookieStr).toContain('HttpOnly')
    expect(cookieStr).toContain('SameSite=Lax')
  })

  it('GET /api/backend/auth/session returns 401 without cookie', async () => {
    const res = await request(app).get('/api/backend/auth/session')
    assertUnauthenticated(res)
  })

  it('GET /api/backend/auth/session returns 200 with cookie from login response', async () => {
    const loginRes = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'session@example.com', password: 'secret123' })

    expect(loginRes.status).toBe(200)
    const sid = getSidFromSetCookie(loginRes.headers['set-cookie'])
    expect(sid).toBeTruthy()

    const sessionRes = await request(app)
      .get('/api/backend/auth/session')
      .set('Cookie', [`sid=${sid}`])

    expect(sessionRes.status).toBe(200)
    expect(sessionRes.body).toHaveProperty('userId', 1)
    expect(sessionRes.body).toHaveProperty('roleId', 1)
    expect(sessionRes.body).toHaveProperty('role', 'Admin')
  })

  it('POST /api/backend/auth/logout clears cookie and session returns 401 again', async () => {
    const loginRes = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'session@example.com', password: 'secret123' })

    expect(loginRes.status).toBe(200)
    const sid = getSidFromSetCookie(loginRes.headers['set-cookie'])
    expect(sid).toBeTruthy()

    const sessionAfterLogin = await request(app)
      .get('/api/backend/auth/session')
      .set('Cookie', [`sid=${sid}`])
    expect(sessionAfterLogin.status).toBe(200)

    const logoutRes = await request(app)
      .post('/api/backend/auth/logout')
      .set('Cookie', [`sid=${sid}`])
    expect(logoutRes.status).toBe(204)
    expect(logoutRes.headers['set-cookie']).toBeDefined()
    const clearCookie = logoutRes.headers['set-cookie'] as string[]
    expect(clearCookie.some((c) => c.includes('sid=') && (c.includes('Max-Age=0') || c.includes('Expires=')))).toBe(true)

    const sessionAfterLogout = await request(app).get('/api/backend/auth/session')
    assertUnauthenticated(sessionAfterLogout)
  })
})
