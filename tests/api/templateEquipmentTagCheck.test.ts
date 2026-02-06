// tests/api/templateEquipmentTagCheck.test.ts
// GET /api/backend/templates/equipment-tag/check - equipment tag uniqueness check

import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

const mockAuthUser = {
  id: 1,
  userId: 1,
  accountId: 1,
  roleId: 1,
  role: 'Admin',
  permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT],
  profilePic: undefined as string | undefined,
}

jest.mock('../../src/backend/middleware/authMiddleware', () => ({
  verifyToken: (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.token ?? req.headers.authorization?.split(' ')[1]
    if (!token) {
      next(new AppError('Unauthorized - No token', 401))
      return
    }
    req.user = { ...mockAuthUser }
    next()
  },
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalVerifyToken: (_req: Request, _res: Response, next: NextFunction) => next(),
  verifyTokenOnly: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

const mockDoesTemplateEquipmentTagExist = jest.fn()

jest.mock('../../src/backend/services/templateService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/templateService')>(
      '../../src/backend/services/templateService'
    )
  return {
    ...actual,
    doesTemplateEquipmentTagExist: (...args: unknown[]) => mockDoesTemplateEquipmentTagExist(...args),
  }
})

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
  getUserPermissions: jest.fn().mockResolvedValue([]),
}))

process.env.JWT_SECRET ??= 'secret'

function createAuthCookie(): string {
  const token = jwt.sign(
    {
      id: 1,
      userId: 1,
      accountId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'Admin',
      roleId: 1,
      profilePic: null,
      permissions: mockAuthUser.permissions,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
  return `token=${token}`
}

describe('GET /api/backend/templates/equipment-tag/check', () => {
  const authCookie = createAuthCookie()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 with exists: false when tag is available', async () => {
    mockDoesTemplateEquipmentTagExist.mockResolvedValue(false)

    const res = await request(app)
      .get('/api/backend/templates/equipment-tag/check')
      .query({ tag: '101', projectId: 1 })
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ exists: false })
    expect(mockDoesTemplateEquipmentTagExist).toHaveBeenCalledTimes(1)
    expect(mockDoesTemplateEquipmentTagExist).toHaveBeenCalledWith('101', 1, 1)
  })

  it('returns 200 with exists: true when tag already exists', async () => {
    mockDoesTemplateEquipmentTagExist.mockResolvedValue(true)

    const res = await request(app)
      .get('/api/backend/templates/equipment-tag/check')
      .query({ tag: '101', projectId: 1 })
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ exists: true })
    expect(mockDoesTemplateEquipmentTagExist).toHaveBeenCalledTimes(1)
    expect(mockDoesTemplateEquipmentTagExist).toHaveBeenCalledWith('101', 1, 1)
  })
})
