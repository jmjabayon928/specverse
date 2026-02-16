/**
 * Phase 2 correctness: Happy path - create and use value sets (Draft sheet).
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

const mockSheetBelongsToAccount = jest.fn()
const mockGetFilledSheetDetailsById = jest.fn()
const mockBumpRejectedToModifiedDraftFilled = jest.fn()
const mockGetValueSetIdSafe = jest.fn()
const mockListValueSets = jest.fn()
const mockGetCompareData = jest.fn()
const mockCreateValueSet = jest.fn()
const mockCreateOfferedValueSet = jest.fn()
const mockCreateAsBuiltValueSet = jest.fn()

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { createAuthMiddlewareMock } = jest.requireActual('../helpers/authMiddlewareMock')
  return createAuthMiddlewareMock({ actual, mode: 'token' })
})

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: (sheetId: number, accountId: number) =>
    mockSheetBelongsToAccount(sheetId, accountId),
}))

jest.mock('../../src/backend/services/filledSheetService', () => ({
  getFilledSheetDetailsById: (...args: unknown[]) => mockGetFilledSheetDetailsById(...args),
  bumpRejectedToModifiedDraftFilled: (...args: unknown[]) =>
    mockBumpRejectedToModifiedDraftFilled(...args),
}))

jest.mock('../../src/backend/services/valueSetService', () => ({
  getValueSetIdSafe: (...args: unknown[]) => mockGetValueSetIdSafe(...args),
  listValueSets: (...args: unknown[]) => mockListValueSets(...args),
  getCompareData: (...args: unknown[]) => mockGetCompareData(...args),
  createValueSet: (...args: unknown[]) => mockCreateValueSet(...args),
  createOfferedValueSet: (...args: unknown[]) => mockCreateOfferedValueSet(...args),
  createAsBuiltValueSet: (...args: unknown[]) => mockCreateAsBuiltValueSet(...args),
  patchVariance: jest.fn(),
  transitionValueSetStatus: jest.fn(),
}))

function makeToken(userId: number, accountId: number): string {
  return jwt.sign(
    {
      userId,
      accountId,
      email: 'u@test.com',
      role: 'Admin',
      permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT],
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
}

const sheetId = 1
const accountId = 1

describe('Value Sets happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSheetBelongsToAccount.mockResolvedValue(true)
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { status: 'Draft', sheetId },
    })
    mockGetValueSetIdSafe.mockResolvedValue(null)
    mockListValueSets.mockResolvedValue([])
    mockGetCompareData.mockResolvedValue({ subsheets: [] })
    mockCreateValueSet.mockResolvedValue(10)
    mockCreateOfferedValueSet.mockResolvedValue(11)
    mockCreateAsBuiltValueSet.mockResolvedValue(12)
  })

  it('POST requirement valueset returns 201', async () => {
    const res = await request(app)
      .post(`/api/backend/sheets/${sheetId}/valuesets`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ context: 'Requirement' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('valueSetId', 10)
    expect(res.body.context).toBe('Requirement')
    expect(mockCreateValueSet).toHaveBeenCalled()
  })

  it('POST offered valueset with partyId returns 201', async () => {
    const res = await request(app)
      .post(`/api/backend/sheets/${sheetId}/valuesets`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ context: 'Offered', partyId: 5 })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('valueSetId', 11)
    expect(res.body.context).toBe('Offered')
    expect(mockCreateOfferedValueSet).toHaveBeenCalled()
  })

  it('POST asbuilt valueset returns 201', async () => {
    const res = await request(app)
      .post(`/api/backend/sheets/${sheetId}/valuesets`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ context: 'AsBuilt' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('valueSetId', 12)
    expect(res.body.context).toBe('AsBuilt')
    expect(mockCreateAsBuiltValueSet).toHaveBeenCalled()
  })

  it('GET valuesets list returns items', async () => {
    mockListValueSets.mockResolvedValue([
      { ValueSetID: 10, SheetID: sheetId, ContextID: 1, Code: 'Requirement', PartyID: null, Status: 'Draft' },
    ])

    const res = await request(app)
      .get(`/api/backend/sheets/${sheetId}/valuesets`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('items')
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(mockListValueSets).toHaveBeenCalledWith(sheetId)
  })

  it('GET compare returns subsheets shape', async () => {
    mockGetCompareData.mockResolvedValue({
      subsheets: [{ id: 1, name: 'Sub1', fields: [] }],
    })

    const res = await request(app)
      .get(`/api/backend/sheets/${sheetId}/compare`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('subsheets')
    expect(Array.isArray(res.body.subsheets)).toBe(true)
  })
})
