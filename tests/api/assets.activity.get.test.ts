/* ──────────────────────────────────────────────────────────────
 * Mocks (must be hoisted before imports)
 * ────────────────────────────────────────────────────────────── */

jest.mock('@/backend/services/assetActivityService', () => ({
  getAssetActivity: jest.fn(),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { createAuthMiddlewareMock } = jest.requireActual('../helpers/authMiddlewareMock')
  return createAuthMiddlewareMock({ actual, mode: 'token' })
})

/* ──────────────────────────────────────────────────────────────
 * Imports (after mocks are hoisted)
 * ────────────────────────────────────────────────────────────── */

import request from 'supertest'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'
import { AppError } from '../../src/backend/errors/AppError'
import type { AssetActivityLogRow } from '../../src/backend/repositories/assetActivityRepository'

function createMockToken(accountId: number | null, userId: number, permissions: string[] = []): string {
  return JSON.stringify({ accountId, userId, permissions })
}

/* ──────────────────────────────────────────────────────────────
 * Tests
 * ────────────────────────────────────────────────────────────── */

describe('GET /api/backend/assets/:assetId/activity', () => {
  const mockAccountId = 1
  const mockOtherAccountId = 2
  const mockAssetId = 123
  const mockUserId = 101
  let mockGetAssetActivity: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset permission check to default (allowed)
    const { checkUserPermission } = require('../../src/backend/database/permissionQueries')
    jest.mocked(checkUserPermission).mockResolvedValue(true)
    
    const AssetActivityServiceMock = jest.requireMock('@/backend/services/assetActivityService') as { getAssetActivity: jest.Mock }
    mockGetAssetActivity = AssetActivityServiceMock.getAssetActivity
    mockGetAssetActivity.mockReset()
    mockGetAssetActivity.mockResolvedValue({ rows: [], nextCursor: null })
  })

  it('should return 200 with empty rows when no activity exists', async () => {
    mockGetAssetActivity.mockResolvedValue({ rows: [], nextCursor: null })

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      rows: [],
      nextCursor: null,
    })
    expect(mockGetAssetActivity).toHaveBeenCalledWith(mockAccountId, mockAssetId, 50, undefined)
  })

  it('should return only rows for the accountId (multi-tenant scoping)', async () => {
    const account1Rows: AssetActivityLogRow[] = [
      {
        logId: 3,
        action: 'Update Asset',
        performedByUserId: 101,
        performedAt: '2026-03-05T10:00:00.000Z',
        route: '/api/backend/assets/123',
        method: 'PUT',
        statusCode: 200,
        changes: '{"name":"Updated"}',
      },
      {
        logId: 2,
        action: 'Create Asset',
        performedByUserId: 101,
        performedAt: '2026-03-05T09:00:00.000Z',
        route: '/api/backend/assets',
        method: 'POST',
        statusCode: 201,
        changes: null,
      },
      {
        logId: 1,
        action: 'Link Asset Document',
        performedByUserId: 102,
        performedAt: '2026-03-05T08:00:00.000Z',
        route: '/api/backend/assets/123/documents/link',
        method: 'POST',
        statusCode: 200,
        changes: '{"attachmentId":456}',
      },
    ]

    mockGetAssetActivity.mockResolvedValue({ rows: account1Rows, nextCursor: null })

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(200)
    expect(res.body.rows).toHaveLength(3)
    expect(res.body.rows[0].logId).toBe(3)
    expect(res.body.rows[0].action).toBe('Update Asset')
    expect(res.body.rows[2].logId).toBe(1)
    expect(res.body.nextCursor).toBeNull() // Only 3 rows, less than limit 50

    // Verify service was called with correct accountId
    expect(mockGetAssetActivity).toHaveBeenCalledWith(mockAccountId, mockAssetId, 50, undefined)
    expect(mockGetAssetActivity).not.toHaveBeenCalledWith(mockOtherAccountId, expect.anything(), expect.anything(), expect.anything())
  })

  it('should return rows ordered by performedAt DESC, then logId DESC', async () => {
    const rows: AssetActivityLogRow[] = [
      {
        logId: 5,
        action: 'Latest Action',
        performedByUserId: 101,
        performedAt: '2026-03-05T12:00:00.000Z',
        route: '/api/backend/assets/123',
        method: 'PUT',
        statusCode: 200,
        changes: null,
      },
      {
        logId: 4,
        action: 'Same Time Action',
        performedByUserId: 101,
        performedAt: '2026-03-05T11:00:00.000Z',
        route: '/api/backend/assets/123',
        method: 'PUT',
        statusCode: 200,
        changes: null,
      },
      {
        logId: 3,
        action: 'Earlier Same Time',
        performedByUserId: 101,
        performedAt: '2026-03-05T11:00:00.000Z',
        route: '/api/backend/assets/123',
        method: 'PUT',
        statusCode: 200,
        changes: null,
      },
    ]

    mockGetAssetActivity.mockResolvedValue({ rows, nextCursor: null })

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(200)
    expect(res.body.rows).toHaveLength(3)
    // Verify ordering: newest first
    expect(res.body.rows[0].performedAt).toBe('2026-03-05T12:00:00.000Z')
    expect(res.body.rows[0].logId).toBe(5)
    // Same timestamp, higher logId first
    expect(res.body.rows[1].performedAt).toBe('2026-03-05T11:00:00.000Z')
    expect(res.body.rows[1].logId).toBe(4)
    expect(res.body.rows[2].performedAt).toBe('2026-03-05T11:00:00.000Z')
    expect(res.body.rows[2].logId).toBe(3)
  })

  it('should support pagination with limit=2 and return nextCursor', async () => {
    const firstPageRows: AssetActivityLogRow[] = [
      {
        logId: 3,
        action: 'Action 3',
        performedByUserId: 101,
        performedAt: '2026-03-05T10:00:00.000Z',
        route: '/api/backend/assets/123',
        method: 'PUT',
        statusCode: 200,
        changes: null,
      },
      {
        logId: 2,
        action: 'Action 2',
        performedByUserId: 101,
        performedAt: '2026-03-05T09:00:00.000Z',
        route: '/api/backend/assets/123',
        method: 'PUT',
        statusCode: 200,
        changes: null,
      },
    ]

    mockGetAssetActivity.mockResolvedValueOnce({
      rows: firstPageRows,
      nextCursor: { performedAt: '2026-03-05T09:00:00.000Z', logId: 2 },
    })

    const res1 = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity?limit=2`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res1.status).toBe(200)
    expect(res1.body.rows).toHaveLength(2)
    expect(res1.body.nextCursor).toEqual({
      performedAt: '2026-03-05T09:00:00.000Z',
      logId: 2,
    })

    // Second page with cursor
    const secondPageRows: AssetActivityLogRow[] = [
      {
        logId: 1,
        action: 'Action 1',
        performedByUserId: 101,
        performedAt: '2026-03-05T08:00:00.000Z',
        route: '/api/backend/assets/123',
        method: 'PUT',
        statusCode: 200,
        changes: null,
      },
    ]

    mockGetAssetActivity.mockResolvedValueOnce({ rows: secondPageRows, nextCursor: null })

    const res2 = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity?limit=2&cursorPerformedAt=2026-03-05T09:00:00.000Z&cursorLogId=2`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res2.status).toBe(200)
    expect(res2.body.rows).toHaveLength(1)
    expect(res2.body.rows[0].logId).toBe(1)
    expect(res2.body.nextCursor).toBeNull() // Last page

    // Verify cursor was passed correctly
    expect(mockGetAssetActivity).toHaveBeenCalledWith(
      mockAccountId,
      mockAssetId,
      2,
      { performedAt: '2026-03-05T09:00:00.000Z', logId: 2 }
    )
  })

  it('should return 400 for invalid assetId parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/invalid/activity`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid asset ID')
    expect(mockGetAssetActivity).not.toHaveBeenCalled()
  })

  it('should return 400 for invalid limit parameter', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity?limit=0`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(mockGetAssetActivity).not.toHaveBeenCalled()
  })

  it('should return 400 for limit > 200', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity?limit=201`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(mockGetAssetActivity).not.toHaveBeenCalled()
  })

  it('should return 400 if only one cursor parameter is provided', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity?cursorPerformedAt=2026-03-05T09:00:00.000Z`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('cursorPerformedAt and cursorLogId must be provided together')
    expect(mockGetAssetActivity).not.toHaveBeenCalled()
  })

  it('should return 401 when token is invalid for account scoping', async () => {
    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity`)
      .set('Authorization', `Bearer ${createMockToken(null, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Unauthorized - Invalid token')
    expect(mockGetAssetActivity).not.toHaveBeenCalled()
  })

  it('should return 403 if user does not have permission', async () => {
    const { checkUserPermission } = require('../../src/backend/database/permissionQueries')
    jest.mocked(checkUserPermission).mockResolvedValue(false)

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [])}`)

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Permission denied')
    expect(mockGetAssetActivity).not.toHaveBeenCalled()
  })

  it('should return 500 if repository throws an unknown error', async () => {
    // Reset permission check to allow this test
    const { checkUserPermission } = require('../../src/backend/database/permissionQueries')
    jest.mocked(checkUserPermission).mockResolvedValue(true)

    mockGetAssetActivity.mockRejectedValueOnce(new Error('Database connection failed'))

    const res = await request(app)
      .get(`/api/backend/assets/${mockAssetId}/activity`)
      .set('Authorization', `Bearer ${createMockToken(mockAccountId, mockUserId, [PERMISSIONS.DATASHEET_VIEW])}`)

    expect(res.status).toBe(500)
    expect(mockGetAssetActivity).toHaveBeenCalled()
  })
})
