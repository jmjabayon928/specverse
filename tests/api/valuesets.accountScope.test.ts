/**
 * Phase 2.5 Bundle 4 Step 1b: ValueSet sheet-gate.
 * - U1 cannot hit any valueSet endpoint for U2's sheetId (404)
 * - U1 can access own sheet value sets (200)
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

// Sheet ownership: sheet 1 -> account 1, sheet 2 -> account 2
function sheetBelongsToAccountImpl(sheetId: number, accountId: number): boolean {
  return (sheetId === 1 && accountId === 1) || (sheetId === 2 && accountId === 2)
}

const mockSheetBelongsToAccount = jest.fn()
const mockListValueSets = jest.fn()
const mockGetValueSetId = jest.fn()
const mockGetCompareData = jest.fn()
const mockCreateValueSet = jest.fn()
const mockPatchVariance = jest.fn()
const mockTransitionValueSetStatus = jest.fn()

jest.mock('../../src/backend/middleware/authMiddleware', () => ({
  verifyToken: (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.token ?? req.headers.authorization?.split(' ')[1]
    if (!token) {
      next(new AppError('Unauthorized - No token', 401))
      return
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as {
        userId: number
        accountId: number
      }
      req.user = {
        userId: decoded.userId,
        roleId: 1,
        role: 'Admin',
        permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT],
        accountId: decoded.accountId,
      }
      next()
    } catch {
      next(new AppError('Invalid token', 403))
    }
  },
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalVerifyToken: (_req: Request, _res: Response, next: NextFunction) => next(),
  verifyTokenOnly: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: (sheetId: number, accountId: number) => mockSheetBelongsToAccount(sheetId, accountId),
}))

jest.mock('../../src/backend/services/valueSetService', () => ({
  getValueSetIdSafe: (...args: unknown[]) => mockGetValueSetId(...args),
  listValueSets: (...args: unknown[]) => mockListValueSets(...args),
  getCompareData: (...args: unknown[]) => mockGetCompareData(...args),
  createValueSet: (...args: unknown[]) => mockCreateValueSet(...args),
  createOfferedValueSet: jest.fn().mockResolvedValue(1),
  createAsBuiltValueSet: jest.fn().mockResolvedValue(1),
  patchVariance: (...args: unknown[]) => mockPatchVariance(...args),
  transitionValueSetStatus: (...args: unknown[]) => mockTransitionValueSetStatus(...args),
}))

function makeToken(userId: number, accountId: number): string {
  return jwt.sign(
    { userId, accountId, email: 'u@test.com', role: 'Admin', permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT] },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
}

describe('ValueSet account scope (Step 1b)', () => {
  beforeEach(() => {
    mockSheetBelongsToAccount.mockImplementation((sheetId: number, accountId: number) =>
      Promise.resolve(sheetBelongsToAccountImpl(sheetId, accountId))
    )
    mockListValueSets.mockResolvedValue([])
    mockGetValueSetId.mockResolvedValue(null)
    mockGetCompareData.mockResolvedValue({ requirement: [], offered: [], asBuilt: [] })
    mockCreateValueSet.mockResolvedValue(1)
    mockPatchVariance.mockResolvedValue(undefined)
    mockTransitionValueSetStatus.mockResolvedValue(undefined)
  })

  describe('cross-tenant returns 404', () => {
    it('GET /api/backend/sheets/:sheetId/valuesets returns 404 when sheet belongs to other account', async () => {
      const token = makeToken(1, 1) // U1 account 1
      const res = await request(app)
        .get('/api/backend/sheets/2/valuesets') // sheet 2 belongs to account 2
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(mockListValueSets).not.toHaveBeenCalled()
    })

    it('GET /api/backend/sheets/:sheetId/compare returns 404 when sheet belongs to other account', async () => {
      const token = makeToken(1, 1)
      const res = await request(app)
        .get('/api/backend/sheets/2/compare')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(mockGetCompareData).not.toHaveBeenCalled()
    })

    it('POST /api/backend/sheets/:sheetId/valuesets returns 404 when sheet belongs to other account', async () => {
      const token = makeToken(1, 1)
      const res = await request(app)
        .post('/api/backend/sheets/2/valuesets')
        .set('Cookie', [`token=${token}`])
        .send({ context: 'Requirement' })

      expect(res.status).toBe(404)
      expect(res.body?.error ?? res.text).toMatch(/not found/i)
      expect(mockCreateValueSet).not.toHaveBeenCalled()
    })

    it('PATCH /api/backend/sheets/:sheetId/valuesets/:valueSetId/variances returns 404 when sheet belongs to other account', async () => {
      const token = makeToken(1, 1)
      const res = await request(app)
        .patch('/api/backend/sheets/2/valuesets/1/variances')
        .set('Cookie', [`token=${token}`])
        .send({ infoTemplateId: 1, status: 'DeviatesAccepted' })

      expect(res.status).toBe(404)
      expect(mockPatchVariance).not.toHaveBeenCalled()
    })

    it('POST /api/backend/sheets/:sheetId/valuesets/:valueSetId/status returns 404 when sheet belongs to other account', async () => {
      const token = makeToken(1, 1)
      const res = await request(app)
        .post('/api/backend/sheets/2/valuesets/1/status')
        .set('Cookie', [`token=${token}`])
        .send({ status: 'Locked' })

      expect(res.status).toBe(404)
      expect(mockTransitionValueSetStatus).not.toHaveBeenCalled()
    })
  })

  describe('own account returns 200/201', () => {
    it('GET /api/backend/sheets/:sheetId/valuesets returns 200 when sheet belongs to caller account', async () => {
      const token = makeToken(1, 1)
      mockListValueSets.mockResolvedValue([{ valueSetId: 1, context: 'Requirement' }])

      const res = await request(app)
        .get('/api/backend/sheets/1/valuesets')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(mockSheetBelongsToAccount).toHaveBeenCalledWith(1, 1)
      expect(mockListValueSets).toHaveBeenCalledWith(1)
      expect(res.body?.items).toEqual([{ valueSetId: 1, context: 'Requirement' }])
    })

    it('GET /api/backend/sheets/:sheetId/compare returns 200 when sheet belongs to caller account', async () => {
      const token = makeToken(2, 2)
      mockGetCompareData.mockResolvedValue({ requirement: [], offered: [], asBuilt: [] })

      const res = await request(app)
        .get('/api/backend/sheets/2/compare')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(mockSheetBelongsToAccount).toHaveBeenCalledWith(2, 2)
      expect(mockGetCompareData).toHaveBeenCalledWith(2, undefined)
    })

    it('POST /api/backend/sheets/:sheetId/valuesets returns 201 when sheet belongs to caller account', async () => {
      const token = makeToken(1, 1)
      mockCreateValueSet.mockResolvedValue(10)

      const res = await request(app)
        .post('/api/backend/sheets/1/valuesets')
        .set('Cookie', [`token=${token}`])
        .send({ context: 'Requirement' })

      expect(res.status).toBe(201)
      expect(mockSheetBelongsToAccount).toHaveBeenCalledWith(1, 1)
      expect(mockCreateValueSet).toHaveBeenCalled()
      expect(res.body?.valueSetId).toBe(10)
    })
  })
})
