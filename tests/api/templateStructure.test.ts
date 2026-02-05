// tests/api/templateStructure.test.ts
// Template structure API: subsheet + field CRUD + reorder (lifecycle gating, create, rename, reorder, field CRUD, delete cascade).

import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

const mockAuthUser = {
  id: 1,
  userId: 1,
  accountId: 1,
  roleId: 1,
  role: 'Admin',
  permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT],
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

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: jest.fn().mockImplementation((templateId: number, accountId: number) =>
    Promise.resolve(accountId === 1 && (templateId === 1 || templateId === 999))
  ),
}))

const APPROVED_TEMPLATE_ID = 999
const DRAFT_TEMPLATE_ID = 1
const mockCreateSubsheet = jest.fn()
const mockUpdateSubsheet = jest.fn()
const mockDeleteSubsheet = jest.fn()
const mockReorderSubsheets = jest.fn()
const mockCreateField = jest.fn()
const mockUpdateField = jest.fn()
const mockDeleteField = jest.fn()
const mockReorderFields = jest.fn()
const mockAssertTemplateStructureEditable = jest.fn()

jest.mock('../../src/backend/services/templateService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/templateService')>(
      '../../src/backend/services/templateService'
    )
  return {
    ...actual,
    assertTemplateStructureEditable: (...args: unknown[]) =>
      mockAssertTemplateStructureEditable(...args),
    createSubsheet: (...args: unknown[]) => mockCreateSubsheet(...args),
    updateSubsheet: (...args: unknown[]) => mockUpdateSubsheet(...args),
    deleteSubsheet: (...args: unknown[]) => mockDeleteSubsheet(...args),
    reorderSubsheets: (...args: unknown[]) => mockReorderSubsheets(...args),
    createField: (...args: unknown[]) => mockCreateField(...args),
    updateField: (...args: unknown[]) => mockUpdateField(...args),
    deleteField: (...args: unknown[]) => mockDeleteField(...args),
    reorderFields: (...args: unknown[]) => mockReorderFields(...args),
    getTemplateDetailsById: jest.fn().mockImplementation((templateId: number) => {
      const status = templateId === APPROVED_TEMPLATE_ID ? 'Approved' : 'Draft'
      return Promise.resolve({
        datasheet: {
          sheetId: templateId,
          sheetName: 'Test Template',
          status,
          subsheets: [
            {
              originalId: 10,
              id: 10,
              name: 'Sub1',
              fields: [
                {
                  originalId: 100,
                  id: 100,
                  label: 'Field1',
                  infoType: 'varchar',
                  sortOrder: 0,
                  required: false,
                  options: ['A', 'B'],
                },
              ],
            },
          ],
        },
        translations: null,
      })
    }),
  }
})

