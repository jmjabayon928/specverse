// tests/services/filledSheetLifecycleGuards.test.ts
// Minimal regression tests for Phase 1–3 lifecycle guards (createFilledSheet, approveFilledSheet).

const queryResponses: Array<{ recordset?: unknown[]; rowsAffected?: number[] }> = []

function makeRequest() {
  return {
    input: jest.fn().mockReturnThis(),
    query: jest.fn(() => {
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
    Date: Date,
    Bit: 0,
    MAX: 2147483647,
    Transaction: jest.fn().mockImplementation(() => mockTransaction),
  },
}))

jest.mock('../../src/backend/database/valueSetQueries', () => ({
  ensureRequirementValueSet: jest.fn().mockResolvedValue(1),
  getValueSetStatus: jest.fn().mockResolvedValue('Draft'),
  getValueSetId: jest.fn(),
  ensureRequirementValueSetInTransaction: jest.fn().mockResolvedValue(1),
  getContextIdByCode: jest.fn(),
  createValueSet: jest.fn(),
  listValueSets: jest.fn(),
}))

jest.mock('../../src/backend/utils/notifyUsers', () => ({
  notifyUsers: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../src/backend/database/sheetRevisionQueries', () => ({
  createRevision: jest.fn().mockResolvedValue(1),
}))

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
}))

import {
  createFilledSheet,
  approveFilledSheet,
  getLatestApprovedTemplateId,
  bumpRejectedToModifiedDraftFilled,
} from '../../src/backend/services/filledSheetService'
import { AppError } from '../../src/backend/errors/AppError'

const minimalCreateInput = {
  templateId: 1,
  sheetName: 'Test',
  equipmentName: 'Eq',
  equipmentTagNum: 'TAG-1',
  categoryId: 1,
  clientId: 1,
  projectId: 1,
  fieldValues: {} as Record<string, string>,
  sheetDesc: '',
  sheetDesc2: '',
  clientDocNum: 1,
  clientProjectNum: 1,
  companyDocNum: 1,
  companyProjectNum: 1,
  areaId: 1,
  packageName: 'Pkg',
  revisionNum: 1,
  revisionDate: '2026-01-01',
  itemLocation: 'Loc',
  requiredQty: 1,
  serviceName: 'Svc',
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
  preparedById: 1,
  preparedByDate: '2026-01-01',
  subsheets: [],
}

describe('createFilledSheet lifecycle guards', () => {
  beforeEach(() => {
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
  })

  it('rejects with 409 when template status is not Approved', async () => {
    queryResponses.push({
      recordset: [{ Status: 'Draft', IsLatest: 1, IsTemplate: 1 }],
    })

    const p = createFilledSheet(
      minimalCreateInput as Parameters<typeof createFilledSheet>[0],
      { userId: 1, route: '/test', method: 'POST' }
    )
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('only be created from an approved template'),
    })
  })

  it('rejects with 409 when template IsLatest is not 1', async () => {
    queryResponses.push({
      recordset: [{ Status: 'Approved', IsLatest: 0, IsTemplate: 1 }],
    })

    const p = createFilledSheet(
      minimalCreateInput as Parameters<typeof createFilledSheet>[0],
      { userId: 1, route: '/test', method: 'POST' }
    )
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('latest version of the template'),
    })
  })
})

