import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'

// Jest runs in jsdom in this repo; Express/router expects setImmediate in Node-like env.
globalThis.setImmediate ??= ((fn: (...args: any[]) => void, ...args: any[]) =>
  setTimeout(fn, 0, ...args)) as any

function createAuthCookie(permissions: string[]): string {
  const token = jwt.sign(
    {
      userId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'Admin',
      profilePic: null,
      permissions,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' },
  )

  return `token=${token}`
}

process.env.JWT_SECRET ??= 'secret'

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/database/auditQueries', () => ({
  getAuditLogsForRecord: jest.fn().mockResolvedValue([
    {
      AuditLogID: 101,
      TableName: 'Sheets',
      RecordID: 123,
      Action: 'Update Filled Sheet',
      PerformedBy: 7,
      PerformedByUserID: 7,
      PerformedByName: 'Jane Doe',
      PerformedAtISO: '2026-01-28T19:04:22.123Z',
      Route: '/api/backend/filledsheets/123',
      Method: 'PUT',
      StatusCode: 200,
      Changes: '{"x":"y"}',
    },
  ]),
}))

jest.mock('../../src/backend/database/changeLogQueries', () => ({
  getChangeLogsForSheet: jest.fn().mockResolvedValue([
    {
      ChangeLogID: 202,
      SheetID: 123,
      ChangedBy: 7,
      ChangedByUserID: 7,
      ChangedByName: 'Jane Doe',
      ChangeDateISO: '2026-01-28T19:04:10.000Z',
      InfoTemplateID: 42,
      FieldLabel: 'Length',
      OldValue: '10',
      NewValue: '12',
      UOM: 'm',
    },
  ]),
}))

function buildTestApp() {
  // Require after mocks so the route/controller/service uses mocked DB modules
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sheetLogsRoutes = require('../../src/backend/routes/sheetLogsRoutes').default

  const app = express()
  app.use(cookieParser())
  app.use('/api/backend/sheets', sheetLogsRoutes)
  return app
}

function expectLogEntryShape(item: any) {
  expect(item).toEqual(
    expect.objectContaining({
      id: expect.any(Number),
      kind: expect.any(String),
      sheetId: expect.any(Number),
      action: expect.any(String),
      user: expect.any(Object),
      timestamp: expect.any(String),
      details: expect.any(Object),
    }),
  )
}

describe('Sheet logs endpoints', () => {
  it('GET /api/backend/sheets/:sheetId/audit-logs returns 401 when unauthenticated', async () => {
    const app = buildTestApp()
    const res = await request(app).get('/api/backend/sheets/123/audit-logs?limit=50')
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/backend/sheets/:sheetId/audit-logs returns 200 and shape when authenticated', async () => {
    const app = buildTestApp()
    const authCookie = createAuthCookie(['DATASHEET_VIEW'])
    const res = await request(app)
      .get('/api/backend/sheets/123/audit-logs?limit=50')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(typeof res.body.limit).toBe('number')
    expect(Array.isArray(res.body.items)).toBe(true)
    expectLogEntryShape(res.body.items[0])
  })

  it('GET /api/backend/sheets/:sheetId/change-logs returns 401 when unauthenticated', async () => {
    const app = buildTestApp()
    const res = await request(app).get('/api/backend/sheets/123/change-logs?limit=50')
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/backend/sheets/:sheetId/change-logs returns 200 and shape when authenticated', async () => {
    const app = buildTestApp()
    const authCookie = createAuthCookie(['DATASHEET_VIEW'])
    const res = await request(app)
      .get('/api/backend/sheets/123/change-logs?limit=50')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(typeof res.body.limit).toBe('number')
    expect(Array.isArray(res.body.items)).toBe(true)
    expectLogEntryShape(res.body.items[0])
  })

  it('GET /api/backend/sheets/:sheetId/logs returns 401 when unauthenticated', async () => {
    const app = buildTestApp()
    const res = await request(app).get('/api/backend/sheets/123/logs?limit=50')
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/backend/sheets/:sheetId/logs returns 200 and shape when authenticated', async () => {
    const app = buildTestApp()
    const authCookie = createAuthCookie(['DATASHEET_VIEW'])
    const res = await request(app)
      .get('/api/backend/sheets/123/logs?limit=50')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(typeof res.body.limit).toBe('number')
    expect(Array.isArray(res.body.items)).toBe(true)
    expectLogEntryShape(res.body.items[0])
  })
})

