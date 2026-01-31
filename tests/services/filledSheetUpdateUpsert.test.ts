// tests/services/filledSheetUpdateUpsert.test.ts
// Phase 2 Slice #2: Assert updateFilledSheet uses UPSERT (no wholesale DELETE on InformationValues).

const executedQueries: string[] = []
const queryResponses: Array<{ recordset?: unknown[]; rowsAffected?: number[] }> = []

function makeRequest() {
  return {
    input: jest.fn().mockReturnThis(),
    query: jest.fn((sqlText: string) => {
      executedQueries.push(sqlText)
      const res = queryResponses.shift()
      if (res) {
        return Promise.resolve({
          recordset: res.recordset ?? [],
          rowsAffected: res.rowsAffected ?? [1],
        })
      }
      return Promise.resolve({ recordset: [], rowsAffected: [0] })
    }),
  }
}

const mockTransaction = {
  begin: jest.fn().mockResolvedValue(undefined),
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  request: jest.fn(() => makeRequest()),
}

jest.mock('../../src/backend/config/db', () => ({
  poolPromise: Promise.resolve({
    request: () => makeRequest(),
  }),
  sql: {
    Int: 1,
    NVarChar: (n: number) => n,
    VarChar: (n: number) => n,
    MAX: 2147483647,
    Transaction: jest.fn().mockImplementation(() => mockTransaction),
  },
}))

jest.mock('../../src/backend/database/valueSetQueries', () => ({
  ensureRequirementValueSet: jest.fn().mockResolvedValue(1),
  getValueSetStatus: jest.fn().mockResolvedValue('Draft'),
  getValueSetId: jest.fn(),
  ensureRequirementValueSetInTransaction: jest.fn(),
  getContextIdByCode: jest.fn(),
  createValueSet: jest.fn(),
  listValueSets: jest.fn(),
}))

const mockNotifyUsers = jest.fn().mockResolvedValue(undefined)
jest.mock('../../src/backend/utils/notifyUsers', () => ({
  notifyUsers: (...args: unknown[]) => mockNotifyUsers(...args),
}))

import { updateFilledSheet } from '../../src/backend/services/filledSheetService'

const minimalUnifiedSheet = {
  sheetName: 'Test',
  sheetDesc: '',
  sheetDesc2: '',
  clientDocNum: 1,
  clientProjectNum: 1,
  companyDocNum: 1,
  companyProjectNum: 1,
  areaId: 1,
  packageName: 'P',
  revisionNum: 1,
  revisionDate: '2026-01-01',
  itemLocation: 'L',
  requiredQty: 1,
  equipmentName: 'E',
  equipmentTagNum: 'TAG',
  serviceName: 'S',
  manuId: 1,
  suppId: 1,
  installPackNum: undefined,
  equipSize: 1,
  modelNum: undefined,
  driver: undefined,
  locationDwg: undefined,
  pid: undefined,
  installDwg: undefined,
  codeStd: undefined,
  categoryId: 1,
  clientId: 1,
  projectId: 1,
  preparedById: 1,
  preparedByDate: '2026-01-01',
  subsheets: [
    {
      name: 'Sub1',
      fields: [{ id: 1, label: 'F1', infoType: 'varchar' as const, sortOrder: 0, required: false, value: 'new' }],
    },
  ],
}

describe('updateFilledSheet UPSERT behavior', () => {
  beforeEach(() => {
    executedQueries.length = 0
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
    // Response order: UPDATE Sheets, SELECT oldValues, SELECT existingRows, SELECT UOM, UPDATE InformationValues (legacy), INSERT ChangeLogs
    queryResponses.push(
      { rowsAffected: [1] },
      {
        recordset: [
          { InfoTemplateID: 1, InfoValue: 'old', ValueSetID: null, Label: 'F1', UOM: null },
        ],
      },
      {
        recordset: [{ InfoTemplateID: 1, ValueSetID: null }],
      },
      {
        recordset: [{ InfoTemplateID: 1, UOM: null }],
      },
      { rowsAffected: [1] },
      { rowsAffected: [1] }
    )
  })

  it('does not execute DELETE on InformationValues (no wholesale delete)', async () => {
    await updateFilledSheet(1, minimalUnifiedSheet, 1, { skipRevisionCreation: true })

    const informationValueQueries = executedQueries.filter((q) =>
      q.replace(/\s+/g, ' ').toLowerCase().includes('informationvalues')
    )
    const deleteOnInfoValues = informationValueQueries.some((q) => {
      const normalized = q.replace(/\s+/g, ' ').toLowerCase()
      return normalized.includes('delete') && normalized.includes('informationvalues')
    })

    expect(deleteOnInfoValues).toBe(false)
  })

  it('uses UPDATE or INSERT for InformationValues (UPSERT)', async () => {
    await updateFilledSheet(1, minimalUnifiedSheet, 1, { skipRevisionCreation: true })

    const informationValueQueries = executedQueries.filter((q) =>
      q.replace(/\s+/g, ' ').toLowerCase().includes('informationvalues')
    )
    const hasUpdate = informationValueQueries.some((q) => {
      const n = q.replace(/\s+/g, ' ').toLowerCase()
      return n.includes('update') && n.includes('informationvalues')
    })
    const hasInsert = informationValueQueries.some((q) => {
      const n = q.replace(/\s+/g, ' ').toLowerCase()
      return n.includes('insert') && n.includes('informationvalues')
    })

    expect(hasUpdate || hasInsert).toBe(true)
  })

  it('legacy row path: UPDATE sets ValueSetID (migrate-in-place)', async () => {
    await updateFilledSheet(1, minimalUnifiedSheet, 1, { skipRevisionCreation: true })

    const legacyUpdate = executedQueries.find((q) => {
      const n = q.replace(/\s+/g, ' ').toLowerCase()
      return (
        n.includes('update') &&
        n.includes('informationvalues') &&
        n.includes('valuesetid') &&
        n.includes('valuesetid is null')
      )
    })

    expect(legacyUpdate).toBeDefined()
  })

  it('resolves with sheetId even when notifyUsers rejects (post-commit side effect non-fatal)', async () => {
    mockNotifyUsers.mockRejectedValueOnce(new Error('notify failed'))
    const result = await updateFilledSheet(1, minimalUnifiedSheet, 1, {
      skipRevisionCreation: true,
    })
    expect(result).toEqual({ sheetId: 1 })
    expect(mockNotifyUsers).toHaveBeenCalled()
  })
})
