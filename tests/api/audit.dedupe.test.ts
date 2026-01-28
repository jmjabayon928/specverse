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

const insertAuditLogMock = jest.fn().mockResolvedValue(undefined)

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: (...args: any[]) => insertAuditLogMock(...args),
  getAuditLogsForRecord: jest.fn().mockResolvedValue([]),
}))

// Mock controller handlers to avoid importing DB-heavy services.
jest.mock('../../src/backend/controllers/filledSheetController', () => ({
  getAllFilled: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getReferenceOptions: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({}),
  getFilledSheetById: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({}),
  createFilledSheetHandler: (_req: unknown, res: { status: (c: number) => any; json: (b: any) => void }) =>
    res.status(201).json({ sheetId: 1 }),
  updateFilledSheetHandler: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({ ok: true }),
  verifyFilledSheetHandler: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({ ok: true }),
  approveFilledSheetHandler: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({ ok: true }),
  cloneFilledSheetHandler: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({ sheetId: 2 }),
  uploadFilledSheetAttachmentHandler: (_req: unknown, res: { status: (c: number) => any; json: (b: any) => void }) =>
    res.status(201).json({}),
  listFilledSheetAttachmentsHandler: (_req: unknown, res: { json: (b: any) => void }) => res.json([]),
  deleteFilledSheetAttachmentHandler: (_req: unknown, res: { status: (c: number) => any; send: () => void }) =>
    res.status(204).send(),
  listFilledSheetNotesHandler: (_req: unknown, res: { json: (b: any) => void }) => res.json([]),
  createFilledSheetNoteHandler: (_req: unknown, res: { status: (c: number) => any; json: (b: any) => void }) =>
    res.status(201).json({}),
  updateFilledSheetNoteHandler: (_req: unknown, res: { json: (b: any) => void }) => res.json({}),
  deleteFilledSheetNoteHandler: (_req: unknown, res: { status: (c: number) => any; send: () => void }) =>
    res.status(204).send(),
  exportFilledSheetPDF: (_req: unknown, res: { status: (c: number) => any; send: (b: any) => void }) =>
    res.status(200).send('pdf'),
  exportFilledSheetExcel: (_req: unknown, res: { status: (c: number) => any; send: (b: any) => void }) =>
    res.status(200).send('xlsx'),
  checkEquipmentTag: (_req: unknown, res: { json: (b: any) => void }) => res.json({ ok: true }),
}))

jest.mock('multer', () => {
  const multer = (() => ({
    single: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  })) as any

  multer.diskStorage = () => ({})
  return multer
})

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const filledSheetRoutes = require('../../src/backend/routes/filledSheetRoutes').default

  const app = express()
  app.use(cookieParser())
  app.use(express.json())
  app.use('/api/backend/filledsheets', filledSheetRoutes)
  return app
}

describe('Audit dedupe', () => {
  it('Update Filled Sheet produces exactly one audit insert', async () => {
    insertAuditLogMock.mockClear()

    const app = buildTestApp()
    const authCookie = createAuthCookie(['DATASHEET_EDIT'])

    const res = await request(app)
      .put('/api/backend/filledsheets/123')
      .set('Cookie', [authCookie])
      .send({ any: 'payload' })

    expect(res.statusCode).toBe(200)

    // auditAction logs on res.finish asynchronously
    await new Promise((r) => setTimeout(r, 0))

    expect(insertAuditLogMock).toHaveBeenCalledTimes(1)
    expect(insertAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Action: 'Update Filled Sheet',
        TableName: 'Sheets',
        RecordID: 123,
      }),
    )
  })
})

