// tests/api/valuesets.slice3.test.ts
// Phase 2 Slice #3: Offered creation, variance PATCH, status POST, compare GET.

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

const FILLED_PERMISSIONS = ['DATASHEET_VIEW', 'DATASHEET_EDIT']

process.env.JWT_SECRET ??= 'secret'

const testSheetId = 42
const testValueSetId = 101

const mockCreateOfferedValueSet = jest.fn()
const mockCreateAsBuiltValueSet = jest.fn()
const mockCreateValueSet = jest.fn()
const mockPatchVariance = jest.fn()
const mockTransitionValueSetStatus = jest.fn()
const mockGetCompareData = jest.fn()

jest.mock('../../src/backend/services/valueSetService', () => ({
  ...jest.requireActual<typeof import('../../src/backend/services/valueSetService')>(
    '../../src/backend/services/valueSetService'
  ),
  createOfferedValueSet: (...args: unknown[]) => mockCreateOfferedValueSet(...args),
  createAsBuiltValueSet: (...args: unknown[]) => mockCreateAsBuiltValueSet(...args),
  createValueSet: (...args: unknown[]) => mockCreateValueSet(...args),
  patchVariance: (...args: unknown[]) => mockPatchVariance(...args),
  transitionValueSetStatus: (...args: unknown[]) => mockTransitionValueSetStatus(...args),
  getCompareData: (...args: unknown[]) => mockGetCompareData(...args),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
  getUserPermissions: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../src/backend/middleware/authMiddleware', () => ({
  verifyToken: (req: unknown, _res: unknown, next: () => void) => {
    ;(req as { user?: { userId: number } }).user = { userId: 1 }
    next()
  },
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
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
  const sheetRoutes = require('../../src/backend/routes/sheetRoutes').default
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/sheets', sheetRoutes)
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const httpErr = toHttpError(err)
    res.status(httpErr.statusCode).json({ error: httpErr.message })
  })
  return app
}

