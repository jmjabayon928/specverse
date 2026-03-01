/**
 * GET /api/backend/health/db
 * 200 when DB connects and dbo.AuthSessions exists; 503 otherwise.
 */
import request from 'supertest'
import type { ConnectionPool } from 'mssql'

const mockRequest = jest.fn()
const mockConnect = jest.fn()

jest.mock('../../src/backend/config/db', () => ({
  get poolPromise() {
    return (async () => {
      await mockConnect()
      return {
        request: () => ({ query: mockRequest }),
      } as unknown as ConnectionPool
    })()
  },
}))

const app = require('../../src/backend/app').default

describe('GET /api/backend/health/db', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 when DB connects and AuthSessions exists', async () => {
    mockConnect.mockResolvedValue(undefined)
    mockRequest.mockResolvedValue({ recordset: [] })

    const res = await request(app).get('/api/backend/health/db')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(mockRequest).toHaveBeenCalledWith(
      "SELECT 1 WHERE OBJECT_ID(N'dbo.AuthSessions', N'U') IS NOT NULL",
    )
  })

  it('returns 503 when DB connection fails', async () => {
    mockConnect.mockRejectedValue(new Error('Connection refused'))

    const res = await request(app).get('/api/backend/health/db')

    expect(res.status).toBe(503)
    expect(res.body).toEqual({ ok: false, message: 'Database unavailable or AuthSessions table missing' })
  })

  it('returns 503 when AuthSessions table does not exist', async () => {
    mockConnect.mockResolvedValue(undefined)
    mockRequest.mockRejectedValue(new Error('Invalid object name \'dbo.AuthSessions\''))

    const res = await request(app).get('/api/backend/health/db')

    expect(res.status).toBe(503)
    expect(res.body).toEqual({ ok: false, message: 'Database unavailable or AuthSessions table missing' })
  })

  it('returns 503 when DB probe times out', async () => {
    const orig = process.env.HEALTH_DB_TIMEOUT_MS
    process.env.HEALTH_DB_TIMEOUT_MS = '10'
    mockConnect.mockResolvedValue(undefined)
    mockRequest.mockImplementation(() => new Promise(() => {}))

    const res = await request(app).get('/api/backend/health/db')

    process.env.HEALTH_DB_TIMEOUT_MS = orig
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ ok: false, message: 'Database unavailable or AuthSessions table missing' })
  })
})
