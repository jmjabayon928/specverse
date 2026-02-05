// tests/repositories/verificationRecordsRepository.test.ts
const mockInput = jest.fn().mockReturnThis()
const mockQuery = jest.fn().mockResolvedValue({ recordset: [], rowsAffected: [0] })
const mockRequest = jest.fn().mockReturnValue({
  input: mockInput,
  query: mockQuery,
})

jest.mock('../../src/backend/config/db', () => ({
  poolPromise: Promise.resolve({
    request: mockRequest,
  }),
  sql: {
    Int: 1,
    NVarChar: () => ({}),
    VarChar: () => ({}),
  },
}))

import {
  listVerificationRecordsForAccount,
  getVerificationRecordById,
  listVerificationRecordsForSheet,
  createVerificationRecord,
  linkVerificationRecordToSheet,
  unlinkVerificationRecordFromSheet,
  attachEvidenceToVerificationRecord,
  listVerificationRecordAttachments,
} from '../../src/backend/repositories/verificationRecordsRepository'
import type { CreateVerificationRecordDto } from '../../src/domain/verification/verificationTypes'

describe('verificationRecordsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] })
  })

  describe('AccountID scoping', () => {
    it('should always include AccountID parameter', async () => {
      await listVerificationRecordsForAccount(1)

      expect(mockInput).toHaveBeenCalledWith('AccountID', 1, 1)
    })

    it('should filter by AccountID in WHERE clause for list', async () => {
      await listVerificationRecordsForAccount(1)

      const queryText = mockQuery.mock.calls[0][0]
      expect(queryText).toContain('@AccountID')
      expect(queryText).toMatch(/WHERE.*AccountID.*=.*@AccountID/i)
    })

    it('should filter by AccountID in WHERE clause for getById', async () => {
      await getVerificationRecordById(1, 100)

      expect(mockInput).toHaveBeenCalledWith('AccountID', 1, 1)
      const queryText = mockQuery.mock.calls[0][0]
      expect(queryText).toContain('@AccountID')
      expect(queryText).toMatch(/WHERE.*AccountID.*=.*@AccountID/i)
    })

    it('should use double AccountID check in join for listVerificationRecordsForSheet', async () => {
      await listVerificationRecordsForSheet(1, 50)

      expect(mockInput).toHaveBeenCalledWith('AccountID', 1, 1)
      const queryText = mockQuery.mock.calls[0][0]
      expect(queryText).toContain('@AccountID')
      expect(queryText).toMatch(/vrl\.AccountID.*=.*@AccountID/i)
      expect(queryText).toMatch(/vr\.AccountID.*=.*@AccountID/i)
    })

    it('should join VerificationRecords to enforce account in listVerificationRecordAttachments', async () => {
      await listVerificationRecordAttachments(1, 100)

      expect(mockInput).toHaveBeenCalledWith('AccountID', 1, 1)
      const queryText = mockQuery.mock.calls[0][0]
      expect(queryText).toContain('INNER JOIN VerificationRecords')
      expect(queryText).toContain('@AccountID')
      expect(queryText).toMatch(/vr\.AccountID.*=.*@AccountID/i)
    })
  })

  describe('attachEvidenceToVerificationRecord account safety', () => {
    it('should use INSERT...SELECT pattern with AccountID check', async () => {
      await attachEvidenceToVerificationRecord(1, 100, 200)

      expect(mockInput).toHaveBeenCalledWith('AccountID', 1, 1)
      const queryText = mockQuery.mock.calls[0][0]
      expect(queryText).toContain('INSERT INTO VerificationRecordAttachments')
      expect(queryText).toContain('SELECT')
      expect(queryText).toContain('FROM VerificationRecords')
      expect(queryText).toContain('@AccountID')
      expect(queryText).toMatch(/vr\.AccountID.*=.*@AccountID/i)
    })

    it('should return null when account mismatch prevents insert', async () => {
      mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] })

      const result = await attachEvidenceToVerificationRecord(1, 100, 200)

      expect(result).toBeNull()
    })

    it('should return row when account match allows insert', async () => {
      mockQuery.mockResolvedValue({
        recordset: [{ verificationRecordId: 100, attachmentId: 200 }],
        rowsAffected: [1],
      })

      const result = await attachEvidenceToVerificationRecord(1, 100, 200)

      expect(result).toEqual({ verificationRecordId: 100, attachmentId: 200 })
    })
  })

  describe('cross-account access prevention', () => {
    it('should return null for cross-account getById', async () => {
      mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] })

      const result = await getVerificationRecordById(2, 100)

      expect(result).toBeNull()
    })

    it('should return empty array for cross-account list', async () => {
      mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] })

      const result = await listVerificationRecordsForAccount(2)

      expect(result).toEqual([])
    })
  })

  describe('createVerificationRecord', () => {
    it('should use accountId parameter and insert VerificationTypeID and Result', async () => {
      const input: CreateVerificationRecordDto = {
        accountId: 999,
        verificationTypeId: 1,
        result: 'Pending',
      }
      mockQuery.mockResolvedValue({
        recordset: [{ verificationRecordId: 100, accountId: 1 }],
        rowsAffected: [1],
      })

      await createVerificationRecord(1, input)

      expect(mockInput).toHaveBeenCalledWith('AccountID', 1, 1)
      expect(mockInput).toHaveBeenCalledWith('VerificationTypeID', 1, 1)
      expect(mockInput).toHaveBeenCalledWith('Result', expect.any(Function), 'Pending')
      expect(mockInput).not.toHaveBeenCalledWith('AccountID', 999, 1)
    })
  })

  describe('unlinkVerificationRecordFromSheet', () => {
    it('should return true when row deleted', async () => {
      mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [1] })

      const result = await unlinkVerificationRecordFromSheet(1, 100, 50)

      expect(result).toBe(true)
    })

    it('should return false when no row deleted', async () => {
      mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] })

      const result = await unlinkVerificationRecordFromSheet(1, 100, 50)

      expect(result).toBe(false)
    })
  })
})
