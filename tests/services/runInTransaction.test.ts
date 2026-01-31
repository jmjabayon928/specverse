/**
 * Tests for runInTransaction safety: no ENOTBEGUN on begin failure,
 * safe rollback on callback/commit failure, original error preserved.
 */
const mockBegin = jest.fn()
const mockCommit = jest.fn()
const mockRollback = jest.fn()
const mockRequest = jest.fn().mockReturnValue({
  input: jest.fn().mockReturnThis(),
  query: jest.fn().mockResolvedValue({ recordset: [] }),
})

jest.mock('../../src/backend/config/db', () => ({
  poolPromise: Promise.resolve({}),
  sql: {
    Transaction: jest.fn().mockImplementation(() => ({
      begin: mockBegin,
      commit: mockCommit,
      rollback: mockRollback,
      request: mockRequest,
    })),
  },
}))

import { runInTransaction } from '../../src/backend/services/filledSheetService'

beforeEach(() => {
  mockBegin.mockReset()
  mockCommit.mockReset()
  mockRollback.mockReset()
  mockBegin.mockResolvedValue(undefined)
  mockCommit.mockResolvedValue(undefined)
  mockRollback.mockResolvedValue(undefined)
})

describe('runInTransaction', () => {
  it('rejects with begin error when begin() throws and does NOT call rollback (no ENOTBEGUN)', async () => {
    const beginError = new Error('begin failed')
    mockBegin.mockRejectedValueOnce(beginError)
    mockRollback.mockRejectedValue(new Error('ENOTBEGUN'))

    await expect(runInTransaction(async () => 42)).rejects.toThrow('begin failed')
    expect(mockRollback).not.toHaveBeenCalled()
  })

  it('attempts rollback when callback throws and preserves original error', async () => {
    const callbackError = new Error('callback failed')
    mockBegin.mockResolvedValue(undefined)
    mockRollback.mockResolvedValue(undefined)

    await expect(
      runInTransaction(async () => {
        throw callbackError
      })
    ).rejects.toThrow('callback failed')
    expect(mockRollback).toHaveBeenCalled()
    expect(mockCommit).not.toHaveBeenCalled()
  })

  it('when commit() throws, rollback is attempted and original commit error is preserved', async () => {
    const commitError = new Error('commit failed')
    mockBegin.mockResolvedValue(undefined)
    mockCommit.mockRejectedValueOnce(commitError)
    mockRollback.mockResolvedValue(undefined)

    await expect(runInTransaction(async () => 'ok')).rejects.toThrow('commit failed')
    expect(mockRollback).toHaveBeenCalled()
  })

  it('when commit() throws and rollback fails, original commit error is still rethrown', async () => {
    const commitError = new Error('commit failed')
    mockBegin.mockResolvedValue(undefined)
    mockCommit.mockRejectedValueOnce(commitError)
    mockRollback.mockRejectedValueOnce(new Error('rollback failed'))

    await expect(runInTransaction(async () => 'ok')).rejects.toThrow('commit failed')
    expect(mockRollback).toHaveBeenCalled()
  })
})
