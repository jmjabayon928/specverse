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
            systemCount: 3,
          },
          {
            facilityId: 2,
            facilityName: 'Warehouse A',
            status: 'Active',
            systemCount: 1,
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
      expect(res.body.items[0].systemCount).toBe(3)
      expect(typeof res.body.items[0].facilityId).toBe('number')
      expect(typeof res.body.items[0].facilityName).toBe('string')
      expect(typeof res.body.items[0].systemCount).toBe('number')
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

    it('returns facility with zero systems → systemCount = 0', async () => {
      mockListFacilities.mockResolvedValue({
        items: [
          {
            facilityId: 1,
            facilityName: 'Empty Facility',
            status: 'Active',
            systemCount: 0,
          },
        ],
        total: 1,
      })

      const res = await request(app).get('/api/backend/facilities')

      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].systemCount).toBe(0)
    })

    it('returns facility with multiple systems → correct count', async () => {
      mockListFacilities.mockResolvedValue({
        items: [
          {
            facilityId: 1,
            facilityName: 'Large Facility',
            status: 'Active',
            systemCount: 5,
          },
        ],
        total: 1,
      })

      const res = await request(app).get('/api/backend/facilities')

      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].systemCount).toBe(5)
    })

    it('returns systemCount scoped by account (multi-tenant)', async () => {
      mockListFacilities.mockResolvedValue({
        items: [
          {
            facilityId: 1,
            facilityName: 'Facility 1',
            status: 'Active',
            systemCount: 2,
          },
        ],
        total: 1,
      })

      const res = await request(app).get('/api/backend/facilities')

      expect(res.status).toBe(200)
      expect(res.body.items[0].systemCount).toBe(2)
      // Verify service was called with correct accountId
      expect(mockListFacilities).toHaveBeenCalledWith(1, expect.any(Object))
    })
  })

  describe('GET /api/backend/facilities/:facilityId', () => {
    it('returns facility detail', async () => {
      mockFacilityBelongsToAccount.mockResolvedValue(true)
      mockGetFacilityById.mockResolvedValue({
        facilityId: 1,
        facilityName: 'Main Building',
        status: 'Active',
        systemCount: 2,
      })

      const res = await request(app).get('/api/backend/facilities/1')

      expect(res.status).toBe(200)
      expect(res.body).not.toBeNull()
      expect(res.body.facilityId).toBe(1)
      expect(res.body.facilityName).toBe('Main Building')
      expect(res.body.systemCount).toBe(2)
      expect(typeof res.body.facilityId).toBe('number')
      expect(typeof res.body.facilityName).toBe('string')
      expect(typeof res.body.systemCount).toBe('number')
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
