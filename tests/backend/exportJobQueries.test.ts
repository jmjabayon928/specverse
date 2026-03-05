/**
 * Targeted tests for export job claim/heartbeat invariants.
 * Mocks DB request chain; no real DB.
 */

const mockQuery = jest.fn()
const mockInput = jest.fn().mockReturnThis()
const mockRequest = jest.fn().mockReturnValue({
  input: mockInput,
  query: mockQuery,
})

jest.mock('../../src/backend/config/db', () => ({
  poolPromise: Promise.resolve({ request: mockRequest }),
  sql: {
    Int: 1,
    NVarChar: () => ({}),
    UniqueIdentifier: 2,
    DateTime2: 3,
    BigInt: 4,
  },
}))

import {
  claimExportJob,
  claimNextExportJob,
  heartbeatExportJob,
  clearLeaseOnTerminal,
} from '../../src/backend/database/exportJobQueries'

const stubRow = {
  Id: 100,
  JobType: 'inventory_transactions_csv',
  Status: 'running',
  Progress: 0,
  ParamsJson: '{}',
  CreatedBy: 1,
  CreatedAt: new Date(),
  StartedAt: new Date(),
  CompletedAt: null as Date | null,
  ExpiresAt: null as Date | null,
  ErrorMessage: null as string | null,
  FileName: null as string | null,
  FilePath: null as string | null,
  LeaseId: 'a1b2c3d4-0000-4000-8000-000000000001',
  LeasedUntil: new Date(),
  AttemptCount: 1,
}

describe('exportJobQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('claimExportJob', () => {
    it('returns claimed and row when UPDATE affects one row', async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [stubRow],
        rowsAffected: [1],
      })

      const result = await claimExportJob(
        100,
        'a1b2c3d4-0000-4000-8000-000000000001',
        new Date(Date.now() + 300000),
        new Date()
      )

      expect(result.claimed).toBe(true)
      expect(result.row).not.toBeNull()
      expect(result.row?.Id).toBe(100)
      expect(result.row?.JobType).toBe('inventory_transactions_csv')
      expect(mockRequest).toHaveBeenCalledTimes(1)
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    it('returns not claimed when UPDATE affects zero rows (concurrent claim)', async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [],
        rowsAffected: [0],
      })

      const result = await claimExportJob(
        100,
        'b2c3d4e5-0000-4000-8000-000000000002',
        new Date(Date.now() + 300000),
        new Date()
      )

      expect(result.claimed).toBe(false)
      expect(result.row).toBeNull()
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    it('simulated concurrent calls: first succeeds, second fails', async () => {
      mockQuery
        .mockResolvedValueOnce({
          recordset: [stubRow],
          rowsAffected: [1],
        })
        .mockResolvedValueOnce({
          recordset: [],
          rowsAffected: [0],
        })

      const [r1, r2] = await Promise.all([
        claimExportJob(100, 'lease-1', new Date(Date.now() + 300000), new Date()),
        claimExportJob(100, 'lease-2', new Date(Date.now() + 300000), new Date()),
      ])

      expect(r1.claimed).toBe(true)
      expect(r2.claimed).toBe(false)
      expect(mockQuery).toHaveBeenCalledTimes(2)
    })
  })

  describe('heartbeatExportJob', () => {
    it('only updates when lease matches (WHERE includes LeaseId and Status)', async () => {
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1] })

      const ok = await heartbeatExportJob(
        100,
        'a1b2c3d4-0000-4000-8000-000000000001',
        new Date(Date.now() + 300000)
      )

      expect(ok).toBe(true)
      const queryText = mockQuery.mock.calls[0][0]
      expect(queryText).toContain('LeaseId = @LeaseId')
      expect(queryText).toContain("Status = 'running'")
    })

    it('returns false when no row updated (lease mismatch or not running)', async () => {
      mockQuery.mockResolvedValueOnce({ rowsAffected: [0] })

      const ok = await heartbeatExportJob(
        100,
        'wrong-lease-id',
        new Date(Date.now() + 300000)
      )

      expect(ok).toBe(false)
    })
  })

  describe('clearLeaseOnTerminal', () => {
    it('clears lease only for matching job and lease', async () => {
      mockQuery.mockResolvedValueOnce({ rowsAffected: [1] })

      await clearLeaseOnTerminal(100, 'a1b2c3d4-0000-4000-8000-000000000001')

      const queryText = mockQuery.mock.calls[0][0]
      expect(queryText).toContain('LeaseId = NULL')
      expect(queryText).toContain('LeasedUntil = NULL')
      expect(queryText).toContain('LeaseId = @LeaseId')
    })
  })

  describe('claimNextExportJob', () => {
    it('returns claimed and row when one job is claimed', async () => {
      mockQuery.mockResolvedValueOnce({
        recordset: [{ ...stubRow, Id: 200 }],
        rowsAffected: [1],
      })

      const result = await claimNextExportJob(
        'c3d4e5f6-0000-4000-8000-000000000003',
        new Date(Date.now() + 300000),
        new Date(),
        1
      )

      expect(result.claimed).toBe(true)
      expect(result.row?.Id).toBe(200)
      expect(mockQuery).toHaveBeenCalledTimes(1)
      const queryText = mockQuery.mock.calls[0][0]
      expect(queryText).toContain('NextAttemptAt')
      expect(queryText).toContain('SYSUTCDATETIME()')
      expect(queryText).toContain('PerAccountLimit')
      expect(queryText).toContain('@PerAccountLimit')
      expect(queryText).toMatch(/COUNT\s*\(\s*1\s*\)|AccountID|per.*account/i)
    })

    it('respects NextAttemptAt in eligible predicate', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] })

      await claimNextExportJob(
        'd4e5f6a7-0000-4000-8000-000000000004',
        new Date(Date.now() + 300000),
        new Date(),
        2
      )

      const queryText = mockQuery.mock.calls[0][0]
      expect(queryText).toContain("Status = 'queued'")
      expect(queryText).toContain('NextAttemptAt IS NULL OR ej.NextAttemptAt <= SYSUTCDATETIME()')
    })
  })
})
