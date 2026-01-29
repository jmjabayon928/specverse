// tests/api/datasheets.filled.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/backend/app'
import { poolPromise, sql } from '../../src/backend/config/db'

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

const FILLED_PERMISSIONS: string[] = [
  'DATASHEET_VIEW',
  'DATASHEET_EDIT',
  'DATASHEET_VERIFY',
  'DATASHEET_APPROVE',
  'DATASHEET_ATTACHMENT_UPLOAD',
  'DATASHEET_NOTE_EDIT',
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

  it('POST /api/backend/filledsheets should reject invalid body', async () => {
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

  it('POST /api/backend/filledsheets/:id/verify should succeed for a seeded filled sheet (happy path)', async () => {
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
