// tests/services/filledSheetUpdateUpsert.test.ts
// Phase 2 Slice #2: Assert updateFilledSheet uses UPSERT (no wholesale DELETE on InformationValues).
// Contract: first save creates revision (updateFilledSheet calls createRevision); create/clone does not (see createFilledSheet.wiring.test).

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
    DateTime2: (_scale?: number) => 0,
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
import { AppError } from '../../src/backend/errors/AppError'

/** Must pass unifiedSheetSchema so createRevision (4C guard) accepts the snapshot. */
const minimalUnifiedSheet = {
  sheetName: 'Test',
  sheetDesc: 'Test description',
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
      fields: [
        {
          id: 1,
          label: 'F1',
          infoType: 'varchar' as const,
          uom: undefined,
          sortOrder: 0,
          required: false,
          value: 'new',
        },
      ],
    },
  ],
}

describe('updateFilledSheet UPSERT behavior', () => {
  beforeEach(() => {
    executedQueries.length = 0
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
    // Response order: SELECT Status (lifecycle guard), [validateFilledValues] SELECT InformationTemplates (field meta), SELECT InformationTemplateOptions, UPDATE Sheets, SELECT oldValues, SELECT existingRows, SELECT UOM, UPDATE InformationValues (legacy), INSERT ChangeLogs
    queryResponses.push(
      { recordset: [{ Status: 'Draft' }] },
      { recordset: [{ InfoTemplateID: 1, Required: 0, Label: 'F1', InfoType: 'varchar' }] },
      { recordset: [] },
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

describe('updateFilledSheet lifecycle guards', () => {
  beforeEach(() => {
    executedQueries.length = 0
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
  })

  it('rejects with 409 when filled sheet status is Approved', async () => {
    queryResponses.push({ recordset: [{ Status: 'Approved' }] })

    const p = updateFilledSheet(1, minimalUnifiedSheet, 1)
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('only be edited when status'),
    })
  })
})

describe('updateFilledSheet values-only (no header update)', () => {
  beforeEach(() => {
    executedQueries.length = 0
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
    queryResponses.push(
      { recordset: [{ Status: 'Draft' }] },
      { recordset: [{ InfoTemplateID: 1, Required: 0, Label: 'F1', InfoType: 'varchar' }] },
      { recordset: [] },
      { rowsAffected: [1] },
      {
        recordset: [
          { InfoTemplateID: 1, InfoValue: 'old', ValueSetID: null, Label: 'F1', UOM: null },
        ],
      },
      { recordset: [{ InfoTemplateID: 1, ValueSetID: null }] },
      { recordset: [{ InfoTemplateID: 1, UOM: null }] },
      { rowsAffected: [1] },
      { rowsAffected: [1] }
    )
  })

  it('does not update Sheets.sheetName when allowHeaderUpdate is false (default)', async () => {
    const inputWithNewName = { ...minimalUnifiedSheet, sheetName: 'ChangedName' }
    await updateFilledSheet(1, inputWithNewName, 1, { skipRevisionCreation: true })

    const updateSheetsQueries = executedQueries.filter((q) => {
      const n = q.replace(/\s+/g, ' ').toLowerCase()
      return n.includes('update') && n.includes('sheets') && n.includes('set')
    })
    expect(updateSheetsQueries.length).toBeGreaterThanOrEqual(1)
    const sheetsUpdate = updateSheetsQueries[0]
    expect(sheetsUpdate).not.toMatch(/SheetName\s*=/i)
  })

  it('persists InformationValues as expected (UPDATE or INSERT executed)', async () => {
    await updateFilledSheet(1, minimalUnifiedSheet, 1, { skipRevisionCreation: true })

    const infoValueQueries = executedQueries.filter((q) => {
      const n = q.replace(/\s+/g, ' ').toLowerCase()
      return (n.includes('update') || n.includes('insert')) && n.includes('informationvalues')
    })
    expect(infoValueQueries.length).toBeGreaterThanOrEqual(1)
  })

  it('with STRICT_FILLED_HEADER_GUARD unset: does not throw when sheetName differs (silent ignore)', async () => {
    const prev = process.env.STRICT_FILLED_HEADER_GUARD
    delete process.env.STRICT_FILLED_HEADER_GUARD

    const inputWithNewName = { ...minimalUnifiedSheet, sheetName: 'ChangedName' }
    const result = await updateFilledSheet(1, inputWithNewName, 1, { skipRevisionCreation: true })

    if (prev !== undefined) process.env.STRICT_FILLED_HEADER_GUARD = prev
    expect(result).toEqual({ sheetId: 1 })
  })
})

describe('updateFilledSheet strict header guard (STRICT_FILLED_HEADER_GUARD=1)', () => {
  const currentHeaderRow = {
    SheetName: 'Test',
    SheetDesc: '',
    SheetDesc2: '',
    ClientDocNum: 1,
    ClientProjNum: 1,
    CompanyDocNum: 1,
    CompanyProjNum: 1,
    AreaID: 1,
    PackageName: 'P',
    RevisionNum: 1,
    RevisionDate: '2026-01-01',
    ItemLocation: 'L',
    RequiredQty: 1,
    EquipmentName: 'E',
    EquipmentTagNum: 'TAG',
    ServiceName: 'S',
    ManuID: 1,
    SuppID: 1,
    InstallPackNum: null as string | null,
    EquipSize: 1,
    ModelNum: null as string | null,
    Driver: null as string | null,
    LocationDWG: null as string | null,
    PID: null as number | null,
    InstallDWG: null as string | null,
    CodeStd: null as string | null,
    CategoryID: 1,
    ClientID: 1,
    ProjectID: 1,
  }

  beforeEach(() => {
    executedQueries.length = 0
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
    queryResponses.push(
      { recordset: [{ Status: 'Draft' }] },
      { recordset: [{ InfoTemplateID: 1, Required: 0, Label: 'F1', InfoType: 'varchar' }] },
      { recordset: [] },
      { recordset: [currentHeaderRow] },
      { rowsAffected: [1] },
      {
        recordset: [
          { InfoTemplateID: 1, InfoValue: 'old', ValueSetID: null, Label: 'F1', UOM: null },
        ],
      },
      { recordset: [{ InfoTemplateID: 1, ValueSetID: null }] },
      { recordset: [{ InfoTemplateID: 1, UOM: null }] },
      { rowsAffected: [1] },
      { rowsAffected: [1] }
    )
  })

  it('changing sheetName triggers 400 and includes sheetName in payload', async () => {
    process.env.STRICT_FILLED_HEADER_GUARD = '1'

    const inputWithNewName = { ...minimalUnifiedSheet, sheetName: 'ChangedName' }
    const p = updateFilledSheet(1, inputWithNewName, 1, { skipRevisionCreation: true })

    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 400,
      payload: expect.objectContaining({
        headerFieldErrors: expect.arrayContaining([
          expect.objectContaining({ field: 'sheetName', message: 'Header fields are read-only on filled sheet edit.' }),
        ]),
      }),
    })

    delete process.env.STRICT_FILLED_HEADER_GUARD
  })
})

describe('updateFilledSheet SQL column names (Sheets / SheetRevisions)', () => {
  beforeEach(() => {
    executedQueries.length = 0
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
    queryResponses.push(
      { recordset: [{ Status: 'Draft' }] },
      { recordset: [{ InfoTemplateID: 1, Required: 0, Label: 'F1', InfoType: 'varchar' }] },
      { recordset: [] },
      { rowsAffected: [1] },
      {
        recordset: [
          { InfoTemplateID: 1, InfoValue: 'old', ValueSetID: null, Label: 'F1', UOM: null },
        ],
      },
      { recordset: [{ InfoTemplateID: 1, ValueSetID: null }] },
      { recordset: [{ InfoTemplateID: 1, UOM: null }] },
      { rowsAffected: [1] },
      { rowsAffected: [1] },
      { recordset: [{ NextRevisionNum: 1 }] },
      { recordset: [{ RevisionID: 1 }] }
    )
  })

  it('SQL does not contain RevisionNumber (uses RevisionNum)', async () => {
    await updateFilledSheet(1, minimalUnifiedSheet, 1)

    const withRevisionNumber = executedQueries.some((q) => q.includes('RevisionNumber'))
    expect(withRevisionNumber).toBe(false)

    const withRevisionNum = executedQueries.some((q) => q.includes('RevisionNum'))
    expect(withRevisionNum).toBe(true)
  })

  it('next revision number query uses SystemRevisionNum (or COALESCE)', async () => {
    await updateFilledSheet(1, minimalUnifiedSheet, 1)

    const nextNumQueries = executedQueries.filter((q) => {
      const n = q.replace(/\s+/g, ' ').toLowerCase()
      return n.includes('sheetrevisions') && n.includes('max') && n.includes('nextrevisionnum')
    })
    expect(nextNumQueries.length).toBeGreaterThanOrEqual(1)
    expect(nextNumQueries[0]).toMatch(/systemrevisionnum|coalesce\s*\(\s*r?\.?systemrevisionnum/i)
  })

  it('SheetRevisions INSERT includes SystemRevisionNum, SystemRevisionAt, RevisionNum, RevisionDate', async () => {
    await updateFilledSheet(1, minimalUnifiedSheet, 1)

    const insertSheetRevisions = executedQueries.filter((q) => {
      const n = q.replace(/\s+/g, ' ').toLowerCase()
      return n.includes('insert') && n.includes('sheetrevisions')
    })
    expect(insertSheetRevisions.length).toBeGreaterThanOrEqual(1)

    const insertSql = insertSheetRevisions[0]
    expect(insertSql).toMatch(/\bSystemRevisionNum\b/)
    expect(insertSql).toMatch(/\bSystemRevisionAt\b/)
    expect(insertSql).toMatch(/\bRevisionNum\b/)
    expect(insertSql).toMatch(/\bRevisionDate\b/)
  })

  it('SheetRevisions INSERT uses Notes (not Comment) and CreatedByID/CreatedByDate (not CreatedBy)', async () => {
    await updateFilledSheet(1, minimalUnifiedSheet, 1)

    const insertSheetRevisions = executedQueries.filter((q) => {
      const n = q.replace(/\s+/g, ' ').toLowerCase()
      return n.includes('insert') && n.includes('sheetrevisions')
    })
    expect(insertSheetRevisions.length).toBeGreaterThanOrEqual(1)

    const insertSql = insertSheetRevisions[0]
    expect(insertSql).not.toMatch(/\bComment\b/)
    expect(insertSql).toMatch(/\bNotes\b/)
    expect(insertSql).not.toMatch(/\bCreatedBy\b(?!ID|Date)/)
    expect(insertSql).toMatch(/\bCreatedByID\b/)
    expect(insertSql).toMatch(/\bCreatedByDate\b/)
  })

  it('SheetRevisions INSERT does not include RevisionID (relies on DB auto-gen)', async () => {
    await updateFilledSheet(1, minimalUnifiedSheet, 1)

    const insertSheetRevisions = executedQueries.filter((q) => {
      const n = q.replace(/\s+/g, ' ').toLowerCase()
      return n.includes('insert') && n.includes('sheetrevisions')
    })
    expect(insertSheetRevisions.length).toBeGreaterThanOrEqual(1)

    const insertSql = insertSheetRevisions[0]
    const insertColumnListMatch = /insert\s+into\s+dbo\.sheetrevisions\s*\(\s*([^)]+)\s*\)/i.exec(
      insertSql.replace(/\s+/g, ' ')
    )
    expect(insertColumnListMatch).toBeTruthy()
    const columnList = insertColumnListMatch![1]
    expect(columnList).not.toMatch(/\brevisionid\b/i)
  })
})
