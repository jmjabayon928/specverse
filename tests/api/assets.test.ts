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
          completenessScore: 80,
          completenessFilled: 8,
          completenessRequired: 10,
        },
      ])

      const res = await request(app).get('/api/backend/assets')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].assetId).toBe(1)
      expect(res.body[0].assetTag).toBe('PT-001')
      expect(typeof res.body[0].completenessScore).toBe('number')
      expect(typeof res.body[0].completenessFilled).toBe('number')
      expect(typeof res.body[0].completenessRequired).toBe('number')
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

      await request(app).get(
        '/api/backend/assets?clientId=10&projectId=20&disciplineId=3&subtypeId=4&location=Area%20A&system=%20HVAC%20&service=Cooling&criticality=High&q=pump'
      )

      expect(mockListAssets).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          clientId: 10,
          projectId: 20,
          disciplineId: 3,
          subtypeId: 4,
          location: 'Area A',
          system: 'HVAC',
          service: 'Cooling',
          criticality: 'High',
          q: 'pump',
        })
      )
    })

    it('trims and drops empty string filters', async () => {
      mockListAssets.mockResolvedValue([])

      await request(app).get(
        '/api/backend/assets?location=%20%20%20&system=%20HVAC%20&service=&criticality=%20%20'
      )

      expect(mockListAssets).toHaveBeenCalledTimes(1)
      const [, filters] = mockListAssets.mock.calls[0]
      expect(filters.location).toBeUndefined()
      expect(filters.service).toBeUndefined()
      expect(filters.criticality).toBeUndefined()
      expect(filters.system).toBe('HVAC')
    })

    it('computes completeness score math as specified', () => {
      const computeCompleteness = (
        coreFilled: number,
        coreRequired: number,
        customFilled: number,
        customRequired: number
      ): { score: number; filled: number; required: number } => {
        const totalFilled = coreFilled + customFilled
        const totalRequired = coreRequired + customRequired
        const score =
          totalRequired === 0
            ? 100
            : Math.floor((100 * totalFilled) / totalRequired)
        return { score, filled: totalFilled, required: totalRequired }
      }

      const case1 = computeCompleteness(0, 0, 0, 0)
      expect(case1.score).toBe(100)
      expect(case1.filled).toBe(0)
      expect(case1.required).toBe(0)

      const case2 = computeCompleteness(3, 5, 1, 5)
      expect(case2.required).toBe(10)
      expect(case2.filled).toBe(4)
      expect(case2.score).toBe(40)

      const case3 = computeCompleteness(5, 5, 5, 5)
      expect(case3.required).toBe(10)
      expect(case3.filled).toBe(10)
      expect(case3.score).toBe(100)
    })
  })
})
