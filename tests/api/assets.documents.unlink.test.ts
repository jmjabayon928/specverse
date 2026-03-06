import request from 'supertest'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'
import { AppError } from '../../src/backend/errors/AppError'
import { checkUserPermission } from '../../src/backend/database/permissionQueries'

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
    removeAssetDocumentLink: jest.fn(),
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

describe('DELETE /api/backend/assets/:assetId/documents/:attachmentId', () => {
  const mockAccountId = 1
  const mockUserId = 101 // Unused but good to have consistent mock user
  const mockAssetId = 123
  const mockAttachmentId = 456
  let AssetDocumentsRepositoryMock: { removeAssetDocumentLink: jest.Mock }

  beforeAll(async () => {
    // app is directly imported, no setupApp needed
  })

  beforeEach(() => {
    jest.clearAllMocks()
  
    // clearAllMocks does NOT reset implementations
    jest.mocked(checkUserPermission).mockResolvedValue(true)
  
    AssetDocumentsRepositoryMock = jest.requireMock(
      '../../src/backend/repositories/assetDocumentsRepository'
    ) as { removeAssetDocumentLink: jest.Mock }
  
    AssetDocumentsRepositoryMock.removeAssetDocumentLink.mockReset()
    AssetDocumentsRepositoryMock.removeAssetDocumentLink.mockResolvedValue(undefined)
  })

  it('should return 204 on successfully unlinking document', async () => {
    const res = await request(app)
      .delete(`/api/backend/assets/${mockAssetId}/documents/${mockAttachmentId}`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_DELETE])}`)

    expect(res.status).toBe(204)
    expect(AssetDocumentsRepositoryMock.removeAssetDocumentLink).toHaveBeenCalledWith({
      pool: expect.anything(),
      accountId: mockAccountId,
      assetId: mockAssetId,
      attachmentId: mockAttachmentId,
    })
  })

  it('should return 400 for invalid assetId parameter', async () => {
    const res = await request(app)
      .delete(`/api/backend/assets/invalid/documents/${mockAttachmentId}`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_DELETE])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid asset ID or attachment ID')
    expect(AssetDocumentsRepositoryMock.removeAssetDocumentLink).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid attachmentId parameter', async () => {
    const res = await request(app)
      .delete(`/api/backend/assets/${mockAssetId}/documents/invalid`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_DELETE])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid asset ID or attachment ID')
    expect(AssetDocumentsRepositoryMock.removeAssetDocumentLink).not.toHaveBeenCalled()
  })

  it('should return 401 when token is invalid for account scoping', async () => {
    const res = await request(app)
      .delete(`/api/backend/assets/${mockAssetId}/documents/${mockAttachmentId}`)
      .set('Authorization', `Bearer ${createMockToken(null, mockUserId, [PERMISSIONS.DATASHEET_ATTACHMENT_DELETE])}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Unauthorized - Invalid token')
    expect(AssetDocumentsRepositoryMock.removeAssetDocumentLink).not.toHaveBeenCalled()
  })

  it('should return 403 if user does not have permission', async () => {
    jest.mocked(checkUserPermission).mockResolvedValue(false)
  
    const res = await request(app)
      .delete(`/api/backend/assets/${mockAssetId}/documents/${mockAttachmentId}`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [
        PERMISSIONS.DATASHEET_VIEW,
        PERMISSIONS.DATASHEET_ATTACHMENT_DELETE,
      ])}`)
  
    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Permission denied')
    expect(AssetDocumentsRepositoryMock.removeAssetDocumentLink).not.toHaveBeenCalled()
  })

  it('should return 404 if document link not found or does not belong to asset/account', async () => {
    AssetDocumentsRepositoryMock.removeAssetDocumentLink.mockRejectedValue(new AppError('Document link not found or does not belong to this asset/account', 404))

    const res = await request(app)
      .delete(`/api/backend/assets/${mockAssetId}/documents/${mockAttachmentId}`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_DELETE])}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toBe('Document link not found or does not belong to this asset/account')
    expect(AssetDocumentsRepositoryMock.removeAssetDocumentLink).toHaveBeenCalled()
  })

  it('should return 500 if service layer throws an unknown error', async () => {
    AssetDocumentsRepositoryMock.removeAssetDocumentLink.mockRejectedValue(new Error('Database error'))

    const res = await request(app)
      .delete(`/api/backend/assets/${mockAssetId}/documents/${mockAttachmentId}`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_DELETE])}`)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Failed to unlink document from asset')
    expect(AssetDocumentsRepositoryMock.removeAssetDocumentLink).toHaveBeenCalled()
  })
})
