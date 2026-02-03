// tests/services/createFilledSheet.wiring.test.ts
// Service-level wiring: createFilledSheet with repo/DB stubbed to prove meta+values mapping matches validated shapes.
// Contract: create/clone does not create revisions; first save does. createFilledSheet must not call createRevision.

import { AppError } from '../../src/backend/errors/AppError'
import type { UnifiedSheet } from '../../src/domain/datasheets/sheetTypes'

const queryResultQueue: unknown[] = []
const mockCreateRevision = jest.fn()

// Stub config/db so createFilledSheet's runInTransaction uses our queue (same module the service imports).
jest.mock('../../src/backend/config/db', () => {
  const defaultResult = { recordset: [] as unknown[], recordsets: [[]], rowsAffected: [0] }
  const createRequest = () => ({
    input: function (this: { query: () => Promise<unknown> }) {
      return this
    },
    query: function (this: { query: () => Promise<unknown> }) {
      const next = queryResultQueue.shift()
      return Promise.resolve(next ?? defaultResult)
    },
  })
  return {
    poolPromise: Promise.resolve({ request: createRequest }),
    sql: {
      Transaction: function (this: Record<string, unknown>) {
        Object.assign(this, {
          begin: () => Promise.resolve(),
          commit: () => Promise.resolve(),
          rollback: () => Promise.resolve(),
          request: createRequest,
        })
        return this
      },
      Int: () => ({}),
      VarChar: () => ({}),
      NVarChar: () => ({}),
      Bit: () => ({}),
      Date: () => ({}),
      DateTime: () => ({}),
      MAX: {},
    },
  }
})

jest.mock('../../src/backend/database/valueSetQueries', () => ({
  ...jest.requireActual<typeof import('../../src/backend/database/valueSetQueries')>(
    '../../src/backend/database/valueSetQueries'
  ),
  ensureRequirementValueSetInTransaction: jest.fn().mockResolvedValue(1),
}))

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../src/backend/utils/notifyUsers', () => ({
  notifyUsers: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../src/backend/database/sheetRevisionQueries', () => {
  const actual =
    jest.requireActual<typeof import('../../src/backend/database/sheetRevisionQueries')>(
      '../../src/backend/database/sheetRevisionQueries'
    )
  return {
    ...actual,
    createRevision: (...args: unknown[]) => mockCreateRevision(...args),
  }
})

const INFO_TEMPLATE_ID_DECIMAL = 3792
const INFO_TEMPLATE_ID_OPTION = 3797
const SUB_NAME = 'Sub1'

const ID_3792 = 3792
const ID_3795 = 3795
const ID_3796 = 3796
const ID_3797 = 3797

const templateMetaResult = {
  recordset: [{ Status: 'Approved', IsLatest: 1, IsTemplate: 1 }],
  recordsets: [[]],
  rowsAffected: [0],
}

const templateFieldsResult = {
  recordset: [
    {
      InfoTemplateID: INFO_TEMPLATE_ID_DECIMAL,
      Required: 0,
      UOM: null,
      OrderIndex: 0,
      SubName: SUB_NAME,
      Label: 'Information_dec',
      InfoType: 'decimal',
    },
    {
      InfoTemplateID: INFO_TEMPLATE_ID_OPTION,
      Required: 0,
      UOM: null,
      OrderIndex: 1,
      SubName: SUB_NAME,
      Label: 'Info_vchar',
      InfoType: 'varchar',
    },
  ],
  recordsets: [[]],
  rowsAffected: [0],
}

const optionsResult = {
  recordset: [{ InfoTemplateID: INFO_TEMPLATE_ID_OPTION, OptionValue: 'D ', SortOrder: 0 }],
  recordsets: [[]],
  rowsAffected: [0],
}

const templateFieldsResult4 = {
  recordset: [
    { InfoTemplateID: ID_3792, Required: 0, UOM: null, OrderIndex: 0, SubName: SUB_NAME, Label: 'Dec1', InfoType: 'decimal' },
    { InfoTemplateID: ID_3795, Required: 0, UOM: null, OrderIndex: 1, SubName: SUB_NAME, Label: 'Dec2', InfoType: 'decimal' },
    { InfoTemplateID: ID_3796, Required: 0, UOM: null, OrderIndex: 2, SubName: SUB_NAME, Label: 'Opt1', InfoType: 'varchar' },
    { InfoTemplateID: ID_3797, Required: 0, UOM: null, OrderIndex: 3, SubName: SUB_NAME, Label: 'Opt2', InfoType: 'varchar' },
  ],
  recordsets: [[]],
  rowsAffected: [0],
}

