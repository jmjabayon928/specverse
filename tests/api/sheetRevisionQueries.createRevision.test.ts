// tests/api/sheetRevisionQueries.createRevision.test.ts
// 4C: Backend guard — createRevision must reject invalid snapshotJson (UnifiedSheet validation).

const mockRequest = jest.fn()
const mockTx = {
  request: () => ({
    input: jest.fn().mockReturnThis(),
    query: mockRequest,
  }),
}

jest.mock('../../src/backend/config/db', () => ({
  poolPromise: Promise.resolve({}),
  sql: {
    Int: 1,
    NVarChar: (_n: number) => 0,
    DateTime2: (_scale?: number) => 0,
    Transaction: jest.fn(),
  },
}))

import { createRevision } from '../../src/backend/database/sheetRevisionQueries'

describe('createRevision snapshot validation (4C)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws and does not execute INSERT when snapshotJson is not valid UnifiedSheet', async () => {
    const invalidInput = {
      sheetId: 1,
      snapshotJson: '{}',
      createdById: 1,
      createdByDate: new Date(),
      status: null as string | null,
      notes: null as string | null,
    }

    await expect(
      createRevision(mockTx as unknown as Parameters<typeof createRevision>[0], invalidInput)
    ).rejects.toThrow('Invalid revision snapshot: snapshotJson is not a UnifiedSheet')

    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('throws when snapshotJson is not valid JSON', async () => {
    const invalidInput = {
      sheetId: 1,
      snapshotJson: 'not json',
      createdById: 1,
      createdByDate: new Date(),
      status: null as string | null,
      notes: null as string | null,
    }

    await expect(
      createRevision(mockTx as unknown as Parameters<typeof createRevision>[0], invalidInput)
    ).rejects.toThrow('Invalid revision snapshot: snapshotJson is not a UnifiedSheet')

    expect(mockRequest).not.toHaveBeenCalled()
  })
})
