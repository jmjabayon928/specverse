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

jest.mock('../../src/backend/services/templateService', () => ({
  addSheetAttachment: jest.fn(),
}))

const deleteSheetAttachmentLinkMock = jest.fn<Promise<boolean>, [number, number]>()
const deleteAttachmentByIdMock = jest.fn<Promise<void>, [number, number]>()

jest.mock('../../src/backend/services/filledSheetService', () => ({
  fetchAllFilled: jest.fn(),
  fetchReferenceOptions: jest.fn(),
  getFilledSheetDetailsById: jest.fn(),
  createFilledSheet: jest.fn(),
  updateFilledSheet: jest.fn(),
  verifyFilledSheet: jest.fn(),
  approveFilledSheet: jest.fn(),
  doesEquipmentTagExist: jest.fn(),
  getAttachmentsForSheet: jest.fn().mockResolvedValue([]),
  deleteAttachmentById: (...args: [number, number]) => deleteAttachmentByIdMock(...args),
  getNotesForSheet: jest.fn(),
  createNoteForSheet: jest.fn(),
  updateNoteForSheet: jest.fn(),
  deleteNoteForSheet: jest.fn(),
  exportPDF: jest.fn(),
  exportExcel: jest.fn(),
  listSheetAttachments: jest.fn(),
  deleteSheetAttachmentLink: (...args: [number, number]) => deleteSheetAttachmentLinkMock(...args),
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
  app.use('/api/backend/filledsheets', filledSheetRoutes)
  return app
}

describe('Filled sheet attachments delete - canonical first with legacy fallback', () => {
  it('uses canonical delete when link exists and does not call legacy delete', async () => {
    deleteSheetAttachmentLinkMock.mockResolvedValueOnce(true)
    deleteAttachmentByIdMock.mockResolvedValueOnce(Promise.resolve())

    const app = buildTestApp()
    const authCookie = createAuthCookie(['DATASHEET_ATTACHMENT_UPLOAD'])

    const res = await request(app)
      .delete('/api/backend/filledsheets/123/attachments/999')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(204)
    expect(deleteSheetAttachmentLinkMock).toHaveBeenCalledWith(123, 999)
    expect(deleteAttachmentByIdMock).not.toHaveBeenCalled()
  })

  it('falls back to legacy delete when no canonical link is removed', async () => {
    deleteSheetAttachmentLinkMock.mockResolvedValueOnce(false)
    deleteAttachmentByIdMock.mockResolvedValueOnce()

    const app = buildTestApp()
    const authCookie = createAuthCookie(['DATASHEET_ATTACHMENT_UPLOAD'])

    const res = await request(app)
      .delete('/api/backend/filledsheets/123/attachments/555')
      .set('Cookie', [authCookie])

    expect(res.statusCode).toBe(204)
    expect(deleteSheetAttachmentLinkMock).toHaveBeenCalledWith(123, 555)
    expect(deleteAttachmentByIdMock).toHaveBeenCalledWith(123, 555)
  })
})

