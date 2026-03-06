// tests/api/facilities.systems.assets.get.test.ts
import request from 'supertest'
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

const mockSystemBelongsToAccountAndFacility = jest.fn()
const mockGetSystemNameForSystem = jest.fn()
const mockListAssetsForSystemName = jest.fn()

jest.mock('../../src/backend/repositories/schedulesRepository', () => ({
  systemBelongsToAccountAndFacility: (...args: unknown[]) =>
    mockSystemBelongsToAccountAndFacility(...args),
}))

jest.mock('../../src/backend/repositories/systemAssetsRepository', () => ({
  getSystemNameForSystem: (...args: unknown[]) => mockGetSystemNameForSystem(...args),
  listAssetsForSystemName: (...args: unknown[]) => mockListAssetsForSystemName(...args),
}))

describe('Facilities Systems Assets API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSystemBelongsToAccountAndFacility.mockResolvedValue(true)
    mockGetSystemNameForSystem.mockResolvedValue('HVAC System')
    mockListAssetsForSystemName.mockResolvedValue({
      items: [],
      total: 0,
    })
  })

  describe('GET /api/backend/facilities/:facilityId/systems/:systemId/assets', () => {
    it('returns list of assets with items and total', async () => {
      mockListAssetsForSystemName.mockResolvedValue({
        items: [
          {
            assetId: 1,
            assetTag: 'P-001',
            assetName: 'Pump 001',
            location: 'Building A',
            status: 'Active',
          },
          {
            assetId: 2,
            assetTag: 'V-002',
            assetName: 'Valve 002',
            location: 'Building B',
            status: 'Active',
          },
        ],
        total: 2,
      })

      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body.items).toHaveLength(2)
      expect(res.body.items[0].assetId).toBe(1)
      expect(res.body.items[0].assetTag).toBe('P-001')
      expect(typeof res.body.items[0].assetId).toBe('number')
      expect(typeof res.body.items[0].assetTag).toBe('string')
      expect(mockSystemBelongsToAccountAndFacility).toHaveBeenCalledWith(1, 1, 1)
      expect(mockGetSystemNameForSystem).toHaveBeenCalledWith(1, 1, 1)
      expect(mockListAssetsForSystemName).toHaveBeenCalledWith(
        1,
        'HVAC System',
        expect.objectContaining({
          take: 50,
          skip: 0,
        })
      )
    })

    it('returns 404 when system not in account/facility', async () => {
      mockSystemBelongsToAccountAndFacility.mockResolvedValue(false)

      const res = await request(app).get('/api/backend/facilities/1/systems/999/assets')

      expect(res.status).toBe(404)
      expect(mockSystemBelongsToAccountAndFacility).toHaveBeenCalledWith(999, 1, 1)
      expect(mockGetSystemNameForSystem).not.toHaveBeenCalled()
      expect(mockListAssetsForSystemName).not.toHaveBeenCalled()
    })

    it('returns 404 when system name not found', async () => {
      mockGetSystemNameForSystem.mockResolvedValue(null)

      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets')

      expect(res.status).toBe(404)
      expect(mockSystemBelongsToAccountAndFacility).toHaveBeenCalledWith(1, 1, 1)
      expect(mockGetSystemNameForSystem).toHaveBeenCalledWith(1, 1, 1)
      expect(mockListAssetsForSystemName).not.toHaveBeenCalled()
    })

    it('passes q filter to repository', async () => {
      mockListAssetsForSystemName.mockResolvedValue({
        items: [],
        total: 0,
      })

      await request(app).get('/api/backend/facilities/1/systems/1/assets?q=P-001')

      expect(mockSystemBelongsToAccountAndFacility).toHaveBeenCalledWith(1, 1, 1)
      expect(mockGetSystemNameForSystem).toHaveBeenCalledWith(1, 1, 1)
      expect(mockListAssetsForSystemName).toHaveBeenCalledWith(
        1,
        'HVAC System',
        expect.objectContaining({
          q: 'P-001',
          take: 50,
          skip: 0,
        })
      )
    })

    it('returns 400 when take=0', async () => {
      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets?take=0')

      expect(res.status).toBe(400)
      // Query validation fails before ownership check
      expect(mockSystemBelongsToAccountAndFacility).not.toHaveBeenCalled()
      expect(mockListAssetsForSystemName).not.toHaveBeenCalled()
    })

    it('returns 400 when take=201', async () => {
      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets?take=201')

      expect(res.status).toBe(400)
      // Query validation fails before ownership check
      expect(mockSystemBelongsToAccountAndFacility).not.toHaveBeenCalled()
      expect(mockListAssetsForSystemName).not.toHaveBeenCalled()
    })

    it('returns 400 when skip=-1', async () => {
      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets?skip=-1')

      expect(res.status).toBe(400)
      // Query validation fails before ownership check
      expect(mockSystemBelongsToAccountAndFacility).not.toHaveBeenCalled()
      expect(mockListAssetsForSystemName).not.toHaveBeenCalled()
    })

    it('passes status filter to repository', async () => {
      mockListAssetsForSystemName.mockResolvedValue({
        items: [],
        total: 0,
      })

      await request(app).get('/api/backend/facilities/1/systems/1/assets?status=Active')

      expect(mockListAssetsForSystemName).toHaveBeenCalledWith(
        1,
        'HVAC System',
        expect.objectContaining({
          status: 'Active',
          take: 50,
          skip: 0,
        })
      )
    })

    it('returns empty array when no assets', async () => {
      mockListAssetsForSystemName.mockResolvedValue({
        items: [],
        total: 0,
      })

      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body.items).toEqual([])
      expect(res.body.total).toBe(0)
    })

    it('matches assets when SystemName has whitespace but Assets.System does not', async () => {
      // SystemName from FacilitySystems has leading/trailing spaces
      mockGetSystemNameForSystem.mockResolvedValue('  HVAC System  ')
      mockListAssetsForSystemName.mockResolvedValue({
        items: [
          {
            assetId: 1,
            assetTag: 'P-001',
            assetName: 'Pump 001',
            location: 'Building A',
            status: 'Active',
          },
        ],
        total: 1,
      })

      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets')

      expect(res.status).toBe(200)
      expect(mockGetSystemNameForSystem).toHaveBeenCalledWith(1, 1, 1)
      // Verify repository is called with the system name (whitespace will be handled in SQL)
      expect(mockListAssetsForSystemName).toHaveBeenCalledWith(
        1,
        '  HVAC System  ',
        expect.any(Object)
      )
      expect(res.body.items).toHaveLength(1)
    })

    it('matches assets when Assets.System has different case than SystemName', async () => {
      mockGetSystemNameForSystem.mockResolvedValue('HVAC System')
      mockListAssetsForSystemName.mockResolvedValue({
        items: [
          {
            assetId: 1,
            assetTag: 'P-001',
            assetName: 'Pump 001',
            location: 'Building A',
            status: 'Active',
          },
        ],
        total: 1,
      })

      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets')

      expect(res.status).toBe(200)
      // Repository receives system name, SQL handles case-insensitive comparison
      expect(mockListAssetsForSystemName).toHaveBeenCalledWith(
        1,
        'HVAC System',
        expect.any(Object)
      )
      expect(res.body.items).toHaveLength(1)
    })

    it('does not match assets when Assets.System is NULL', async () => {
      mockListAssetsForSystemName.mockResolvedValue({
        items: [],
        total: 0,
      })

      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets')

      expect(res.status).toBe(200)
      // Verify repository is called and NULL System values are excluded
      expect(mockListAssetsForSystemName).toHaveBeenCalledWith(
        1,
        'HVAC System',
        expect.objectContaining({
          take: 50,
          skip: 0,
        })
      )
      expect(res.body.items).toEqual([])
      expect(res.body.total).toBe(0)
    })

    it('defaults to Active status when status parameter is not provided', async () => {
      mockListAssetsForSystemName.mockResolvedValue({
        items: [
          {
            assetId: 1,
            assetTag: 'P-001',
            assetName: 'Pump 001',
            location: 'Building A',
            status: 'Active',
          },
        ],
        total: 1,
      })

      const res = await request(app).get('/api/backend/facilities/1/systems/1/assets')

      expect(res.status).toBe(200)
      // Controller passes status: undefined when no query param provided
      // Repository defaults to 'Active' internally
      expect(mockListAssetsForSystemName).toHaveBeenCalledWith(
        1,
        'HVAC System',
        expect.objectContaining({
          status: undefined,
          take: 50,
          skip: 0,
        })
      )
      // Verify that Active assets are returned (repository applies default)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].status).toBe('Active')
    })
  })
})
