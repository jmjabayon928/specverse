/**
 * Targeted tests for export job service: deterministic ZIP and ExportJobItems.
 * Mocks DB and file system; asserts FileName ends .zip and item insert with normalized path.
 */

const mockClaimExportJob = jest.fn()
const mockClaimNextExportJob = jest.fn()
const mockInsertExportJobItem = jest.fn()
const mockUpdateExportJobCompleted = jest.fn()
const mockUpdateExportJobFailed = jest.fn()
const mockGetInventoryTransactionsForCsv = jest.fn()
const mockGetExportJobItemsForJob = jest.fn()

jest.mock('../../src/backend/database/exportJobQueries', () => ({
  insertExportJob: jest.fn(),
  getExportJobById: jest.fn(),
  claimExportJob: (...args: unknown[]) => mockClaimExportJob(...args),
  claimNextExportJob: (...args: unknown[]) => mockClaimNextExportJob(...args),
  heartbeatExportJob: jest.fn(),
  updateExportJobCompleted: (...args: unknown[]) => mockUpdateExportJobCompleted(...args),
  updateExportJobFailed: (...args: unknown[]) => mockUpdateExportJobFailed(...args),
  updateExportJobCancelled: jest.fn(),
  updateExportJobResetForRetry: jest.fn(),
  listExportJobsForCleanup: jest.fn(),
  getExportJobItemsForJob: (...args: unknown[]) => mockGetExportJobItemsForJob(...args),
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

const mockGetAssetById = jest.fn()
const mockListChecklistRunsByAssetId = jest.fn()
const mockFetchAssetDocuments = jest.fn()
const mockFetchFilledSheetsForAsset = jest.fn()
const mockGetAccountContextForUser = jest.fn()

jest.mock('../../src/backend/services/assetsService', () => ({
  getAssetById: (...args: unknown[]) => mockGetAssetById(...args),
}))

jest.mock('../../src/backend/services/checklistsService', () => ({
  listChecklistRunsByAssetId: (...args: unknown[]) => mockListChecklistRunsByAssetId(...args),
}))

jest.mock('../../src/backend/services/assetDocumentsService', () => ({
  fetchAssetDocuments: (...args: unknown[]) => mockFetchAssetDocuments(...args),
}))

jest.mock('../../src/backend/services/filledSheetService', () => ({
  fetchFilledSheetsForAsset: (...args: unknown[]) => mockFetchFilledSheetsForAsset(...args),
}))

jest.mock('../../src/backend/database/accountContextQueries', () => ({
  getAccountContextForUser: (...args: unknown[]) => mockGetAccountContextForUser(...args),
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

const mockExistsSync = jest.fn()
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
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}))

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}))

import {
  runExportJob,
  runClaimedExportJob,
  startExportJobRunner,
} from '../../src/backend/services/exportJobService'

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
  MaxAttempts: 3,
}