describe('Phase 2 Slice #3 value-set API', () => {
  const authCookie = createAuthCookie(FILLED_PERMISSIONS)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST valuesets Offered (createOfferedValueSet + prefill)', () => {
    it('creates offered set with partyId and returns 201 with valueSetId', async () => {
      mockCreateOfferedValueSet.mockResolvedValue(2)
      const app = buildTestApp()
      const res = await request(app)
        .post(`/api/backend/sheets/${testSheetId}/valuesets`)
        .set('Cookie', [authCookie])
        .send({ context: 'Offered', partyId: 99 })

      expect(res.statusCode).toBe(201)
      expect(res.body).toHaveProperty('valueSetId', 2)
      expect(res.body).toHaveProperty('context', 'Offered')
      expect(res.body).toHaveProperty('partyId', 99)
      expect(mockCreateOfferedValueSet).toHaveBeenCalledWith(testSheetId, 99, 1)
      expect(mockCreateValueSet).not.toHaveBeenCalled()
    })

    it('AsBuilt uses createAsBuiltValueSet and returns 201 with valueSetId', async () => {
      mockCreateAsBuiltValueSet.mockResolvedValue(3)
      const app = buildTestApp()
      const res = await request(app)
        .post(`/api/backend/sheets/${testSheetId}/valuesets`)
        .set('Cookie', [authCookie])
        .send({ context: 'AsBuilt' })

      expect(res.statusCode).toBe(201)
      expect(res.body).toHaveProperty('valueSetId', 3)
      expect(res.body).toHaveProperty('context', 'AsBuilt')
      expect(res.body).toHaveProperty('partyId', null)
      expect(mockCreateAsBuiltValueSet).toHaveBeenCalledWith(testSheetId, 1)
      expect(mockCreateValueSet).not.toHaveBeenCalled()
      expect(mockCreateOfferedValueSet).not.toHaveBeenCalled()
    })

    it('Requirement still uses createValueSet (no partyId)', async () => {
      mockCreateValueSet.mockResolvedValue(1)
      const app = buildTestApp()
      const res = await request(app)
        .post(`/api/backend/sheets/${testSheetId}/valuesets`)
        .set('Cookie', [authCookie])
        .send({ context: 'Requirement' })

      expect(res.statusCode).toBe(201)
      expect(res.body.valueSetId).toBe(1)
      expect(mockCreateValueSet).toHaveBeenCalledWith(testSheetId, 'Requirement', undefined, 1)
      expect(mockCreateOfferedValueSet).not.toHaveBeenCalled()
      expect(mockCreateAsBuiltValueSet).not.toHaveBeenCalled()
    })
  })

  describe('PATCH valuesets/:valueSetId/variances', () => {
    it('upsert sets ReviewedBy/ReviewedAt and returns 204', async () => {
      mockPatchVariance.mockResolvedValue(undefined)
      const app = buildTestApp()
      const res = await request(app)
        .patch(`/api/backend/sheets/${testSheetId}/valuesets/${testValueSetId}/variances`)
        .set('Cookie', [authCookie])
        .send({ infoTemplateId: 10, status: 'DeviatesAccepted' })

      expect(res.statusCode).toBe(204)
      expect(mockPatchVariance).toHaveBeenCalledWith(testSheetId, testValueSetId, 10, 'DeviatesAccepted', 1)
    })

    it('status=null deletes row and returns 204', async () => {
      mockPatchVariance.mockResolvedValue(undefined)
      const app = buildTestApp()
      const res = await request(app)
        .patch(`/api/backend/sheets/${testSheetId}/valuesets/${testValueSetId}/variances`)
        .set('Cookie', [authCookie])
        .send({ infoTemplateId: 10, status: null })

      expect(res.statusCode).toBe(204)
      expect(mockPatchVariance).toHaveBeenCalledWith(testSheetId, testValueSetId, 10, null, 1)
    })

    it('returns 409 when ValueSet status is not Draft', async () => {
      mockPatchVariance.mockRejectedValue(
        new AppError('Cannot change variance when ValueSet status is Locked', 409)
      )
      const app = buildTestApp()
      const res = await request(app)
        .patch(`/api/backend/sheets/${testSheetId}/valuesets/${testValueSetId}/variances`)
        .set('Cookie', [authCookie])
        .send({ infoTemplateId: 10, status: 'DeviatesRejected' })

      expect(res.statusCode).toBe(409)
    })
  })

  describe('POST valuesets/:valueSetId/status', () => {
    it('allowed transition succeeds and returns 200', async () => {
      mockTransitionValueSetStatus.mockResolvedValue(undefined)
      const app = buildTestApp()
      const res = await request(app)
        .post(`/api/backend/sheets/${testSheetId}/valuesets/${testValueSetId}/status`)
        .set('Cookie', [authCookie])
        .send({ status: 'Locked' })

      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({ valueSetId: testValueSetId, status: 'Locked' })
      expect(mockTransitionValueSetStatus).toHaveBeenCalledWith(testSheetId, testValueSetId, 'Locked')
    })

    it('invalid transition returns 409', async () => {
      mockTransitionValueSetStatus.mockRejectedValue(
        new AppError('Requirement/Offered can only transition to Locked', 409)
      )
      const app = buildTestApp()
      const res = await request(app)
        .post(`/api/backend/sheets/${testSheetId}/valuesets/${testValueSetId}/status`)
        .set('Cookie', [authCookie])
        .send({ status: 'Verified' })

      expect(res.statusCode).toBe(409)
    })
  })

  describe('GET compare', () => {
    it('returns expected shape and includes variance overrides', async () => {
      mockGetCompareData.mockResolvedValue({
        subsheets: [
          {
            id: 1,
            name: 'Sub1',
            fields: [
              {
                infoTemplateId: 10,
                label: 'F1',
                requirement: { value: 'req', uom: 'm' },
                offered: [
                  {
                    partyId: 99,
                    valueSetId: 101,
                    value: 'off',
                    uom: 'm',
                    varianceStatus: 'DeviatesAccepted',
                  },
                ],
                asBuilt: { value: 'asbuilt', uom: 'kg', varianceStatus: 'DeviatesAccepted' },
              },
            ],
          },
        ],
      })
      const app = buildTestApp()
      const res = await request(app)
        .get(`/api/backend/sheets/${testSheetId}/compare`)
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('subsheets')
      expect(res.body.subsheets).toHaveLength(1)
      expect(res.body.subsheets[0].fields[0]).toMatchObject({
        infoTemplateId: 10,
        label: 'F1',
        requirement: { value: 'req', uom: 'm' },
        offered: [
          {
            partyId: 99,
            valueSetId: 101,
            value: 'off',
            uom: 'm',
            varianceStatus: 'DeviatesAccepted',
          },
        ],
        asBuilt: { value: 'asbuilt', uom: 'kg', varianceStatus: 'DeviatesAccepted' },
      })
      expect(mockGetCompareData).toHaveBeenCalledWith(testSheetId, undefined)
    })

    it('passes offeredPartyId query when provided', async () => {
      mockGetCompareData.mockResolvedValue({ subsheets: [] })
      const app = buildTestApp()
      await request(app)
        .get(`/api/backend/sheets/${testSheetId}/compare`)
        .query({ offeredPartyId: 99 })
        .set('Cookie', [authCookie])

      expect(mockGetCompareData).toHaveBeenCalledWith(testSheetId, 99)
    })
  })
})
