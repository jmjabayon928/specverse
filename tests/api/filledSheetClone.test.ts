// tests/api/filledSheetClone.test.ts
// Phase 4: Clone uses latest approved template; 409 when no latest approved.

import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'

const mockAuthUser = {
  userId: 1,
  roleId: 1,
  role: 'Admin',
  permissions: ['DATASHEET_VIEW', 'DATASHEET_EDIT', 'DATASHEET_VERIFY', 'DATASHEET_APPROVE'] as string[],
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

const mockGetFilledSheetTemplateId = jest.fn()
const mockGetLatestApprovedTemplateId = jest.fn()
const mockCreateFilledSheet = jest.fn()
const mockDoesEquipmentTagExist = jest.fn()

jest.mock('../../src/backend/services/filledSheetService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/filledSheetService')>(
      '../../src/backend/services/filledSheetService'
    )
  return {
    ...actual,
    getFilledSheetTemplateId: (...args: unknown[]) => mockGetFilledSheetTemplateId(...args),
    getLatestApprovedTemplateId: (...args: unknown[]) => mockGetLatestApprovedTemplateId(...args),
    createFilledSheet: (...args: unknown[]) => mockCreateFilledSheet(...args),
    doesEquipmentTagExist: (...args: unknown[]) => mockDoesEquipmentTagExist(...args),
  }
})

process.env.JWT_SECRET ??= 'secret'

function createAuthCookie(): string {
  const token = jwt.sign(
    {
      userId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'Admin',
      profilePic: null,
      permissions: mockAuthUser.permissions,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
  return `token=${token}`
}

describe('Filled sheet clone (Phase 4)', () => {
  const authCookie = createAuthCookie()

  beforeEach(() => {
    jest.clearAllMocks()
    mockDoesEquipmentTagExist.mockResolvedValue(false)
  })

  it('uses latest approved template id when calling createFilledSheet (not source TemplateID)', async () => {
    const sourceSheetId = 5
    const sourceTemplateId = 10
    const resolvedTemplateId = 99

    mockGetFilledSheetTemplateId.mockResolvedValue({ TemplateID: sourceTemplateId })
    mockGetLatestApprovedTemplateId.mockResolvedValue(resolvedTemplateId)
    mockCreateFilledSheet.mockResolvedValue({ sheetId: 1 })

    const res = await request(app)
      .post(`/api/backend/filledsheets/${sourceSheetId}/clone`)
      .set('Cookie', [authCookie])
      .send({
        equipmentTagNum: 'CLONE-TAG-1',
        projectId: 1,
        fieldValues: {},
      })

    expect(res.statusCode).toBe(201)
    expect(mockGetFilledSheetTemplateId).toHaveBeenCalledWith(sourceSheetId)
    expect(mockGetLatestApprovedTemplateId).toHaveBeenCalledWith(sourceTemplateId)
    expect(mockCreateFilledSheet).toHaveBeenCalledTimes(1)
    const createInput = mockCreateFilledSheet.mock.calls[0][0] as { templateId: number }
    expect(createInput.templateId).toBe(resolvedTemplateId)
    expect(createInput.templateId).not.toBe(sourceTemplateId)
  })

  it('returns 409 when no latest approved template in chain', async () => {
    mockGetFilledSheetTemplateId.mockResolvedValue({ TemplateID: 10 })
    mockGetLatestApprovedTemplateId.mockRejectedValue(
      new AppError('No latest approved template in chain.', 409)
    )

    const res = await request(app)
      .post('/api/backend/filledsheets/5/clone')
      .set('Cookie', [authCookie])
      .send({
        equipmentTagNum: 'CLONE-TAG-2',
        projectId: 1,
      })

    expect(res.statusCode).toBe(409)
    expect(mockCreateFilledSheet).not.toHaveBeenCalled()
  })
})
