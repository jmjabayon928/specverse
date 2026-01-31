// tests/services/valueSetSlice3.test.ts
// Phase 2 Slice #3: createOfferedValueSet, patchVariance, transitionStatus, getCompareData.

import { AppError } from '../../src/backend/errors/AppError'
import {
  createOfferedValueSet,
  patchVariance,
  transitionValueSetStatus,
  getCompareData,
  type VarianceStatus,
} from '../../src/backend/services/valueSetService'

const mockGetValueSetId = jest.fn()
const mockGetValueSetRow = jest.fn()
const mockCreateOfferedValueSetQuery = jest.fn()
const mockDeleteVarianceQuery = jest.fn()
const mockUpsertVarianceQuery = jest.fn()
const mockUpdateValueSetStatusQuery = jest.fn()
const mockGetCompareStructure = jest.fn()
const mockGetValueSetValues = jest.fn()
const mockGetVariancesForValueSet = jest.fn()
const mockListValueSetsQuery = jest.fn()

jest.mock('../../src/backend/database/valueSetQueries', () => ({
  getContextIdByCode: jest.fn(),
  getValueSetId: (...args: unknown[]) => mockGetValueSetId(...args),
  getValueSetRow: (...args: unknown[]) => mockGetValueSetRow(...args),
  getValueSetStatus: jest.fn(),
  createValueSet: jest.fn(),
  createOfferedValueSet: (...args: unknown[]) => mockCreateOfferedValueSetQuery(...args),
  listValueSets: (...args: unknown[]) => mockListValueSetsQuery(...args),
  upsertVariance: (...args: unknown[]) => mockUpsertVarianceQuery(...args),
  deleteVariance: (...args: unknown[]) => mockDeleteVarianceQuery(...args),
  updateValueSetStatus: (...args: unknown[]) => mockUpdateValueSetStatusQuery(...args),
  getCompareStructure: (...args: unknown[]) => mockGetCompareStructure(...args),
  getValueSetValues: (...args: unknown[]) => mockGetValueSetValues(...args),
  getVariancesForValueSet: (...args: unknown[]) => mockGetVariancesForValueSet(...args),
  getRequirementValueRows: jest.fn(),
  ensureRequirementValueSet: jest.fn(),
}))

