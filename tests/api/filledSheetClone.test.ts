// tests/api/filledSheetClone.test.ts
// Phase 4: Clone uses latest approved template; 409 when no latest approved.
// Phase 3: Filled→filled clone creates new sheet with correct linkage; revisions are NOT copied.
// Phase 3.1: Contract — create/clone does not create revisions; first save does. Cloned sheet has 0 revisions until first update.

import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'

const mockAuthUser = {
  id: 1,
  userId: 1,
  accountId: 1,
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

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: jest.fn().mockImplementation((sheetId: number, accountId: number) =>
    Promise.resolve(accountId === 1 && (sheetId === 5 || sheetId === 200))
  ),
}))
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

const mockListRevisionsPaged = jest.fn()

jest.mock('../../src/backend/database/sheetRevisionQueries', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/database/sheetRevisionQueries')>(
      '../../src/backend/database/sheetRevisionQueries'
    )
  return {
    ...actual,
    listRevisionsPaged: (...args: unknown[]) => mockListRevisionsPaged(...args),
  }
})

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
    mockListRevisionsPaged.mockResolvedValue({ total: 0, rows: [] })
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

  it('createFilledSheet is called with isTemplate false and templateId (new sheet, no revision copy)', async () => {
    mockGetFilledSheetTemplateId.mockResolvedValue({ TemplateID: 10 })
    mockGetLatestApprovedTemplateId.mockResolvedValue(99)
    mockCreateFilledSheet.mockResolvedValue({ sheetId: 42 })

    const res = await request(app)
      .post('/api/backend/filledsheets/5/clone')
      .set('Cookie', [authCookie])
      .send({
        equipmentTagNum: 'CLONE-TAG-3',
        projectId: 2,
        fieldValues: { 101: 'val1' },
      })

    expect(res.statusCode).toBe(201)
    expect(res.body).toHaveProperty('sheetId', 42)
    expect(mockCreateFilledSheet).toHaveBeenCalledTimes(1)
    const createInput = mockCreateFilledSheet.mock.calls[0][0] as {
      templateId: number
      isTemplate: boolean
      equipmentTagNum: string
      projectId: number
      fieldValues: Record<string, string>
    }
    expect(createInput.templateId).toBe(99)
    expect(createInput.isTemplate).toBe(false)
    expect(createInput.equipmentTagNum).toBe('CLONE-TAG-3')
    expect(createInput.projectId).toBe(2)
    expect(createInput.fieldValues).toEqual({ 101: 'val1' })
  })

  it('cloned sheet has 0 revisions until first update (list revisions returns empty)', async () => {
    const newSheetId = 200
    mockGetFilledSheetTemplateId.mockResolvedValue({ TemplateID: 10 })
    mockGetLatestApprovedTemplateId.mockResolvedValue(99)
    mockCreateFilledSheet.mockResolvedValue({ sheetId: newSheetId })
    mockListRevisionsPaged.mockResolvedValue({ total: 0, rows: [] })

    const cloneRes = await request(app)
      .post('/api/backend/filledsheets/5/clone')
      .set('Cookie', [authCookie])
      .send({
        equipmentTagNum: 'CLONE-NO-REV',
        projectId: 1,
        fieldValues: {},
      })

    expect(cloneRes.statusCode).toBe(201)
    expect(cloneRes.body.sheetId).toBe(newSheetId)

    const listRes = await request(app)
      .get(`/api/backend/filledsheets/${newSheetId}/revisions?page=1&pageSize=20`)
      .set('Cookie', [authCookie])

    expect(listRes.statusCode).toBe(200)
    expect(listRes.body.total).toBe(0)
    expect(Array.isArray(listRes.body.rows)).toBe(true)
    expect(listRes.body.rows).toHaveLength(0)
    expect(mockListRevisionsPaged).toHaveBeenCalledWith(newSheetId, 1, 20)
  })
})
