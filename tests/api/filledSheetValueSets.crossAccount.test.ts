/**
 * Phase 2 correctness: Cross-account access returns 404.
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

const mockSheetBelongsToAccount = jest.fn()

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

describe('Value Sets cross-account 404', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // User in account 1; sheet 2 is in account 2
    mockSheetBelongsToAccount.mockImplementation((sheetId: number, accountId: number) =>
      Promise.resolve(sheetId === 1 && accountId === 1)
    )
  })

  it('GET valuesets for other account sheet returns 404', async () => {
    const res = await request(app)
      .get('/api/backend/sheets/2/valuesets')
      .set('Cookie', [`token=${makeToken(1, 1)}`])

    expect(res.status).toBe(404)
    expect(res.body?.error ?? res.text).toMatch(/not found/i)
  })

  it('POST valueset for other account sheet returns 404', async () => {
    const res = await request(app)
      .post('/api/backend/sheets/2/valuesets')
      .set('Cookie', [`token=${makeToken(1, 1)}`])
      .send({ context: 'Requirement' })

    expect(res.status).toBe(404)
    expect(res.body?.error ?? res.text).toMatch(/not found/i)
  })

  it('PATCH variances for other account sheet returns 404', async () => {
    const res = await request(app)
      .patch('/api/backend/sheets/2/valuesets/1/variances')
      .set('Cookie', [`token=${makeToken(1, 1)}`])
      .send({ infoTemplateId: 1, status: 'DeviatesAccepted' })

    expect(res.status).toBe(404)
    expect(res.body?.error ?? res.text).toMatch(/not found/i)
  })

  it('GET compare for other account sheet returns 404', async () => {
    const res = await request(app)
      .get('/api/backend/sheets/2/compare')
      .set('Cookie', [`token=${makeToken(1, 1)}`])

    expect(res.status).toBe(404)
    expect(res.body?.error ?? res.text).toMatch(/not found/i)
  })
})
