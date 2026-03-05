/**
 * Targeted tests for export job service: deterministic ZIP and ExportJobItems.
 * Mocks DB and file system; asserts FileName ends .zip and item insert with normalized path.
 */

const mockClaimExportJob = jest.fn()
const mockInsertExportJobItem = jest.fn()
const mockUpdateExportJobCompleted = jest.fn()
const mockUpdateExportJobFailed = jest.fn()
const mockGetInventoryTransactionsForCsv = jest.fn()

jest.mock('../../src/backend/database/exportJobQueries', () => ({
  insertExportJob: jest.fn(),
  getExportJobById: jest.fn(),
  claimExportJob: (...args: unknown[]) => mockClaimExportJob(...args),
  heartbeatExportJob: jest.fn(),
  updateExportJobCompleted: (...args: unknown[]) => mockUpdateExportJobCompleted(...args),
  updateExportJobFailed: (...args: unknown[]) => mockUpdateExportJobFailed(...args),
  updateExportJobCancelled: jest.fn(),
  updateExportJobResetForRetry: jest.fn(),
  listExportJobsForCleanup: jest.fn(),
  insertExportJobItem: (...args: unknown[]) => mockInsertExportJobItem(...args),
}))

jest.mock('../../src/backend/database/inventoryTransactionQueries', () => ({
  getInventoryTransactionsPaged: jest.fn(),
  getInventoryTransactionsForCsv: (...args: unknown[]) =>
    mockGetInventoryTransactionsForCsv(...args),
  getInventoryTransactions: jest.fn(),
  addInventoryTransaction: jest.fn(),
  getAllInventoryTransactions: jest.fn(),
  getAllInventoryMaintenanceLogs: jest.fn(),
  getAllInventoryAuditLogs: jest.fn(),
}))

const mockAppend = jest.fn()
const mockFinalize = jest.fn()
const mockPipe = jest.fn()
let streamCloseCallback: (() => void) | null = null
let finalizeCalled = false

jest.mock('archiver', () => {
  return jest.fn(() => ({
    pipe: mockPipe,
    append: mockAppend,
    finalize: function () {
      mockFinalize()
      finalizeCalled = true
      if (streamCloseCallback) {
        const fn = streamCloseCallback
        streamCloseCallback = null
        fn()
      }
    },
    on: jest.fn(),
  }))
})

jest.mock('fs', () => ({
  createWriteStream: jest.fn(() => ({
    on: jest.fn((ev: string, fn: () => void) => {
      if (ev === 'close') {
        streamCloseCallback = fn
        if (finalizeCalled) {
          const cb = streamCloseCallback
          streamCloseCallback = null
          setImmediate(cb)
        }
      }
      return { on: jest.fn() }
    }),
  })),
}))

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}))

import { runExportJob } from '../../src/backend/services/exportJobService'

const stubClaimedRow = {
  Id: 50,
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
  LeaseId: null as string | null,
  LeasedUntil: null as Date | null,
  AttemptCount: 0,
}

describe('exportJobService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    streamCloseCallback = null
    finalizeCalled = false
    mockGetInventoryTransactionsForCsv.mockResolvedValue([])
    mockClaimExportJob.mockResolvedValue({
      claimed: true,
      row: stubClaimedRow,
    })
  })

  describe('inventory_transactions_csv', () => {
    it('inserts ExportJobItems with normalized RelativePath and completes with FileName ending .zip', async () => {
      mockGetInventoryTransactionsForCsv.mockResolvedValue([
        {
          transactionId: 1,
          itemId: 10,
          itemName: 'Item',
          warehouseId: 1,
          warehouseName: 'WH1',
          quantityChanged: 5,
          transactionType: 'Receive',
          performedAt: new Date().toISOString(),
          performedBy: 'User',
        },
      ])

      await runExportJob(50)

      expect(mockClaimExportJob).toHaveBeenCalledTimes(1)
      expect(mockInsertExportJobItem).toHaveBeenCalledTimes(1)
      expect(mockInsertExportJobItem).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 50,
          relativePath: 'inventory_transactions/transactions.csv',
          sourceType: 'inventory_transactions_csv',
          sourceId: null,
        })
      )
      expect(mockUpdateExportJobCompleted).toHaveBeenCalledTimes(1)
      const completedArgs = mockUpdateExportJobCompleted.mock.calls[0]
      expect(completedArgs[0]).toBe(50)
      expect(completedArgs[1]).toMatch(/\.zip$/)
      expect(completedArgs[2]).toContain('export-50.zip')
      expect(completedArgs[3]).toBeDefined()
    })

    it('does not call updateExportJobCompleted or insertExportJobItem when claim fails', async () => {
      mockClaimExportJob.mockResolvedValueOnce({ claimed: false, row: null })

      await runExportJob(50)

      expect(mockInsertExportJobItem).not.toHaveBeenCalled()
      expect(mockUpdateExportJobCompleted).not.toHaveBeenCalled()
      expect(mockUpdateExportJobFailed).not.toHaveBeenCalled()
    })
  })
})