const optionsResult4 = {
  recordset: [
    { InfoTemplateID: ID_3796, OptionValue: 'A', SortOrder: 0 },
    { InfoTemplateID: ID_3796, OptionValue: 'B', SortOrder: 1 },
    { InfoTemplateID: ID_3796, OptionValue: 'C', SortOrder: 2 },
    { InfoTemplateID: ID_3797, OptionValue: 'D', SortOrder: 0 },
    { InfoTemplateID: ID_3797, OptionValue: 'E', SortOrder: 1 },
    { InfoTemplateID: ID_3797, OptionValue: 'F', SortOrder: 2 },
  ],
  recordsets: [[]],
  rowsAffected: [0],
}

const templateSheetRowResult = {
  recordset: [{ DisciplineID: null, SubtypeID: null }],
  recordsets: [[]],
  rowsAffected: [0],
}

const insertSheetResult = {
  recordset: [{ SheetID: 999 }],
  recordsets: [[]],
  rowsAffected: [1],
}

const insertSubsheetResult = {
  recordset: [{ SubID: 1 }],
  recordsets: [[]],
  rowsAffected: [1],
}

const insertInfoTemplateResult = (infoTemplateId: number) => ({
  recordset: [{ InfoTemplateID: infoTemplateId }],
  recordsets: [[]],
  rowsAffected: [1],
})

const emptyResult = { recordset: [], recordsets: [[]], rowsAffected: [0] }

function buildMinimalPayload(fieldValues: Record<string, string>): UnifiedSheet & { fieldValues: Record<string, string> } {
  const payload: UnifiedSheet & { fieldValues: Record<string, string> } = {
    templateId: 1,
    sheetName: 'S',
    sheetDesc: '',
    sheetDesc2: '',
    equipmentName: 'E',
    equipmentTagNum: 'T',
    categoryId: 1,
    clientId: 1,
    projectId: 1,
    areaId: 0,
    manuId: 0,
    suppId: 0,
    clientDocNum: 0,
    clientProjectNum: 0,
    companyDocNum: 0,
    companyProjectNum: 0,
    revisionNum: 0,
    revisionDate: '',
    serviceName: '',
    requiredQty: 0,
    itemLocation: '',
    equipSize: 0,
    packageName: '',
    locationDwg: '',
    installDwg: '',
    codeStd: '',
    driver: '',
    modelNum: '',
    preparedById: 1,
    preparedByDate: '',
    subsheets: [
      {
        name: SUB_NAME,
        id: 1,
        fields: [
          {
            id: INFO_TEMPLATE_ID_DECIMAL,
            label: 'Information_dec',
            infoType: 'decimal',
            sortOrder: 0,
            required: false,
          },
          {
            id: INFO_TEMPLATE_ID_OPTION,
            label: 'Info_vchar',
            infoType: 'varchar',
            sortOrder: 1,
            required: false,
            options: ['D ', 'E', 'F'],
          },
        ],
      },
    ],
    fieldValues,
  }
  return payload
}

function buildPayloadFourFields(fieldValues: Record<string, string>): UnifiedSheet & { fieldValues: Record<string, string> } {
  return {
    ...buildMinimalPayload(fieldValues),
    subsheets: [
      {
        name: SUB_NAME,
        id: 1,
        fields: [
          { id: ID_3792, label: 'Dec1', infoType: 'decimal', sortOrder: 0, required: false },
          { id: ID_3795, label: 'Dec2', infoType: 'decimal', sortOrder: 1, required: false },
          { id: ID_3796, label: 'Opt1', infoType: 'varchar', sortOrder: 2, required: false, options: ['A', 'B', 'C'] },
          { id: ID_3797, label: 'Opt2', infoType: 'varchar', sortOrder: 3, required: false, options: ['D', 'E', 'F'] },
        ],
      },
    ],
    fieldValues,
  }
}

const sheetBelongsToAccountResult = { recordset: [{ Ex: 1 }], recordsets: [[]], rowsAffected: [0] }

function enqueueSuccessResponses(): void {
  queryResultQueue.length = 0
  // Order matches createFilledSheet: sheetBelongsToAccount (gate), then template meta/fields/options, templateSheetRow, insertSheet,
  // then cloneSubsheetsAndFields: insertSubsheet, per-field insertInfoTemplate, insertInfoValue, insertInfoOptions.
  queryResultQueue.push(
    sheetBelongsToAccountResult,
    templateMetaResult,
    templateFieldsResult,
    optionsResult,
    templateSheetRowResult,
    insertSheetResult,
    insertSubsheetResult,
    insertInfoTemplateResult(1001),
    emptyResult, // insertInfoValue (field 0)
    insertInfoTemplateResult(1002),
    emptyResult,
    emptyResult,
    emptyResult, // insertInfoOptions x3 for field 1
    emptyResult // insertInfoValue (field 1)
  )
}

