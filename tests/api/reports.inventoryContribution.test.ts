import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import { errorHandler } from '../../src/backend/middleware/errorHandler'

globalThis.setImmediate ??= ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
  setTimeout(fn, 0, ...args)) as unknown as typeof setImmediate

function createAuthCookie(permissions: string[]): string {
  const token = jwt.sign(
    {
      userId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'Admin',
      profilePic: null,
      permissions,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
  return `token=${token}`
}

process.env.JWT_SECRET ??= 'secret'

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const mockGetInventoryContributionFromDB = jest.fn()
jest.mock('../../src/backend/services/reportsService', () => {
  const actual = jest.requireActual('../../src/backend/services/reportsService') as Record<string, unknown>
  return {
    ...actual,
    getInventoryContributionFromDB: (...args: unknown[]) => mockGetInventoryContributionFromDB(...args),
  }
})

function buildTestApp() {
  const reportsRoutes = require('../../src/backend/routes/reportsRoutes').default
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/reports', reportsRoutes)
  app.use(errorHandler)
  return app
}

describe('GET /api/backend/reports/inventory-contribution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetInventoryContributionFromDB.mockResolvedValue([
      { categoryName: 'Pipes', items: [{ itemName: 'Steel Pipe', quantity: 100 }] },
      { categoryName: 'Valves', items: [] },
    ])
  })

  it('returns 401 when unauthenticated', async () => {
    const app = buildTestApp()
    const res = await request(app).get('/api/backend/reports/inventory-contribution')
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 and array with categoryName and items for each element', async () => {
    const app = buildTestApp()
    const authCookie = createAuthCookie(['DASHBOARD_VIEW'])

    const res = await request(app)
      .get('/api/backend/reports/inventory-contribution')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    res.body.forEach((el: { categoryName: unknown; items: unknown }) => {
      expect(typeof el.categoryName).toBe('string')
      expect(Array.isArray(el.items)).toBe(true)
    })
  })

  it('returns empty items array for category with no items', async () => {
    mockGetInventoryContributionFromDB.mockResolvedValueOnce([
      { categoryName: 'Empty', items: [] },
    ])
    const app = buildTestApp()
    const authCookie = createAuthCookie(['DASHBOARD_VIEW'])

    const res = await request(app)
      .get('/api/backend/reports/inventory-contribution')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].categoryName).toBe('Empty')
    expect(res.body[0].items).toEqual([])
  })
})
