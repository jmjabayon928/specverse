// tests/services/verificationRecordsService.test.ts
import {
  listForAccount,
  getById,
  listForSheet,
  create,
  linkToSheet,
  unlinkFromSheet,
  attachEvidence,
  listAttachments,
} from '../../src/backend/services/verificationRecordsService'
import { AppError } from '../../src/backend/errors/AppError'

const mockListVerificationRecordsForAccount = jest.fn()
const mockGetVerificationRecordById = jest.fn()
const mockListVerificationRecordsForSheet = jest.fn()
const mockCreateVerificationRecord = jest.fn()
const mockLinkVerificationRecordToSheet = jest.fn()
const mockUnlinkVerificationRecordFromSheet = jest.fn()
const mockAttachEvidenceToVerificationRecord = jest.fn()
const mockListVerificationRecordAttachments = jest.fn()
const mockSheetBelongsToAccount = jest.fn()

jest.mock('../../src/backend/repositories/verificationRecordsRepository', () => ({
  listVerificationRecordsForAccount: (...args: unknown[]) => mockListVerificationRecordsForAccount(...args),
  getVerificationRecordById: (...args: unknown[]) => mockGetVerificationRecordById(...args),
  listVerificationRecordsForSheet: (...args: unknown[]) => mockListVerificationRecordsForSheet(...args),
  createVerificationRecord: (...args: unknown[]) => mockCreateVerificationRecord(...args),
  linkVerificationRecordToSheet: (...args: unknown[]) => mockLinkVerificationRecordToSheet(...args),
  unlinkVerificationRecordFromSheet: (...args: unknown[]) => mockUnlinkVerificationRecordFromSheet(...args),
  attachEvidenceToVerificationRecord: (...args: unknown[]) => mockAttachEvidenceToVerificationRecord(...args),
  listVerificationRecordAttachments: (...args: unknown[]) => mockListVerificationRecordAttachments(...args),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: (...args: unknown[]) => mockSheetBelongsToAccount(...args),
}))

describe('verificationRecordsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('linkToSheet', () => {
    it('should reject when sheet does not belong to account', async () => {
      mockSheetBelongsToAccount.mockResolvedValue(false)

      await expect(linkToSheet(1, 100, 50)).rejects.toThrow(AppError)
      await expect(linkToSheet(1, 100, 50)).rejects.toThrow('Sheet not found or does not belong to account')

      const error = await linkToSheet(1, 100, 50).catch(e => e)
      expect(error.statusCode).toBe(404)

      expect(mockSheetBelongsToAccount).toHaveBeenCalledWith(50, 1)
      expect(mockGetVerificationRecordById).not.toHaveBeenCalled()
      expect(mockLinkVerificationRecordToSheet).not.toHaveBeenCalled()
    })

    it('should call repo functions in correct order when allowed', async () => {
      mockSheetBelongsToAccount.mockResolvedValue(true)
      mockGetVerificationRecordById.mockResolvedValue({ verificationRecordId: 100, accountId: 1 })
      mockLinkVerificationRecordToSheet.mockResolvedValue({
        accountId: 1,
        verificationRecordId: 100,
        sheetId: 50,
      })

      const result = await linkToSheet(1, 100, 50)

      expect(mockSheetBelongsToAccount).toHaveBeenCalledWith(50, 1)
      expect(mockGetVerificationRecordById).toHaveBeenCalledWith(1, 100)
      expect(mockLinkVerificationRecordToSheet).toHaveBeenCalledWith(1, 100, 50)

      const callOrder = [
        mockSheetBelongsToAccount.mock.invocationCallOrder[0],
        mockGetVerificationRecordById.mock.invocationCallOrder[0],
        mockLinkVerificationRecordToSheet.mock.invocationCallOrder[0],
      ]
      expect(callOrder[0]).toBeLessThan(callOrder[1])
      expect(callOrder[1]).toBeLessThan(callOrder[2])

      expect(result).toEqual({ accountId: 1, verificationRecordId: 100, sheetId: 50 })
    })

    it('should throw AppError when record not found', async () => {
      mockSheetBelongsToAccount.mockResolvedValue(true)
      mockGetVerificationRecordById.mockResolvedValue(null)

      await expect(linkToSheet(1, 100, 50)).rejects.toThrow(AppError)
      await expect(linkToSheet(1, 100, 50)).rejects.toThrow('Verification record not found')

      const error = await linkToSheet(1, 100, 50).catch(e => e)
      expect(error.statusCode).toBe(404)

      expect(mockSheetBelongsToAccount).toHaveBeenCalledWith(50, 1)
      expect(mockGetVerificationRecordById).toHaveBeenCalledWith(1, 100)
      expect(mockLinkVerificationRecordToSheet).not.toHaveBeenCalled()
    })
  })

  describe('listForSheet', () => {
    it('should throw AppError when sheet does not belong to account', async () => {
      mockSheetBelongsToAccount.mockResolvedValue(false)

      await expect(listForSheet(1, 50)).rejects.toThrow(AppError)
      await expect(listForSheet(1, 50)).rejects.toThrow('Sheet not found or does not belong to account')

      const error = await listForSheet(1, 50).catch(e => e)
      expect(error.statusCode).toBe(404)

      expect(mockListVerificationRecordsForSheet).not.toHaveBeenCalled()
    })
  })

  describe('attachEvidence', () => {
    it('should throw AppError when record not found', async () => {
      mockGetVerificationRecordById.mockResolvedValue(null)

      await expect(attachEvidence(1, 100, 200)).rejects.toThrow(AppError)
      await expect(attachEvidence(1, 100, 200)).rejects.toThrow('Verification record not found')

      expect(mockAttachEvidenceToVerificationRecord).not.toHaveBeenCalled()
    })

    it('should throw AppError when attachment insert fails', async () => {
      mockGetVerificationRecordById.mockResolvedValue({ verificationRecordId: 100, accountId: 1 })
      mockAttachEvidenceToVerificationRecord.mockResolvedValue(null)

      await expect(attachEvidence(1, 100, 200)).rejects.toThrow(AppError)
      await expect(attachEvidence(1, 100, 200)).rejects.toThrow('Attachment not found or not in account scope')
    })
  })

  describe('listAttachments', () => {
    it('should throw AppError when record not found', async () => {
      mockGetVerificationRecordById.mockResolvedValue(null)

      await expect(listAttachments(1, 100)).rejects.toThrow(AppError)
      await expect(listAttachments(1, 100)).rejects.toThrow('Verification record not found')

      expect(mockListVerificationRecordAttachments).not.toHaveBeenCalled()
    })
  })
})
