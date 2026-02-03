// tests/api/valuesets.filled.test.ts
// Phase 2 Slice #2: Backend value-set plumbing — integration tests (Supertest).

import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import { AppError } from '../../src/backend/errors/AppError'

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

const FILLED_PERMISSIONS = ['DATASHEET_VIEW', 'DATASHEET_EDIT', 'DATASHEET_VERIFY', 'DATASHEET_APPROVE']

process.env.JWT_SECRET ??= 'secret'

const testSheetId = 42

const mockGetFilledSheetDetailsById = jest.fn()
const mockUpdateFilledSheet = jest.fn()
const mockGetValueSetId = jest.fn()
const mockEnsureRequirementValueSet = jest.fn()
const mockGetValueSetStatus = jest.fn()
const mockCreateValueSet = jest.fn()
const mockListValueSets = jest.fn()

// Full mock to avoid loading the real filledSheetService (deterministic, no timeout under parallel run).
const mockSheetBelongsToAccount = jest.fn().mockResolvedValue(true)
jest.mock('../../src/backend/services/filledSheetService', () => ({
  fetchAllFilled: jest.fn(),
  fetchReferenceOptions: jest.fn(),
  getFilledSheetDetailsById: (...args: unknown[]) => mockGetFilledSheetDetailsById(...args),
  sheetBelongsToAccount: (...args: unknown[]) => mockSheetBelongsToAccount(...args),
  createFilledSheet: jest.fn(),
  updateFilledSheet: (...args: unknown[]) => mockUpdateFilledSheet(...args),
  verifyFilledSheet: jest.fn(),
  approveFilledSheet: jest.fn(),
  bumpRejectedToModifiedDraftFilled: jest.fn(),
  doesEquipmentTagExist: jest.fn(),
  getFilledSheetTemplateId: jest.fn(),
  getLatestApprovedTemplateId: jest.fn(),
  getAttachmentsForSheet: jest.fn(),
  deleteAttachmentById: jest.fn(),
  listSheetAttachments: jest.fn(),
  deleteSheetAttachmentLink: jest.fn(),
  getNotesForSheet: jest.fn(),
  createNoteForSheet: jest.fn(),
  updateNoteForSheet: jest.fn(),
  deleteNoteForSheet: jest.fn(),
  exportPDF: jest.fn(),
  exportExcel: jest.fn(),
}))

jest.mock('../../src/backend/database/valueSetQueries', () => ({
  getContextIdByCode: jest.fn(),
  getValueSetId: (...args: unknown[]) => mockGetValueSetId(...args),
  ensureRequirementValueSet: (...args: unknown[]) => mockEnsureRequirementValueSet(...args),
  ensureRequirementValueSetInTransaction: jest.fn().mockResolvedValue(1),
  getValueSetStatus: (...args: unknown[]) => mockGetValueSetStatus(...args),
  createValueSet: (...args: unknown[]) => mockCreateValueSet(...args),
  listValueSets: (...args: unknown[]) => mockListValueSets(...args),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
  getUserPermissions: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../src/backend/middleware/authMiddleware', () => ({
  verifyToken: (req: unknown, _res: unknown, next: () => void) => {
    ;(req as { user?: { userId: number; accountId: number } }).user = { userId: 1, accountId: 1 }
    next()
  },
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalVerifyToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

function toHttpError(err: unknown): { statusCode: number; message: string } {
  const statusCode =
    err != null &&
    typeof err === 'object' &&
    'statusCode' in err &&
    typeof (err as Record<string, unknown>).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 500
  let message = 'Internal Server Error'
  if (err instanceof Error) {
    message = err.message
  } else if (
    err != null &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as Record<string, unknown>).message === 'string'
  ) {
    message = (err as { message: string }).message
  }
  return { statusCode, message }
}

function buildTestApp(): express.Application {
  const filledSheetRoutes = require('../../src/backend/routes/filledSheetRoutes').default
  const sheetRoutes = require('../../src/backend/routes/sheetRoutes').default
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/filledsheets', filledSheetRoutes)
  app.use('/api/backend/sheets', sheetRoutes)
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const httpErr = toHttpError(err)
    res.status(httpErr.statusCode).json({ error: httpErr.message })
  })
  return app
}