describe('valueSet Slice #3 service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createOfferedValueSet', () => {
    it('creates offered set and prefills from requirement (delegates to query)', async () => {
      mockCreateOfferedValueSetQuery.mockResolvedValue(2)
      const id = await createOfferedValueSet(1, 99, 1)
      expect(id).toBe(2)
      expect(mockCreateOfferedValueSetQuery).toHaveBeenCalledWith(1, 99, 1)
    })

    it('re-running returns same id (idempotent, no duplicate values)', async () => {
      mockCreateOfferedValueSetQuery.mockResolvedValue(2)
      const id1 = await createOfferedValueSet(1, 99, 1)
      const id2 = await createOfferedValueSet(1, 99, 1)
      expect(id1).toBe(2)
      expect(id2).toBe(2)
      expect(mockCreateOfferedValueSetQuery).toHaveBeenCalledTimes(2)
    })
  })

  describe('patchVariance', () => {
    it('upserts row with status and sets ReviewedBy/ReviewedAt via query', async () => {
      mockGetValueSetRow.mockResolvedValue({
        ValueSetID: 1,
        SheetID: 42,
        Code: 'Offered',
        Status: 'Draft',
        PartyID: 99,
      })
      await patchVariance(42, 1, 10, 'DeviatesAccepted' as VarianceStatus, 1)
      expect(mockUpsertVarianceQuery).toHaveBeenCalledWith(1, 10, 'DeviatesAccepted', 1)
      expect(mockDeleteVarianceQuery).not.toHaveBeenCalled()
    })

    it('status=null deletes variance row', async () => {
      mockGetValueSetRow.mockResolvedValue({
        ValueSetID: 1,
        SheetID: 42,
        Code: 'Offered',
        Status: 'Draft',
        PartyID: 99,
      })
      await patchVariance(42, 1, 10, null, 1)
      expect(mockDeleteVarianceQuery).toHaveBeenCalledWith(1, 10)
      expect(mockUpsertVarianceQuery).not.toHaveBeenCalled()
    })

    it('rejects when ValueSet status is not Draft', async () => {
      mockGetValueSetRow.mockResolvedValue({
        ValueSetID: 1,
        SheetID: 42,
        Code: 'Offered',
        Status: 'Locked',
        PartyID: 99,
      })
      await expect(patchVariance(42, 1, 10, 'DeviatesAccepted' as VarianceStatus, 1)).rejects.toThrow(AppError)
      await expect(patchVariance(42, 1, 10, 'DeviatesAccepted' as VarianceStatus, 1)).rejects.toMatchObject({
        statusCode: 409,
      })
      expect(mockUpsertVarianceQuery).not.toHaveBeenCalled()
    })

    it('rejects when context is Requirement', async () => {
      mockGetValueSetRow.mockResolvedValue({
        ValueSetID: 1,
        SheetID: 42,
        Code: 'Requirement',
        Status: 'Draft',
        PartyID: null,
      })
      await expect(patchVariance(42, 1, 10, 'DeviatesAccepted' as VarianceStatus, 1)).rejects.toThrow(AppError)
      expect(mockUpsertVarianceQuery).not.toHaveBeenCalled()
    })
  })

  describe('transitionValueSetStatus', () => {
    it('Requirement/Offered Draft -> Locked succeeds', async () => {
      mockGetValueSetRow.mockResolvedValue({
        ValueSetID: 1,
        SheetID: 42,
        Code: 'Offered',
        Status: 'Draft',
        PartyID: 99,
      })
      await transitionValueSetStatus(42, 1, 'Locked')
      expect(mockUpdateValueSetStatusQuery).toHaveBeenCalledWith(1, 'Locked')
    })

    it('AsBuilt Draft -> Verified succeeds', async () => {
      mockGetValueSetRow.mockResolvedValue({
        ValueSetID: 2,
        SheetID: 42,
        Code: 'AsBuilt',
        Status: 'Draft',
        PartyID: null,
      })
      await transitionValueSetStatus(42, 2, 'Verified')
      expect(mockUpdateValueSetStatusQuery).toHaveBeenCalledWith(2, 'Verified')
    })

    it('invalid transition rejected (409)', async () => {
      mockGetValueSetRow.mockResolvedValue({
        ValueSetID: 1,
        SheetID: 42,
        Code: 'Offered',
        Status: 'Draft',
        PartyID: 99,
      })
      await expect(transitionValueSetStatus(42, 1, 'Verified')).rejects.toThrow(AppError)
      await expect(transitionValueSetStatus(42, 1, 'Verified')).rejects.toMatchObject({ statusCode: 409 })
      expect(mockUpdateValueSetStatusQuery).not.toHaveBeenCalled()
    })

    it('current status not Draft rejected (409)', async () => {
      mockGetValueSetRow.mockResolvedValue({
        ValueSetID: 1,
        SheetID: 42,
        Code: 'Offered',
        Status: 'Locked',
        PartyID: 99,
      })
      await expect(transitionValueSetStatus(42, 1, 'Locked')).rejects.toThrow(AppError)
      expect(mockUpdateValueSetStatusQuery).not.toHaveBeenCalled()
    })
  })

  describe('getCompareData', () => {
    it('returns expected shape and includes variance overrides', async () => {
      mockGetCompareStructure.mockResolvedValue([
        { SubID: 1, SubName: 'Sub1', InfoTemplateID: 10, Label: 'F1', OrderIndex: 0 },
      ])
      mockGetValueSetId.mockImplementation((_sheetId: number, code: string) => {
        if (code === 'Requirement') return Promise.resolve(100)
        if (code === 'AsBuilt') return Promise.resolve(102)
        return Promise.resolve(null)
      })
      mockListValueSetsQuery.mockResolvedValue([
        { ValueSetID: 101, SheetID: 42, ContextID: 2, Code: 'Offered', PartyID: 99, Status: 'Draft' },
      ])
      mockGetValueSetValues
        .mockResolvedValueOnce(new Map([[10, { value: 'req', uom: 'm' }]]))
        .mockResolvedValueOnce(new Map([[10, { value: 'asbuilt', uom: 'kg' }]]))
        .mockResolvedValueOnce(new Map([[10, { value: 'offered', uom: 'm' }]]))
      const varianceMap = new Map<number, VarianceStatus>([[10, 'DeviatesAccepted']])
      mockGetVariancesForValueSet.mockImplementation(() => Promise.resolve(varianceMap))

      const data = await getCompareData(42)

      expect(data.subsheets).toHaveLength(1)
      expect(data.subsheets[0].fields).toHaveLength(1)
      const field = data.subsheets[0].fields[0]
      expect(field.requirement).toEqual({ value: 'req', uom: 'm' })
      expect(field.offered).toHaveLength(1)
      expect(field.offered[0]).toMatchObject({
        partyId: 99,
        valueSetId: 101,
        value: 'offered',
        uom: 'm',
        varianceStatus: 'DeviatesAccepted',
      })
      expect(field.asBuilt).toEqual({ value: 'asbuilt', uom: 'kg', varianceStatus: 'DeviatesAccepted' })
    })
  })
})
