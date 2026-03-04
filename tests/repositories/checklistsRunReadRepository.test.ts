interface QueryCall {
  sql: string
}

interface QueryResult {
  recordset: Array<Record<string, unknown>>
  rowsAffected?: number[]
}

class MockRequest {
  public static nextQueryHandlers: Array<jest.Mock<Promise<QueryResult>, [string]>> = []

  public readonly inputs: Array<{ name: string; type: unknown; value: unknown }> = []
  public readonly queries: QueryCall[] = []

  private readonly queryHandler: jest.Mock<Promise<QueryResult>, [string]>

  constructor() {
    const handler = MockRequest.nextQueryHandlers.shift()
    if (!handler) {
      this.queryHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
        recordset: [],
      })
    } else {
      this.queryHandler = handler
    }
    allRequests.push(this)
  }

  input(name: string, type: unknown, value: unknown): this {
    this.inputs.push({ name, type, value })
    return this
  }

  async query<TRecord extends Record<string, unknown>>(
    sqlText: string,
  ): Promise<{ recordset: TRecord[]; rowsAffected?: number[] }> {
    this.queries.push({ sql: sqlText })
    const result = await this.queryHandler(sqlText)

    const base: { recordset: TRecord[]; rowsAffected?: number[] } = {
      recordset: result.recordset as TRecord[],
    }

    if (Array.isArray(result.rowsAffected)) {
      base.rowsAffected = result.rowsAffected
    }

    return base
  }
}

class MockTransaction {
  public readonly begin = jest.fn<Promise<void>, []>(async () => {})
  public readonly commit = jest.fn<Promise<void>, []>(async () => {})
  public readonly rollback = jest.fn<Promise<void>, []>(async () => {})

  public readonly requests: MockRequest[] = []

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_pool: unknown) {}

  request(): MockRequest {
    const req = new MockRequest()
    this.requests.push(req)
    return req
  }
}

interface MockSqlModule {
  Transaction: typeof MockTransaction
  Request: typeof MockRequest
  Int: unknown
  BigInt: unknown
  NVarChar: (length: number) => unknown
}

const mockTransactionInstances: MockTransaction[] = []
const allRequests: MockRequest[] = []

jest.mock('@/backend/config/db', () => {
  const poolPromise = Promise.resolve({}) as Promise<{}>

  class TrackedTransaction extends MockTransaction {
    constructor(pool: unknown) {
      super(pool)
      mockTransactionInstances.push(this)
    }
  }

  const sql: MockSqlModule = {
    Transaction: TrackedTransaction,
    Request: MockRequest,
    Int: Symbol('Int'),
    BigInt: Symbol('BigInt'),
    NVarChar: (length: number) => Symbol(`NVarChar(${length})`),
  }

  return {
    poolPromise,
    sql,
  }
})

import { getChecklistRun } from '@/backend/repositories/checklistsRepository'

describe('getChecklistRun', () => {
  const accountId = 1
  const runId = 10

  beforeEach(() => {
    mockTransactionInstances.length = 0
    allRequests.length = 0
    MockRequest.nextQueryHandlers = []
  })

  it('uses account-scoped queries for run, entries, and attachments', async () => {
    const headerHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [
        {
          ChecklistRunID: runId,
          ChecklistTemplateID: 100,
          RunName: 'Run name',
          Notes: null,
          ProjectID: null,
          FacilityID: null,
          SystemID: null,
          AssetID: null,
          Status: 'DRAFT',
        },
      ],
    })

    const entriesHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [
        {
          ChecklistRunEntryID: 200,
          ChecklistTemplateEntryID: 300,
          SortOrder: 1,
          Result: 'PENDING',
          Notes: null,
          MeasuredValue: null,
          Uom: null,
        },
      ],
    })

    const attachmentsHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [
        {
          ChecklistRunEntryID: 200,
          AttachmentID: 500,
        },
      ],
    })

    const attachmentsMetaHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [
        {
          ChecklistRunEntryID: 200,
          AttachmentID: 500,
          StoredName: 'stored-file',
          ContentType: 'application/pdf',
          FileSizeBytes: 1234,
          UploadedAt: new Date('2024-01-01T00:00:00.000Z'),
          UploadedByUserID: 7,
          UploadedByFirstName: 'Jane',
          UploadedByLastName: 'Doe',
          UploadedByEmail: 'jane@example.com',
        },
      ],
    })

    MockRequest.nextQueryHandlers.push(
      headerHandler,
      entriesHandler,
      attachmentsHandler,
      attachmentsMetaHandler,
    )

    const result = await getChecklistRun(accountId, runId)

    expect(result).not.toBeNull()
    expect(result?.runId).toBe(runId)
    const firstEntry = result?.entries[0]
    expect(firstEntry?.evidenceAttachmentIds).toEqual([500])
    expect(firstEntry?.evidenceAttachments[0]?.attachmentId).toBe(500)
    expect(firstEntry?.evidenceAttachments[0]?.uploadedBy?.userId).toBe(7)

    expect(allRequests.length).toBeGreaterThanOrEqual(4)

    const allSql = allRequests
      .flatMap(request => request.queries)
      .map(q => q.sql)
      .join(' ')

    expect(allSql).toContain('FROM dbo.ChecklistRuns')
    expect(allSql).toContain('WHERE AccountID = @AccountID')
    expect(allSql).toContain('AND ChecklistRunID = @ChecklistRunID')

    expect(allSql).toContain('FROM dbo.ChecklistRunEntries')
    expect(allSql).toContain('WHERE AccountID = @AccountID')
    expect(allSql).toContain('AND ChecklistRunID = @ChecklistRunID')

    expect(allSql).toContain('FROM dbo.ChecklistRunEntryAttachments')
    expect(allSql).toContain('INNER JOIN dbo.ChecklistRunEntries cre')
    expect(allSql).toContain('cre.AccountID = @AccountID')
    expect(allSql).toContain('INNER JOIN dbo.Attachments a')
    expect(allSql).toContain('a.AccountID = @AccountID')
  })
})

