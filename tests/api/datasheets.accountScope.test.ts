/**
 * Phase 2.5 Bundle 4 Step 1a: Account scoping for filled sheets and templates list + get-details.
 * accountId is guaranteed by verifyToken; controllers assume it is present.
 * - 404 when GET by id for a sheet/template belonging to another account
 * - List endpoints call service with req.user.accountId so only caller account items are returned
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

const baseUser = {
  userId: 1,
  roleId: 1,
  role: 'Admin',
  permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT],
}

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { createAuthMiddlewareMock } = jest.requireActual('../helpers/authMiddlewareMock')
  return createAuthMiddlewareMock({ actual, mode: 'token' })
})

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: jest.fn().mockResolvedValue(true),
}))
jest.mock('../../src/backend/services/filledSheetService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/filledSheetService')>(
      '../../src/backend/services/filledSheetService'
    )
  const AppErrorClass = require('../../src/backend/errors/AppError').AppError as typeof import('../../src/backend/errors/AppError').AppError
  return {
    ...actual,
    fetchAllFilled: jest.fn().mockResolvedValue([]),
    getFilledSheetDetailsById: jest.fn().mockResolvedValue(null),
    getFilledSheetTemplateId: jest.fn().mockResolvedValue({ TemplateID: 1 }),
    getLatestApprovedTemplateId: jest.fn().mockResolvedValue(1),
    doesEquipmentTagExist: jest.fn().mockResolvedValue(false),
    createFilledSheet: jest.fn().mockImplementation(async (data: { templateId?: unknown }, _ctx: unknown, accountId: number) => {
      const sheetAccess = require('../../src/backend/services/sheetAccessService')
      const templateIdNum = Number(data.templateId)
      const belongs = await sheetAccess.sheetBelongsToAccount(templateIdNum, accountId)
      if (!belongs) {
        throw new AppErrorClass('Template not found.', 404)
      }
      return { sheetId: 201 }
    }),
  }
})

jest.mock('../../src/backend/services/templateService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/templateService')>(
      '../../src/backend/services/templateService'
    )
  const AppErrorClass = require('../../src/backend/errors/AppError').AppError as typeof import('../../src/backend/errors/AppError').AppError
  return {
    ...actual,
    fetchAllTemplates: jest.fn().mockResolvedValue([]),
    getTemplateDetailsById: jest.fn().mockResolvedValue(null),
    createTemplate: jest.fn().mockResolvedValue(123),
    cloneTemplateFrom: jest.fn().mockImplementation(async (sourceTemplateId: number, overrides: Record<string, unknown>, userId: number, accountId: number) => {
      const tpl = require('../../src/backend/services/templateService')
      const details = await tpl.getTemplateDetailsById(sourceTemplateId, 'eng', 'SI', accountId)
      if (details?.datasheet == null) {
        throw new AppErrorClass('Source template not found', 404)
      }
      const created = await tpl.createTemplate(
        {
          ...details.datasheet,
          ...overrides,
          sheetId: undefined,
          isTemplate: true,
          status: 'Draft',
          preparedById: userId,
          preparedByDate: new Date().toISOString(),
          verifiedById: null,
          verifiedDate: null,
          approvedById: null,
          approvedDate: null,
        },
        userId,
        accountId
      )
      return { sheetId: typeof created === 'number' ? created : (created as { sheetId: number }).sheetId }
    }),
  }
})

function makeToken(payload: { userId: number; accountId?: number }) {
  return jwt.sign(
    {
      userId: payload.userId,
      email: 'test@example.com',
      role: 'Admin',
      permissions: baseUser.permissions,
      accountId: payload.accountId,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
}

const sheetAccessService = () =>
  require('../../src/backend/services/sheetAccessService') as typeof import('../../src/backend/services/sheetAccessService') & {
    sheetBelongsToAccount: jest.Mock
  }
const filledSheetService = () =>
  require('../../src/backend/services/filledSheetService') as typeof import('../../src/backend/services/filledSheetService') & {
    fetchAllFilled: jest.Mock
    getFilledSheetDetailsById: jest.Mock
    createFilledSheet: jest.Mock
  }
const templateService = () =>
  require('../../src/backend/services/templateService') as typeof import('../../src/backend/services/templateService') & {
    fetchAllTemplates: jest.Mock
    getTemplateDetailsById: jest.Mock
    createTemplate: jest.Mock
  }

describe('Datasheets account scope (Step 1a)', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  beforeEach(() => {
    filledSheetService().fetchAllFilled.mockResolvedValue([])
    filledSheetService().getFilledSheetDetailsById.mockResolvedValue(null)
    templateService().fetchAllTemplates.mockResolvedValue([])
    templateService().getTemplateDetailsById.mockResolvedValue(null)
  })

  describe('list passes accountId to service', () => {
    it('GET /api/backend/filledsheets calls fetchAllFilled with accountId', async () => {
      const token = makeToken({ userId: 1, accountId: 10 })
      filledSheetService().fetchAllFilled.mockResolvedValue([{ sheetId: 1, sheetName: 'A' }])

      const res = await request(app)
        .get('/api/backend/filledsheets')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(filledSheetService().fetchAllFilled).toHaveBeenCalledWith(10)
    })

    it('GET /api/backend/templates calls fetchAllTemplates with accountId', async () => {
      const token = makeToken({ userId: 1, accountId: 20 })
      templateService().fetchAllTemplates.mockResolvedValue([{ sheetId: 2, sheetName: 'T1' }])

      const res = await request(app)
        .get('/api/backend/templates')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(templateService().fetchAllTemplates).toHaveBeenCalledWith(20)
    })
  })

  describe('list returns only account-scoped rows (no cross-tenant data)', () => {
    it('GET /api/backend/filledsheets with accountId 1 returns only account 1 sheets', async () => {
      const account1Rows = [{ sheetId: 101, sheetName: 'Filled-A1' }]
      filledSheetService().fetchAllFilled.mockResolvedValue(account1Rows)

      const res = await request(app)
        .get('/api/backend/filledsheets')
        .set('Cookie', [`token=${makeToken({ userId: 1, accountId: 1 })}`])

      expect(res.status).toBe(200)
      expect(filledSheetService().fetchAllFilled).toHaveBeenCalledWith(1)
      expect(res.body).toEqual(account1Rows)
    })

    it('GET /api/backend/filledsheets with accountId 2 returns only account 2 sheets', async () => {
      const account2Rows = [{ sheetId: 102, sheetName: 'Filled-A2' }]
      filledSheetService().fetchAllFilled.mockResolvedValue(account2Rows)

      const res = await request(app)
        .get('/api/backend/filledsheets')
        .set('Cookie', [`token=${makeToken({ userId: 1, accountId: 2 })}`])

      expect(res.status).toBe(200)
      expect(filledSheetService().fetchAllFilled).toHaveBeenCalledWith(2)
      expect(res.body).toEqual(account2Rows)
    })

    it('GET /api/backend/templates with accountId 1 returns only account 1 templates', async () => {
      const account1Rows = [{ sheetId: 201, sheetName: 'Tpl-A1' }]
      templateService().fetchAllTemplates.mockResolvedValue(account1Rows)

      const res = await request(app)
        .get('/api/backend/templates')
        .set('Cookie', [`token=${makeToken({ userId: 1, accountId: 1 })}`])

      expect(res.status).toBe(200)
      expect(templateService().fetchAllTemplates).toHaveBeenCalledWith(1)
      expect(res.body).toEqual(account1Rows)
    })

    it('GET /api/backend/templates with accountId 2 returns only account 2 templates', async () => {
      const account2Rows = [{ sheetId: 202, sheetName: 'Tpl-A2' }]
      templateService().fetchAllTemplates.mockResolvedValue(account2Rows)

      const res = await request(app)
        .get('/api/backend/templates')
        .set('Cookie', [`token=${makeToken({ userId: 1, accountId: 2 })}`])

      expect(res.status).toBe(200)
      expect(templateService().fetchAllTemplates).toHaveBeenCalledWith(2)
      expect(res.body).toEqual(account2Rows)
    })
  })

  describe('list returns 401 when accountId is missing (no fallback)', () => {
    it('GET /api/backend/filledsheets returns 401 when token has no accountId', async () => {
      filledSheetService().fetchAllFilled.mockClear()
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .get('/api/backend/filledsheets')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(401)
      expect(filledSheetService().fetchAllFilled).not.toHaveBeenCalled()
    })

    it('GET /api/backend/templates returns 401 when token has no accountId', async () => {
      templateService().fetchAllTemplates.mockClear()
      const token = makeToken({ userId: 1 })
      const res = await request(app)
        .get('/api/backend/templates')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(401)
      expect(templateService().fetchAllTemplates).not.toHaveBeenCalled()
    })
  })

  describe('cross-tenant by-id returns 404', () => {
    it('GET /api/backend/filledsheets/:id returns 404 when sheet not in account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      filledSheetService().getFilledSheetDetailsById.mockResolvedValue(null) // other account's sheet

      const res = await request(app)
        .get('/api/backend/filledsheets/999')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(filledSheetService().getFilledSheetDetailsById).toHaveBeenCalledWith(999, expect.any(String), 'SI', 1)
    })

    it('GET /api/backend/templates/:id returns 404 when template not in account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      templateService().getTemplateDetailsById.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/backend/templates/999')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(templateService().getTemplateDetailsById).toHaveBeenCalledWith(999, expect.any(String), 'SI', 1)
    })
  })

  describe('by-id passes accountId and returns 200 when found', () => {
    it('GET /api/backend/filledsheets/:id returns 200 when service returns data', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      filledSheetService().getFilledSheetDetailsById.mockResolvedValue({
        datasheet: { sheetId: 1, sheetName: 'F1' },
        translations: null,
      })

      const res = await request(app)
        .get('/api/backend/filledsheets/1')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(filledSheetService().getFilledSheetDetailsById).toHaveBeenCalledWith(1, expect.any(String), 'SI', 1)
    })

    it('GET /api/backend/templates/:id returns 200 when service returns data', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      templateService().getTemplateDetailsById.mockResolvedValue({
        datasheet: { sheetId: 1, sheetName: 'T1' },
        translations: null,
      })

      const res = await request(app)
        .get('/api/backend/templates/1')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(templateService().getTemplateDetailsById).toHaveBeenCalledWith(1, expect.any(String), 'SI', 1)
    })
  })

  describe('Step 1c.2: filled sheet create and clone account scope', () => {
    const minimalCreateFilledBody = {
      templateId: 1,
      sheetName: 'Test',
      equipmentName: 'Eq',
      equipmentTagNum: 'TAG-1',
      categoryId: 1,
      clientId: 1,
      projectId: 1,
      subsheets: [] as Array<{ name: string; fields: unknown[] }>,
      fieldValues: {} as Record<string, string>,
    }

    it('POST /api/backend/filledsheets returns 404 when template is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .post('/api/backend/filledsheets')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({ ...minimalCreateFilledBody, templateId: 999 })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('POST /api/backend/filledsheets returns 201 when template is in same account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(true)
      filledSheetService().createFilledSheet.mockResolvedValue({ sheetId: 201 })

      const res = await request(app)
        .post('/api/backend/filledsheets')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send(minimalCreateFilledBody)

      expect(res.status).toBe(201)
      expect(res.body?.sheetId).toBe(201)
      expect(filledSheetService().createFilledSheet).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 1 }),
        expect.any(Object),
        1
      )
    })

    it('POST /api/backend/filledsheets/:id/clone returns 404 when source sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .post('/api/backend/filledsheets/888/clone')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({ equipmentTagNum: 'TAG-2', projectId: 1, fieldValues: {} })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(888, 1)
    })

    it('POST /api/backend/filledsheets/:id/clone returns 201 when source sheet is in same account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(true)
      filledSheetService().createFilledSheet.mockResolvedValue({ sheetId: 202 })

      const res = await request(app)
        .post('/api/backend/filledsheets/1/clone')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({ equipmentTagNum: 'TAG-CLONE', projectId: 1, fieldValues: {} })

      expect(res.status).toBe(201)
      expect(res.body?.sheetId).toBe(202)
      expect(filledSheetService().createFilledSheet).toHaveBeenCalledWith(
        expect.objectContaining({ equipmentTagNum: 'TAG-CLONE', templateId: 1 }),
        expect.any(Object),
        1
      )
    })
  })

  describe('Step 1c.1: template create and clone account scope', () => {
    const minimalCreateTemplateBody = {
      disciplineId: 1,
      sheetName: 'Scope Test Template',
      subsheets: [] as Array<{ name: string; fields: unknown[] }>,
    }

    it('POST /api/backend/templates calls createTemplate with caller accountId and returns 201', async () => {
      const token = makeToken({ userId: 1, accountId: 42 })
      templateService().createTemplate.mockResolvedValue(999)

      const res = await request(app)
        .post('/api/backend/templates')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send(minimalCreateTemplateBody)

      expect(res.status).toBe(201)
      expect(res.body?.sheetId).toBe(999)
      expect(templateService().createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ sheetName: 'Scope Test Template', disciplineId: 1 }),
        1,
        42
      )
    })

    it('POST /api/backend/templates/:id/clone returns 404 when source template is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      templateService().getTemplateDetailsById.mockResolvedValue(null)

      const res = await request(app)
        .post('/api/backend/templates/999/clone')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({})

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(templateService().getTemplateDetailsById).toHaveBeenCalledWith(999, 'eng', 'SI', 1)
    })

    it('POST /api/backend/templates/:id/clone returns 201 when source template is in same account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      templateService().getTemplateDetailsById.mockResolvedValue({
        datasheet: {
          sheetId: 999,
          sheetName: 'Source',
          disciplineId: 1,
          subtypeId: null,
          subsheets: [],
        },
        translations: null,
      })
      templateService().createTemplate.mockResolvedValue(1000)

      const res = await request(app)
        .post('/api/backend/templates/999/clone')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({})

      expect(res.status).toBe(201)
      expect(res.body?.sheetId).toBe(1000)
      expect(templateService().createTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        1
      )
    })
  })

  describe('Step 1d: attachments and notes sheet-gate', () => {
    it('GET /api/backend/filledsheets/:id/attachments returns 404 when sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/filledsheets/999/attachments')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('GET /api/backend/filledsheets/:id/notes returns 404 when sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/filledsheets/999/notes')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('POST /api/backend/filledsheets/:id/notes returns 404 when sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .post('/api/backend/filledsheets/999/notes')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({ text: 'a note' })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('GET /api/backend/templates/:id/attachments returns 404 when template is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/templates/999/attachments')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('GET /api/backend/templates/:id/notes returns 404 when template is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/templates/999/notes')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('DELETE /api/backend/templates/:id/notes/:noteId returns 404 when template is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .delete('/api/backend/templates/999/notes/1')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })
  })

  describe('Step 1e: revisions sheet-gate', () => {
    it('GET /api/backend/filledsheets/:id/revisions returns 404 when sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/filledsheets/999/revisions')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('GET /api/backend/filledsheets/:id/revisions/:revisionId returns 404 when sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/filledsheets/999/revisions/1')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('POST /api/backend/filledsheets/:id/revisions/:revisionId/restore returns 404 when sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .post('/api/backend/filledsheets/999/revisions/1/restore')
        .set('Cookie', [`token=${token}`])
        .send({})

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })
  })

  describe('Step 1g: sheet logs sheet-gate', () => {
    it('GET /api/backend/sheets/:sheetId/audit-logs returns 404 when sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/sheets/999/audit-logs')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('GET /api/backend/sheets/:sheetId/change-logs returns 404 when sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/sheets/999/change-logs')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })

    it('GET /api/backend/sheets/:sheetId/logs returns 404 when sheet is in another account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/sheets/999/logs')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 1)
    })
  })

  describe('Step 1i: template structure sheet-gate', () => {
    it('GET /api/backend/templates/999/structure returns 404 when sheetBelongsToAccount false', async () => {
      const token = makeToken({ userId: 1, accountId: 7 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .get('/api/backend/templates/999/structure')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 7)
    })

    it('PUT /api/backend/templates/999/subsheets/order returns 404 when sheetBelongsToAccount false', async () => {
      const token = makeToken({ userId: 1, accountId: 7 })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .put('/api/backend/templates/999/subsheets/order')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({ order: [{ subId: 1, orderIndex: 0 }] })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, 7)
    })
  })

  describe('Step 1j: verify/approve + template update sheet-gate', () => {
    const accountId = 7

    it('POST /api/backend/templates/999/verify returns 404 when sheetBelongsToAccount false', async () => {
      const token = makeToken({ userId: 1, accountId })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .post('/api/backend/templates/999/verify')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({ action: 'verify' })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, accountId)
    })

    it('POST /api/backend/templates/999/approve returns 404 when sheetBelongsToAccount false', async () => {
      const token = makeToken({ userId: 1, accountId })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .post('/api/backend/templates/999/approve')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({ action: 'approve' })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, accountId)
    })

    it('PUT /api/backend/templates/999 returns 404 when sheetBelongsToAccount false', async () => {
      const token = makeToken({ userId: 1, accountId })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .put('/api/backend/templates/999')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({
          sheetName: 'Updated',
          disciplineId: 1,
          subtypeId: null,
          subsheets: [],
          fieldValues: {},
        })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, accountId)
    })

    it('POST /api/backend/filledsheets/999/verify returns 404 when sheetBelongsToAccount false', async () => {
      const token = makeToken({ userId: 1, accountId })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .post('/api/backend/filledsheets/999/verify')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({ action: 'verify' })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, accountId)
    })

    it('POST /api/backend/filledsheets/999/approve returns 404 when sheetBelongsToAccount false', async () => {
      const token = makeToken({ userId: 1, accountId })
      sheetAccessService().sheetBelongsToAccount.mockResolvedValue(false)

      const res = await request(app)
        .post('/api/backend/filledsheets/999/approve')
        .set('Cookie', [`token=${token}`])
        .set('Content-Type', 'application/json')
        .send({ action: 'approve' })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(sheetAccessService().sheetBelongsToAccount).toHaveBeenCalledWith(999, accountId)
    })
  })

  describe('Step 1h: export PDF cross-tenant 404', () => {
    it('GET /api/backend/filledsheets/export/999/pdf returns 404 when sheet not in account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      filledSheetService().getFilledSheetDetailsById.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/backend/filledsheets/export/999/pdf')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
    })

    it('GET /api/backend/templates/export/999/pdf returns 404 when template not in account', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      templateService().getTemplateDetailsById.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/backend/templates/export/999/pdf')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
    })
  })
})