describe('exportJobService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    streamCloseCallback = null
    finalizeCalled = false
    mockExistsSync.mockReturnValue(false)
    mockGetExportJobItemsForJob.mockResolvedValue([])
    mockGetInventoryTransactionsForCsv.mockResolvedValue([])
    mockClaimExportJob.mockResolvedValue({
      claimed: true,
      row: stubClaimedRow,
    })
    mockGetAccountContextForUser.mockResolvedValue({ accountId: 1 })
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

    it('runClaimedExportJob still produces .zip and inserts ExportJobItems with normalized path', async () => {
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

      await runClaimedExportJob(stubClaimedRow, 'lease-123')

      expect(mockInsertExportJobItem).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 50,
          relativePath: 'inventory_transactions/transactions.csv',
          sourceType: 'inventory_transactions_csv',
        })
      )
      expect(mockUpdateExportJobCompleted).toHaveBeenCalledTimes(1)
      expect(mockUpdateExportJobCompleted.mock.calls[0][1]).toMatch(/\.zip$/)
    })

    it('runClaimedExportJob completes without regenerating when zip already exists', async () => {
      mockExistsSync.mockReturnValue(true)
      mockGetExportJobItemsForJob.mockResolvedValue([])
      const rowWithExistingFile = {
        ...stubClaimedRow,
        Status: 'running',
        LeaseId: 'lease-456',
        FileName: 'export-50.zip',
        FilePath: 'jobs/export-50.zip',
      }

      await runClaimedExportJob(rowWithExistingFile, 'lease-456')

      expect(mockUpdateExportJobCompleted).toHaveBeenCalledTimes(1)
      expect(mockUpdateExportJobCompleted).toHaveBeenCalledWith(50, 'export-50.zip', 'jobs/export-50.zip', 'lease-456')
      expect(mockGetInventoryTransactionsForCsv).not.toHaveBeenCalled()
      expect(mockAppend).not.toHaveBeenCalled()
      expect(mockFinalize).not.toHaveBeenCalled()
      expect(mockInsertExportJobItem).toHaveBeenCalledTimes(1)
      expect(mockInsertExportJobItem).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 50,
          relativePath: 'inventory_transactions/transactions.csv',
          sourceType: 'inventory_transactions_csv',
        })
      )
    })
  })

  describe('runner', () => {
    it('calls claimNextExportJob when poll fires and runs job when claimed', async () => {
      jest.useFakeTimers()
      mockClaimNextExportJob.mockResolvedValue({ claimed: true, row: { ...stubClaimedRow, Id: 51 } })
      mockGetInventoryTransactionsForCsv.mockResolvedValue([])

      startExportJobRunner({
        enabled: true,
        workerId: 'runner-1',
        pollIntervalMs: 5000,
        leaseTtlMs: 300000,
        heartbeatMs: 60000,
        globalConcurrency: 2,
        perAccountLimit: 1,
      })

      expect(mockClaimNextExportJob).not.toHaveBeenCalled()
      jest.advanceTimersByTime(5000)
      await Promise.resolve()
      await Promise.resolve()
      expect(mockClaimNextExportJob).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Date),
        expect.any(Date),
        1
      )
      jest.useRealTimers()
    })
  })

  describe('handover_binder', () => {
    const stubBinderRow = {
      ...stubClaimedRow,
      JobType: 'handover_binder',
      ParamsJson: JSON.stringify({ assetId: 100 }),
      AccountID: 1,
    }

    beforeEach(() => {
      mockGetAssetById.mockResolvedValue({
        assetId: 100,
        assetTag: 'ASSET-001',
        assetName: 'Test Asset',
        location: 'Location A',
        system: 'System A',
        service: 'Service A',
        criticality: 'HIGH',
        disciplineId: 1,
        subtypeId: 1,
        clientId: 1,
        projectId: 1,
        facilityId: 1,
        facilityName: 'Facility A',
        systemId: 1,
        systemName: 'System A',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      })
      mockListChecklistRunsByAssetId.mockResolvedValue({
        items: [
          {
            checklistRunId: 1,
            runName: 'Run 1',
            status: 'COMPLETED',
            createdAt: '2024-01-01T00:00:00Z',
            checklistTemplateId: 1,
            totalEntries: 10,
            completedEntries: 10,
            completionPercentage: 100,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      })
      mockFetchAssetDocuments.mockResolvedValue({
        items: [
          {
            attachmentId: 1,
            filename: 'doc1.pdf',
            contentType: 'application/pdf',
            filesize: 1024,
            uploadedAt: '2024-01-01T00:00:00Z',
            uploadedBy: 1,
          },
        ],
        total: 1,
      })
      mockFetchFilledSheetsForAsset.mockResolvedValue({
        items: [
          {
            sheetId: 1,
            sheetName: 'Sheet 1',
            equipmentTagNum: 'TAG-001',
            status: 'APPROVED',
            revisionDate: '2024-01-01',
          },
        ],
        total: 1,
      })
    })

    it('creates ZIP with correct structure and inserts ExportJobItems', async () => {
      const rowWithCorrectId = {
        ...stubBinderRow,
        Id: 51,
      }
      mockClaimExportJob.mockResolvedValueOnce({
        claimed: true,
        row: rowWithCorrectId,
      })

      await runExportJob(51)

      expect(mockGetAssetById).toHaveBeenCalledWith(1, 100)
      expect(mockListChecklistRunsByAssetId).toHaveBeenCalled()
      expect(mockFetchAssetDocuments).toHaveBeenCalled()
      expect(mockFetchFilledSheetsForAsset).toHaveBeenCalled()

      // Check that manifest and all sections were added (order may vary)
      const appendCalls = mockAppend.mock.calls
      const fileNames = appendCalls.map((call) => call[1]?.name)
      expect(fileNames).toContain('manifest.json')
      expect(fileNames).toContain('asset-summary.json')
      expect(fileNames).toContain('checklists/index.json')
      expect(fileNames).toContain('documents/index.json')
      expect(fileNames).toContain('datasheets/index.json')
      
      // Verify manifest contains expected fields (JSON.stringify adds spaces)
      const manifestCall = appendCalls.find((call) => call[1]?.name === 'manifest.json')
      expect(manifestCall).toBeDefined()
      expect(manifestCall![0]).toMatch(/"exportType"\s*:\s*"handover_binder"/)
      expect(manifestCall![0]).toMatch(/"assetId"\s*:\s*100/)

      // Check ExportJobItems were inserted (should be 5: manifest + 4 sections)
      expect(mockInsertExportJobItem.mock.calls.length).toBeGreaterThanOrEqual(5)
      const manifestItemCall = mockInsertExportJobItem.mock.calls.find(
        (call) => call[0]?.relativePath === 'manifest.json'
      )
      expect(manifestItemCall).toBeDefined()
      expect(manifestItemCall![0]).toMatchObject({
        jobId: 51,
        relativePath: 'manifest.json',
        sourceType: 'handover_binder',
        sourceId: 100,
      })

      expect(mockUpdateExportJobCompleted).toHaveBeenCalled()
      const completedCall = mockUpdateExportJobCompleted.mock.calls.find(
        (call) => call[1]?.match(/^handover-binder-51\.zip$/)
      )
      expect(completedCall).toBeDefined()
      expect(completedCall![1]).toMatch(/^handover-binder-51\.zip$/)
    })

    it('fails when assetId is missing', async () => {
      const rowWithoutAssetId = {
        ...stubBinderRow,
        Id: 52,
        ParamsJson: JSON.stringify({}),
      }
      mockClaimExportJob.mockResolvedValueOnce({
        claimed: true,
        row: rowWithoutAssetId,
      })

      await runExportJob(52)

      expect(mockUpdateExportJobFailed).toHaveBeenCalledWith(
        52,
        'Missing or invalid assetId parameter (must be positive integer)',
        expect.any(String),
        expect.any(Number)
      )
      expect(mockGetAssetById).not.toHaveBeenCalled()
    })

    it('queries accountId from user when AccountID not in row', async () => {
      const rowWithoutAccountId = {
        ...stubBinderRow,
        AccountID: null,
      }
      mockClaimExportJob.mockResolvedValueOnce({
        claimed: true,
        row: rowWithoutAccountId,
      })

      await runExportJob(53)

      expect(mockGetAccountContextForUser).toHaveBeenCalledWith(stubBinderRow.CreatedBy)
      expect(mockGetAssetById).toHaveBeenCalled()
    })
  })
})
