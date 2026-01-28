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
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
  getAuditLogsForRecord: jest.fn().mockResolvedValue([]),
}))

const mockedDetails = {
  datasheet: {
    sheetId: 123,
    sheetName: 'Filled from Template',
    attachments: [
      {
        sheetAttachmentId: 10,
        orderIndex: 1,
        isFromTemplate: true,
        linkedFromSheetId: 42,
        cloneOnCreate: false,
        id: 100,
        originalName: 'from-template.pdf',
        storedName: 'from-template.pdf',
        contentType: 'application/pdf',
        fileSizeBytes: 1024,
        storageProvider: 'local',
        storagePath: 'attachments/from-template.pdf',
        sha256: null,
        uploadedBy: 7,
        uploadedByName: 'Template Owner',
        uploadedAt: new Date().toISOString(),
        isViewable: true,
        fileUrl: '/files/from-template.pdf',
      },
    ],
  },
  translations: null,
}

jest.mock('../../src/backend/controllers/filledSheetController', () => ({
  getAllFilled: (_req: unknown, res: { json: (body: unknown) => void }) => res.json([]),
  getReferenceOptions: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({}),
  getFilledSheetById: (_req: unknown, res: { json: (body: unknown) => void }) => res.json(mockedDetails),
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

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const filledSheetRoutes = require('../../src/backend/routes/filledSheetRoutes').default

  const app = express()
  app.use(cookieParser())
  app.use('/api/backend/filledsheets', filledSheetRoutes)
  return app
}

describe('Filled sheet attachments reference template attachments', () => {
  it('GET /api/backend/filledsheets/:id returns attachments including referenced template attachment', async () => {
    const app = buildTestApp()
    const authCookie = createAuthCookie(['DATASHEET_VIEW'])

    const res = await request(app)
      .get('/api/backend/filledsheets/123?lang=eng')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)

    const body = res.body
    const ds = body?.datasheet ?? body
    expect(Array.isArray(ds.attachments)).toBe(true)

    const ref = ds.attachments[0]
    expect(ref).toEqual(
      expect.objectContaining({
        isFromTemplate: true,
        linkedFromSheetId: 42,
      }),
    )
  })
})

