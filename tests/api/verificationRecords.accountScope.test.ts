// tests/api/verificationRecords.accountScope.test.ts
import request from 'supertest'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

let currentTestAccountId = 1

jest.mock('../../src/backend/middleware/authMiddleware', () => ({
  verifyToken: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      userId: 1,
      accountId: currentTestAccountId,
      role: 'Admin',
      roleId: 1,
      permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT],
    }
    next()
  },
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalVerifyToken: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

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
      const res = await request(app).get('/api/backend/verification-records')

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
      expect(mockListForAccount).toHaveBeenCalledWith(2, { limit: 100, offset: 0 })
    })

    it('account A gets records when service returns account A data', async () => {
      mockListForAccount.mockResolvedValue([{ verificationRecordId: 100, accountId: 1 }])

      currentTestAccountId = 1
      const res = await request(app).get('/api/backend/verification-records')

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
      const res = await request(app).get('/api/backend/verification-records/100')

      expect(res.status).toBe(404)
      expect(res.body?.error).toMatch(/not found/i)
      expect(mockGetById).toHaveBeenCalledWith(2, 100)
    })

    it('account A gets record when requesting account A record', async () => {
      mockGetById.mockResolvedValue({ verificationRecordId: 100, accountId: 1 })

      currentTestAccountId = 1
      const res = await request(app).get('/api/backend/verification-records/100')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ verificationRecordId: 100, accountId: 1 })
      expect(mockGetById).toHaveBeenCalledWith(1, 100)
    })
  })

  describe('createVerificationRecord', () => {
    it('should create record with verificationTypeId and result', async () => {
      mockCreate.mockResolvedValue({ verificationRecordId: 200, accountId: 1 })

      currentTestAccountId = 1
      const res = await request(app)
        .post('/api/backend/verification-records')
        .send({ verificationTypeId: 1, result: 'Pending' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({ verificationRecordId: 200, accountId: 1 })
      expect(mockCreate).toHaveBeenCalledWith(1, {
        accountId: 1,
        verificationTypeId: 1,
        result: 'Pending',
      })
    })

    it('should reject invalid payload', async () => {
      currentTestAccountId = 1
      const res = await request(app)
        .post('/api/backend/verification-records')
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
      const res = await request(app).get('/api/backend/verification-records/verification-record-types')

      expect(res.status).toBe(200)
      expect(res.body).toEqual([
        { verificationTypeId: 1, code: 'GEN', name: 'General Verification', status: 'Active' },
      ])
      expect(mockListActiveTypes).toHaveBeenCalled()
    })
  })
})
