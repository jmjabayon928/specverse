// tests/api/verificationRecords.accountScope.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

let currentTestAccountId = 1

function makeToken(payload: { userId: number; accountId: number }): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: 'test@example.com',
      role: 'Admin',
      permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT],
      accountId: payload.accountId,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
}

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { createAuthMiddlewareMock } = jest.requireActual('../helpers/authMiddlewareMock')
  return createAuthMiddlewareMock({ actual, mode: 'token' })
})

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const mockListForAccount = jest.fn()
const mockGetById = jest.fn()
const mockListForSheet = jest.fn()
const mockCreate = jest.fn()
const mockLinkToSheet = jest.fn()
const mockUnlinkFromSheet = jest.fn()
const mockAttachEvidence = jest.fn()
const mockListAttachments = jest.fn()
const mockListActiveTypes = jest.fn()

jest.mock('../../src/backend/services/verificationRecordsService', () => ({
  listForAccount: (...args: unknown[]) => mockListForAccount(...args),
  getById: (...args: unknown[]) => mockGetById(...args),
  listForSheet: (...args: unknown[]) => mockListForSheet(...args),
  create: (...args: unknown[]) => mockCreate(...args),
  linkToSheet: (...args: unknown[]) => mockLinkToSheet(...args),
  unlinkFromSheet: (...args: unknown[]) => mockUnlinkFromSheet(...args),
  attachEvidence: (...args: unknown[]) => mockAttachEvidence(...args),
  listAttachments: (...args: unknown[]) => mockListAttachments(...args),
  listActiveTypes: (...args: unknown[]) => mockListActiveTypes(...args),
}))

