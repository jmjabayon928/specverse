interface QueryResult {
  recordset: Array<Record<string, unknown>>
  rowsAffected?: number[]
}

class MockRequest {
  public static nextQueryHandlers: Array<jest.Mock<Promise<QueryResult>, [string]>> = []

  public readonly inputs: Array<{ name: string; type: unknown; value: unknown }> = []
  public readonly queries: Array<{ sql: string }> = []

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

const mockTransactionInstances: Array<{ begin: jest.Mock; commit: jest.Mock; rollback: jest.Mock }> = []
const allRequests: MockRequest[] = []

jest.mock('@/backend/config/db', () => {
  const poolPromise = Promise.resolve({}) as Promise<{}>

  class MockTransaction {
    public readonly begin = jest.fn<Promise<void>, []>(async () => {})
    public readonly commit = jest.fn<Promise<void>, []>(async () => {})
    public readonly rollback = jest.fn<Promise<void>, []>(async () => {})

    public readonly requests: MockRequest[] = []

    constructor(_pool: unknown) {
      mockTransactionInstances.push(this)
    }

    request(): MockRequest {
      const req = new MockRequest()
      this.requests.push(req)
      return req
    }
  }

  const sql = {
    Transaction: MockTransaction,
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

import { AppError } from '@/backend/errors/AppError'
import { patchChecklistRun } from '@/backend/repositories/checklistsRepository'

describe('patchChecklistRun', () => {
  const accountId = 1
  const userId = 2
  const runId = 10

  beforeEach(() => {
    mockTransactionInstances.length = 0
    allRequests.length = 0
    MockRequest.nextQueryHandlers = []
  })

  it('allows cancelling IN_PROGRESS runs', async () => {
    const checkHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [{ Status: 'IN_PROGRESS' }],
    })

    const updateHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [],
      rowsAffected: [1],
    })

    MockRequest.nextQueryHandlers.push(checkHandler, updateHandler)

    const result = await patchChecklistRun({
      accountId,
      userId,
      runId,
      input: { status: 'CANCELLED' },
    })

    expect(result).toEqual({ exists: true, updatedRows: 1 })

    const sqlText = allRequests
      .flatMap(request => request.queries)
      .map(q => q.sql)
      .join(' ')

    expect(sqlText).toContain('SELECT Status')
    expect(sqlText).toContain('UPDATE dbo.ChecklistRuns')
    expect(sqlText).toContain('Status = @Status')
    expect(sqlText).toContain('UpdatedAt = SYSUTCDATETIME()')
  })

  it('blocks cancelling DRAFT runs', async () => {
    const checkHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [{ Status: 'DRAFT' }],
    })

    MockRequest.nextQueryHandlers.push(checkHandler)

    await expect(
      patchChecklistRun({
        accountId,
        userId,
        runId,
        input: { status: 'CANCELLED' },
      }),
    ).rejects.toThrow('Can only cancel IN_PROGRESS checklist runs')
  })

  it('blocks changing status of COMPLETED runs', async () => {
    const checkHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [{ Status: 'COMPLETED' }],
    })

    MockRequest.nextQueryHandlers.push(checkHandler)

    await expect(
      patchChecklistRun({
        accountId,
        userId,
        runId,
        input: { status: 'CANCELLED' },
      }),
    ).rejects.toThrow('Cannot change status of COMPLETED checklist run')
  })

  it('blocks manual transitions to DRAFT or IN_PROGRESS', async () => {
    const checkHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [{ Status: 'IN_PROGRESS' }],
    })

    MockRequest.nextQueryHandlers.push(checkHandler)

    await expect(
      patchChecklistRun({
        accountId,
        userId,
        runId,
        input: { status: 'DRAFT' },
      }),
    ).rejects.toThrow('Status transitions to DRAFT or IN_PROGRESS are automatic')
  })

  it('returns exists: false when run not found', async () => {
    const checkHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [],
    })

    MockRequest.nextQueryHandlers.push(checkHandler)

    const result = await patchChecklistRun({
      accountId,
      userId,
      runId,
      input: { status: 'CANCELLED' },
    })

    expect(result).toEqual({ exists: false, updatedRows: 0 })
  })

  it('updates UpdatedAt even when status does not change', async () => {
    const checkHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [{ Status: 'IN_PROGRESS' }],
    })

    const updateHandler = jest.fn<Promise<QueryResult>, [string]>().mockResolvedValue({
      recordset: [],
      rowsAffected: [1],
    })

    MockRequest.nextQueryHandlers.push(checkHandler, updateHandler)

    const result = await patchChecklistRun({
      accountId,
      userId,
      runId,
      input: {},
    })

    expect(result).toEqual({ exists: true, updatedRows: 1 })

    const sqlText = allRequests
      .flatMap(request => request.queries)
      .map(q => q.sql)
      .join(' ')

    expect(sqlText).toContain('UPDATE dbo.ChecklistRuns')
    expect(sqlText).toContain('UpdatedAt = SYSUTCDATETIME()')
  })
})
