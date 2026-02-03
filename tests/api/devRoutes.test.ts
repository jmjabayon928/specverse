// tests/api/devRoutes.test.ts
// Dev-only endpoints: seed-admin, reset-admin-password.
// Guard: NODE_ENV !== 'production' && DEV_ADMIN_UTILS === '1'.

import request from 'supertest'
import express from 'express'
import { errorHandler } from '../../src/backend/middleware/errorHandler'

globalThis.setImmediate ??= ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
  setTimeout(fn, 0, ...args)) as unknown as typeof setImmediate

const env = process.env as Record<string, string | undefined>

function buildTestApp() {
  const devRoutes = require('../../src/backend/routes/devRoutes').default
  const app = express()
  app.use(express.json())
  app.use('/api/backend/dev', devRoutes)
  app.use(errorHandler)
  return app
}

function createMockPool(requestImpl: () => { input: () => unknown; query: () => Promise<{ recordset: unknown[] }> }) {
  return {
    request: requestImpl,
  }
}

jest.mock('../../src/backend/config/db', () => ({
  poolPromise: null as Promise<ReturnType<typeof createMockPool>> | null,
  sql: {
    NVarChar: jest.fn((len?: number) => ({ type: 'NVarChar', length: len })),
    Int: jest.fn(() => ({ type: 'Int' })),
    DateTime2: jest.fn((len?: number) => ({ type: 'DateTime2', length: len })),
    Date: jest.fn(() => ({ type: 'Date' })),
  },
}))

const mockCreateUser = jest.fn()
const mockResetUserPassword = jest.fn()
jest.mock('../../src/backend/services/usersService', () => ({
  createUser: (...args: unknown[]) => mockCreateUser(...args),
  resetUserPassword: (...args: unknown[]) => mockResetUserPassword(...args),
}))

jest.mock('../../src/backend/services/passwordHasher', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed'),
}))

describe('Dev routes', () => {
  let savedNodeEnv: string | undefined
  let savedDevAdminUtils: string | undefined

  beforeEach(() => {
    jest.clearAllMocks()
    savedNodeEnv = env.NODE_ENV
    savedDevAdminUtils = env.DEV_ADMIN_UTILS
  })

  afterEach(() => {
    env.NODE_ENV = savedNodeEnv
    env.DEV_ADMIN_UTILS = savedDevAdminUtils
  })

  describe('when guard fails', () => {
    it('returns 404 when NODE_ENV is production', async () => {
      env.NODE_ENV = 'production'
      env.DEV_ADMIN_UTILS = '1'

      const app = buildTestApp()
      const res = await request(app)
        .post('/api/backend/dev/seed-admin')
        .send({})

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Not found')
    })

    it('returns 404 when DEV_ADMIN_UTILS is not 1', async () => {
      env.NODE_ENV = 'development'
      env.DEV_ADMIN_UTILS = '0'

      const app = buildTestApp()
      const res = await request(app)
        .post('/api/backend/dev/seed-admin')
        .send({})

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Not found')
    })

    it('returns 404 when DEV_ADMIN_UTILS is missing', async () => {
      env.NODE_ENV = 'development'
      delete env.DEV_ADMIN_UTILS

      const app = buildTestApp()
      const res = await request(app)
        .post('/api/backend/dev/reset-admin-password')
        .send({})

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Not found')
    })
  })

  describe('when guard passes (DEV_ADMIN_UTILS=1, NODE_ENV !== production)', () => {
    beforeEach(() => {
      env.NODE_ENV = 'development'
      env.DEV_ADMIN_UTILS = '1'
    })

    describe('POST /seed-admin', () => {
      it('returns 201 and tempPassword when no admin exists', async () => {
        const queryMock = jest.fn()
        queryMock
          .mockResolvedValueOnce({ recordset: [] })
          .mockResolvedValueOnce({ recordset: [{ RoleID: 1 }] })

        const db = require('../../src/backend/config/db')
        db.poolPromise = Promise.resolve(
          createMockPool(() => ({
            input: jest.fn().mockReturnThis(),
            query: queryMock,
          }))
        )

        mockCreateUser.mockResolvedValueOnce(1)

        const app = buildTestApp()
        const res = await request(app)
          .post('/api/backend/dev/seed-admin')
          .send({})

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Admin user created successfully')
        expect(res.body.userId).toBe(1)
        expect(res.body.email).toBe('admin@specverse.local')
        expect(res.body.tempPassword).toBeDefined()
        expect(typeof res.body.tempPassword).toBe('string')
      })

      it('returns 200 when admin already exists', async () => {
        const queryMock = jest.fn().mockResolvedValueOnce({ recordset: [{ UserID: 1 }] })

        const db = require('../../src/backend/config/db')
        db.poolPromise = Promise.resolve(
          createMockPool(() => ({
            input: jest.fn().mockReturnThis(),
            query: queryMock,
          }))
        )

        const app = buildTestApp()
        const res = await request(app)
          .post('/api/backend/dev/seed-admin')
          .send({})

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('Admin user already exists')
        expect(res.body.userId).toBe(1)
        expect(res.body.email).toBe('admin@specverse.local')
        expect(mockCreateUser).not.toHaveBeenCalled()
      })
    })

    describe('POST /reset-admin-password', () => {
      it('returns 200 and tempPassword on success', async () => {
        const queryMock = jest.fn().mockResolvedValueOnce({
          recordset: [{ UserID: 1, RoleID: 1, RoleName: 'Admin' }],
        })

        const db = require('../../src/backend/config/db')
        db.poolPromise = Promise.resolve(
          createMockPool(() => ({
            input: jest.fn().mockReturnThis(),
            query: queryMock,
          }))
        )

        mockResetUserPassword.mockResolvedValueOnce(true)

        const app = buildTestApp()
        const res = await request(app)
          .post('/api/backend/dev/reset-admin-password')
          .send({})

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('Admin password reset successfully')
        expect(res.body.userId).toBe(1)
        expect(res.body.email).toBe('admin@specverse.local')
        expect(res.body.tempPassword).toBeDefined()
        expect(typeof res.body.tempPassword).toBe('string')
      })

      it('returns 404 when admin user not found', async () => {
        const queryMock = jest.fn().mockResolvedValueOnce({ recordset: [] })

        const db = require('../../src/backend/config/db')
        db.poolPromise = Promise.resolve(
          createMockPool(() => ({
            input: jest.fn().mockReturnThis(),
            query: queryMock,
          }))
        )

        const app = buildTestApp()
        const res = await request(app)
          .post('/api/backend/dev/reset-admin-password')
          .send({})

        expect(res.status).toBe(404)
        expect(res.body.error).toContain('not found')
      })
    })
  })
})
