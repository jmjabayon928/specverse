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
    addAssetDocumentLink: jest.fn(),
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

describe('POST /api/backend/assets/:assetId/documents/link', () => {
  const mockAccountId = 1
  const mockUserId = 101
  const mockAssetId = 123
  const mockAttachmentId = 456
  let AssetDocumentsRepositoryMock: { addAssetDocumentLink: jest.Mock }

  beforeAll(async () => {
    // app is directly imported, no setupApp needed
  })

  beforeEach(() => {
    jest.clearAllMocks()
  
    // IMPORTANT: clearAllMocks does not reset implementations.
    // Ensure permission checks default to "allowed" for each test.
    jest.mocked(checkUserPermission).mockResolvedValue(true)
  
    AssetDocumentsRepositoryMock = jest.requireMock(
      '../../src/backend/repositories/assetDocumentsRepository'
    ) as { addAssetDocumentLink: jest.Mock }
  
    AssetDocumentsRepositoryMock.addAssetDocumentLink.mockReset()
    AssetDocumentsRepositoryMock.addAssetDocumentLink.mockResolvedValue(undefined)
  })

  it('should return 200 and success message on linking document', async () => {
    const res = await request(app)
      .post(`/api/backend/assets/${mockAssetId}/documents/link`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD])}`)
      .send({ attachmentId: mockAttachmentId })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: 'Document linked successfully' })
    expect(AssetDocumentsRepositoryMock.addAssetDocumentLink).toHaveBeenCalledWith({
      pool: expect.anything(),
      accountId: mockAccountId,
      assetId: mockAssetId,
      attachmentId: mockAttachmentId,
      userId: mockUserId,
    })
  })

  it('should return 400 for invalid assetId parameter', async () => {
    const res = await request(app)
      .post(`/api/backend/assets/invalid/documents/link`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD])}`)
      .send({ attachmentId: mockAttachmentId })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid asset ID')
    expect(AssetDocumentsRepositoryMock.addAssetDocumentLink).not.toHaveBeenCalled()
  })

  it('should return 400 for missing attachmentId in body', async () => {
    const res = await request(app)
      .post(`/api/backend/assets/${mockAssetId}/documents/link`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD])}`)
      .send({}) // Missing attachmentId

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid request body')
    expect(AssetDocumentsRepositoryMock.addAssetDocumentLink).not.toHaveBeenCalled()
  })

  it('should return 400 for non-positive attachmentId in body', async () => {
    const res = await request(app)
      .post(`/api/backend/assets/${mockAssetId}/documents/link`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD])}`)
      .send({ attachmentId: 0 })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid request body')
    expect(AssetDocumentsRepositoryMock.addAssetDocumentLink).not.toHaveBeenCalled()
  })

  it('should return 401 when token is invalid for account scoping', async () => {
    const res = await request(app)
      .post(`/api/backend/assets/${mockAssetId}/documents/link`)
      .set('Authorization', `Bearer ${createMockToken(null, mockUserId, [PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD])}`)
      .send({ attachmentId: mockAttachmentId })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Unauthorized - Invalid token')
    expect(AssetDocumentsRepositoryMock.addAssetDocumentLink).not.toHaveBeenCalled()
  })

  it('should return 403 if user does not have permission', async () => {
    jest.mocked(checkUserPermission).mockResolvedValue(false)

    const res = await request(app)
      .post(`/api/backend/assets/${mockAssetId}/documents/link`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [])}`)
      .send({ attachmentId: mockAttachmentId })

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Permission denied')
    expect(AssetDocumentsRepositoryMock.addAssetDocumentLink).not.toHaveBeenCalled()
  })

  it('should return 404 if attachment does not exist or belong to account', async () => {
    AssetDocumentsRepositoryMock.addAssetDocumentLink.mockRejectedValue(new AppError('Attachment not found or does not belong to this account', 404))

    const res = await request(app)
      .post(`/api/backend/assets/${mockAssetId}/documents/link`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD])}`)
      .send({ attachmentId: mockAttachmentId })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe('Attachment not found or does not belong to this account')
    expect(AssetDocumentsRepositoryMock.addAssetDocumentLink).toHaveBeenCalled()
  })

  it('should return 500 if service layer throws an unknown error', async () => {
    AssetDocumentsRepositoryMock.addAssetDocumentLink.mockRejectedValue(new Error('Database error'))

    const res = await request(app)
      .post(`/api/backend/assets/${mockAssetId}/documents/link`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD])}`)
      .send({ attachmentId: mockAttachmentId })

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Failed to link document to asset')
    expect(AssetDocumentsRepositoryMock.addAssetDocumentLink).toHaveBeenCalled()
  })
})
