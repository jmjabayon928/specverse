// tests/services/sheetInstrumentSnapshotWorker.test.ts
import {
  processQueueOnce,
  drainQueue,
  kickSheetInstrumentSnapshotWorker,
  normalizeErrorForLog,
} from '../../src/backend/workers/sheetInstrumentSnapshotWorker'

const mockDequeueOneClaimed = jest.fn()
const mockDequeueManyClaimed = jest.fn()
const mockBuildSnapshotPayload = jest.fn()
const mockUpsertSnapshot = jest.fn()
const mockDeleteQueueRow = jest.fn()
const mockUpsertSnapshotError = jest.fn()
const mockReleaseQueueClaim = jest.fn()

jest.mock('../../src/backend/repositories/sheetInstrumentSnapshotsRepository', () => ({
  dequeueOneClaimed: (...args: unknown[]) => mockDequeueOneClaimed(...args),
  dequeueManyClaimed: (...args: unknown[]) => mockDequeueManyClaimed(...args),
  upsertSnapshot: (...args: unknown[]) => mockUpsertSnapshot(...args),
  deleteQueueRow: (...args: unknown[]) => mockDeleteQueueRow(...args),
  upsertSnapshotError: (...args: unknown[]) => mockUpsertSnapshotError(...args),
  releaseQueueClaim: (...args: unknown[]) => mockReleaseQueueClaim(...args),
}))

jest.mock('../../src/backend/services/sheetInstrumentSnapshotsService', () => ({
  buildSnapshotPayload: (...args: unknown[]) => mockBuildSnapshotPayload(...args),
}))

describe('sheetInstrumentSnapshotWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('processQueueOnce', () => {
    it('returns false when no row claimed', async () => {
      mockDequeueOneClaimed.mockResolvedValue(null)

      const result = await processQueueOnce()

      expect(result).toBe(false)
      expect(mockBuildSnapshotPayload).not.toHaveBeenCalled()
    })

    it('builds snapshot, upserts, deletes queue row on success', async () => {
      mockDequeueOneClaimed.mockResolvedValue({
        accountId: 1,
        sheetId: 5,
        attempts: 1,
      })
      const rows = [
        {
          instrumentId: 10,
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
          instrumentType: 'Pressure',
          linkRole: null,
          loopTags: ['LC-101'],
        },
      ]
      mockBuildSnapshotPayload.mockResolvedValue(rows)

      const result = await processQueueOnce()

      expect(result).toBe(true)
      expect(mockBuildSnapshotPayload).toHaveBeenCalledWith(1, 5)
      expect(mockUpsertSnapshot).toHaveBeenCalledWith(
        1,
        5,
        JSON.stringify(rows),
        expect.objectContaining({ instrumentCount: 1 })
      )
      expect(mockDeleteQueueRow).toHaveBeenCalledWith(1, 5)
      expect(mockUpsertSnapshotError).not.toHaveBeenCalled()
      expect(mockReleaseQueueClaim).not.toHaveBeenCalled()
    })

    it('on build failure with attempts < 3: writes error and releases claim', async () => {
      mockDequeueOneClaimed.mockResolvedValue({
        accountId: 1,
        sheetId: 5,
        attempts: 2,
      })
      mockBuildSnapshotPayload.mockRejectedValue(new Error('Build failed'))

      const result = await processQueueOnce()

      expect(result).toBe(true)
      expect(mockUpsertSnapshotError).toHaveBeenCalledWith(1, 5, 'Build failed')
      expect(mockReleaseQueueClaim).toHaveBeenCalledWith(1, 5, 'in-process-snapshot-v1')
      expect(mockDeleteQueueRow).not.toHaveBeenCalled()
    })

    it('on build failure with attempts >= 3: writes error and deletes queue row', async () => {
      mockDequeueOneClaimed.mockResolvedValue({
        accountId: 1,
        sheetId: 5,
        attempts: 3,
      })
      mockBuildSnapshotPayload.mockRejectedValue(new Error('Build failed'))

      const result = await processQueueOnce()

      expect(result).toBe(true)
      expect(mockUpsertSnapshotError).toHaveBeenCalledWith(1, 5, 'Build failed')
      expect(mockDeleteQueueRow).toHaveBeenCalledWith(1, 5)
      expect(mockReleaseQueueClaim).not.toHaveBeenCalled()
    })

    it('normalizes error message for LastError (strip newlines, collapse whitespace)', async () => {
      mockDequeueOneClaimed.mockResolvedValue({
        accountId: 1,
        sheetId: 5,
        attempts: 1,
      })
      mockBuildSnapshotPayload.mockRejectedValue(new Error('line1\n\nline2  line3'))

      await processQueueOnce()

      expect(mockUpsertSnapshotError).toHaveBeenCalledWith(1, 5, 'line1 line2 line3')
    })
  })

  describe('payload size cap', () => {
    it('when payload exceeds cap: does not upsert, calls upsertSnapshotError and applies attempts logic', async () => {
      const huge = 'x'.repeat(1_500_000)
      mockDequeueOneClaimed.mockResolvedValue({
        accountId: 1,
        sheetId: 5,
        attempts: 1,
      })
      mockBuildSnapshotPayload.mockResolvedValue([
        {
          instrumentId: 1,
          instrumentTag: 'a',
          instrumentTagNorm: 'a',
          instrumentType: null,
          linkRole: null,
          loopTags: [huge],
        },
      ])

      await processQueueOnce()

      expect(mockUpsertSnapshot).not.toHaveBeenCalled()
      expect(mockUpsertSnapshotError).toHaveBeenCalledWith(
        1,
        5,
        expect.stringMatching(/^Snapshot payload too large: \d+ bytes$/)
      )
      expect(mockReleaseQueueClaim).toHaveBeenCalledWith(1, 5, 'in-process-snapshot-v1')
      expect(mockDeleteQueueRow).not.toHaveBeenCalled()
    })

    it('when payload exceeds cap and attempts >= 3: deletes queue row', async () => {
      const huge = 'x'.repeat(1_500_000)
      mockDequeueOneClaimed.mockResolvedValue({
        accountId: 1,
        sheetId: 5,
        attempts: 3,
      })
      mockBuildSnapshotPayload.mockResolvedValue([
        {
          instrumentId: 1,
          instrumentTag: 'a',
          instrumentTagNorm: 'a',
          instrumentType: null,
          linkRole: null,
          loopTags: [huge],
        },
      ])

      await processQueueOnce()

      expect(mockUpsertSnapshot).not.toHaveBeenCalled()
      expect(mockUpsertSnapshotError).toHaveBeenCalledWith(
        1,
        5,
        expect.stringMatching(/^Snapshot payload too large: \d+ bytes$/)
      )
      expect(mockDeleteQueueRow).toHaveBeenCalledWith(1, 5)
      expect(mockReleaseQueueClaim).not.toHaveBeenCalled()
    })
  })

  describe('normalizeErrorForLog', () => {
    it('strips newlines and collapses whitespace', () => {
      expect(normalizeErrorForLog(new Error('a\n\nb  c'))).toBe('a b c')
    })

    it('truncates to 500 chars', () => {
      const long = 'x'.repeat(600)
      const result = normalizeErrorForLog(new Error(long))
      expect(result.length).toBe(500)
      expect(result.endsWith('...')).toBe(true)
    })

    it('handles non-Error values', () => {
      expect(normalizeErrorForLog('string error')).toBe('string error')
    })
  })

  describe('drainQueue', () => {
    it('calls dequeueManyClaimed with WORKER_ID and maxItems', async () => {
      mockDequeueManyClaimed.mockResolvedValue([])

      await drainQueue(5)

      expect(mockDequeueManyClaimed).toHaveBeenCalledWith('in-process-snapshot-v1', 5)
    })

    it('returns 0 when no rows claimed', async () => {
      mockDequeueManyClaimed.mockResolvedValue([])

      const count = await drainQueue(5)

      expect(count).toBe(0)
      expect(mockBuildSnapshotPayload).not.toHaveBeenCalled()
    })

    it('processes multiple claimed rows sequentially', async () => {
      mockDequeueManyClaimed.mockResolvedValue([
        { accountId: 1, sheetId: 5, attempts: 1 },
        { accountId: 1, sheetId: 7, attempts: 1 },
      ])
      mockBuildSnapshotPayload.mockResolvedValue([])

      const count = await drainQueue(5)

      expect(count).toBe(2)
      expect(mockBuildSnapshotPayload).toHaveBeenCalledWith(1, 5)
      expect(mockBuildSnapshotPayload).toHaveBeenCalledWith(1, 7)
      expect(mockUpsertSnapshot).toHaveBeenCalledTimes(2)
      expect(mockDeleteQueueRow).toHaveBeenCalledWith(1, 5)
      expect(mockDeleteQueueRow).toHaveBeenCalledWith(1, 7)
    })
  })

  describe('TTL stale-claim recovery', () => {
    it('selection predicate includes stale claim TTL condition', () => {
      const repo = jest.requireActual<typeof import('../../src/backend/repositories/sheetInstrumentSnapshotsRepository')>(
        '../../src/backend/repositories/sheetInstrumentSnapshotsRepository'
      )
      expect(repo.CLAIMABLE_ROW_WHERE).toContain('DATEADD(minute, -5')
      expect(repo.CLAIMABLE_ROW_WHERE).toContain('ClaimedAt IS NULL')
    })
  })

  describe('kickSheetInstrumentSnapshotWorker', () => {
    it('schedules drain via setImmediate', async () => {
      mockDequeueManyClaimed.mockResolvedValue([])

      kickSheetInstrumentSnapshotWorker()
      expect(mockDequeueManyClaimed).not.toHaveBeenCalled()

      await jest.runAllTimersAsync()
      expect(mockDequeueManyClaimed).toHaveBeenCalledWith('in-process-snapshot-v1', 5)
    })
  })

  describe('debug logging (SNAPSHOT_DEBUG)', () => {
    const snapshotWorkerLogPrefix = '[snapshot-worker]'

    it('when SNAPSHOT_DEBUG=1, console.log is called at least once during drainQueue success path', async () => {
      const prev = process.env.SNAPSHOT_DEBUG
      process.env.SNAPSHOT_DEBUG = '1'
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      mockDequeueManyClaimed.mockResolvedValue([
        { accountId: 1, sheetId: 5, attempts: 1 },
      ])
      mockBuildSnapshotPayload.mockResolvedValue([])

      await drainQueue(5)

      const snapshotLogs = logSpy.mock.calls.filter(
        (c) => c.length > 0 && String(c[0]).includes(snapshotWorkerLogPrefix)
      )
      expect(snapshotLogs.length).toBeGreaterThanOrEqual(1)

      logSpy.mockRestore()
      process.env.SNAPSHOT_DEBUG = prev
    })

    it('when SNAPSHOT_DEBUG is not set, no snapshot-worker logs occur', async () => {
      const prev = process.env.SNAPSHOT_DEBUG
      delete process.env.SNAPSHOT_DEBUG
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      mockDequeueManyClaimed.mockResolvedValue([
        { accountId: 1, sheetId: 5, attempts: 1 },
      ])
      mockBuildSnapshotPayload.mockResolvedValue([])

      await drainQueue(5)

      const snapshotLogs = logSpy.mock.calls.filter(
        (c) => c.length > 0 && String(c[0]).includes(snapshotWorkerLogPrefix)
      )
      expect(snapshotLogs).toHaveLength(0)

      logSpy.mockRestore()
      process.env.SNAPSHOT_DEBUG = prev
    })
  })
})
