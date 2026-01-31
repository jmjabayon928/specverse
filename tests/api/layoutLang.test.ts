/**
 * Layout render accepts lang=en and lang=eng (normalized to eng).
 * @jest-environment node
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'

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

jest.mock('../../src/backend/services/layoutService', () => ({
  renderLayout: jest.fn().mockResolvedValue({
    layoutId: 1,
    sheetId: 1,
    uom: 'SI',
    lang: 'eng',
    header: { equipmentTag: null, equipmentName: null, project: null, fields: [] },
    body: [],
  }),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const layoutService = require('../../src/backend/services/layoutService') as {
  renderLayout: jest.Mock
}

function buildLayoutApp() {
  const layoutRoutes = require('../../src/backend/routes/layoutRoutes').default
  const authMiddleware = require('../../src/backend/middleware/authMiddleware')
  const app = express()
  app.use(cookieParser())
  app.use('/api/backend/layouts', authMiddleware.verifyToken, layoutRoutes)
  return app
}

describe('Layout render lang', () => {
  beforeEach(() => {
    layoutService.renderLayout.mockClear()
  })

  it('accepts lang=en and normalizes to eng', async () => {
    const app = buildLayoutApp()
    const res = await request(app)
      .get('/api/backend/layouts/1/render?sheetId=1&uom=SI&lang=en')
      .set('Cookie', [createAuthCookie(['DATASHEET_VIEW'])])

    expect(res.status).toBe(200)
    expect(layoutService.renderLayout).toHaveBeenCalledWith(
      expect.objectContaining({ layoutId: 1, sheetId: 1, uom: 'SI', lang: 'eng' })
    )
  })

  it('accepts lang=eng', async () => {
    const app = buildLayoutApp()
    const res = await request(app)
      .get('/api/backend/layouts/1/render?sheetId=1&uom=SI&lang=eng')
      .set('Cookie', [createAuthCookie(['DATASHEET_VIEW'])])

    expect(res.status).toBe(200)
    expect(layoutService.renderLayout).toHaveBeenCalledWith(
      expect.objectContaining({ layoutId: 1, sheetId: 1, uom: 'SI', lang: 'eng' })
    )
  })
})