describe('getLatestApprovedTemplateId', () => {
  beforeEach(() => {
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
  })

  it('returns source template id when it is Approved and IsLatest', async () => {
    queryResponses.push({
      recordset: [
        {
          SheetID: 5,
          Status: 'Approved',
          IsLatest: 1,
          IsTemplate: 1,
          ParentSheetID: null,
        },
      ],
    })

    const id = await getLatestApprovedTemplateId(5)
    expect(id).toBe(5)
  })

  it('returns child template id when source is not latest', async () => {
    queryResponses.push(
      {
        recordset: [
          {
            SheetID: 5,
            Status: 'Approved',
            IsLatest: 0,
            IsTemplate: 1,
            ParentSheetID: null,
          },
        ],
      },
      { recordset: [{ SheetID: 99 }] },
      { recordset: [] },
      { recordset: [{ SheetID: 99 }] }
    )

    const id = await getLatestApprovedTemplateId(5)
    expect(id).toBe(99)
  })

  it('throws 409 when no latest approved template in chain', async () => {
    queryResponses.push(
      {
        recordset: [
          {
            SheetID: 5,
            Status: 'Draft',
            IsLatest: 0,
            IsTemplate: 1,
            ParentSheetID: null,
          },
        ],
      },
      { recordset: [] },
      { recordset: [] }
    )

    const p = getLatestApprovedTemplateId(5)
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('No latest approved template'),
    })
  })

  it('throws 409 when source is not a template (non-template rows ignored)', async () => {
    queryResponses.push({ recordset: [] })

    const p = getLatestApprovedTemplateId(5)
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('not a template'),
    })
  })

  it('throws 409 when multiple latest approved templates in chain', async () => {
    queryResponses.push(
      {
        recordset: [
          {
            SheetID: 5,
            Status: 'Approved',
            IsLatest: 0,
            IsTemplate: 1,
            ParentSheetID: null,
          },
        ],
      },
      { recordset: [{ SheetID: 99 }, { SheetID: 98 }] },
      { recordset: [] },
      { recordset: [] },
      { recordset: [{ SheetID: 99 }, { SheetID: 98 }] }
    )

    const p = getLatestApprovedTemplateId(5)
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Multiple latest'),
    })
  })
})

describe('approveFilledSheet lifecycle guards', () => {
  beforeEach(() => {
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
  })

  it('rejects with 409 when filled sheet status is Draft', async () => {
    queryResponses.push({ recordset: [{ Status: 'Draft' }] })

    const p = approveFilledSheet(1, 'approve', undefined, 1)
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('only be approved or rejected when status is Verified'),
    })
  })

  it('resolves with sheetId when action is approve and status is Verified', async () => {
    queryResponses.push(
      { recordset: [{ Status: 'Verified' }] },
      { rowsAffected: [1] },
      { recordset: [{ PreparedByID: 1 }] },
      { recordset: [] }
    )

    const result = await approveFilledSheet(1, 'approve', undefined, 1)
    expect(result).toBe(1)
  })

  it('persists Rejected when action is reject with rejectComment', async () => {
    queryResponses.push(
      { recordset: [{ Status: 'Verified' }] },
      { rowsAffected: [1] },
      { recordset: [{ PreparedByID: 1 }] },
      { recordset: [] }
    )

    const result = await approveFilledSheet(1, 'reject', 'Needs changes', 1)
    expect(result).toBe(1)
  })
})

describe('bumpRejectedToModifiedDraftFilled', () => {
  beforeEach(() => {
    queryResponses.length = 0
    mockTransaction.request.mockImplementation(() => makeRequest())
  })

  it('runs UPDATE with Status = Modified Draft and RejectedByID = NULL for Rejected filled sheet', async () => {
    const { poolPromise } = await import('../../src/backend/config/db')
    const pool = (await poolPromise) as unknown as {
      request: () => ReturnType<typeof makeRequest>
    }
    let requestChain: ReturnType<typeof makeRequest> | null = null
    const originalRequest = pool.request
    pool.request = () => {
      requestChain = makeRequest()
      return requestChain
    }

    await bumpRejectedToModifiedDraftFilled(10, 1)

    expect(requestChain).not.toBeNull()
    const chain = requestChain!
    const queryCalls = (chain.query as jest.Mock).mock.calls as [string][]
    const hasBump = queryCalls.some(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('Modified Draft') &&
        call[0].includes('RejectedByID = NULL')
    )
    expect(hasBump).toBe(true)
    pool.request = originalRequest
  })
})
