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
  VarBinary: (length: number) => unknown
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
    VarBinary: (length: number) => Symbol(`VarBinary(${length})`),
  }

  return {
    poolPromise,
    sql,
  }
})

import { patchChecklistRunEntry } from '@/backend/repositories/checklistsRepository'

describe('patchChecklistRunEntry', () => {
  const accountId = 1
  const userId = 2
  const runEntryId = 3

  beforeEach(() => {
    mockTransactionInstances.length = 0
    allRequests.length = 0
    MockRequest.nextQueryHandlers = []
  })

  it('updates provided fields with tenant-safe WHERE clause', async () => {
    const selectHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [
        {
          RowVersion: Buffer.from('rowversion', 'utf8'),
        },
      ],
    })

    const updateHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [],
      rowsAffected: [1],
    })

    MockRequest.nextQueryHandlers.push(selectHandler, updateHandler)

    const result = await patchChecklistRunEntry(accountId, userId, runEntryId, {
      result: 'PASS',
      notes: 'ok',
      expectedRowVersionBase64: 'ZXhwZWN0ZWQ=',
    })

    expect(result).toEqual({ exists: true, updatedRows: 1 })

    expect(allRequests.length).toBeGreaterThanOrEqual(2)
    const sqlText = allRequests
      .flatMap(request => request.queries)
      .map(q => q.sql)
      .join(' ')

    expect(sqlText).toContain('SELECT RowVersion')
    expect(sqlText).toContain('FROM dbo.ChecklistRunEntries')
    expect(sqlText).toContain('WHERE AccountID = @AccountID')
    expect(sqlText).toContain('AND ChecklistRunEntryID = @ChecklistRunEntryID')

    expect(sqlText).toContain('UPDATE dbo.ChecklistRunEntries')
    expect(sqlText).toContain('Result = @Result')
    expect(sqlText).toContain('Notes = @Notes')
    expect(sqlText).toContain('WHERE AccountID = @AccountID')
    expect(sqlText).toContain('AND ChecklistRunEntryID = @ChecklistRunEntryID')
    expect(sqlText).toContain('AND RowVersion = @ExpectedRowVersion')

    const updateRequest = allRequests[1]
    const inputNames = updateRequest.inputs.map(i => i.name)

    expect(inputNames).toContain('AccountID')
    expect(inputNames).toContain('ChecklistRunEntryID')
    expect(inputNames).toContain('Result')
    expect(inputNames).toContain('Notes')
    expect(inputNames).toContain('ExpectedRowVersion')
  })

  it('returns 0 rows when nothing is updated', async () => {
    const selectHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [
        {
          RowVersion: Buffer.from('rowversion', 'utf8'),
        },
      ],
    })

    const updateHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [],
      rowsAffected: [0],
    })

    MockRequest.nextQueryHandlers.push(selectHandler, updateHandler)

    const result = await patchChecklistRunEntry(accountId, userId, runEntryId, {
      result: 'FAIL',
      expectedRowVersionBase64: 'ZXhwZWN0ZWQ=',
    })

    expect(result).toEqual({ exists: true, updatedRows: 0 })
  })
})

