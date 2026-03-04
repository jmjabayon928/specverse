interface QueryCall {
  sql: string
}

interface QueryResult {
  recordset: Array<Record<string, unknown>>
  rowsAffected?: number[]
}

class MockRequest {
  public static nextQueryHandlers: Array<
    jest.Mock<Promise<QueryResult>, [string]>
  > = []

  public readonly inputs: Array<{ name: string; type: unknown; value: unknown }> = []
  public readonly queries: QueryCall[] = []

  private readonly queryHandler: jest.Mock<Promise<QueryResult>, [string]>

  constructor() {
    const handler = MockRequest.nextQueryHandlers.shift()
    if (!handler) {
      this.queryHandler = jest
        .fn<Promise<QueryResult>, [string]>()
        .mockResolvedValue({ recordset: [] })
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

import { uploadChecklistRunEntryEvidence } from '@/backend/repositories/checklistsRepository'

describe('uploadChecklistRunEntryEvidence', () => {
  const baseArgs = {
    accountId: 1,
    userId: 2,
    runEntryId: 3,
    storedName: 'stored-file',
    storageProvider: 'local',
    storagePath: '/tmp/stored-file',
    sha256: null,
  }

  beforeEach(() => {
    mockTransactionInstances.length = 0
    allRequests.length = 0
    MockRequest.nextQueryHandlers = []
  })

  it('uses tenant-safe SQL and commits on success', async () => {
    const runEntryCheckHandler = jest
      .fn<Promise<QueryResult>, [string]>()
      .mockResolvedValue({
        recordset: [{ ExistsFlag: 1 }],
      })

    const insertAttachmentHandler = jest
      .fn<Promise<QueryResult>, [string]>()
      .mockResolvedValue({
        recordset: [{ AttachmentID: 10 }],
      })

    const linkHandler = jest
      .fn<Promise<QueryResult>, [string]>()
      .mockResolvedValue({
        recordset: [],
        rowsAffected: [1],
      })

    MockRequest.nextQueryHandlers.push(
      runEntryCheckHandler,
      insertAttachmentHandler,
      linkHandler,
    )

    const result = await uploadChecklistRunEntryEvidence(baseArgs)

    expect(result).toEqual({
      attachmentId: 10,
      attachment: {
        attachmentId: 10,
        originalName: 'stored-file',
        contentType: 'local',
        fileSizeBytes: 0,
        uploadedAt: expect.any(String),
        uploadedBy: null,
      },
    })

    expect(mockTransactionInstances).toHaveLength(1)
    const tx = mockTransactionInstances[0]

    expect(tx.begin).toHaveBeenCalledTimes(1)
    expect(tx.commit).toHaveBeenCalledTimes(1)
    expect(tx.rollback).not.toHaveBeenCalled()

    expect(allRequests.length).toBeGreaterThanOrEqual(3)

    const allSql = allRequests
      .flatMap(request => request.queries)
      .map(q => q.sql)
      .join(' ')

    expect(allSql).toContain('FROM dbo.ChecklistRunEntries')
    expect(allSql).toContain('WHERE AccountID = @AccountID')
    expect(allSql).toContain('AND ChecklistRunEntryID = @ChecklistRunEntryID')

    expect(allSql).toContain('INSERT INTO dbo.Attachments')

    expect(allSql).toContain('INSERT INTO dbo.ChecklistRunEntryAttachments')
    expect(allSql).toContain('FROM dbo.ChecklistRunEntries cre')
    expect(allSql).toContain('INNER JOIN dbo.Attachments a ON a.AttachmentID = @AttachmentID')
    expect(allSql).toContain('a.AccountID = @AccountID')
  })

  it('rolls back the transaction when link insert fails', async () => {
    const runEntryCheckHandler = jest
      .fn<Promise<QueryResult>, [string]>()
      .mockResolvedValue({
        recordset: [{ ExistsFlag: 1 }],
      })

    const insertAttachmentHandler = jest
      .fn<Promise<QueryResult>, [string]>()
      .mockResolvedValue({
        recordset: [{ AttachmentID: 10 }],
      })

    const linkHandler = jest
      .fn<Promise<QueryResult>, [string]>()
      .mockImplementation(async () => {
        throw new Error('link failed')
      })

    MockRequest.nextQueryHandlers.push(
      runEntryCheckHandler,
      insertAttachmentHandler,
      linkHandler,
    )

    await expect(uploadChecklistRunEntryEvidence(baseArgs)).rejects.toThrow('link failed')

    expect(mockTransactionInstances).toHaveLength(1)
    const tx = mockTransactionInstances[0]

    expect(tx.begin).toHaveBeenCalledTimes(1)
    expect(tx.commit).not.toHaveBeenCalled()
    expect(tx.rollback).toHaveBeenCalledTimes(1)
  })
})

