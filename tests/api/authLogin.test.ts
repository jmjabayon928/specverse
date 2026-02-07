/**
 * POST /api/backend/auth/login — password verification (bcrypt + argon2)
 */
import request from 'supertest'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

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

const bcryptCompare = jest.fn()
jest.mock('bcryptjs', () => ({
  compare: (...args: unknown[]) => bcryptCompare(...args),
}))

const verifyPassword = jest.fn()
jest.mock('../../src/backend/services/passwordHasher', () => ({
  verifyPassword: (...args: unknown[]) => verifyPassword(...args),
  hashPassword: jest.fn(),
}))

import app from '../../src/backend/app'

beforeEach(() => {
  jest.clearAllMocks()
  mockUserRecord = null
  getAccountContextForUser.mockResolvedValue({
    accountId: 1,
    roleId: 1,
    roleName: 'Admin',
    permissions: ['ACCOUNT_VIEW'],
  })
})

describe('POST /api/backend/auth/login', () => {
  it('returns 200 when user has bcrypt hash and password matches', async () => {
    mockUserRecord = {
      UserID: 1,
      FirstName: 'Test',
      LastName: 'User',
      Email: 'bcrypt@example.com',
      PasswordHash: '$2b$10$abcdefghijklmnopqrstuv',
      RoleID: 1,
      ProfilePic: null,
      RoleName: 'Admin',
    }
    bcryptCompare.mockResolvedValue(true)

    const res = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'bcrypt@example.com', password: 'secret123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('user')
    expect(res.body).toMatchObject({ message: 'Login successful' })
    expect(bcryptCompare).toHaveBeenCalledWith('secret123', mockUserRecord.PasswordHash)
  })

  it('returns 200 when user has argon2 hash and password matches', async () => {
    mockUserRecord = {
      UserID: 2,
      FirstName: 'Invited',
      LastName: 'User',
      Email: 'argon@example.com',
      PasswordHash: '$argon2id$v=19$m=65536,t=3,p=4$somesalt$somehash',
      RoleID: 2,
      ProfilePic: null,
      RoleName: 'Viewer',
    }
    verifyPassword.mockResolvedValue(true)

    const res = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'argon@example.com', password: 'SecurePass1!' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('user')
    expect(res.body).toMatchObject({ message: 'Login successful' })
    expect(verifyPassword).toHaveBeenCalledWith(
      mockUserRecord.PasswordHash,
      'SecurePass1!',
    )
  })

  it('returns 401 when hash format is unknown', async () => {
    mockUserRecord = {
      UserID: 3,
      FirstName: 'Unknown',
      LastName: 'Hash',
      Email: 'unknown@example.com',
      PasswordHash: '$unknown$format',
      RoleID: 1,
      ProfilePic: null,
      RoleName: 'Admin',
    }

    const res = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: 'unknown@example.com', password: 'any' })

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ message: 'Invalid email or password' })
    expect(bcryptCompare).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
  })

  it('returns 200 when email has leading/trailing spaces and mixed casing', async () => {
    mockUserRecord = {
      UserID: 1,
      FirstName: 'Test',
      LastName: 'User',
      Email: 'normal@example.com',
      PasswordHash: '$2b$10$abcdefghijklmnopqrstuv',
      RoleID: 1,
      ProfilePic: null,
      RoleName: 'Admin',
    }
    bcryptCompare.mockResolvedValue(true)

    const res = await request(app)
      .post('/api/backend/auth/login')
      .send({ email: '  Normal@Example.com  ', password: 'secret123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('user')
    expect(res.body).toMatchObject({ message: 'Login successful' })
  })
})
