/**
 * Mock for @/backend/config/db used by Jest (frontend and backend projects).
 * Prevents any real DB connection; does not import mssql.
 * Query result shape matches mssql driver: recordset, recordsets, rowsAffected.
 * Minimal sql.* stubs so code that uses sql.NVarChar, sql.Transaction, etc. does not throw.
 */

const defaultQueryResult = {
  recordset: [] as unknown[],
  recordsets: [[]] as unknown[][],
  rowsAffected: [0] as number[],
}

const createRequest = () => {
  const req = {
    query: () => Promise.resolve(defaultQueryResult),
    input: () => req,
    output: () => req,
  }
  return req
}

/** Standalone request (pool.request()); also used as new sql.Request(transaction). */
const mockRequest = createRequest

/** Transaction stub: begin/commit/rollback no-op, request() returns mock request chain. */
function createMockTransaction() {
  return {
    begin: () => Promise.resolve(),
    commit: () => Promise.resolve(),
    rollback: () => Promise.resolve(),
    request: createRequest,
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

/** Stub type descriptors used by .input(name, type, value). Mock ignores type. */
const typeStub = (): Record<string, unknown> => ({})

/** Constructor for new sql.Request(transaction); returns request with query/input/output. */
function MockRequest(this: ReturnType<typeof createRequest>, _transaction: unknown) {
  Object.assign(this, createRequest())
}

export const sql = {
  Transaction: function (this: ReturnType<typeof createMockTransaction>, _pool: unknown) {
    Object.assign(this, createMockTransaction())
  } as unknown as new (pool: unknown) => ReturnType<typeof createMockTransaction>,
  NVarChar: typeStub,
  VarChar: typeStub,
  Int: typeStub(),
  Request: MockRequest as unknown as new (transaction: unknown) => ReturnType<typeof createRequest>,
}
