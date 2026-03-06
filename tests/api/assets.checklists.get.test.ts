import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const helper = jest.requireActual('../helpers/authMiddlewareMock')
  return (helper as typeof import('../helpers/authMiddlewareMock')).createAuthMiddlewareMock({
    actual,
    mode: 'passthrough',
  })
})

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const mockListChecklistRunsByAssetId = jest.fn()

jest.mock('../../src/backend/services/checklistsService', () => ({
  listChecklistRunsByAssetId: (...args: unknown[]) => mockListChecklistRunsByAssetId(...args),
}))

describe('GET /api/backend/assets/:assetId/checklists', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty items for asset with no checklist runs', async () => {
    mockListChecklistRunsByAssetId.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })

    const res = await request(app).get('/api/backend/assets/123/checklists')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })
    expect(mockListChecklistRunsByAssetId).toHaveBeenCalledWith(1, 123, 1, 10)
  })

  it('returns checklist runs for the correct asset/account only', async () => {
    mockListChecklistRunsByAssetId.mockResolvedValue({
      items: [
        {
          checklistRunId: 1,
          runName: 'Inspection Run 1',
          status: 'DRAFT',
          createdAt: '2026-03-05T10:00:00.000Z',
          checklistTemplateId: 10,
        },
        {
          checklistRunId: 2,
          runName: 'Inspection Run 2',
          status: 'COMPLETED',
          createdAt: '2026-03-04T09:00:00.000Z',
          checklistTemplateId: 11,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 10,
    })

    const res = await request(app).get('/api/backend/assets/123/checklists')

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(2)
    expect(res.body.items[0].checklistRunId).toBe(1)
    expect(res.body.items[0].runName).toBe('Inspection Run 1')
    expect(res.body.items[1].checklistRunId).toBe(2)
    expect(res.body.total).toBe(2)
    expect(mockListChecklistRunsByAssetId).toHaveBeenCalledWith(1, 123, 1, 10)
  })

  it('supports page + pageSize query parameters', async () => {
    mockListChecklistRunsByAssetId.mockResolvedValue({
      items: [
        {
          checklistRunId: 3,
          runName: 'Inspection Run 3',
          status: 'DRAFT',
          createdAt: '2026-03-03T08:00:00.000Z',
          checklistTemplateId: 12,
        },
      ],
      total: 15,
      page: 2,
      pageSize: 5,
    })

    const res = await request(app).get('/api/backend/assets/123/checklists?page=2&pageSize=5')

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.page).toBe(2)
    expect(res.body.pageSize).toBe(5)
    expect(res.body.total).toBe(15)
    expect(mockListChecklistRunsByAssetId).toHaveBeenCalledWith(1, 123, 2, 5)
  })

  it('returns 400 for invalid assetId parameter', async () => {
    const res = await request(app).get('/api/backend/assets/invalid/checklists')

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid asset id')
    expect(mockListChecklistRunsByAssetId).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid page parameter', async () => {
    const res = await request(app).get('/api/backend/assets/123/checklists?page=0')

    expect(res.status).toBe(400)
    expect(mockListChecklistRunsByAssetId).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid pageSize parameter', async () => {
    const res = await request(app).get('/api/backend/assets/123/checklists?pageSize=201')

    expect(res.status).toBe(400)
    expect(mockListChecklistRunsByAssetId).not.toHaveBeenCalled()
  })
})
