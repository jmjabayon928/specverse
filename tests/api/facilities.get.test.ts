// tests/api/facilities.get.test.ts
import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

let currentTestAccountId = 1
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

const mockListFacilities = jest.fn()
const mockGetFacilityById = jest.fn()
const mockFacilityBelongsToAccount = jest.fn()

jest.mock('../../src/backend/services/facilitiesService', () => ({
  listFacilities: (...args: unknown[]) => mockListFacilities(...args),
  getFacilityById: (...args: unknown[]) => mockGetFacilityById(...args),
  facilityBelongsToAccount: (...args: unknown[]) => mockFacilityBelongsToAccount(...args),
}))

describe('Facilities API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentTestAccountId = 1
    mockFacilityBelongsToAccount.mockResolvedValue(true)
  })

  describe('GET /api/backend/facilities', () => {
    it('returns list of facilities scoped by account', async () => {
      mockListFacilities.mockResolvedValue({
        items: [
          {
            facilityId: 1,
            facilityName: 'Main Building',
            status: 'Active',
          },
          {
            facilityId: 2,
            facilityName: 'Warehouse A',
            status: 'Active',
          },
        ],
        total: 2,
      })

      const res = await request(app).get('/api/backend/facilities')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body.items).toHaveLength(2)
      expect(res.body.items[0].facilityId).toBe(1)
      expect(res.body.items[0].facilityName).toBe('Main Building')
      expect(typeof res.body.items[0].facilityId).toBe('number')
      expect(typeof res.body.items[0].facilityName).toBe('string')
      expect(mockListFacilities).toHaveBeenCalledWith(1, expect.any(Object))
    })

    it('returns empty array when no facilities', async () => {
      mockListFacilities.mockResolvedValue({
        items: [],
        total: 0,
      })

      const res = await request(app).get('/api/backend/facilities')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body.items).toEqual([])
      expect(res.body.total).toBe(0)
      expect(mockListFacilities).toHaveBeenCalledWith(1, expect.any(Object))
    })

    it('passes query filters to service', async () => {
      mockListFacilities.mockResolvedValue({
        items: [],
        total: 0,
      })

      await request(app).get('/api/backend/facilities?q=warehouse&status=Active&take=25&skip=0')

      expect(mockListFacilities).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          q: 'warehouse',
          status: 'Active',
          take: 25,
          skip: 0,
        })
      )
    })
  })

  describe('GET /api/backend/facilities/:facilityId', () => {
    it('returns facility detail', async () => {
      mockFacilityBelongsToAccount.mockResolvedValue(true)
      mockGetFacilityById.mockResolvedValue({
        facilityId: 1,
        facilityName: 'Main Building',
        status: 'Active',
      })

      const res = await request(app).get('/api/backend/facilities/1')

      expect(res.status).toBe(200)
      expect(res.body).not.toBeNull()
      expect(res.body.facilityId).toBe(1)
      expect(res.body.facilityName).toBe('Main Building')
      expect(typeof res.body.facilityId).toBe('number')
      expect(typeof res.body.facilityName).toBe('string')
      expect(mockFacilityBelongsToAccount).toHaveBeenCalledWith(1, 1)
      expect(mockGetFacilityById).toHaveBeenCalledWith(1, 1)
    })

    it('returns 404 when facility not found', async () => {
      mockFacilityBelongsToAccount.mockResolvedValue(false)

      const res = await request(app).get('/api/backend/facilities/999')

      expect(res.status).toBe(404)
      expect(mockFacilityBelongsToAccount).toHaveBeenCalledWith(999, 1)
      expect(mockGetFacilityById).not.toHaveBeenCalled()
    })
  })
})