describe('VerificationRecords API account scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentTestAccountId = 1
  })

  describe('listVerificationRecords', () => {
    it('account B gets empty array when service returns account A data', async () => {
      mockListForAccount.mockImplementation((accountId: number) => {
        if (accountId === 1) {
          return Promise.resolve([{ verificationRecordId: 100, accountId: 1 }])
        }
        return Promise.resolve([])
      })

      currentTestAccountId = 2
      const token = makeToken({ userId: 1, accountId: 2 })
      const res = await request(app)
        .get('/api/backend/verification-records')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
      expect(mockListForAccount).toHaveBeenCalledWith(2, { limit: 100, offset: 0 })
    })

    it('account A gets records when service returns account A data', async () => {
      mockListForAccount.mockResolvedValue([{ verificationRecordId: 100, accountId: 1 }])

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/verification-records')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body).toEqual([{ verificationRecordId: 100, accountId: 1 }])
      expect(mockListForAccount).toHaveBeenCalledWith(1, { limit: 100, offset: 0 })
    })
  })

  describe('getVerificationRecordById', () => {
    it('account B gets 404 when requesting account A record', async () => {
      mockGetById.mockImplementation((accountId: number, id: number) => {
        if (accountId === 1 && id === 100) {
          return Promise.resolve({ verificationRecordId: 100, accountId: 1 })
        }
        return Promise.resolve(null)
      })

      currentTestAccountId = 2
      const token = makeToken({ userId: 1, accountId: 2 })
      const res = await request(app)
        .get('/api/backend/verification-records/100')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error).toMatch(/not found/i)
      expect(mockGetById).toHaveBeenCalledWith(2, 100)
    })

    it('account A gets record when requesting account A record', async () => {
      mockGetById.mockResolvedValue({ verificationRecordId: 100, accountId: 1 })

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/verification-records/100')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ verificationRecordId: 100, accountId: 1 })
      expect(mockGetById).toHaveBeenCalledWith(1, 100)
    })
  })

  describe('createVerificationRecord', () => {
    it('should create record with verificationTypeId only (no result)', async () => {
      mockCreate.mockResolvedValue({ verificationRecordId: 200, accountId: 1 })

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/verification-records')
        .set('Cookie', [`token=${token}`])
        .send({ verificationTypeId: 1 })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({ verificationRecordId: 200, accountId: 1 })
      expect(mockCreate).toHaveBeenCalledWith(1, {
        accountId: 1,
        verificationTypeId: 1,
      })
    })

    it('should reject result: Pending (invalid enum)', async () => {
      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/verification-records')
        .set('Cookie', [`token=${token}`])
        .send({ verificationTypeId: 1, result: 'Pending' })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/Invalid request payload/i)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('should reject invalid payload', async () => {
      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/verification-records')
        .set('Cookie', [`token=${token}`])
        .send({})

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/Invalid request payload/i)
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('listVerificationRecordTypes', () => {
    it('should return active verification record types', async () => {
      mockListActiveTypes.mockResolvedValue([
        { verificationTypeId: 1, code: 'GEN', name: 'General Verification', status: 'Active' },
      ])

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/verification-records/verification-record-types')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body).toEqual([
        { verificationTypeId: 1, code: 'GEN', name: 'General Verification', status: 'Active' },
      ])
      expect(mockListActiveTypes).toHaveBeenCalled()
    })
  })

  describe('POST /api/backend/verification-records/:id/attachments', () => {
    it('should attach evidence and return 200 with attachment row', async () => {
      mockAttachEvidence.mockResolvedValue({ verificationRecordId: 100, attachmentId: 123 })

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/verification-records/100/attachments')
        .set('Cookie', [`token=${token}`])
        .send({ attachmentId: 123 })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ verificationRecordId: 100, attachmentId: 123 })
      expect(mockAttachEvidence).toHaveBeenCalledWith(1, 100, 123)
    })

    it('should return 404 when attachment is not in account scope', async () => {
      mockAttachEvidence.mockRejectedValue(new AppError('Attachment not found or not in account scope', 404))

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/verification-records/100/attachments')
        .set('Cookie', [`token=${token}`])
        .send({ attachmentId: 999 })

      expect(res.status).toBe(404)
      expect(res.body?.error).toMatch(/account scope|not found/i)
      expect(mockAttachEvidence).toHaveBeenCalledWith(1, 100, 999)
    })
  })

  describe('GET /api/backend/verification-records/:id/attachments', () => {
    it('should return 200 and list of attachments', async () => {
      mockListAttachments.mockResolvedValue([
        { verificationRecordId: 100, attachmentId: 123 },
        { verificationRecordId: 100, attachmentId: 456 },
      ])

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/verification-records/100/attachments')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body).toEqual([
        { verificationRecordId: 100, attachmentId: 123 },
        { verificationRecordId: 100, attachmentId: 456 },
      ])
      expect(mockListAttachments).toHaveBeenCalledWith(1, 100)
    })
  })

  describe('POST /api/backend/verification-records/:id/link', () => {
    it('should link record to sheet and return 200 with link row', async () => {
      mockLinkToSheet.mockResolvedValue({ accountId: 1, verificationRecordId: 100, sheetId: 50 })

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/verification-records/100/link')
        .set('Cookie', [`token=${token}`])
        .send({ sheetId: 50 })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ accountId: 1, verificationRecordId: 100, sheetId: 50 })
      expect(mockLinkToSheet).toHaveBeenCalledWith(1, 100, 50)
    })
  })

  describe('POST /api/backend/verification-records/:id/unlink', () => {
    it('should unlink record from sheet and return 200 with deleted true', async () => {
      mockUnlinkFromSheet.mockResolvedValue(true)

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/verification-records/100/unlink')
        .set('Cookie', [`token=${token}`])
        .send({ sheetId: 50 })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ deleted: true })
      expect(mockUnlinkFromSheet).toHaveBeenCalledWith(1, 100, 50)
    })
  })

  describe('GET /api/backend/datasheets/:sheetId/verification-records', () => {
    it('should return 200 and list of records for sheet', async () => {
      mockListForSheet.mockResolvedValue([
        { verificationRecordId: 100, accountId: 1 },
        { verificationRecordId: 101, accountId: 1 },
      ])

      currentTestAccountId = 1
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/datasheets/50/verification-records')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body).toEqual([
        { verificationRecordId: 100, accountId: 1 },
        { verificationRecordId: 101, accountId: 1 },
      ])
      expect(mockListForSheet).toHaveBeenCalledWith(1, 50)
    })
  })
})
