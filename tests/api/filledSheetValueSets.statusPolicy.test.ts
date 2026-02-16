/**
 * Phase 2 correctness: Approved/Verified sheets block value-set mutations with 409.
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

const mockSheetBelongsToAccount = jest.fn()
const mockGetFilledSheetDetailsById = jest.fn()
const mockCreateValueSet = jest.fn()
const mockPatchVariance = jest.fn()
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
  createValueSet: (...args: unknown[]) => mockCreateValueSet(...args),
  createOfferedValueSet: jest.fn(),
  createAsBuiltValueSet: jest.fn(),
  patchVariance: (...args: unknown[]) => mockPatchVariance(...args),
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

const sheetIdApproved = 10
const sheetIdVerified = 11
const accountId = 1

describe('Value Sets status policy (Approved/Verified blocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSheetBelongsToAccount.mockResolvedValue(true)
  })

  it('POST valueset on Approved sheet returns 409 with message', async () => {
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { status: 'Approved', sheetId: sheetIdApproved },
    })

    const res = await request(app)
      .post(`/api/backend/sheets/${sheetIdApproved}/valuesets`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ context: 'Requirement' })

    expect(res.status).toBe(409)
    expect(res.body?.error ?? res.text).toMatch(/Sheet is not editable in status Approved/)
    expect(mockCreateValueSet).not.toHaveBeenCalled()
  })

  it('POST valueset on Verified sheet returns 409 with message', async () => {
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { status: 'Verified', sheetId: sheetIdVerified },
    })

    const res = await request(app)
      .post(`/api/backend/sheets/${sheetIdVerified}/valuesets`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ context: 'AsBuilt' })

    expect(res.status).toBe(409)
    expect(res.body?.error ?? res.text).toMatch(/Sheet is not editable in status Verified/)
    expect(mockCreateValueSet).not.toHaveBeenCalled()
  })

  it('PATCH variances on Approved sheet returns 409', async () => {
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { status: 'Approved', sheetId: sheetIdApproved },
    })

    const res = await request(app)
      .patch(`/api/backend/sheets/${sheetIdApproved}/valuesets/1/variances`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ infoTemplateId: 1, status: 'DeviatesAccepted' })

    expect(res.status).toBe(409)
    expect(res.body?.error ?? res.text).toMatch(/Sheet is not editable in status Approved/)
    expect(mockPatchVariance).not.toHaveBeenCalled()
  })

  it('POST valueset status on Verified sheet returns 409', async () => {
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { status: 'Verified', sheetId: sheetIdVerified },
    })

    const res = await request(app)
      .post(`/api/backend/sheets/${sheetIdVerified}/valuesets/1/status`)
      .set('Cookie', [`token=${makeToken(1, accountId)}`])
      .send({ status: 'Locked' })

    expect(res.status).toBe(409)
    expect(res.body?.error ?? res.text).toMatch(/Sheet is not editable in status Verified/)
    expect(mockTransitionValueSetStatus).not.toHaveBeenCalled()
  })
})
