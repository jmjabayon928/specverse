// Unit test: duplicate-key race recovery in upsertCustomFieldDefinition (2627/2601).

import { upsertCustomFieldDefinition } from '../../src/backend/database/customFieldQueries'

let mockRequest: { input: jest.Mock; query: jest.Mock }

jest.mock('../../src/backend/config/db', () => {
  const req = { input: jest.fn().mockReturnThis(), query: jest.fn() }
  return {
    poolPromise: Promise.resolve({ request: () => req }),
    sql: { Int: 1, NVarChar: (_n: number) => 50, Bit: 1, MAX: 2147483647 },
    __mockRequest: req,
  }
})

describe('customFieldQueries', () => {
  beforeAll(() => {
    const db = require('../../src/backend/config/db') as { __mockRequest: { input: jest.Mock; query: jest.Mock } }
    mockRequest = db.__mockRequest
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequest.input.mockReturnThis()
    mockRequest.query.mockReset()
  })

  describe('upsertCustomFieldDefinition', () => {
    it('returns existing CustomFieldID when MERGE hits unique violation (2627)', async () => {
      const duplicateError = Object.assign(new Error('Duplicate key'), { number: 2627 })
      mockRequest.query
        .mockRejectedValueOnce(duplicateError)
        .mockResolvedValueOnce({ recordset: [{ CustomFieldID: 42 }] })

      const id = await upsertCustomFieldDefinition({
        accountId: 1,
        entityType: 'Asset',
        fieldKey: 'Custom1',
        displayLabel: 'Custom 1',
        dataType: 'varchar',
      })

      expect(id).toBe(42)
      expect(mockRequest.query).toHaveBeenCalledTimes(2)
    })

    it('returns existing CustomFieldID when MERGE hits duplicate key (2601)', async () => {
      const duplicateError = Object.assign(new Error('Duplicate key'), { number: 2601 })
      mockRequest.query
        .mockRejectedValueOnce(duplicateError)
        .mockResolvedValueOnce({ recordset: [{ CustomFieldID: 99 }] })

      const id = await upsertCustomFieldDefinition({
        accountId: 1,
        entityType: 'Asset',
        fieldKey: 'Custom2',
        displayLabel: 'Custom 2',
        dataType: 'varchar',
      })

      expect(id).toBe(99)
      expect(mockRequest.query).toHaveBeenCalledTimes(2)
    })
  })
})
