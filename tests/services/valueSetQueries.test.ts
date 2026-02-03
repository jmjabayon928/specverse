// tests/services/valueSetQueries.test.ts
// Unit tests for Phase 2 value-set queries: ensureRequirementValueSet creates one and reuses.

import {
  getContextIdByCode,
  getValueSetId,
  ensureRequirementValueSet,
  ensureRequirementValueSetInTransaction,
  createOfferedValueSet,
  getRequirementValueRows,
} from '../../src/backend/database/valueSetQueries'

let mockRequest: { input: jest.Mock; query: jest.Mock }
let mockTransaction: { request: jest.Mock }

jest.mock('../../src/backend/config/db', () => {
  const req = { input: jest.fn().mockReturnThis(), query: jest.fn() }
  const tx = { request: jest.fn(() => req) }
  return {
    poolPromise: Promise.resolve({ request: () => req }),
    sql: { Int: 1, NVarChar: (n: number) => n, VarChar: (n: number) => n, MAX: 2147483647 },
    __mockRequest: req,
    __mockTransaction: tx,
  }
})

describe('valueSetQueries', () => {
  beforeAll(() => {
    const db = require('../../src/backend/config/db') as {
      __mockRequest: { input: jest.Mock; query: jest.Mock }
      __mockTransaction: { request: jest.Mock }
    }
    mockRequest = db.__mockRequest
    mockTransaction = db.__mockTransaction
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequest.input.mockReturnThis()
    mockRequest.query.mockReset()
    mockRequest.query.mockResolvedValue({ recordset: [], rowsAffected: [0] } as { recordset: unknown[]; rowsAffected: number[] })
  })

  describe('getContextIdByCode', () => {
    it('returns ContextID for Requirement', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
      const id = await getContextIdByCode('Requirement')
      expect(id).toBe(1)
    })

    it('returns null when code not found', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [] })
      const id = await getContextIdByCode('Offered')
      expect(id).toBeNull()
    })
  })

  describe('getValueSetId', () => {
    it('returns ValueSetID when set exists', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
      mockRequest.query.mockResolvedValueOnce({ recordset: [{ ValueSetID: 10 }] })
      const id = await getValueSetId(42, 'Requirement', null)
      expect(id).toBe(10)
    })

    it('returns null when set does not exist', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
      mockRequest.query.mockResolvedValueOnce({ recordset: [] })
      const id = await getValueSetId(42, 'Requirement', null)
      expect(id).toBeNull()
    })
  })

  describe('ensureRequirementValueSet', () => {
    it('creates one set when none exists and reuses on second call', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ ValueSetID: 100 }] })
        .mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ ValueSetID: 100 }] })

      const id1 = await ensureRequirementValueSet(42, 1)
      expect(id1).toBe(100)

      const id2 = await ensureRequirementValueSet(42, 1)
      expect(id2).toBe(100)

      const insertCalls = mockRequest.query.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && String(call[0]).includes('INSERT')
      )
      expect(insertCalls.length).toBe(1)
    })

    it('returns existing ValueSetID without inserting when set already exists', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ ValueSetID: 99 }] })

      const id = await ensureRequirementValueSet(42, 1)
      expect(id).toBe(99)
      const insertCalls = mockRequest.query.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && String(call[0]).includes('INSERT')
      )
      expect(insertCalls.length).toBe(0)
    })
  })

  describe('createOfferedValueSet', () => {
    it('returns existing Offered ValueSet id when set already exists; runs set-based prefill once (no per-row INSERT)', async () => {
      mockRequest.query.mockImplementation((sqlText: string) => {
        if (sqlText.includes('ValueContexts') && sqlText.includes('Code')) {
          return Promise.resolve({ recordset: [{ ContextID: sqlText.includes('Offered') ? 2 : 1 }] })
        }
        if (sqlText.includes('InformationValueSets') && sqlText.includes('SELECT ValueSetID')) {
          return Promise.resolve({ recordset: sqlText.includes('PartyID') ? [{ ValueSetID: 99 }] : [{ ValueSetID: 1 }] })
        }
        if (sqlText.includes('INSERT INTO dbo.InformationValues')) {
          return Promise.resolve({ recordset: [], rowsAffected: [0] })
        }
        return Promise.resolve({ recordset: [], rowsAffected: [0] })
      })

      const id = await createOfferedValueSet(1, 99, 1)
      expect(id).toBe(99)

      const insertInfoValuesCalls = mockRequest.query.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === 'string' && String(call[0]).includes('INSERT INTO dbo.InformationValues')
      )
      expect(insertInfoValuesCalls.length).toBe(1)
      expect(insertInfoValuesCalls[0][0]).toContain('NOT EXISTS')
    })

    it('does not throw when called twice; second call returns same id', async () => {
      let offeredExists = false
      mockRequest.query.mockImplementation((sqlText: string) => {
        if (sqlText.includes('ValueContexts') && sqlText.includes('Code')) {
          return Promise.resolve({ recordset: [{ ContextID: sqlText.includes('Offered') ? 2 : 1 }] })
        }
        if (sqlText.includes('InformationValueSets') && sqlText.includes('SELECT ValueSetID')) {
          if (sqlText.includes('PartyID')) {
            const out = offeredExists ? [{ ValueSetID: 2 }] : []
            offeredExists = true
            return Promise.resolve({ recordset: out })
          }
          return Promise.resolve({ recordset: [{ ValueSetID: 1 }] })
        }
        if (sqlText.includes('INSERT INTO dbo.InformationValueSets') && sqlText.includes('OUTPUT INSERTED.ValueSetID')) {
          return Promise.resolve({ recordset: [{ ValueSetID: 2 }] })
        }
        if (sqlText.includes('INSERT INTO dbo.InformationValues')) {
          return Promise.resolve({ recordset: [], rowsAffected: [1] })
        }
        return Promise.resolve({ recordset: [], rowsAffected: [0] })
      })

      const id1 = await createOfferedValueSet(1, 99, 1)
      const id2 = await createOfferedValueSet(1, 99, 1)
      expect(id1).toBe(2)
      expect(id2).toBe(2)
    })
  })

  describe('getRequirementValueRows', () => {
    it('returns effective view: one row per InfoTemplateID, prefer ValueSet then legacy', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ ValueSetID: 1 }] })
        .mockResolvedValueOnce({
          recordset: [
            { InfoTemplateID: 10, InfoValue: 'fromValueSet', UOM: 'm' },
            { InfoTemplateID: 11, InfoValue: 'fromLegacy', UOM: null },
          ],
        })

      const rows = await getRequirementValueRows(42)
      expect(rows).toHaveLength(2)
      expect(rows.find((r) => r.InfoTemplateID === 10)).toEqual({ InfoTemplateID: 10, InfoValue: 'fromValueSet', UOM: 'm' })
      expect(rows.find((r) => r.InfoTemplateID === 11)).toEqual({ InfoTemplateID: 11, InfoValue: 'fromLegacy', UOM: null })
    })

    it('includes legacy requirement values when ValueSet rows are missing', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ ValueSetID: 1 }] })
        .mockResolvedValueOnce({
          recordset: [{ InfoTemplateID: 10, InfoValue: 'legacyOnly', UOM: null }],
        })

      const rows = await getRequirementValueRows(42)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toEqual({ InfoTemplateID: 10, InfoValue: 'legacyOnly', UOM: null })
    })
  })

  describe('ensureRequirementValueSetInTransaction', () => {
    it('creates ValueSet when none exists and returns ValueSetID', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ recordset: [{ ValueSetID: 50 }] })

      const id = await ensureRequirementValueSetInTransaction(mockTransaction as never, 42, 1, 1)
      expect(id).toBe(50)
      expect(mockTransaction.request).toHaveBeenCalled()
    })

    it('returns existing ValueSetID when set exists', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ ContextID: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ ValueSetID: 50 }] })

      const id = await ensureRequirementValueSetInTransaction(mockTransaction as never, 42, 1, 1)
      expect(id).toBe(50)
    })
  })
})
