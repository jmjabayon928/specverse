/**
 * Sid cookie Secure flag is set when req.secure is true (proxy-aware), not only NODE_ENV.
 * Requires BACKEND_TRUST_PROXY so Express sets req.secure from X-Forwarded-Proto.
 */

const mockLogin = jest.fn()
const mockGetAccountContext = jest.fn()
const mockCreateAuthSession = jest.fn()
const mockHashSid = jest.fn((s: string) => s + '_hashed')

jest.mock('../../src/backend/services/authService', () => ({
  loginWithEmailAndPassword: (...args: unknown[]) => mockLogin(...args),
}))
jest.mock('../../src/backend/database/accountContextQueries', () => ({
  getAccountContextForUser: (...args: unknown[]) => mockGetAccountContext(...args),
}))
jest.mock('../../src/backend/repositories/authSessionsRepository', () => ({
  createAuthSession: (...args: unknown[]) => mockCreateAuthSession(...args),
  hashSid: (...args: unknown[]) => mockHashSid(...args),
}))

import type { Application } from 'express'
import request from 'supertest'

let app: Application
let originalTrustProxy: string | undefined
let originalConsoleLog: typeof console.log

describe('POST /api/backend/auth/login – sid cookie Secure when req.secure', () => {
  beforeAll(() => {
    originalTrustProxy = process.env.BACKEND_TRUST_PROXY
    process.env.BACKEND_TRUST_PROXY = '1'
    originalConsoleLog = console.log
    console.log = jest.fn()
    jest.resetModules()
    jest.isolateModules(() => {
      app = require('../../src/backend/app').default
    })
  })

  afterAll(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.BACKEND_TRUST_PROXY
    } else {
      process.env.BACKEND_TRUST_PROXY = originalTrustProxy
    }
    console.log = originalConsoleLog
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogin.mockResolvedValue({ payload: { userId: 1, accountId: 1 } })
    mockGetAccountContext.mockResolvedValue(null)
    mockCreateAuthSession.mockResolvedValue(undefined)
  })

  it('sets Set-Cookie with Secure, HttpOnly, SameSite=Lax when X-Forwarded-Proto: https', async () => {
    const res = await request(app)
      .post('/api/backend/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'u@example.com', password: 'secret' })

    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toBeDefined()
    const setCookie = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie'].join('; ')
      : res.headers['set-cookie']
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
  })

  it('does not set Secure when X-Forwarded-Proto: http', async () => {
    const res = await request(app)
      .post('/api/backend/auth/login')
      .set('X-Forwarded-Proto', 'http')
      .send({ email: 'u@example.com', password: 'secret' })

    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toBeDefined()
    const setCookie = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie'].join('; ')
      : res.headers['set-cookie']
    expect(setCookie).not.toContain('Secure')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
  })
})
