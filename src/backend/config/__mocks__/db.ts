/**
 * Manual mock for db.ts used by Jest backend tests.
 * Prevents any real DB connection; does not import mssql.
 * Tests may override with jest.mock('../../src/backend/config/db', factory).
 */

const defaultQueryResult = {
  recordset: [] as unknown[],
  recordsets: [[]] as unknown[][],
  rowsAffected: [0] as number[],
}

const mockRequest = () => {
  const req = {
    query: () => Promise.resolve(defaultQueryResult),
    input: () => req,
    output: () => req,
  }
  return req
}

function createMockTransaction() {
  return {
    begin: () => Promise.resolve(),
    commit: () => Promise.resolve(),
    rollback: () => Promise.resolve(),
    request: mockRequest,
  }
}

const mockPool = {
  request: mockRequest,
  query: () => Promise.resolve(defaultQueryResult),
  close: () => Promise.resolve(),
}

export const poolPromise: Promise<unknown> = Promise.resolve(mockPool)

export const dbConfig = {
  user: '',
  password: '',
  server: '',
  database: '',
  options: { encrypt: true, enableArithAbort: true, trustServerCertificate: true },
}

const typeStub = (): Record<string, unknown> => ({})

export const sql = {
  Transaction: function (this: ReturnType<typeof createMockTransaction>) {
    Object.assign(this, createMockTransaction())
  } as unknown as new (pool: unknown) => ReturnType<typeof createMockTransaction>,
  NVarChar: typeStub,
  VarChar: typeStub,
  Int: typeStub(),
  Request: mockRequest,
}
