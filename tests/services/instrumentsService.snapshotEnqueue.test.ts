// tests/services/instrumentsService.snapshotEnqueue.test.ts
import {
  linkInstrumentToSheet,
  unlinkInstrumentFromSheet,
  updateInstrument,
} from '../../src/backend/services/instrumentsService'

const mockSheetBelongsToAccount = jest.fn()
const mockGetById = jest.fn()
const mockLinkExists = jest.fn()
const mockLinkToSheet = jest.fn()
const mockUnlinkFromSheet = jest.fn()
const mockUpdate = jest.fn()
const mockEnqueueSnapshotRebuild = jest.fn()
const mockListSheetIdsLinkedToInstrument = jest.fn()
const mockKickSheetInstrumentSnapshotWorker = jest.fn()

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: (...args: unknown[]) => mockSheetBelongsToAccount(...args),
}))

jest.mock('../../src/backend/repositories/instrumentsRepository', () => ({
  getById: (...args: unknown[]) => mockGetById(...args),
  linkExists: (...args: unknown[]) => mockLinkExists(...args),
  linkToSheet: (...args: unknown[]) => mockLinkToSheet(...args),
  unlinkFromSheet: (...args: unknown[]) => mockUnlinkFromSheet(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  listByAccount: jest.fn(),
  listLinkedToSheet: jest.fn(),
  listActiveTagRulesByAccount: jest.fn(),
}))

jest.mock('../../src/backend/repositories/sheetInstrumentSnapshotsRepository', () => ({
  getSnapshot: jest.fn(),
  enqueueSnapshotRebuild: (...args: unknown[]) =>
    Promise.resolve(mockEnqueueSnapshotRebuild(...args)),
  listSheetIdsLinkedToInstrument: (...args: unknown[]) =>
    mockListSheetIdsLinkedToInstrument(...args),
}))

jest.mock('../../src/backend/workers/sheetInstrumentSnapshotWorker', () => ({
  kickSheetInstrumentSnapshotWorker: () => mockKickSheetInstrumentSnapshotWorker(),
}))

describe('InstrumentsService snapshot enqueue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSheetBelongsToAccount.mockResolvedValue(true)
    mockGetById.mockResolvedValue({
      instrumentId: 10,
      accountId: 1,
      instrumentTag: 'PT-101',
      instrumentTagNorm: 'PT-101',
      instrumentType: 'Pressure',
    })
    mockLinkExists.mockResolvedValue(false)
    mockLinkToSheet.mockResolvedValue(undefined)
    mockUnlinkFromSheet.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({
      instrumentId: 10,
      accountId: 1,
      instrumentTag: 'PT-101',
      instrumentTagNorm: 'PT-101',
      instrumentType: 'Pressure',
    })
  })

  it('enqueues and kicks worker after linkInstrumentToSheet', async () => {
    await linkInstrumentToSheet(1, 5, 10, null, 1)

    expect(mockLinkToSheet).toHaveBeenCalledWith(1, 10, 5, null, 1)
    expect(mockEnqueueSnapshotRebuild).toHaveBeenCalledWith(1, 5, 'link')
    expect(mockKickSheetInstrumentSnapshotWorker).toHaveBeenCalledTimes(1)
  })

  it('enqueues and kicks worker after unlinkInstrumentFromSheet', async () => {
    await unlinkInstrumentFromSheet(1, 5, 10)

    expect(mockUnlinkFromSheet).toHaveBeenCalledWith(1, 10, 5, undefined)
    expect(mockEnqueueSnapshotRebuild).toHaveBeenCalledWith(1, 5, 'unlink')
    expect(mockKickSheetInstrumentSnapshotWorker).toHaveBeenCalledTimes(1)
  })

  it('enqueues each linked sheet and kicks worker once after updateInstrument', async () => {
    mockListSheetIdsLinkedToInstrument.mockResolvedValue([5, 7])

    await updateInstrument(1, 10, { instrumentType: 'Temperature' })

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockListSheetIdsLinkedToInstrument).toHaveBeenCalledWith(1, 10)
    expect(mockEnqueueSnapshotRebuild).toHaveBeenCalledWith(1, 5, 'instrument_update')
    expect(mockEnqueueSnapshotRebuild).toHaveBeenCalledWith(1, 7, 'instrument_update')
    expect(mockKickSheetInstrumentSnapshotWorker).toHaveBeenCalledTimes(1)
  })

  it('does not kick worker when no sheets linked on updateInstrument', async () => {
    mockListSheetIdsLinkedToInstrument.mockResolvedValue([])

    await updateInstrument(1, 10, { instrumentType: 'Temperature' })

    expect(mockEnqueueSnapshotRebuild).not.toHaveBeenCalled()
    expect(mockKickSheetInstrumentSnapshotWorker).not.toHaveBeenCalled()
  })
})