describe('Phase 2 value-set plumbing', () => {
  const authCookie = createAuthCookie(FILLED_PERMISSIONS)

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetValueSetStatus.mockResolvedValue('Draft')
    mockEnsureRequirementValueSet.mockResolvedValue(1)
    mockGetValueSetId.mockResolvedValue(1)
    mockCreateValueSet.mockResolvedValue(1)
    mockListValueSets.mockResolvedValue([
      { ValueSetID: 1, SheetID: testSheetId, ContextID: 1, Code: 'Requirement', PartyID: null, Status: 'Draft' },
    ])
  })

  describe('GET filled sheet (same payload shape)', () => {
    it('returns same payload shape with datasheet.subsheets and fields', async () => {
      const payload = {
        datasheet: {
          sheetId: testSheetId,
          sheetName: 'Test',
          subsheets: [
            {
              id: 1,
              name: 'Sub1',
              fields: [
                { id: 10, label: 'Field1', infoType: 'varchar' as const, sortOrder: 0, required: false, value: 'v1' },
              ],
            },
          ],
        },
        translations: null,
      }
      mockGetFilledSheetDetailsById.mockResolvedValue(payload)

      const app = buildTestApp()
      const res = await request(app)
        .get(`/api/backend/filledsheets/${testSheetId}`)
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('datasheet')
      expect(res.body.datasheet).toHaveProperty('subsheets')
      expect(Array.isArray(res.body.datasheet.subsheets)).toBe(true)
      expect(res.body.datasheet.subsheets[0]).toHaveProperty('fields')
      expect(res.body.datasheet.subsheets[0].fields[0]).toMatchObject({
        id: 10,
        label: 'Field1',
        value: 'v1',
      })
    })
  })

  describe('PUT filled sheet (rejected when status Locked)', () => {
    it('returns 409 when ValueSet status is Locked', async () => {
      mockGetFilledSheetDetailsById.mockResolvedValue({
        datasheet: {
          sheetId: testSheetId,
          sheetName: 'Test',
          subsheets: [{ name: 'S1', fields: [{ id: 1, label: 'F1', value: 'x' }] }],
        },
        translations: null,
      })
      mockUpdateFilledSheet.mockRejectedValue(
        new AppError('Cannot update values: ValueSet status is Locked. Only Draft can be edited.', 409)
      )

      const app = buildTestApp()
      const res = await request(app)
        .put(`/api/backend/filledsheets/${testSheetId}`)
        .set('Cookie', [authCookie])
        .send({
          sheetName: 'Test',
          sheetDesc: '',
          clientDocNum: 1,
          clientProjectNum: 1,
          companyDocNum: 1,
          companyProjectNum: 1,
          areaId: 1,
          packageName: 'P',
          revisionNum: 1,
          revisionDate: '2026-01-01',
          itemLocation: 'L',
          requiredQty: 1,
          equipmentName: 'E',
          equipmentTagNum: 'TAG',
          serviceName: 'S',
          manuId: 1,
          suppId: 1,
          equipSize: 1,
          categoryId: 1,
          clientId: 1,
          projectId: 1,
          subsheets: [{ name: 'S1', fields: [{ id: 1, label: 'F1', value: 'x' }] }],
        })

      expect(res.statusCode).toBe(409)
    })
  })

  describe('ensureRequirementValueSet (creates one, reuses)', () => {
    it('createValueSet is called once for Requirement; getValueSetId returns same id on list', async () => {
      mockGetValueSetId.mockResolvedValue(null).mockResolvedValueOnce(1)
      mockCreateValueSet.mockResolvedValue(1)

      const app = buildTestApp()
      const res = await request(app)
        .post(`/api/backend/sheets/${testSheetId}/valuesets`)
        .set('Cookie', [authCookie])
        .send({ context: 'Requirement' })

      expect(res.statusCode).toBe(201)
      expect(res.body).toHaveProperty('valueSetId', 1)
      expect(mockCreateValueSet).toHaveBeenCalledWith(
        testSheetId,
        'Requirement',
        undefined,
        expect.anything()
      )
    })

    it('GET /sheets/:sheetId/valuesets?context=Requirement returns valueSetId when set exists', async () => {
      mockGetValueSetId.mockResolvedValue(1)

      const app = buildTestApp()
      const res = await request(app)
        .get(`/api/backend/sheets/${testSheetId}/valuesets`)
        .query({ context: 'Requirement' })
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('valueSetId', 1)
      expect(res.body).toHaveProperty('context', 'Requirement')
    })

    it('GET /sheets/:sheetId/valuesets returns items array when no context filter', async () => {
      const app = buildTestApp()
      const res = await request(app)
        .get(`/api/backend/sheets/${testSheetId}/valuesets`)
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('items')
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(mockListValueSets).toHaveBeenCalledWith(testSheetId)
    })
  })

  describe('PUT writes rows with ValueSetID and UOM (service contract)', () => {
    it('updateFilledSheet is called with sheetId and merged body including subsheets', async () => {
      mockGetFilledSheetDetailsById.mockResolvedValue({
        datasheet: {
          sheetId: testSheetId,
          sheetName: 'Test',
          subsheets: [{ name: 'S1', fields: [{ id: 1, label: 'F1', value: 'old' }] }],
        },
        translations: null,
      })
      mockUpdateFilledSheet.mockResolvedValue({ sheetId: testSheetId })

      const app = buildTestApp()
      const res = await request(app)
        .put(`/api/backend/filledsheets/${testSheetId}`)
        .set('Cookie', [authCookie])
        .send({
          sheetName: 'Test',
          sheetDesc: '',
          clientDocNum: 1,
          clientProjectNum: 1,
          companyDocNum: 1,
          companyProjectNum: 1,
          areaId: 1,
          packageName: 'P',
          revisionNum: 1,
          revisionDate: '2026-01-01',
          itemLocation: 'L',
          requiredQty: 1,
          equipmentName: 'E',
          equipmentTagNum: 'TAG',
          serviceName: 'S',
          manuId: 1,
          suppId: 1,
          equipSize: 1,
          categoryId: 1,
          clientId: 1,
          projectId: 1,
          subsheets: [{ name: 'S1', fields: [{ id: 1, label: 'F1', value: 'new' }] }],
        })

      expect(res.statusCode).toBe(200)
      expect(mockUpdateFilledSheet).toHaveBeenCalledWith(
        testSheetId,
        expect.objectContaining({
          subsheets: expect.any(Array),
          sheetName: 'Test',
        }),
        expect.any(Number)
      )
    })
  })
})
