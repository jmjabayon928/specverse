import request from 'supertest'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'
import { AppError } from '../../src/backend/errors/AppError'
import type { AssetFilledSheetRow } from '../../src/backend/services/filledSheetService'


function createMockToken(accountId: number | null, userId: number, permissions: string[] = []): string {
  return JSON.stringify({ accountId, userId, permissions })
}

/* ──────────────────────────────────────────────────────────────
 * Mocks
 * ────────────────────────────────────────────────────────────── */

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/services/filledSheetService', () => {
  const actual = jest.requireActual('../../src/backend/services/filledSheetService')
  return {
    ...actual,
    fetchFilledSheetsForAsset: jest.fn(),
  }
})

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { createAuthMiddlewareMock } = jest.requireActual('../helpers/authMiddlewareMock')
  return createAuthMiddlewareMock({ actual, mode: 'token' })
})

/* ──────────────────────────────────────────────────────────────
 * Tests
 * ────────────────────────────────────────────────────────────── */

describe('GET /api/backend/assets/:assetId/datasheets', () => {
  const mockAccountId = 1
  const mockAssetId = 123
  let FilledSheetServiceMock: { fetchFilledSheetsForAsset: jest.Mock }

  beforeAll(async () => {
    // app is directly imported, no setupApp needed
  })

  beforeEach(() => {
    jest.clearAllMocks()
    FilledSheetServiceMock = jest.requireMock('../../src/backend/services/filledSheetService') as { fetchFilledSheetsForAsset: jest.Mock }
    FilledSheetServiceMock.fetchFilledSheetsForAsset.mockReset()
    FilledSheetServiceMock.fetchFilledSheetsForAsset.mockResolvedValue({ items: [], total: 0 })
  })

  it('should return 200 and an empty array if no datasheets found', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [], total: 0 })
    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).toHaveBeenCalledWith({
      accountId: mockAccountId,
      assetId: mockAssetId,
      q: undefined,
      status: undefined,
      take: 50,
      skip: 0,
    })
  })

  it('should return 200 and a list of datasheets', async () => {
    const mockDatasheets: AssetFilledSheetRow[] = [
      {
        sheetId: 1,
        sheetName: 'Datasheet A',
        equipmentTagNum: 'EQ-001',
        status: 'Approved',
        revisionDate: '2023-01-01',
      },
      {
        sheetId: 2,
        sheetName: 'Datasheet B',
        equipmentTagNum: 'EQ-002',
        status: 'Draft',
        revisionDate: '2023-01-05',
      },
    ]
    FilledSheetServiceMock.fetchFilledSheetsForAsset.mockResolvedValue({ items: mockDatasheets, total: 2 })

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: mockDatasheets, total: 2 })
  })

  it('should return 400 for invalid assetId parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/invalid/datasheets`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid asset ID')
    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).not.toHaveBeenCalled()
  })

  it('should return 400 for negative assetId parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/-1/datasheets`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid asset ID')
    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).not.toHaveBeenCalled()
  })

  it('should apply query parameters for search and status', async () => {
    const q = 'test'
    const status = 'Draft'

    await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets?q=${q}&status=${status}`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).toHaveBeenCalledWith(expect.objectContaining({
      q,
      status,
      accountId: mockAccountId,
      assetId: mockAssetId,
    }))
  })

  it('should apply pagination parameters (take and skip)', async () => {
    const take = 10
    const skip = 20

    await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets?take=${take}&skip=${skip}`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).toHaveBeenCalledWith(expect.objectContaining({
      take,
      skip,
      accountId: mockAccountId,
      assetId: mockAssetId,
    }))
  })

  it('should return 400 for invalid take parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets?take=invalid`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).not.toHaveBeenCalled()
  })

  it('should return 400 for take > 200', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets?take=201`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).not.toHaveBeenCalled()
  })

  it('should return 400 for take < 1', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets?take=0`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid skip parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets?skip=invalid`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).not.toHaveBeenCalled()
  })

  it('should return 400 for negative skip parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets?skip=-1`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).not.toHaveBeenCalled()
  })

  // The auth middleware mock rejects tokens where accountId is not a finite number,
  // so accountId=null will fail in verifyToken before the controller runs.
  it('should return 401 when token is invalid for account scoping', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets`)
      .set('Authorization', `Bearer ${createMockToken(null, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Unauthorized - Invalid token') // Expect message from auth middleware mock
    expect(FilledSheetServiceMock.fetchFilledSheetsForAsset).not.toHaveBeenCalled()
  })

  it('should return 500 if service layer throws an unknown error', async () => {
    FilledSheetServiceMock.fetchFilledSheetsForAsset.mockRejectedValue(new Error('Database connection failed'))

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Failed to fetch datasheets for asset')
  })

  it('should return 404 if service layer throws an AppError with 404 status', async () => {
    FilledSheetServiceMock.fetchFilledSheetsForAsset.mockRejectedValue(new AppError('Asset not found', 404))

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/datasheets`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toBe('Asset not found')
  })
})
