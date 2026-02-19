// tests/services/instrumentsService.tagRules.test.ts
import { AppError } from '../../src/backend/errors/AppError'
import {
  createInstrument,
  updateInstrument,
  normalizeTag,
} from '../../src/backend/services/instrumentsService'

const mockListActiveTagRulesByAccount = jest.fn()
const mockCreate = jest.fn()
const mockUpdate = jest.fn()
const mockGetById = jest.fn()

jest.mock('../../src/backend/repositories/instrumentsRepository', () => ({
  listActiveTagRulesByAccount: (...args: unknown[]) =>
    mockListActiveTagRulesByAccount(...args),
  create: (...args: unknown[]) => mockCreate(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  getById: (...args: unknown[]) => mockGetById(...args),
  listByAccount: jest.fn(),
  listLinkedToSheet: jest.fn(),
  linkToSheet: jest.fn(),
  unlinkFromSheet: jest.fn(),
  linkExists: jest.fn(),
}))

jest.mock('../../src/backend/services/sheetAccessService', () => ({
  sheetBelongsToAccount: jest.fn(),
}))

describe('InstrumentsService TagRules Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Multiple active rules', () => {
    it('rejects when multiple active rules exist', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: 'PT',
          separator: '-',
          minNumberDigits: 3,
          maxNumberDigits: 3,
          allowedAreaCodes: null,
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
        {
          ruleId: 2,
          accountId: 1,
          prefix: 'TE',
          separator: '-',
          minNumberDigits: 3,
          maxNumberDigits: 3,
          allowedAreaCodes: null,
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      await expect(
        createInstrument(1, { instrumentTag: 'PT-101' })
      ).rejects.toThrow(AppError)

      const error = await createInstrument(1, { instrumentTag: 'PT-101' }).catch((e) => e)
      expect(error.message).toBe(
        'Multiple active instrument tag rules found. Please keep only one active rule per account.'
      )
      expect(error.statusCode).toBe(400)

      expect(mockListActiveTagRulesByAccount).toHaveBeenCalledWith(1)
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('Prefix and Separator validation', () => {
    it('validates prefix requirement', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: 'PT',
          separator: null,
          minNumberDigits: null,
          maxNumberDigits: null,
          allowedAreaCodes: null,
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await createInstrument(1, { instrumentTag: 'TE-101' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag must start with "PT"')
      expect(error.statusCode).toBe(400)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('validates prefix + separator combination', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: 'PT',
          separator: '-',
          minNumberDigits: null,
          maxNumberDigits: null,
          allowedAreaCodes: null,
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await createInstrument(1, { instrumentTag: 'PT101' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag must start with "PT-"')
      expect(error.statusCode).toBe(400)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('allows valid prefix + separator tag', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: 'PT',
          separator: '-',
          minNumberDigits: null,
          maxNumberDigits: null,
          allowedAreaCodes: null,
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      mockCreate.mockResolvedValue({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createInstrument(1, { instrumentTag: 'PT-101' })

      expect(result.instrumentTag).toBe('PT-101')
      expect(mockCreate).toHaveBeenCalled()
    })
  })

  describe('MinNumberDigits / MaxNumberDigits validation', () => {
    it('validates minimum digit count', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: 'PT',
          separator: '-',
          minNumberDigits: 3,
          maxNumberDigits: null,
          allowedAreaCodes: null,
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await createInstrument(1, { instrumentTag: 'PT-10' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag must have at least 3 trailing digits')
      expect(error.statusCode).toBe(400)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('validates maximum digit count', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: 'PT',
          separator: '-',
          minNumberDigits: null,
          maxNumberDigits: 3,
          allowedAreaCodes: null,
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await createInstrument(1, { instrumentTag: 'PT-1010' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag must have at most 3 trailing digits')
      expect(error.statusCode).toBe(400)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('requires trailing digits when digit rules are set', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: 'PT',
          separator: '-',
          minNumberDigits: 3,
          maxNumberDigits: 3,
          allowedAreaCodes: null,
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await createInstrument(1, { instrumentTag: 'PT-ABC' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag must end with digits')
      expect(error.statusCode).toBe(400)

      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('AllowedAreaCodes validation', () => {
    it('validates area code prefix', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: null,
          separator: null,
          minNumberDigits: null,
          maxNumberDigits: null,
          allowedAreaCodes: 'A100,A200,B100',
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await createInstrument(1, { instrumentTag: 'C100-101' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag must start with one of: A100, A200, B100')
      expect(error.statusCode).toBe(400)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('validates area code with separator', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: null,
          separator: '-',
          minNumberDigits: null,
          maxNumberDigits: null,
          allowedAreaCodes: 'A100,A200',
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await createInstrument(1, { instrumentTag: 'C100-101' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag must start with one of: A100, A200-')
      expect(error.statusCode).toBe(400)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('allows valid area code', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: null,
          separator: null,
          minNumberDigits: null,
          maxNumberDigits: null,
          allowedAreaCodes: 'A100,A200',
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      mockCreate.mockResolvedValue({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'A100-101',
        instrumentTagNorm: 'A100-101',
        instrumentType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createInstrument(1, { instrumentTag: 'A100-101' })

      expect(result.instrumentTag).toBe('A100-101')
      expect(mockCreate).toHaveBeenCalled()
    })
  })

  describe('RegexPattern validation', () => {
    it('validates tag against regex pattern', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: null,
          separator: null,
          minNumberDigits: null,
          maxNumberDigits: null,
          allowedAreaCodes: null,
          regexPattern: '^PT-\\d{3}$',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await createInstrument(1, { instrumentTag: 'PT-10' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag does not match required format')
      expect(error.statusCode).toBe(400)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('allows tag matching regex pattern', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: null,
          separator: null,
          minNumberDigits: null,
          maxNumberDigits: null,
          allowedAreaCodes: null,
          regexPattern: '^PT-\\d{3}$',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      mockCreate.mockResolvedValue({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createInstrument(1, { instrumentTag: 'PT-101' })

      expect(result.instrumentTag).toBe('PT-101')
      expect(mockCreate).toHaveBeenCalled()
    })

    it('throws 500 when regex pattern is invalid', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: null,
          separator: null,
          minNumberDigits: null,
          maxNumberDigits: null,
          allowedAreaCodes: null,
          regexPattern: '[invalid regex',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await createInstrument(1, { instrumentTag: 'PT-101' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag rules are misconfigured')
      expect(error.statusCode).toBe(500)

      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('No rules', () => {
    it('allows any tag when no active rules exist', async () => {
      mockListActiveTagRulesByAccount.mockResolvedValue([])

      mockCreate.mockResolvedValue({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'ANY-TAG-123',
        instrumentTagNorm: 'ANY-TAG-123',
        instrumentType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createInstrument(1, { instrumentTag: 'ANY-TAG-123' })

      expect(result.instrumentTag).toBe('ANY-TAG-123')
      expect(mockCreate).toHaveBeenCalled()
    })
  })

  describe('Update instrument', () => {
    it('validates tag when updating instrument tag', async () => {
      mockGetById.mockResolvedValue({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockListActiveTagRulesByAccount.mockResolvedValue([
        {
          ruleId: 1,
          accountId: 1,
          prefix: 'PT',
          separator: '-',
          minNumberDigits: 3,
          maxNumberDigits: 3,
          allowedAreaCodes: null,
          regexPattern: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        },
      ])

      const error = await updateInstrument(1, 1, { instrumentTag: 'TE-101' }).catch((e) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error.message).toBe('Instrument tag must start with "PT"')
      expect(error.statusCode).toBe(400)

      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('skips validation when tag is not updated', async () => {
      mockGetById.mockResolvedValue({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockUpdate.mockResolvedValue({
        instrumentId: 1,
        accountId: 1,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: 'Pressure',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await updateInstrument(1, 1, { instrumentType: 'Pressure' })

      expect(result.instrumentType).toBe('Pressure')
      expect(mockListActiveTagRulesByAccount).not.toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalled()
    })
  })
})
