// tests/services/sheetInstrumentSnapshotsService.test.ts
import {
  buildSnapshotPayload,
  parseAndValidateSnapshot,
  SHEET_INSTRUMENT_SNAPSHOT_VERSION,
} from '../../src/backend/services/sheetInstrumentSnapshotsService'

const mockListLinkedToSheet = jest.fn()

jest.mock('../../src/backend/repositories/instrumentsRepository', () => ({
  listLinkedToSheet: (...args: unknown[]) => mockListLinkedToSheet(...args),
}))

describe('sheetInstrumentSnapshotsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SHEET_INSTRUMENT_SNAPSHOT_VERSION', () => {
    it('is 1', () => {
      expect(SHEET_INSTRUMENT_SNAPSHOT_VERSION).toBe(1)
    })
  })

  describe('parseAndValidateSnapshot', () => {
    it('returns null for wrong version', () => {
      expect(parseAndValidateSnapshot('[]', 0)).toBeNull()
      expect(parseAndValidateSnapshot('[]', 2)).toBeNull()
    })

    it('returns null for null/undefined payload', () => {
      expect(parseAndValidateSnapshot(null, 1)).toBeNull()
      expect(parseAndValidateSnapshot(undefined, 1)).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(parseAndValidateSnapshot('not json', 1)).toBeNull()
      expect(parseAndValidateSnapshot('{', 1)).toBeNull()
    })

    it('returns null for non-array', () => {
      expect(parseAndValidateSnapshot('{}', 1)).toBeNull()
      expect(parseAndValidateSnapshot('"x"', 1)).toBeNull()
    })

    it('returns null for item missing instrumentId or instrumentTag', () => {
      expect(parseAndValidateSnapshot('[{}]', 1)).toBeNull()
      expect(parseAndValidateSnapshot('[{"instrumentTag":"x"}]', 1)).toBeNull()
      expect(parseAndValidateSnapshot('[{"instrumentId":1}]', 1)).toBeNull()
    })

    it('returns valid array for correct payload', () => {
      const payload = JSON.stringify([
        {
          instrumentId: 10,
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
          instrumentType: 'Pressure',
          linkRole: null,
          loopTags: ['LC-101'],
        },
      ])
      const out = parseAndValidateSnapshot(payload, 1)
      expect(out).not.toBeNull()
      expect(out).toHaveLength(1)
      expect(out![0]).toEqual({
        instrumentId: 10,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: 'Pressure',
        linkRole: null,
        loopTags: ['LC-101'],
      })
    })

    it('returns null for invalid instrumentId type', () => {
      const payload = JSON.stringify([
        { instrumentId: 'not-a-number', instrumentTag: 'x', loopTags: [] },
      ])
      expect(parseAndValidateSnapshot(payload, 1)).toBeNull()
    })
  })

  describe('buildSnapshotPayload', () => {
    it('calls listLinkedToSheet and returns result', async () => {
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
      mockListLinkedToSheet.mockResolvedValue(rows)

      const result = await buildSnapshotPayload(1, 5)

      expect(mockListLinkedToSheet).toHaveBeenCalledWith(1, 5)
      expect(result).toEqual(rows)
    })
  })
})
