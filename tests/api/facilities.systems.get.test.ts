// tests/api/facilities.systems.get.test.ts
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

const mockListSystems = jest.fn()
const mockGetSystemById = jest.fn()
const mockFacilityBelongsToAccount = jest.fn()
const mockSystemBelongsToAccountAndFacility = jest.fn()

jest.mock('../../src/backend/services/facilitiesService', () => ({
  listSystems: (...args: unknown[]) => mockListSystems(...args),
  getSystemById: (...args: unknown[]) => mockGetSystemById(...args),
  facilityBelongsToAccount: (...args: unknown[]) => mockFacilityBelongsToAccount(...args),
  systemBelongsToAccountAndFacility: (...args: unknown[]) => mockSystemBelongsToAccountAndFacility(...args),
}))

describe('Facilities Systems API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentTestAccountId = 1
    mockFacilityBelongsToAccount.mockResolvedValue(true)
    mockSystemBelongsToAccountAndFacility.mockResolvedValue(true)
  })

  describe('GET /api/backend/facilities/:facilityId/systems', () => {
    it('returns list of systems scoped by facility and account', async () => {
      mockListSystems.mockResolvedValue({
        items: [
          {
            systemId: 1,
            systemName: 'HVAC System',
            status: 'Active',
          },
          {
            systemId: 2,
            systemName: 'Electrical System',
            status: 'Active',
          },
        ],
        total: 2,
      })

      const res = await request(app).get('/api/backend/facilities/1/systems')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body.items).toHaveLength(2)
      expect(res.body.items[0].systemId).toBe(1)
      expect(res.body.items[0].systemName).toBe('HVAC System')
      expect(typeof res.body.items[0].systemId).toBe('number')
      expect(typeof res.body.items[0].systemName).toBe('string')
      expect(mockFacilityBelongsToAccount).toHaveBeenCalledWith(1, 1)
      expect(mockListSystems).toHaveBeenCalledWith(1, 1, expect.any(Object))
    })

    it('returns empty array when no systems', async () => {
      mockListSystems.mockResolvedValue({
        items: [],
        total: 0,
      })

      const res = await request(app).get('/api/backend/facilities/1/systems')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body.items).toEqual([])
      expect(res.body.total).toBe(0)
      expect(mockFacilityBelongsToAccount).toHaveBeenCalledWith(1, 1)
      expect(mockListSystems).toHaveBeenCalledWith(1, 1, expect.any(Object))
    })

    it('returns 404 when facility not found', async () => {
      mockFacilityBelongsToAccount.mockResolvedValue(false)

      const res = await request(app).get('/api/backend/facilities/999/systems')

      expect(res.status).toBe(404)
      expect(mockFacilityBelongsToAccount).toHaveBeenCalledWith(999, 1)
      expect(mockListSystems).not.toHaveBeenCalled()
    })

    it('passes query filters to service', async () => {
      mockListSystems.mockResolvedValue({
        items: [],
        total: 0,
      })

      await request(app).get('/api/backend/facilities/1/systems?q=HVAC&take=25&skip=0')

      expect(mockFacilityBelongsToAccount).toHaveBeenCalledWith(1, 1)
      expect(mockListSystems).toHaveBeenCalledWith(
        1,
        1,
        expect.objectContaining({
          q: 'HVAC',
          take: 25,
          skip: 0,
        })
      )
    })
  })

  describe('GET /api/backend/facilities/:facilityId/systems/:systemId', () => {
    it('returns system detail', async () => {
      mockGetSystemById.mockResolvedValue({
        systemId: 1,
        systemName: 'HVAC System',
        status: 'Active',
      })

      const res = await request(app).get('/api/backend/facilities/1/systems/1')

      expect(res.status).toBe(200)
      expect(res.body).not.toBeNull()
      expect(res.body.systemId).toBe(1)
      expect(res.body.systemName).toBe('HVAC System')
      expect(res.body.facilityId).toBe(1)
      expect(typeof res.body.systemId).toBe('number')
      expect(typeof res.body.systemName).toBe('string')
      expect(mockSystemBelongsToAccountAndFacility).toHaveBeenCalledWith(1, 1, 1)
      expect(mockGetSystemById).toHaveBeenCalledWith(1, 1, 1)
    })

    it('returns 404 when system not found', async () => {
      mockSystemBelongsToAccountAndFacility.mockResolvedValue(false)

      const res = await request(app).get('/api/backend/facilities/1/systems/999')

      expect(res.status).toBe(404)
      expect(mockSystemBelongsToAccountAndFacility).toHaveBeenCalledWith(999, 1, 1)
      expect(mockGetSystemById).not.toHaveBeenCalled()
    })
  })
})
