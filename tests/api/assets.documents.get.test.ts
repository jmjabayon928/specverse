import request from 'supertest'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'
import { AppError } from '../../src/backend/errors/AppError'
import type { AssetDocumentRow } from '../../src/backend/services/assetDocumentsService'

function createMockToken(accountId: number | null, userId: number, permissions: string[] = []): string {
  return JSON.stringify({ accountId, userId, permissions })
}

/* ──────────────────────────────────────────────────────────────
 * Mocks
 * ────────────────────────────────────────────────────────────── */

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/repositories/assetDocumentsRepository', () => {
  const actual = jest.requireActual('../../src/backend/repositories/assetDocumentsRepository')
  return {
    ...actual,
    listAssetDocuments: jest.fn(),
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

describe('GET /api/backend/assets/:assetId/documents', () => {
  const mockAccountId = 1
  const mockAssetId = 123
  let AssetDocumentsRepositoryMock: { listAssetDocuments: jest.Mock }

  beforeAll(async () => {
    // app is directly imported, no setupApp needed
  })

  beforeEach(() => {
    jest.clearAllMocks()
    AssetDocumentsRepositoryMock = jest.requireMock('../../src/backend/repositories/assetDocumentsRepository') as { listAssetDocuments: jest.Mock }
    AssetDocumentsRepositoryMock.listAssetDocuments.mockReset()
    AssetDocumentsRepositoryMock.listAssetDocuments.mockResolvedValue({ items: [], total: 0 })
  })

  it('should return 200 and an empty array if no documents found', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [], total: 0 })
    expect(AssetDocumentsRepositoryMock.listAssetDocuments).toHaveBeenCalledWith({
      pool: expect.anything(), // poolPromise is passed from service
      accountId: mockAccountId,
      assetId: mockAssetId,
      q: undefined,
      take: 50,
      skip: 0,
    })
  })

  it('should return 200 and a list of documents', async () => {
    const mockDocuments: AssetDocumentRow[] = [
      {
        attachmentId: 1,
        filename: 'document_a.pdf',
        contentType: 'application/pdf',
        filesize: 1024,
        uploadedAt: '2023-01-01T10:00:00Z',
        uploadedBy: 1,
      },
      {
        attachmentId: 2,
        filename: 'image_b.png',
        contentType: 'image/png',
        filesize: 2048,
        uploadedAt: '2023-01-02T11:00:00Z',
        uploadedBy: 1,
      },
    ]
    AssetDocumentsRepositoryMock.listAssetDocuments.mockResolvedValue({ items: mockDocuments, total: 2 })

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: mockDocuments, total: 2 })
  })

  it('should return 400 for invalid assetId parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/invalid/documents`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid asset ID')
    expect(AssetDocumentsRepositoryMock.listAssetDocuments).not.toHaveBeenCalled()
  })

  it('should return 400 for negative assetId parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/-1/documents`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid asset ID')
    expect(AssetDocumentsRepositoryMock.listAssetDocuments).not.toHaveBeenCalled()
  })

  it('should apply query parameters for search', async () => {
    const q = 'report'

    await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents?q=${q}`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(AssetDocumentsRepositoryMock.listAssetDocuments).toHaveBeenCalledWith(expect.objectContaining({
      q,
      accountId: mockAccountId,
      assetId: mockAssetId,
    }))
  })

  it('should apply pagination parameters (take and skip)', async () => {
    const take = 10
    const skip = 20

    await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents?take=${take}&skip=${skip}`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(AssetDocumentsRepositoryMock.listAssetDocuments).toHaveBeenCalledWith(expect.objectContaining({
      take,
      skip,
      accountId: mockAccountId,
      assetId: mockAssetId,
    }))
  })

  it('should return 400 for invalid take parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents?take=invalid`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(AssetDocumentsRepositoryMock.listAssetDocuments).not.toHaveBeenCalled()
  })

  it('should return 400 for take > 200', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents?take=201`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(AssetDocumentsRepositoryMock.listAssetDocuments).not.toHaveBeenCalled()
  })

  it('should return 400 for take < 1', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents?take=0`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(AssetDocumentsRepositoryMock.listAssetDocuments).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid skip parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents?skip=invalid`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(AssetDocumentsRepositoryMock.listAssetDocuments).not.toHaveBeenCalled()
  })

  it('should return 400 for negative skip parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents?skip=-1`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid query parameters')
    expect(AssetDocumentsRepositoryMock.listAssetDocuments).not.toHaveBeenCalled()
  })

  // The auth middleware mock rejects tokens where accountId is not a finite number,
  // so accountId=null will fail in verifyToken before the controller runs.
  it('should return 401 when token is invalid for account scoping', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents`)
      .set('Authorization', `Bearer ${createMockToken(null, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Unauthorized - Invalid token') // Expect message from auth middleware mock
    expect(AssetDocumentsRepositoryMock.listAssetDocuments).not.toHaveBeenCalled()
  })

  it('should return 500 if service layer throws an unknown error', async () => {
    AssetDocumentsRepositoryMock.listAssetDocuments.mockRejectedValue(new Error('Database connection failed'))

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Failed to fetch asset documents')
  })

  it('should return 404 if service layer throws an AppError with 404 status', async () => {
    AssetDocumentsRepositoryMock.listAssetDocuments.mockRejectedValue(new AppError('Asset not found', 404))

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/documents`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, 1, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toBe('Asset not found')
  })
})
