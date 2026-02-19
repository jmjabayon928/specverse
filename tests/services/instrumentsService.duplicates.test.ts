// tests/services/instrumentsService.duplicates.test.ts
import { AppError } from '../../src/backend/errors/AppError'

const mockPoolRequest = jest.fn()
const mockPoolPromise = Promise.resolve({
  request: () => mockPoolRequest(),
})

jest.mock('../../src/backend/config/db', () => ({
  poolPromise: mockPoolPromise,
  sql: {
    Int: 1,
    NVarChar: () => ({}),
    MAX: {},
  },
}))

const mockGetById = jest.fn()

jest.mock('../../src/backend/repositories/instrumentsRepository', () => {
  const actualModule = jest.requireActual('../../src/backend/repositories/instrumentsRepository')
  return {
    ...actualModule,
    getById: (...args: unknown[]) => mockGetById(...args),
  }
})

describe('InstrumentsRepository Duplicate Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetById.mockReset()
    // Reset call count for pool.request() mock
    ;(mockPoolRequest as jest.Mock).mockClear()
  })

  describe('create - duplicate tag handling', () => {
    it('throws 409 when SQL error 2601 occurs', async () => {
      const { create } = await import('../../src/backend/repositories/instrumentsRepository')

      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockRejectedValue({ number: 2601, message: 'Duplicate key' }),
      }
      mockPoolRequest.mockReturnValue(mockRequest)

      await expect(
        create(1, {
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
        })
      ).rejects.toThrow(AppError)

      await expect(
        create(1, {
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
        })
      ).rejects.toThrow('Instrument tag already exists.')

      const error = await create(1, {
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
      }).catch((e) => e)
      expect(error.statusCode).toBe(409)
    })

    it('throws 409 when SQL error 2627 occurs', async () => {
      const { create } = await import('../../src/backend/repositories/instrumentsRepository')

      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockRejectedValue({ number: 2627, message: 'Violation of UNIQUE KEY constraint' }),
      }
      mockPoolRequest.mockReturnValue(mockRequest)

      await expect(
        create(1, {
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
        })
      ).rejects.toThrow(AppError)

      await expect(
        create(1, {
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
        })
      ).rejects.toThrow('Instrument tag already exists.')

      const error = await create(1, {
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
      }).catch((e) => e)
      expect(error.statusCode).toBe(409)
    })

    it('propagates other SQL errors unchanged', async () => {
      const { create } = await import('../../src/backend/repositories/instrumentsRepository')

      const otherError = { number: 50000, message: 'Some other error' }
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockRejectedValue(otherError),
      }
      mockPoolRequest.mockReturnValue(mockRequest)

      await expect(
        create(1, {
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
        })
      ).rejects.toBe(otherError)
    })

    it('does not treat non-numeric error codes as duplicates', async () => {
      const { create } = await import('../../src/backend/repositories/instrumentsRepository')

      const timeoutError = { code: 'ETIMEOUT', message: 'Connection timeout' }
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockRejectedValue(timeoutError),
      }
      mockPoolRequest.mockReturnValue(mockRequest)

      await expect(
        create(1, {
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
        })
      ).rejects.toBe(timeoutError)
    })

    it('treats numeric string error codes as duplicates', async () => {
      const { create } = await import('../../src/backend/repositories/instrumentsRepository')

      const duplicateError = { code: '2601', message: 'Duplicate key' }
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockRejectedValue(duplicateError),
      }
      mockPoolRequest.mockReturnValue(mockRequest)

      const error = await create(1, {
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
      }).catch((e) => e)

      expect((error as { message?: string }).message).toBe('Instrument tag already exists.')
      expect((error as { statusCode?: number }).statusCode).toBe(409)
    })
  })

  describe('update - duplicate tag handling', () => {
    it('throws 409 when SQL error 2601 occurs', async () => {
      const { update } = await import('../../src/backend/repositories/instrumentsRepository')

      // Mock getById to return existing record (before UPDATE)
      // Note: getById is called internally, so we need to mock it at the module level
      // The actual getById will try to query DB, so we need to mock the DB response for it
      mockGetById.mockResolvedValue({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Mock DB for getById calls (SELECT query)
      const getByIdQueryMock = jest.fn().mockResolvedValue({
        recordset: [{
          instrumentId: 1,
          accountId: 1,
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
          instrumentType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      })
      const getByIdRequestMock = {
        input: jest.fn().mockReturnThis(),
        query: getByIdQueryMock,
      }

      // Mock DB for UPDATE query (should throw error)
      const sqlError2601: { number: number; message: string } = { number: 2601, message: 'Duplicate key' }
      const updateQueryMock = jest.fn().mockRejectedValue(sqlError2601)
      const updateRequestMock = {
        input: jest.fn().mockReturnThis(),
        query: updateQueryMock,
      }

      // Return different mocks for different calls
      let callCount = 0
      mockPoolRequest.mockImplementation(() => {
        callCount++
        // First call is for getById (SELECT), second is for UPDATE
        return callCount === 1 ? getByIdRequestMock : updateRequestMock
      })

      const error = await update(1, 1, {
        instrumentTag: 'PT-102',
        instrumentTagNorm: 'PT-102',
      }).catch((e) => e)

      // Verify the UPDATE query was called (should throw error)
      expect(updateQueryMock).toHaveBeenCalled()
      
      // Verify error was converted
      expect(error).toBeDefined()
      expect((error as { message?: string }).message).toBe('Instrument tag already exists.')
      expect((error as { statusCode?: number }).statusCode).toBe(409)
    })

    it('throws 409 when SQL error 2627 occurs', async () => {
      const { update } = await import('../../src/backend/repositories/instrumentsRepository')

      mockGetById.mockResolvedValue({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const getByIdQueryMock = jest.fn().mockResolvedValue({
        recordset: [{
          instrumentId: 1,
          accountId: 1,
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
          instrumentType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      })
      const getByIdRequestMock = {
        input: jest.fn().mockReturnThis(),
        query: getByIdQueryMock,
      }

      const sqlError2627: { number: number; message: string } = { number: 2627, message: 'Violation of UNIQUE KEY constraint' }
      const updateQueryMock = jest.fn().mockRejectedValue(sqlError2627)
      const updateRequestMock = {
        input: jest.fn().mockReturnThis(),
        query: updateQueryMock,
      }

      let callCount = 0
      mockPoolRequest.mockImplementation(() => {
        callCount++
        return callCount === 1 ? getByIdRequestMock : updateRequestMock
      })

      const error = await update(1, 1, {
        instrumentTag: 'PT-102',
        instrumentTagNorm: 'PT-102',
      }).catch((e) => e)

      expect(updateQueryMock).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect((error as { message?: string }).message).toBe('Instrument tag already exists.')
      expect((error as { statusCode?: number }).statusCode).toBe(409)
    })

    it('propagates other SQL errors unchanged', async () => {
      const { update } = await import('../../src/backend/repositories/instrumentsRepository')

      mockGetById.mockResolvedValueOnce({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const otherError = { number: 50000, message: 'Some other error' }
      const mockRequest = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockRejectedValue(otherError),
      }
      mockPoolRequest.mockReturnValue(mockRequest)

      await expect(
        update(1, 1, {
          instrumentTag: 'PT-102',
          instrumentTagNorm: 'PT-102',
        })
      ).rejects.toBe(otherError)
    })
  })
})