function enqueueValidationOnlyResponses(): void {
  queryResultQueue.length = 0
  queryResultQueue.push(sheetBelongsToAccountResult, templateMetaResult, templateFieldsResult, optionsResult)
}

function enqueueSuccessResponsesFourFields(): void {
  queryResultQueue.length = 0
  queryResultQueue.push(
    sheetBelongsToAccountResult,
    templateMetaResult,
    templateFieldsResult4,
    optionsResult4,
    templateSheetRowResult,
    insertSheetResult,
    insertSubsheetResult,
    insertInfoTemplateResult(1001),
    emptyResult, // insertInfoValue 3792
    insertInfoTemplateResult(1002),
    emptyResult, // insertInfoValue 3795
    insertInfoTemplateResult(1003),
    emptyResult,
    emptyResult,
    emptyResult, // insertInfoOptions x3 for 3796
    emptyResult, // insertInfoValue 3796
    insertInfoTemplateResult(1004),
    emptyResult,
    emptyResult,
    emptyResult, // insertInfoOptions x3 for 3797
    emptyResult // insertInfoValue 3797
  )
}

describe('createFilledSheet wiring (stubbed DB)', () => {
  beforeEach(() => {
    queryResultQueue.length = 0
    mockCreateRevision.mockClear()
  })

  it('does not call createRevision (create/clone does not create revisions; first save does)', async () => {
    enqueueSuccessResponses()
    const { createFilledSheet } = await import('../../src/backend/services/filledSheetService')
    const payload = buildMinimalPayload({
      [String(INFO_TEMPLATE_ID_DECIMAL)]: '2.0',
      [String(INFO_TEMPLATE_ID_OPTION)]: 'D',
    })

    await createFilledSheet(payload, { userId: 1, route: '/test', method: 'POST' }, 1)

    expect(mockCreateRevision).not.toHaveBeenCalled()
  })

  it('resolves with sheetId when fieldValues have decimal "2.0" and option "D" (meta has "D ")', async () => {
    enqueueSuccessResponses()
    const { createFilledSheet } = await import('../../src/backend/services/filledSheetService')
    const payload = buildMinimalPayload({
      [String(INFO_TEMPLATE_ID_DECIMAL)]: '2.0',
      [String(INFO_TEMPLATE_ID_OPTION)]: 'D',
    })

    const result = await createFilledSheet(payload, { userId: 1, route: '/test', method: 'POST' }, 1)

    expect(result).toEqual({ sheetId: 999 })
  })

  it('throws AppError 400 with fieldErrors containing infoTemplateId when decimal is "abc"', async () => {
    enqueueValidationOnlyResponses()
    const { createFilledSheet } = await import('../../src/backend/services/filledSheetService')
    const payload = buildMinimalPayload({
      [String(INFO_TEMPLATE_ID_DECIMAL)]: 'abc',
      [String(INFO_TEMPLATE_ID_OPTION)]: 'D',
    })

    const err = await createFilledSheet(payload, { userId: 1, route: '/test', method: 'POST' }, 1).catch(
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).statusCode).toBe(400)
    const fieldErrors = (err as AppError).payload?.fieldErrors as Array<{ infoTemplateId: number }> | undefined
    expect(fieldErrors).toBeDefined()
    expect(Array.isArray(fieldErrors)).toBe(true)
    expect(fieldErrors?.some((e) => e.infoTemplateId === INFO_TEMPLATE_ID_DECIMAL)).toBe(true)
  })

  it('validates against fieldValues string keys and passes for 3792/3795/3796/3797', async () => {
    enqueueSuccessResponsesFourFields()
    const { createFilledSheet } = await import('../../src/backend/services/filledSheetService')
    const fieldValues: Record<string, string> = {
      [String(ID_3792)]: '2',
      [String(ID_3795)]: '2',
      [String(ID_3796)]: 'A',
      [String(ID_3797)]: 'D',
    }
    const payload = buildPayloadFourFields(fieldValues)

    const result = await createFilledSheet(payload, { userId: 1, route: '/test', method: 'POST' }, 1)

    expect(result).toEqual({ sheetId: 999 })
  })
})
