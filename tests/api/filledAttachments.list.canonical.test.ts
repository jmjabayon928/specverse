import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import type { SheetAttachmentDTO } from '@/domain/datasheets/sheetTypes'

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

const canonicalAttachments: SheetAttachmentDTO[] = [
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
]

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
  getAuditLogsForRecord: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../src/backend/services/templateService', () => ({
  addSheetAttachment: jest.fn(),
}))

jest.mock('../../src/backend/services/filledSheetService', () => {
  const listSheetAttachments = jest.fn(
    async (_sheetId: number): Promise<SheetAttachmentDTO[]> => canonicalAttachments,
  )

  return {
    fetchAllFilled: jest.fn(),
    fetchReferenceOptions: jest.fn(),
    getFilledSheetDetailsById: jest.fn(),
    createFilledSheet: jest.fn(),
    updateFilledSheet: jest.fn(),
    verifyFilledSheet: jest.fn(),
    approveFilledSheet: jest.fn(),
    doesEquipmentTagExist: jest.fn(),
    getAttachmentsForSheet: jest.fn().mockResolvedValue([]),
    deleteAttachmentById: jest.fn().mockResolvedValue(undefined),
    getNotesForSheet: jest.fn(),
    createNoteForSheet: jest.fn(),
    updateNoteForSheet: jest.fn(),
    deleteNoteForSheet: jest.fn(),
    exportPDF: jest.fn(),
    exportExcel: jest.fn(),
    listSheetAttachments,
    deleteSheetAttachmentLink: jest.fn(),
  }
})

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
  app.use('/api/backend/filledsheets', filledSheetRoutes)
  return app
}

describe('Filled sheet attachments list - canonical', () => {
  it('returns canonical attachments including isFromTemplate and linkedFromSheetId by default', async () => {
    const app = buildTestApp()
    const authCookie = createAuthCookie(['DATASHEET_VIEW'])

    const res = await request(app)
      .get('/api/backend/filledsheets/123/attachments')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const first = res.body[0] as SheetAttachmentDTO
    expect(first.isFromTemplate).toBe(true)
    expect(first.linkedFromSheetId).toBe(42)
  })
})

