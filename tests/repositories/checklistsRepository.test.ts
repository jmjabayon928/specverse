interface QueryCall {
  sql: string
}

class MockRequest {
  public static nextQueryHandlers: Array<
    jest.Mock<Promise<{ recordset: Array<Record<string, unknown>> }>, [string]>
  > = []

  public readonly inputs: Array<{ name: string; type: unknown; value: unknown }> = []
  public readonly queries: QueryCall[] = []

  private readonly queryHandler: jest.Mock<
    Promise<{ recordset: Array<Record<string, unknown>> }>,
    [string]
  >

  constructor() {
    const handler = MockRequest.nextQueryHandlers.shift()
    if (!handler) {
      this.queryHandler = jest
        .fn<Promise<{ recordset: Array<Record<string, unknown>> }>, [string]>()
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
  ): Promise<{ recordset: TRecord[] }> {
    this.queries.push({ sql: sqlText })
    const result = await this.queryHandler(sqlText)
    return { recordset: result.recordset as TRecord[] }
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

import { createChecklistRunWithEntries } from '@/backend/repositories/checklistsRepository'

describe('createChecklistRunWithEntries', () => {
  const baseArgs = {
    accountId: 1,
    userId: 2,
    checklistTemplateId: 3,
    runName: 'Run',
    notes: 'Notes',
    projectId: 10,
    facilityId: 20,
    systemId: 30,
    assetId: 40,
  }

  beforeEach(() => {
    mockTransactionInstances.length = 0
    MockRequest.nextQueryHandlers = []
  })

  it('uses a transaction, set-based tenant-scoped SQL, and returns result on success', async () => {
    const templateVersionHandler = jest
      .fn<Promise<{ recordset: Array<Record<string, unknown>> }>, [string]>()
      .mockResolvedValue({
        recordset: [{ VersionNumber: 2 }],
      })

    const insertRunHandler = jest
      .fn<Promise<{ recordset: Array<Record<string, unknown>> }>, [string]>()
      .mockResolvedValue({
        recordset: [{ ChecklistRunID: 123 }],
      })

    const insertEntriesHandler = jest
      .fn<Promise<{ recordset: Array<Record<string, unknown>> }>, [string]>()
      .mockResolvedValue({
        recordset: [{ EntryCount: 5 }],
      })

    MockRequest.nextQueryHandlers.push(templateVersionHandler, insertRunHandler, insertEntriesHandler)

    const result = await createChecklistRunWithEntries(baseArgs)

    expect(result).toEqual({
      checklistRunId: 123,
      entryCount: 5,
    })

    expect(mockTransactionInstances).toHaveLength(1)
    const tx = mockTransactionInstances[0]

    expect(tx.begin).toHaveBeenCalledTimes(1)
    expect(tx.commit).toHaveBeenCalledTimes(1)
    expect(tx.rollback).not.toHaveBeenCalled()

    expect(allRequests.length).toBeGreaterThanOrEqual(2)

    const allSql = allRequests
      .flatMap(request => request.queries)
      .map(q => q.sql)
      .join(' ')

    expect(allSql).toContain('SELECT VersionNumber')
    expect(allSql).toContain('FROM dbo.ChecklistTemplates')
    expect(allSql).toContain('WHERE AccountID = @AccountID')
    expect(allSql).toContain('INSERT INTO dbo.ChecklistRuns')
    expect(allSql).toContain('ChecklistTemplateVersionNumber')
    expect(allSql).toContain('OUTPUT inserted.ChecklistRunID')
    expect(allSql).toContain('INSERT INTO dbo.ChecklistRunEntries')
    expect(allSql).toContain('FROM dbo.ChecklistTemplateEntries te')
    expect(allSql).toContain('WHERE te.AccountID = @AccountID')
    expect(allSql).toContain('AND te.ChecklistTemplateID = @ChecklistTemplateID')
  })

  it('rolls back the transaction when entries insert fails', async () => {
    const templateVersionHandler = jest
      .fn<Promise<{ recordset: Array<Record<string, unknown>> }>, [string]>()
      .mockResolvedValue({
        recordset: [{ VersionNumber: 1 }],
      })

    const insertRunHandler = jest
      .fn<Promise<{ recordset: Array<Record<string, unknown>> }>, [string]>()
      .mockResolvedValue({
        recordset: [{ ChecklistRunID: 123 }],
      })

    const insertEntriesHandler = jest
      .fn<Promise<{ recordset: Array<Record<string, unknown>> }>, [string]>()
      .mockImplementation(async () => {
        throw new Error('entries failed')
      })

    MockRequest.nextQueryHandlers.push(templateVersionHandler, insertRunHandler, insertEntriesHandler)

    await expect(createChecklistRunWithEntries(baseArgs)).rejects.toThrow('entries failed')

    expect(mockTransactionInstances).toHaveLength(1)
    const tx = mockTransactionInstances[0]

    expect(tx.begin).toHaveBeenCalledTimes(1)
    expect(tx.commit).not.toHaveBeenCalled()
    expect(tx.rollback).toHaveBeenCalledTimes(1)
  })
})

