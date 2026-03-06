// tests/repositories/assetsRepository.listAssets.sqlContract.test.ts
const mockInput = jest.fn().mockReturnThis()
const mockQuery = jest.fn().mockResolvedValue({ recordset: [] })
const mockRequest = jest.fn().mockReturnValue({
  input: mockInput,
  query: mockQuery,
})

jest.mock('@/backend/config/db', () => ({
  poolPromise: Promise.resolve({
    request: mockRequest,
  }),
  sql: {
    Int: 1,
    NVarChar: () => ({}),
    VarChar: () => ({}),
  },
}))

import { listAssets } from '@/backend/repositories/assetsRepository'
import type { AssetsListFilters } from '@/backend/repositories/assetsRepository'

describe('assetsRepository.listAssets SQL contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery.mockResolvedValue({ recordset: [] })
  })

  describe('Case A: no q parameter', () => {
    it('should include AccountID filter in WHERE clause', async () => {
      const filters: AssetsListFilters = {
        take: 50,
        skip: 0,
      }

      await listAssets(123, filters)

      expect(mockQuery).toHaveBeenCalledTimes(1)
      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('WHERE a.AccountID = @AccountID')
    })

    it('should use deterministic ORDER BY', async () => {
      const filters: AssetsListFilters = {
        take: 50,
        skip: 0,
      }

      await listAssets(123, filters)

      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('ORDER BY a.AssetTag, a.AssetID')
    })

    it('should use OFFSET/FETCH pagination', async () => {
      const filters: AssetsListFilters = {
        take: 50,
        skip: 0,
      }

      await listAssets(123, filters)

      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('OFFSET @Skip ROWS')
      expect(sql).toContain('FETCH NEXT @Take ROWS ONLY')
    })

    it('should bind AccountID, Skip, and Take parameters', async () => {
      const filters: AssetsListFilters = {
        take: 50,
        skip: 0,
      }

      await listAssets(123, filters)

      expect(mockInput).toHaveBeenCalledWith('AccountID', 1, 123)
      expect(mockInput).toHaveBeenCalledWith('Skip', 1, 0)
      expect(mockInput).toHaveBeenCalledWith('Take', 1, 50)
    })
  })

  describe('Case B: with q parameter', () => {
    it('should include search conditions for AssetTagNorm prefix and AssetName contains', async () => {
      const filters: AssetsListFilters = {
        q: 'P-101',
        take: 50,
        skip: 0,
      }

      await listAssets(123, filters)

      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('a.AssetTagNorm LIKE @QNormPrefix')
      expect(sql).toContain('a.AssetName LIKE @QContains')
    })

    it('should bind QNormPrefix and QContains parameters when q is provided', async () => {
      const filters: AssetsListFilters = {
        q: 'P-101',
        take: 50,
        skip: 0,
      }

      await listAssets(123, filters)

      expect(mockInput).toHaveBeenCalledWith('QNormPrefix', expect.anything(), expect.stringContaining('%'))
      expect(mockInput).toHaveBeenCalledWith('QContains', expect.anything(), expect.stringMatching(/^%.*%$/))
    })

    it('should still include AccountID filter when q is provided', async () => {
      const filters: AssetsListFilters = {
        q: 'P-101',
        take: 50,
        skip: 0,
      }

      await listAssets(123, filters)

      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('WHERE a.AccountID = @AccountID')
    })

    it('should still use ORDER BY and pagination when q is provided', async () => {
      const filters: AssetsListFilters = {
        q: 'P-101',
        take: 50,
        skip: 0,
      }

      await listAssets(123, filters)

      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('ORDER BY a.AssetTag, a.AssetID')
      expect(sql).toContain('OFFSET @Skip ROWS')
      expect(sql).toContain('FETCH NEXT @Take ROWS ONLY')
    })
  })
})
