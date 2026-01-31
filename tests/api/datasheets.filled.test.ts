// tests/api/datasheets.filled.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'

// Mock auth so no real DB (permissionQueries) runs.
const mockAuthUser = {
  userId: 1,
  roleId: 1,
  role: 'Admin',
  permissions: [
    'DATASHEET_VIEW',
    'DATASHEET_EDIT',
    'DATASHEET_VERIFY',
    'DATASHEET_APPROVE',
    'DATASHEET_ATTACHMENT_UPLOAD',
    'DATASHEET_NOTE_EDIT',
  ] as string[],
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

// Mock filled sheet list so tests pass without Phase 1 DB schema (Disciplines/DatasheetSubtypes).
jest.mock('../../src/backend/services/filledSheetService', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/services/filledSheetService')>(
      '../../src/backend/services/filledSheetService'
    )
  return {
    ...actual,
    fetchAllFilled: jest.fn().mockResolvedValue([]),
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

const FILLED_PERMISSIONS: string[] = [
  'DATASHEET_VIEW',
  'DATASHEET_EDIT',
  'DATASHEET_VERIFY',
  'DATASHEET_APPROVE',
  'DATASHEET_ATTACHMENT_UPLOAD',
  'DATASHEET_NOTE_EDIT',
]

describe('Filled Sheets API', () => {
  const authCookie = createAuthCookie(FILLED_PERMISSIONS)

  it('GET /api/backend/filledsheets should return 200 and array with optional discipline fields', async () => {
    const res = await request(app)
      .get('/api/backend/filledsheets')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    for (const row of res.body as Array<Record<string, unknown>>) {
      if (row.disciplineId !== undefined) expect(typeof row.disciplineId === 'number' || row.disciplineId === null).toBe(true)
      if (row.disciplineName !== undefined) expect(typeof row.disciplineName === 'string' || row.disciplineName === null).toBe(true)
      if (row.subtypeId !== undefined) expect(typeof row.subtypeId === 'number' || row.subtypeId === null).toBe(true)
      if (row.subtypeName !== undefined) expect(typeof row.subtypeName === 'string' || row.subtypeName === null).toBe(true)
    }
  })

  it('GET /api/backend/filledsheets returns disciplineName/subtypeName when DB returns rows with IDs', async () => {
    const filledSheetService = await import('../../src/backend/services/filledSheetService')
    const mockFetch = filledSheetService.fetchAllFilled as jest.Mock
    mockFetch.mockResolvedValueOnce([
      {
        sheetId: 1,
        sheetName: 'F1',
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
      .get('/api/backend/filledsheets')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
    const row = res.body[0] as Record<string, unknown>
    expect(row.disciplineId).toBe(1)
    expect(row.disciplineName).toBe('PIPING')
    expect(row.subtypeId).toBe(1)
    expect(row.subtypeName).toBe('Pressure Transmitter')
  })

  it('GET /api/backend/filledsheets returns null disciplineName/subtypeName when DisciplineID/SubtypeID are null', async () => {
    const filledSheetService = await import('../../src/backend/services/filledSheetService')
    const mockFetch = filledSheetService.fetchAllFilled as jest.Mock
    mockFetch.mockResolvedValueOnce([
      {
        sheetId: 2,
        sheetName: 'F2',
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
      .get('/api/backend/filledsheets')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
    const row = res.body[0] as Record<string, unknown>
    expect(row.disciplineId).toBeNull()
    expect(row.disciplineName).toBeNull()
    expect(row.subtypeId).toBeNull()
    expect(row.subtypeName).toBeNull()
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
})
