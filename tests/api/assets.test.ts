// tests/api/assets.test.ts
import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

let currentTestAccountId = 1
jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  // require helper inside factory to avoid hoisting issues
  const helper = jest.requireActual('../helpers/authMiddlewareMock')
  return (helper as typeof import('../helpers/authMiddlewareMock')).createAuthMiddlewareMock({
    actual,
    mode: 'passthrough',
  })
})

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const mockListAssets = jest.fn()

jest.mock('../../src/backend/services/assetsService', () => ({
  listAssets: (...args: unknown[]) => mockListAssets(...args),
}))

describe('Assets API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentTestAccountId = 1
  })

  describe('GET /api/backend/assets', () => {
    it('returns list of assets scoped by account', async () => {
      mockListAssets.mockResolvedValue([
        {
          assetId: 1,
          assetTag: 'PT-001',
          assetName: 'Pressure Transmitter',
          location: 'Area A',
          system: 'HVAC',
          service: 'Cooling',
          criticality: 'High',
          disciplineId: 1,
          subtypeId: 2,
          clientId: null,
          projectId: null,
        },
      ])

      const res = await request(app).get('/api/backend/assets')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].assetId).toBe(1)
      expect(res.body[0].assetTag).toBe('PT-001')
      expect(mockListAssets).toHaveBeenCalledWith(1, expect.any(Object))
    })

    it('returns empty array when no assets', async () => {
      mockListAssets.mockResolvedValue([])

      const res = await request(app).get('/api/backend/assets')

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
      expect(mockListAssets).toHaveBeenCalledWith(1, expect.any(Object))
    })

    it('passes query filters to service', async () => {
      mockListAssets.mockResolvedValue([])

      await request(app).get('/api/backend/assets?clientId=10&projectId=20&q=pump')

      expect(mockListAssets).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          clientId: 10,
          projectId: 20,
          q: 'pump',
        })
      )
    })
  })
})
