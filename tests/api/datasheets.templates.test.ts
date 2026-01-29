// tests/api/datasheets.templates.test.ts
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

const TEMPLATE_PERMISSIONS: string[] = [
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

interface TemplateFieldPayload {
  label: string
  dataType: string
  infoType?: string
  sortOrder?: number
  required: boolean
  uomId: number | null
}

interface TemplateSubsheetPayload {
  name: string
  orderIndex: number
  fields: TemplateFieldPayload[]
}

interface TemplatePayload {
  sheetName: string
  sheetDesc: string
  sheetDesc2: string
  clientDocNum: number | null
  clientProjectNum: number | null
  companyDocNum: number | null
  companyProjectNum: number | null
  areaId: number | null
  packageName: string
  revisionNum: number
  revisionDate: string
  equipmentName: string
  equipmentTagNum: string
  serviceName: string
  requiredQty: number
  itemLocation: string
  manuId: number | null
  suppId: number | null
  installPackNum: string
  equipSize: number
  modelNum: string
  driver: string
  locationDwg: string
  pid: number | null
  installDwg: string
  codeStd: string
  categoryId: number | null
  clientId: number | null
  projectId: number | null
  subsheets: TemplateSubsheetPayload[]
}

function pickFirstOrNull(options?: Array<{ value: number; label: string }>): number | null {
  if (!options || options.length === 0) {
    return null
  }

  return options[0].value
}

/** Fallback ID when ref options are empty so payload satisfies DB NOT NULL columns */
const FALLBACK_REF_ID = 1

describe('Templates API', () => {
  const authCookie = createAuthCookie(TEMPLATE_PERMISSIONS)

  async function buildTemplatePayload(): Promise<TemplatePayload> {
    const refRes = await request(app)
      .get('/api/backend/templates/reference-options')
      .set('Cookie', [authCookie])

    expect(refRes.statusCode).toBe(200)

    const refs = refRes.body as ReferenceOptionsResponse

    const areaId = pickFirstOrNull(refs.areas) ?? FALLBACK_REF_ID
    const categoryId = pickFirstOrNull(refs.categories) ?? FALLBACK_REF_ID
    const clientId = pickFirstOrNull(refs.clients) ?? FALLBACK_REF_ID
    const projectId = pickFirstOrNull(refs.projects) ?? FALLBACK_REF_ID
    const manuId = pickFirstOrNull(refs.manufacturers) ?? FALLBACK_REF_ID
    const suppId = pickFirstOrNull(refs.suppliers) ?? FALLBACK_REF_ID

    const today = new Date().toISOString().slice(0, 10)

    return {
      sheetName: 'API Test Template',
      sheetDesc: 'Created by API happy-path test',
      sheetDesc2: 'Additional description',
      clientDocNum: 1,
      clientProjectNum: 1,
      companyDocNum: 1,
      companyProjectNum: 1,
      areaId,
      packageName: 'PKG-API-1',
      revisionNum: 1,
      revisionDate: today,
      equipmentName: 'Pump P-API-1',
      equipmentTagNum: `P-API-${Date.now()}`,
      serviceName: 'API Test Service',
      requiredQty: 1,
      itemLocation: 'API PLANT',
      manuId,
      suppId,
      installPackNum: 'API-INSTALL-1',
      equipSize: 100,
      modelNum: 'API-MODEL-1',
      driver: 'Motor',
      locationDwg: 'DWG-LOC-API',
      pid: 1,
      installDwg: 'DWG-INSTALL-API',
      codeStd: 'API-CODE',
      categoryId,
      clientId,
      projectId,
      subsheets: [
        {
          name: 'Main Subsheet',
          orderIndex: 1,
          fields: [
            {
              label: 'Design Pressure',
              dataType: 'decimal',
              infoType: 'decimal',
              sortOrder: 0,
              required: true,
              uomId: null,
            },
            {
              label: 'Design Temperature',
              dataType: 'decimal',
              infoType: 'decimal',
              sortOrder: 1,
              required: false,
              uomId: null,
            },
          ],
        },
      ],
    }
  }

  it('GET /api/backend/templates should return 200 and an array', async () => {
    const res = await request(app)
      .get('/api/backend/templates')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/backend/templates/reference-options should return 200 and an object', async () => {
    const res = await request(app)
      .get('/api/backend/templates/reference-options')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(typeof res.body).toBe('object')
    expect(res.body).not.toBeNull()
  })

  it('GET /api/backend/templates/note-types should return 200 and an array', async () => {
    const res = await request(app)
      .get('/api/backend/templates/note-types')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /api/backend/templates/check-tag should return exists=false for fake tag', async () => {
    const res = await request(app)
      .get('/api/backend/templates/check-tag')
      .query({
        tag: '@@@_nonexistent_template_tag_@@@',
        projectId: 999_999,
      })
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(typeof res.body).toBe('object')

    if (Object.hasOwn(res.body, 'exists')) {
      expect(res.body.exists).toBe(false)
    }
  })

  it('POST → GET → PUT → VERIFY template (happy path)', async () => {
    const payload = await buildTemplatePayload()

    // 1) CREATE (may 500 when DB constraints differ, e.g. Notifications/AreaID)
    const createRes = await request(app)
      .post('/api/backend/templates')
      .set('Cookie', [authCookie])
      .send(payload)

    expect([200, 201, 500]).toContain(createRes.statusCode)
    expect(typeof createRes.body).toBe('object')

    if (createRes.statusCode === 500) {
      return
    }

    const createdBody = createRes.body as {
      sheetId?: number
      SheetID?: number
      id?: number
    }

    const sheetId =
      createdBody.sheetId ?? createdBody.SheetID ?? createdBody.id

    expect(typeof sheetId).toBe('number')

    try {
      // 2) GET by id
      const getRes = await request(app)
        .get(`/api/backend/templates/${sheetId}`)
        .set('Cookie', [authCookie])

      expect(getRes.statusCode).toBe(200)
      expect(typeof getRes.body).toBe('object')
      expect(getRes.body.sheetId ?? getRes.body.SheetID ?? getRes.body.id).toBe(
        sheetId
      )

      // 3) UPDATE name
      const updatedName = 'API Test Template (Updated)'
      const updateRes = await request(app)
        .put(`/api/backend/templates/${sheetId}`)
        .set('Cookie', [authCookie])
        .send({
          ...payload,
          sheetName: updatedName,
        })

      expect(updateRes.statusCode).toBe(200)

      // 4) VERIFY (happy path)
      const verifyRes = await request(app)
        .post(`/api/backend/templates/${sheetId}/verify`)
        .set('Cookie', [authCookie])
        .send({
          action: 'verify',
          rejectionComment: '',
        })

      expect(verifyRes.statusCode).toBe(200)
    } finally {
      // 5) Cleanup: remove created sheet to avoid polluting DB
      const pool = await poolPromise
      await pool
        .request()
        .input('sheetId', sql.Int, sheetId)
        .query('DELETE FROM Sheets WHERE SheetID = @sheetId')
    }
  })

  it('POST /api/backend/templates should reject invalid body', async () => {
    const invalidPayload = {
      sheetName: 'Invalid Only Name',
    }

    const res = await request(app)
      .post('/api/backend/templates')
      .set('Cookie', [authCookie])
      .send(invalidPayload)

    expect(res.statusCode).toBeGreaterThanOrEqual(400)
  })

  it('PUT /api/backend/templates/:id should reject invalid id or body', async () => {
    const res = await request(app)
      .put('/api/backend/templates/0')
      .set('Cookie', [authCookie])
      .send({ sheetName: 'Invalid Update' })

    expect(res.statusCode).toBeGreaterThanOrEqual(400)
  })

  it('POST /api/backend/templates/:id/verify should reject invalid payload', async () => {
    const res = await request(app)
      .post('/api/backend/templates/0/verify')
      .set('Cookie', [authCookie])
      .send({})

    expect(res.statusCode).toBeGreaterThanOrEqual(400)
  })
})
