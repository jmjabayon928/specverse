// tests/api/templateClone.test.ts
// Phase 3: Template clone creates new template; 201 + sheetId.

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
  permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT, PERMISSIONS.DATASHEET_VERIFY, PERMISSIONS.DATASHEET_APPROVE],
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
}))

const mockCloneTemplateFrom = jest.fn()

jest.mock('../../src/backend/services/templateService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/templateService')>(
      '../../src/backend/services/templateService'
    )
  return {
    ...actual,
    cloneTemplateFrom: (...args: unknown[]) => mockCloneTemplateFrom(...args),
  }
})

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
  getUserPermissions: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
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

describe('Template clone (Phase 3)', () => {
  const authCookie = createAuthCookie()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates new template and returns 201 with sheetId', async () => {
    const sourceTemplateId = 10
    const newSheetId = 20

    mockCloneTemplateFrom.mockResolvedValue({ sheetId: newSheetId })

    const res = await request(app)
      .post(`/api/backend/templates/${sourceTemplateId}/clone`)
      .set('Cookie', [authCookie])
      .send({ equipmentTagNum: 'TMP-CLONE-1' })

    expect(res.statusCode).toBe(201)
    expect(res.body).toHaveProperty('sheetId', newSheetId)
    expect(mockCloneTemplateFrom).toHaveBeenCalledTimes(1)
    expect(mockCloneTemplateFrom).toHaveBeenCalledWith(
      sourceTemplateId,
      expect.any(Object),
      1,
      1
    )
  })

  it('returns 401 when no auth token', async () => {
    const res = await request(app)
      .post('/api/backend/templates/10/clone')
      .send({})

    expect(res.statusCode).toBe(401)
    expect(mockCloneTemplateFrom).not.toHaveBeenCalled()
  })
})
