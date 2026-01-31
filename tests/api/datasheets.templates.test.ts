// tests/api/datasheets.templates.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'

process.env.JWT_SECRET ??= 'secret'

const mockAuthUser = {
  userId: 1,
  roleId: 1,
  role: 'Admin',
  permissions: ['DATASHEET_VIEW', 'DATASHEET_EDIT', 'DATASHEET_VERIFY', 'DATASHEET_APPROVE', 'DATASHEET_ATTACHMENT_UPLOAD', 'DATASHEET_NOTE_EDIT'] as string[],
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

// Mock template service so suite is fully deterministic (no DB). List/reference + create/update/get/verify.
jest.mock('../../src/backend/services/templateService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/templateService')>(
      '../../src/backend/services/templateService'
    )
  return {
    ...actual,
    fetchAllTemplates: jest.fn().mockResolvedValue([]),
    fetchTemplateReferenceOptions: jest.fn().mockResolvedValue({
      categories: [{ CategoryID: 1, CategoryName: 'Test' }],
      users: [{ UserID: 1, FirstName: 'Test', LastName: 'User' }],
      disciplines: [
        { id: 1, code: 'PIPING', name: 'PIPING' },
        { id: 2, code: 'INSTRUMENTATION', name: 'INSTRUMENTATION' },
      ],
      subtypes: [
        { id: 1, disciplineId: 1, code: 'Pressure Transmitter', name: 'Pressure Transmitter' },
      ],
    }),
    createTemplate: jest.fn().mockResolvedValue(1),
    updateTemplate: jest.fn().mockImplementation((sheetId: number) => Promise.resolve(sheetId)),
    getTemplateDetailsById: jest.fn().mockImplementation((templateId: number) =>
      Promise.resolve({
        datasheet: {
          sheetId: templateId,
          disciplineId: 1,
          disciplineName: 'PIPING',
          subtypeId: null,
          subtypeName: null,
        },
        translations: null,
      })
    ),
    verifyTemplate: jest.fn().mockResolvedValue(undefined),
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

interface DisciplineOption {
  id: number
  code: string
  name: string
}

interface SubtypeOption {
  id: number
  disciplineId: number
  code: string
  name: string
}

interface ReferenceOptionsResponse {
  areas?: Array<{ value: number; label: string }>
  categories?: Array<{ value: number; label: string }>
  clients?: Array<{ value: number; label: string }>
  projects?: Array<{ value: number; label: string }>
  manufacturers?: Array<{ value: number; label: string }>
  suppliers?: Array<{ value: number; label: string }>
  disciplines?: DisciplineOption[]
  subtypes?: SubtypeOption[]
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
  disciplineId: number
  subtypeId?: number | null
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
    const firstDisciplineId =
      Array.isArray(refs.disciplines) && refs.disciplines.length > 0 ? refs.disciplines[0].id : null
    const disciplineId = typeof firstDisciplineId === 'number' ? firstDisciplineId : FALLBACK_REF_ID

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
      disciplineId,
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

  it('GET /api/backend/templates should return 200 and array with optional discipline fields', async () => {
    const res = await request(app)
      .get('/api/backend/templates')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    for (const row of res.body as Array<Record<string, unknown>>) {
      expect(typeof row.sheetId === 'number' || typeof row.sheetId === 'undefined').toBe(true)
      if (row.disciplineId !== undefined) expect(typeof row.disciplineId === 'number' || row.disciplineId === null).toBe(true)
      if (row.disciplineName !== undefined) expect(typeof row.disciplineName === 'string' || row.disciplineName === null).toBe(true)
      if (row.subtypeId !== undefined) expect(typeof row.subtypeId === 'number' || row.subtypeId === null).toBe(true)
      if (row.subtypeName !== undefined) expect(typeof row.subtypeName === 'string' || row.subtypeName === null).toBe(true)
    }
  })

  it('GET /api/backend/templates returns disciplineName/subtypeName when DB returns rows with IDs', async () => {
    const templateService = await import('../../src/backend/services/templateService')
    const mockFetch = templateService.fetchAllTemplates as jest.Mock
    mockFetch.mockResolvedValueOnce([
      {
        sheetId: 1,
        sheetName: 'T1',
        sheetDesc: '',
        categoryId: 1,
        categoryName: 'Cat',
        preparedById: 1,
        preparedByName: 'User',
        revisionDate: null,
        status: 'Draft',
        disciplineId: 1,
        disciplineName: 'PIPING',
        subtypeId: 1,
        subtypeName: 'Pressure Transmitter',
      },
    ])

    const res = await request(app)
      .get('/api/backend/templates')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(1)
    const row = res.body[0] as Record<string, unknown>
    expect(row.disciplineId).toBe(1)
    expect(row.disciplineName).toBe('PIPING')
    expect(row.subtypeId).toBe(1)
    expect(row.subtypeName).toBe('Pressure Transmitter')
  })

  it('GET /api/backend/templates returns null disciplineName/subtypeName when DisciplineID/SubtypeID are null', async () => {
    const templateService = await import('../../src/backend/services/templateService')
    const mockFetch = templateService.fetchAllTemplates as jest.Mock
    mockFetch.mockResolvedValueOnce([
      {
        sheetId: 2,
        sheetName: 'T2',
        sheetDesc: '',
        categoryId: 1,
        categoryName: 'Cat',
        preparedById: 1,
        preparedByName: 'User',
        revisionDate: null,
        status: 'Draft',
        disciplineId: null,
        disciplineName: null,
        subtypeId: null,
        subtypeName: null,
      },
    ])

    const res = await request(app)
      .get('/api/backend/templates')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
    const row = res.body[0] as Record<string, unknown>
    expect(row.disciplineId).toBeNull()
    expect(row.disciplineName).toBeNull()
    expect(row.subtypeId).toBeNull()
    expect(row.subtypeName).toBeNull()
  })

  it('GET /api/backend/templates/reference-options should return 200 with disciplines/subtypes shaped by id, code (Code column), name (Name column)', async () => {
    const res = await request(app)
      .get('/api/backend/templates/reference-options')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(typeof res.body).toBe('object')
    expect(res.body).not.toBeNull()
    expect(Array.isArray(res.body.disciplines)).toBe(true)
    expect(Array.isArray(res.body.subtypes)).toBe(true)
    expect(res.body.disciplines.length).toBeGreaterThan(0)
    expect(res.body.subtypes.length).toBeGreaterThan(0)
    const disc = res.body.disciplines[0] as Record<string, unknown>
    expect(disc).toHaveProperty('id')
    expect(disc).toHaveProperty('name')
    expect(disc).toHaveProperty('code')
    expect(disc).not.toHaveProperty('DisciplineName')
    const sub = res.body.subtypes[0] as Record<string, unknown>
    expect(sub).toHaveProperty('id')
    expect(sub).toHaveProperty('disciplineId')
    expect(sub).toHaveProperty('name')
    expect(sub).toHaveProperty('code')
    expect(sub).not.toHaveProperty('SubtypeName')
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

    // 1) CREATE (mocked; no DB)
    const createRes = await request(app)
      .post('/api/backend/templates')
      .set('Cookie', [authCookie])
      .send(payload)

    expect(createRes.statusCode).toBe(201)
    expect(typeof createRes.body).toBe('object')
    const createdBody = createRes.body as { sheetId?: number; SheetID?: number; id?: number }
    const sheetId = createdBody.sheetId ?? createdBody.SheetID ?? createdBody.id
    expect(typeof sheetId).toBe('number')

    // 2) GET by id (mocked)
    const getRes = await request(app)
      .get(`/api/backend/templates/${sheetId}`)
      .set('Cookie', [authCookie])

    expect(getRes.statusCode).toBe(200)
    expect(typeof getRes.body).toBe('object')
    const resolvedSheetId =
      getRes.body.datasheet?.sheetId ??
      getRes.body.sheetId ??
      getRes.body.SheetID ??
      getRes.body.id
    expect(resolvedSheetId).toBe(sheetId)
    if (getRes.body.datasheet) {
      expect(
        typeof getRes.body.datasheet.disciplineId === 'number' ||
          getRes.body.datasheet.disciplineId === null ||
          getRes.body.datasheet.disciplineId === undefined
      ).toBe(true)
    }

    // 3) UPDATE name (mocked)
    const updatedName = 'API Test Template (Updated)'
    const updateRes = await request(app)
      .put(`/api/backend/templates/${sheetId}`)
      .set('Cookie', [authCookie])
      .send({
        ...payload,
        sheetName: updatedName,
      })

    expect(updateRes.statusCode).toBe(200)

    // 4) VERIFY (mocked)
    const verifyRes = await request(app)
      .post(`/api/backend/templates/${sheetId}/verify`)
      .set('Cookie', [authCookie])
      .send({
        action: 'verify',
        rejectionComment: '',
      })

    expect(verifyRes.statusCode).toBe(200)
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

  it('POST /api/backend/templates should return 400 when disciplineId is missing', async () => {
    const refRes = await request(app)
      .get('/api/backend/templates/reference-options')
      .set('Cookie', [authCookie])
    expect(refRes.statusCode).toBe(200)
    const refs = refRes.body as ReferenceOptionsResponse
    const categoryId = pickFirstOrNull(refs.categories) ?? FALLBACK_REF_ID
    const clientId = pickFirstOrNull(refs.clients) ?? FALLBACK_REF_ID
    const projectId = pickFirstOrNull(refs.projects) ?? FALLBACK_REF_ID
    const payloadWithoutDiscipline = {
      sheetName: 'Missing Discipline',
      sheetDesc: 'No disciplineId',
      sheetDesc2: '',
      clientDocNum: 1,
      clientProjectNum: 1,
      companyDocNum: 1,
      companyProjectNum: 1,
      areaId: FALLBACK_REF_ID,
      packageName: 'PKG',
      revisionNum: 1,
      revisionDate: new Date().toISOString().slice(0, 10),
      equipmentName: 'Eq',
      equipmentTagNum: `T-${Date.now()}`,
      serviceName: 'Svc',
      requiredQty: 1,
      itemLocation: 'Loc',
      manuId: FALLBACK_REF_ID,
      suppId: FALLBACK_REF_ID,
      installPackNum: '',
      equipSize: 0,
      modelNum: '',
      driver: '',
      locationDwg: '',
      pid: 0,
      installDwg: '',
      codeStd: '',
      categoryId,
      clientId,
      projectId,
      subsheets: [],
    }

    const res = await request(app)
      .post('/api/backend/templates')
      .set('Cookie', [authCookie])
      .send(payloadWithoutDiscipline)

    expect(res.statusCode).toBe(400)
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