function createAuthCookie(permissions: string[]): string {
  const token = jwt.sign(
    {
      userId: 1,
      accountId: 1,
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

const authCookie = createAuthCookie([PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT])

describe('Template structure API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAssertTemplateStructureEditable.mockResolvedValue(undefined)
  })

  describe('lifecycle gating', () => {
    it('POST /api/backend/templates/:id/subsheets returns 409 when template is Approved', async () => {
      mockCreateSubsheet.mockRejectedValueOnce(
        new AppError(
          'Template can only be edited when status is Draft, Modified Draft, or Rejected. Current status: Approved.',
          409
        )
      )

      const res = await request(app)
        .post(`/api/backend/templates/${APPROVED_TEMPLATE_ID}/subsheets`)
        .set('Cookie', [authCookie])
        .send({ subName: 'New Subsheet' })

      expect(res.status).toBe(409)
      expect(mockCreateSubsheet).toHaveBeenCalledWith(
        APPROVED_TEMPLATE_ID,
        'New Subsheet',
        mockAuthUser.userId
      )
    })
  })

  describe('subsheet CRUD', () => {
    it('POST /api/backend/templates/:id/subsheets returns 201 with subId and orderIndex', async () => {
      mockCreateSubsheet.mockResolvedValueOnce({
        subId: 101,
        subName: 'New Subsheet',
        orderIndex: 1,
      })

      const res = await request(app)
        .post(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets`)
        .set('Cookie', [authCookie])
        .send({ subName: 'New Subsheet' })

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        subId: 101,
        subName: 'New Subsheet',
        orderIndex: 1,
      })
      expect(mockCreateSubsheet).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        'New Subsheet',
        mockAuthUser.userId
      )
    })

    it('PATCH /api/backend/templates/:id/subsheets/:subId updates SubName', async () => {
      mockUpdateSubsheet.mockResolvedValueOnce({
        subId: 10,
        subName: 'Renamed Subsheet',
        orderIndex: 0,
      })

      const res = await request(app)
        .patch(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10`)
        .set('Cookie', [authCookie])
        .send({ subName: 'Renamed Subsheet' })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        subId: 10,
        subName: 'Renamed Subsheet',
        orderIndex: 0,
      })
      expect(mockUpdateSubsheet).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        10,
        { subName: 'Renamed Subsheet' },
        mockAuthUser.userId
      )
    })

    it('DELETE /api/backend/templates/:id/subsheets/:subId returns 200 and deletedSubId', async () => {
      mockDeleteSubsheet.mockResolvedValueOnce({ deletedSubId: 10 })

      const res = await request(app)
        .delete(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10`)
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ deletedSubId: 10 })
      expect(mockDeleteSubsheet).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        10,
        mockAuthUser.userId
      )
    })

    it('PUT /api/backend/templates/:id/subsheets/order updates order and returns updated count', async () => {
      mockReorderSubsheets.mockResolvedValueOnce({ updated: 2 })

      const res = await request(app)
        .put(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/order`)
        .set('Cookie', [authCookie])
        .send({ order: [{ subId: 11, orderIndex: 0 }, { subId: 10, orderIndex: 1 }] })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ updated: 2 })
      expect(mockReorderSubsheets).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        [{ subId: 11, orderIndex: 0 }, { subId: 10, orderIndex: 1 }],
        mockAuthUser.userId
      )
    })
  })

  describe('field CRUD', () => {
    it('POST /api/backend/templates/:id/subsheets/:subId/fields creates field with options', async () => {
      mockCreateField.mockResolvedValueOnce({
        fieldId: 201,
        label: 'New Field',
        infoType: 'varchar',
        uom: '',
        required: true,
        orderIndex: 1,
        options: ['X', 'Y'],
      })

      const res = await request(app)
        .post(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10/fields`)
        .set('Cookie', [authCookie])
        .send({
          label: 'New Field',
          infoType: 'varchar',
          uom: '',
          required: true,
          options: ['X', 'Y'],
        })

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        fieldId: 201,
        label: 'New Field',
        infoType: 'varchar',
        required: true,
        orderIndex: 1,
        options: ['X', 'Y'],
      })
      expect(mockCreateField).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        10,
        expect.objectContaining({
          label: 'New Field',
          infoType: 'varchar',
          required: true,
          options: ['X', 'Y'],
        }),
        mockAuthUser.userId
      )
    })

    it('PATCH /api/backend/templates/:id/subsheets/:subId/fields/:fieldId updates field and options', async () => {
      mockUpdateField.mockResolvedValueOnce({
        fieldId: 100,
        label: 'Updated Label',
        infoType: 'int',
        uom: 'bar',
        required: true,
        orderIndex: 0,
        options: ['C', 'D'],
      })

      const res = await request(app)
        .patch(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10/fields/100`)
        .set('Cookie', [authCookie])
        .send({
          label: 'Updated Label',
          infoType: 'int',
          uom: 'bar',
          required: true,
          options: ['C', 'D'],
        })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        fieldId: 100,
        label: 'Updated Label',
        infoType: 'int',
        options: ['C', 'D'],
      })
      expect(mockUpdateField).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        10,
        100,
        expect.objectContaining({
          label: 'Updated Label',
          infoType: 'int',
          options: ['C', 'D'],
        }),
        mockAuthUser.userId
      )
    })

    it('DELETE /api/backend/templates/:id/subsheets/:subId/fields/:fieldId returns 200 and deletedFieldId', async () => {
      mockDeleteField.mockResolvedValueOnce({ deletedFieldId: 100 })

      const res = await request(app)
        .delete(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10/fields/100`)
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ deletedFieldId: 100 })
      expect(mockDeleteField).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        10,
        100,
        mockAuthUser.userId
      )
    })

    it('PUT /api/backend/templates/:id/subsheets/:subId/fields/order returns 200 and updated count', async () => {
      mockReorderFields.mockResolvedValueOnce({ updated: 2 })

      const res = await request(app)
        .put(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10/fields/order`)
        .set('Cookie', [authCookie])
        .send({ order: [{ fieldId: 100, orderIndex: 1 }, { fieldId: 101, orderIndex: 0 }] })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ updated: 2 })
      expect(mockReorderFields).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        10,
        [{ fieldId: 100, orderIndex: 1 }, { fieldId: 101, orderIndex: 0 }],
        mockAuthUser.userId
      )
    })

    it('PUT /api/backend/templates/:id/subsheets/:subId/fields/order returns 400 with issues when body is invalid', async () => {
      const res = await request(app)
        .put(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10/fields/order`)
        .set('Cookie', [authCookie])
        .send({ order: [{ fieldId: 0, orderIndex: 0 }] })

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        error: 'Invalid request payload',
        message: 'Invalid request payload',
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: expect.any(String),
            message: expect.any(String),
          }),
        ]),
      })
      expect(mockReorderFields).not.toHaveBeenCalled()
    })
  })

  describe('guard blocks cross-template subId/fieldId', () => {
    it('PATCH /api/backend/templates/:id/subsheets/:subId returns 404 when subId does not belong to template', async () => {
      mockUpdateSubsheet.mockRejectedValueOnce(new AppError('Subsheet not found', 404))

      const res = await request(app)
        .patch(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/999`)
        .set('Cookie', [authCookie])
        .send({ subName: 'Other' })

      expect(res.status).toBe(404)
      expect(mockUpdateSubsheet).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        999,
        { subName: 'Other' },
        mockAuthUser.userId
      )
    })

    it('PATCH /api/backend/templates/:id/subsheets/:subId/fields/:fieldId returns 404 when fieldId does not belong to subsheet', async () => {
      mockUpdateField.mockRejectedValueOnce(new AppError('Field not found', 404))

      const res = await request(app)
        .patch(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10/fields/999`)
        .set('Cookie', [authCookie])
        .send({ label: 'Other' })

      expect(res.status).toBe(404)
      expect(mockUpdateField).toHaveBeenCalledWith(
        DRAFT_TEMPLATE_ID,
        10,
        999,
        expect.any(Object),
        mockAuthUser.userId
      )
    })

    it('PATCH /api/backend/templates/:id/subsheets/:subId/fields/:fieldId returns 400 with Zod issues when body is invalid', async () => {
      const res = await request(app)
        .patch(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10/fields/100`)
        .set('Cookie', [authCookie])
        .send({ label: '' })

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        error: 'Invalid request payload',
        message: 'Invalid request payload',
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: expect.any(String),
            message: expect.any(String),
          }),
        ]),
      })
      expect(mockUpdateField).not.toHaveBeenCalled()
    })
  })

  describe('delete subsheet cascades', () => {
    it('DELETE subsheet calls deleteSubsheet once (service is responsible for options + fields + sub)', async () => {
      mockDeleteSubsheet.mockResolvedValueOnce({ deletedSubId: 10 })

      const res = await request(app)
        .delete(`/api/backend/templates/${DRAFT_TEMPLATE_ID}/subsheets/10`)
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(mockDeleteSubsheet).toHaveBeenCalledTimes(1)
      expect(mockDeleteField).not.toHaveBeenCalled()
    })
  })
})
