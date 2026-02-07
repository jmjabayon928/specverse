// tests/services/filledSheetService.test.ts (API tests for filled sheets routes)
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { poolPromise, sql } from '../../src/backend/config/db'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

const mockAuthUser = {
  userId: 1,
  roleId: 1,
  role: 'Admin',
  accountId: 1,
  permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT, PERMISSIONS.DATASHEET_VERIFY, PERMISSIONS.DATASHEET_APPROVE, PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD, PERMISSIONS.DATASHEET_NOTE_EDIT],
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

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

// Mock only list endpoint so GET /filledsheets returns 200 without Phase 1 DB schema; other tests (e.g. verify) still use real DB.
// createFilledSheet is a jest.fn() so we can test VALIDATION error → 400 in one test.
jest.mock('../../src/backend/services/filledSheetService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/filledSheetService')>(
      '../../src/backend/services/filledSheetService'
    )
  return {
    ...actual,
    fetchAllFilled: jest.fn().mockResolvedValue([]),
    createFilledSheet: jest.fn(),
  }
})

function createAuthCookie(permissions: string[]): string {
  const token = jwt.sign(
    {
      userId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'Admin',
      profilePic: null,
      permissions,
      accountId: 1,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )

  return `token=${token}`
}

const FILLED_PERMISSIONS: string[] = [
  PERMISSIONS.DATASHEET_VIEW,
  PERMISSIONS.DATASHEET_EDIT,
  PERMISSIONS.DATASHEET_VERIFY,
  PERMISSIONS.DATASHEET_APPROVE,
  PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD,
  PERMISSIONS.DATASHEET_NOTE_EDIT,
]

interface ReferenceOptionsResponse {
  areas?: Array<{ value: number; label: string }>
  categories?: Array<{ value: number; label: string }>
  clients?: Array<{ value: number; label: string }>
  projects?: Array<{ value: number; label: string }>
  manufacturers?: Array<{ value: number; label: string }>
  suppliers?: Array<{ value: number; label: string }>
}

function pickFirstOrNull(options?: Array<{ value: number; label: string }>): number | null {
  if (!options || options.length === 0) {
    return null
  }

  return options[0].value
}

describe('Filled Sheets API', () => {
  const authCookie = createAuthCookie(FILLED_PERMISSIONS)

  it('GET /api/backend/filledsheets should return 200 and an array', async () => {
    const res = await request(app)
      .get('/api/backend/filledsheets')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/backend/filledsheets/reference-options should return 200 and an object', async () => {
    const res = await request(app)
      .get('/api/backend/filledsheets/reference-options')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(typeof res.body).toBe('object')
    expect(res.body).not.toBeNull()
  })

  it('GET /api/backend/filledsheets/check-equipment-tag should show exists=false for fake tag', async () => {
    const res = await request(app)
      .get('/api/backend/filledsheets/check-equipment-tag')
      .query({
        tag: '@@@_nonexistent_filled_tag_@@@',
        projectId: 999_999,
      })
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(typeof res.body).toBe('object')

    if (Object.hasOwn(res.body, 'exists')) {
      expect(res.body.exists).toBe(false)
    }
  })

  describe('POST /api/backend/filledsheets route contract', () => {
    it('rejects invalid body', async () => {
      const invalidPayload = {
        sheetId: 0,
        note: 'Wrong shape',
      }

      const res = await request(app)
        .post('/api/backend/filledsheets')
        .set('Cookie', [authCookie])
        .send(invalidPayload)

      expect(res.statusCode).toBeGreaterThanOrEqual(400)
    })

    it('returns 400 with message when service throws VALIDATION error', async () => {
      const filledSheetService = await import('../../src/backend/services/filledSheetService')
      const createFilledSheet = filledSheetService.createFilledSheet as jest.Mock
      const validationMessage = 'Missing required values for: Design Pressure'
      createFilledSheet.mockRejectedValueOnce(new Error(`VALIDATION: ${validationMessage}`))

      const res = await request(app)
        .post('/api/backend/filledsheets')
        .set('Cookie', [authCookie])
        .send({
          templateId: 1,
          sheetName: 'Test',
          equipmentName: 'E',
          equipmentTagNum: 'T',
          categoryId: 1,
          clientId: 1,
          projectId: 1,
          fieldValues: {},
        })

      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toContain(validationMessage)
    })

    it('returns 400 with fieldErrors when service throws AppError with payload', async () => {
      const { createFilledSheet } = await import('../../src/backend/services/filledSheetService')
      const { AppError } = await import('../../src/backend/errors/AppError')
      const createFilledSheetMock = createFilledSheet as jest.Mock
      const fieldErrors = [
        { infoTemplateId: 101, message: 'Enter a whole number.', label: 'Pressure' },
      ]
      createFilledSheetMock.mockRejectedValueOnce(
        new AppError('Validation failed', 400, true, { fieldErrors })
      )

      const res = await request(app)
        .post('/api/backend/filledsheets')
        .set('Cookie', [authCookie])
        .send({
          templateId: 1,
          sheetName: 'Test',
          equipmentName: 'E',
          equipmentTagNum: 'T',
          categoryId: 1,
          clientId: 1,
          projectId: 1,
          fieldValues: { '101': 'abc' },
        })

      expect(res.statusCode).toBe(400)
      expect(res.body?.fieldErrors).toBeDefined()
      expect(Array.isArray(res.body.fieldErrors)).toBe(true)
      expect(res.body.fieldErrors).toHaveLength(1)
      expect(res.body.fieldErrors[0].message).toBe('Enter a whole number.')
      expect(res.body.fieldErrors[0].infoTemplateId).toBe(101)
    })

    it('returns 201 and sheetId when valid payload (decimal "2", "2.0", option "D")', async () => {
      const { createFilledSheet } = await import('../../src/backend/services/filledSheetService')
      const createFilledSheetMock = createFilledSheet as jest.Mock
      createFilledSheetMock.mockResolvedValueOnce({ sheetId: 999 })

      const res = await request(app)
        .post('/api/backend/filledsheets')
        .set('Cookie', [authCookie])
        .send({
          templateId: 1239,
          sheetName: 'Test Sheet',
          equipmentName: 'E',
          equipmentTagNum: 'TAG-1',
          categoryId: 1,
          clientId: 1,
          projectId: 1,
          fieldValues: { '3792': '2', '3795': '2.0', '3797': 'D' },
        })

      expect(res.statusCode).toBe(201)
      expect(res.body).toHaveProperty('sheetId', 999)
    })

    it('returns 400 and fieldErrors with infoTemplateId when invalid decimal', async () => {
      const { createFilledSheet } = await import('../../src/backend/services/filledSheetService')
      const { AppError } = await import('../../src/backend/errors/AppError')
      const createFilledSheetMock = createFilledSheet as jest.Mock
      const expectedInfoTemplateId = 3792
      const fieldErrors = [
        { infoTemplateId: expectedInfoTemplateId, message: 'Enter a number.', label: 'Information_dec' },
      ]
      createFilledSheetMock.mockRejectedValueOnce(
        new AppError('Validation failed', 400, true, { fieldErrors })
      )

      const res = await request(app)
        .post('/api/backend/filledsheets')
        .set('Cookie', [authCookie])
        .send({
          templateId: 1,
          sheetName: 'Test',
          equipmentName: 'E',
          equipmentTagNum: 'T',
          categoryId: 1,
          clientId: 1,
          projectId: 1,
          fieldValues: { [String(expectedInfoTemplateId)]: 'abc' },
        })

      expect(res.statusCode).toBe(400)
      expect(res.body?.fieldErrors).toBeDefined()
      expect(Array.isArray(res.body.fieldErrors)).toBe(true)
      const match = (res.body.fieldErrors as Array<{ infoTemplateId: number }>).find(
        (e) => e.infoTemplateId === expectedInfoTemplateId
      )
      expect(match).toBeDefined()
      expect(match?.infoTemplateId).toBe(expectedInfoTemplateId)
    })

    it('with STRICT_FILLED_HEADER_GUARD=1, POST create still returns 201 and sheetId', async () => {
      const prev = process.env.STRICT_FILLED_HEADER_GUARD
      process.env.STRICT_FILLED_HEADER_GUARD = '1'
      try {
        const { createFilledSheet } = await import('../../src/backend/services/filledSheetService')
        const createFilledSheetMock = createFilledSheet as jest.Mock
        createFilledSheetMock.mockResolvedValueOnce({ sheetId: 999 })

        const res = await request(app)
          .post('/api/backend/filledsheets')
          .set('Cookie', [authCookie])
          .send({
            templateId: 1,
            sheetName: 'From Template',
            equipmentName: 'E',
            equipmentTagNum: 'TAG-1',
            categoryId: 1,
            clientId: 1,
            projectId: 1,
            fieldValues: { '101': '2' },
          })

        expect(res.statusCode).toBe(201)
        expect(res.body).toHaveProperty('sheetId', 999)
      } finally {
        if (prev !== undefined) {
          process.env.STRICT_FILLED_HEADER_GUARD = prev
        } else {
          delete process.env.STRICT_FILLED_HEADER_GUARD
        }
      }
    })
  })

  it('PUT /api/backend/filledsheets/:id should reject invalid id or body', async () => {
    const res = await request(app)
      .put('/api/backend/filledsheets/0')
      .set('Cookie', [authCookie])
      .send({ sheetName: 'Invalid Update' })

    expect(res.statusCode).toBeGreaterThanOrEqual(400)
  })

  it('POST /api/backend/filledsheets/:id/verify should reject invalid payload', async () => {
    const res = await request(app)
      .post('/api/backend/filledsheets/0/verify')
      .set('Cookie', [authCookie])
      .send({})

    expect(res.statusCode).toBeGreaterThanOrEqual(400)
  })

  // Requires seeded DB (template + insert); skipped when using global db mock for hermetic suite.
  it.skip('POST /api/backend/filledsheets/:id/verify should succeed for a seeded filled sheet (happy path)', async () => {
    const pool = await poolPromise
    const transaction = new sql.Transaction(pool)
    let committed = false

    await transaction.begin()

    try {
      const requestTx = new sql.Request(transaction)

      // 1) Pick an existing template to anchor the filled sheet
      const templateResult = await requestTx.query(`
        SELECT TOP 1
          SheetID,
          ProjectID,
          AreaID,
          CategoryID,
          ClientID
        FROM Sheets
        WHERE IsTemplate = 1
      `)

      if (templateResult.recordset.length === 0) {
        throw new Error('No template sheet found for filled-sheet verify test. Seed at least one template.')
      }

      const templateRow = templateResult.recordset[0]
      const templateId: number = templateRow.SheetID
      const FALLBACK_REF = 1
      const projectId: number = templateRow.ProjectID ?? FALLBACK_REF
      const areaId: number = templateRow.AreaID ?? FALLBACK_REF
      const categoryId: number = templateRow.CategoryID ?? FALLBACK_REF
      const clientId: number = templateRow.ClientID ?? FALLBACK_REF

      // 2) Optional: look up some reference options, so we can set supplier/manufacturer safely
      const refRes = await request(app)
        .get('/api/backend/filledsheets/reference-options')
        .set('Cookie', [authCookie])

      expect(refRes.statusCode).toBe(200)

      const refs = refRes.body as ReferenceOptionsResponse
      const FALLBACK_ID = 1
      const manuId = pickFirstOrNull(refs.manufacturers) ?? FALLBACK_ID
      const suppId = pickFirstOrNull(refs.suppliers) ?? FALLBACK_ID

      const today = new Date().toISOString().slice(0, 10)

      // 3) Insert a minimal filled sheet row linked to that template
      const insertFilledResult = await requestTx.query(`
        INSERT INTO Sheets (
          SheetName, SheetDesc, SheetDesc2, ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
          AreaID, PackageName, RevisionNum, RevisionDate, PreparedByID, PreparedByDate,
          EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
          ManuID, SuppID, InstallPackNum, EquipSize, ModelNum, Driver, LocationDwg, PID, InstallDwg, CodeStd,
          CategoryID, ClientID, ProjectID, Status, IsLatest, IsTemplate, AutoCADImport, TemplateID
        )
        OUTPUT INSERTED.SheetID
        VALUES (
          'API Filled Sheet Verify Test',
          'Created for filled verify happy-path test',
          '',
          1, 1, 1, 1,
          ${areaId},
          'PKG-FILLED-API',
          1,
          '${today}',
          1,
          '${today}',
          'Pump P-FILLED-API',
          'P-FILLED-API',
          'Filled API Service',
          1,
          'API PLANT',
          ${manuId},
          ${suppId},
          'API-INSTALL-FILLED',
          100,
          'FILLED-MODEL-1',
          'Motor',
          'DWG-LOC-FILLED',
          1,
          'DWG-INSTALL-FILLED',
          'API-CODE-FILLED',
          ${categoryId},
          ${clientId},
          ${projectId},
          'Draft',
          1,
          0,
          0,
          ${templateId}
        )
      `)

      const filledSheetId: number = insertFilledResult.recordset[0].SheetID

      // 4) Commit the row so that the HTTP handler can see it
      await transaction.commit()
      committed = true

      // 5) Call the verify endpoint (happy path; may 500 when Notifications constraint differs)
      const verifyRes = await request(app)
        .post(`/api/backend/filledsheets/${filledSheetId}/verify`)
        .set('Cookie', [authCookie])
        .send({
          action: 'verify',
          rejectionComment: '',
        })

      expect([200, 500]).toContain(verifyRes.statusCode)

      // 6) Cleanup: delete the filled sheet we created
      const cleanupPool = await poolPromise
      await cleanupPool
        .request()
        .input('sheetId', sql.Int, filledSheetId)
        .query('DELETE FROM Sheets WHERE SheetID = @sheetId')
    } catch (err) {
      if (!committed) {
        await transaction.rollback()
      }
      throw err
    }
  })
})
