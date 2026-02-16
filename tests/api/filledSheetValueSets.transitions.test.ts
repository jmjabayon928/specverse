/**
 * Phase 2 correctness: Value set status transitions (Draft -> Locked/Verified).
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'
import { AppError } from '../../src/backend/errors/AppError'

process.env.JWT_SECRET ??= 'secret'

const mockSheetBelongsToAccount = jest.fn()
const mockGetFilledSheetDetailsById = jest.fn()
const mockTransitionValueSetStatus = jest.fn()

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
  bumpRejectedToModifiedDraftFilled: jest.fn(),
}))

jest.mock('../../src/backend/services/valueSetService', () => ({
  getValueSetIdSafe: jest.fn().mockResolvedValue(null),
  listValueSets: jest.fn().mockResolvedValue([]),
  getCompareData: jest.fn().mockResolvedValue({ subsheets: [] }),
  createValueSet: jest.fn().mockResolvedValue(1),
  createOfferedValueSet: jest.fn().mockResolvedValue(2),
  createAsBuiltValueSet: jest.fn().mockResolvedValue(3),
  patchVariance: jest.fn(),
  transitionValueSetStatus: (...args: unknown[]) => mockTransitionValueSetStatus(...args),
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

describe('Value Set status transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSheetBelongsToAccount.mockResolvedValue(true)
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { status: 'Draft', sheetId },
    })
    mockTransitionValueSetStatus.mockResolvedValue(undefined)
  })

  it('Requirement Draft -> Locked succeeds', async () => {
    const res = await request(app)
      .post(`/api/backend/sheets/${sheetId}/valuesets/1/status`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ status: 'Locked' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('valueSetId', 1)
    expect(res.body.status).toBe('Locked')
    expect(mockTransitionValueSetStatus).toHaveBeenCalledWith(sheetId, 1, 'Locked')
  })

  it('Requirement Draft -> Verified fails 409', async () => {
    mockTransitionValueSetStatus.mockRejectedValue(
      new AppError('Requirement/Offered can only transition to Locked', 409)
    )

    const res = await request(app)
      .post(`/api/backend/sheets/${sheetId}/valuesets/1/status`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ status: 'Verified' })

    expect(res.status).toBe(409)
  })

  it('Offered Draft -> Locked succeeds', async () => {
    const res = await request(app)
      .post(`/api/backend/sheets/${sheetId}/valuesets/2/status`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ status: 'Locked' })

    expect(res.status).toBe(200)
    expect(mockTransitionValueSetStatus).toHaveBeenCalledWith(sheetId, 2, 'Locked')
  })

  it('AsBuilt Draft -> Verified succeeds', async () => {
    const res = await request(app)
      .post(`/api/backend/sheets/${sheetId}/valuesets/3/status`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ status: 'Verified' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Verified')
    expect(mockTransitionValueSetStatus).toHaveBeenCalledWith(sheetId, 3, 'Verified')
  })

  it('AsBuilt Draft -> Locked fails 409', async () => {
    mockTransitionValueSetStatus.mockRejectedValue(
      new AppError('AsBuilt can only transition to Verified', 409)
    )

    const res = await request(app)
      .post(`/api/backend/sheets/${sheetId}/valuesets/3/status`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ status: 'Locked' })

    expect(res.status).toBe(409)
  })

  it('Transition non-Draft value set fails 409', async () => {
    mockTransitionValueSetStatus.mockRejectedValue(
      new AppError('Invalid transition: current status is Locked', 409)
    )

    const res = await request(app)
      .post(`/api/backend/sheets/${sheetId}/valuesets/1/status`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ status: 'Locked' })

    expect(res.status).toBe(409)
  })
})
