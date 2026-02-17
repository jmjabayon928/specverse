// tests/api/ratings.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

let currentTestAccountId = 1
let currentTestUserIsAdmin = true

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { createAuthMiddlewareMock } = jest.requireActual('../helpers/authMiddlewareMock')
  return createAuthMiddlewareMock({ actual, mode: 'token' })
})

function makeToken(payload: { userId: number; accountId: number; isOwner?: boolean; roleId?: number; role?: string }): string {
  return jwt.sign(
    {
      userId: payload.userId,
      accountId: payload.accountId,
      email: 'test@example.com',
      role: payload.role ?? 'Admin',
      roleId: payload.roleId ?? 1,
      permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT],
      isOwner: payload.isOwner,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
}

const authCookie = `token=${makeToken({ userId: 1, accountId: 1 })}`

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const mockListForSheet = jest.fn()
const mockGetById = jest.fn()
const mockCreate = jest.fn()
const mockUpdate = jest.fn()
const mockRemove = jest.fn()
const mockLock = jest.fn()
const mockUnlock = jest.fn()
const mockListRatingsTemplates = jest.fn()
const mockGetRatingsTemplateById = jest.fn()

jest.mock('../../src/backend/services/ratingsService', () => ({
  listForSheet: (...args: unknown[]) => mockListForSheet(...args),
  getById: (...args: unknown[]) => mockGetById(...args),
  create: (...args: unknown[]) => mockCreate(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  lock: (...args: unknown[]) => mockLock(...args),
  unlock: (...args: unknown[]) => mockUnlock(...args),
  listRatingsTemplates: (...args: unknown[]) => mockListRatingsTemplates(...args),
  getRatingsTemplateById: (...args: unknown[]) => mockGetRatingsTemplateById(...args),
}))

describe('Ratings API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentTestAccountId = 1
    currentTestUserIsAdmin = true
  })

  describe('GET /api/backend/datasheets/:sheetId/ratings', () => {
    it('returns list of blocks for sheet', async () => {
      mockListForSheet.mockResolvedValue([
        {
          ratingsBlockId: 10,
          sheetId: 5,
          blockType: 'Nameplate',
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date('2025-01-01'),
        },
      ])

      const res = await request(app)
        .get('/api/backend/datasheets/5/ratings')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].ratingsBlockId).toBe(10)
      expect(res.body[0].sheetId).toBe(5)
      expect(mockListForSheet).toHaveBeenCalledWith(1, 5)
    })

    it('returns 400 for invalid sheet id', async () => {
      const res = await request(app)
        .get('/api/backend/datasheets/abc/ratings')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(400)
      expect(mockListForSheet).not.toHaveBeenCalled()
    })

    it('returns 404 when sheet not found', async () => {
      mockListForSheet.mockRejectedValue(new AppError('Sheet not found or does not belong to account', 404))

      const res = await request(app)
        .get('/api/backend/datasheets/999/ratings')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(404)
      expect(res.body?.error).toMatch(/not found|belong/i)
    })
  })

  describe('GET /api/backend/ratings/:id', () => {
    it('returns block with entries', async () => {
      mockGetById.mockResolvedValue({
        block: {
          ratingsBlockId: 10,
          sheetId: 5,
          blockType: 'Nameplate',
          sourceValueSetId: null,
          lockedAt: null,
          lockedBy: null,
          notes: null,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
        entries: [
          { entryId: 1, ratingsBlockId: 10, key: 'Manufacturer', value: 'Acme', uom: null, orderIndex: 0 },
        ],
      })

      const res = await request(app)
        .get('/api/backend/ratings/10')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(res.body.block.ratingsBlockId).toBe(10)
      expect(res.body.entries).toHaveLength(1)
      expect(res.body.entries[0].key).toBe('Manufacturer')
      expect(mockGetById).toHaveBeenCalledWith(1, 10)
    })

    it('returns 404 when block not found', async () => {
      mockGetById.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/backend/ratings/999')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(404)
      expect(res.body?.error).toMatch(/not found/i)
    })

    it('returns 400 for invalid block id', async () => {
      const res = await request(app)
        .get('/api/backend/ratings/invalid')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(400)
      expect(mockGetById).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/backend/ratings', () => {
    it('creates block with entries', async () => {
      const created = {
        ratingsBlockId: 20,
        sheetId: 5,
        blockType: 'Nameplate',
        sourceValueSetId: null,
        lockedAt: null,
        lockedBy: null,
        notes: 'Test',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }
      mockCreate.mockResolvedValue(created)

      const res = await request(app)
        .post('/api/backend/ratings')
        .set('Cookie', [authCookie])
        .send({
          sheetId: 5,
          blockType: 'Nameplate',
          notes: 'Test',
          entries: [{ key: 'Manufacturer', value: 'Acme', orderIndex: 0 }],
        })

      expect(res.status).toBe(201)
      expect(res.body.ratingsBlockId).toBe(20)
      expect(mockCreate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          sheetId: 5,
          blockType: 'Nameplate',
          notes: 'Test',
          entries: expect.arrayContaining([expect.objectContaining({ key: 'Manufacturer', value: 'Acme' })]),
        }),
        expect.objectContaining({ userId: 1 })
      )
    })

    it('rejects invalid payload', async () => {
      const res = await request(app)
        .post('/api/backend/ratings')
        .set('Cookie', [authCookie])
        .send({})

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/Invalid ratings payload/i)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns 400 when too many entries', async () => {
      const entries = Array.from({ length: 201 }, (_, i) => ({ key: `k${i}`, value: 'v' }))

      const res = await request(app)
        .post('/api/backend/ratings')
        .set('Cookie', [authCookie])
        .send({
          sheetId: 5,
          blockType: 'Nameplate',
          entries,
        })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/Invalid ratings payload/i)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns 400 when key too long', async () => {
      const res = await request(app)
        .post('/api/backend/ratings')
        .set('Cookie', [authCookie])
        .send({
          sheetId: 5,
          blockType: 'Nameplate',
          entries: [{ key: 'a'.repeat(101), value: 'v' }],
        })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/Invalid ratings payload/i)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns 400 when uom too long', async () => {
      const res = await request(app)
        .post('/api/backend/ratings')
        .set('Cookie', [authCookie])
        .send({
          sheetId: 5,
          blockType: 'Nameplate',
          entries: [{ key: 'MAWP', value: '100', uom: 'a'.repeat(51) }],
        })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/Invalid ratings payload/i)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns 400 when blockType too long', async () => {
      const res = await request(app)
        .post('/api/backend/ratings')
        .set('Cookie', [authCookie])
        .send({
          sheetId: 5,
          blockType: 'a'.repeat(51),
          entries: [],
        })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/Invalid ratings payload/i)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('accepts templateId and initialValues and returns 201', async () => {
      const created = {
        ratingsBlockId: 30,
        sheetId: 5,
        blockType: 'Motor Nameplate',
        ratingsBlockTemplateId: 1,
        sourceValueSetId: null,
        lockedAt: null,
        lockedBy: null,
        notes: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }
      mockCreate.mockResolvedValue(created)

      const res = await request(app)
        .post('/api/backend/ratings')
        .set('Cookie', [authCookie])
        .send({
          sheetId: 5,
          blockType: 'Motor Nameplate',
          templateId: 1,
          initialValues: { mfr: 'Acme', model: 'X1' },
        })

      expect(res.status).toBe(201)
      expect(res.body.ratingsBlockId).toBe(30)
      expect(mockCreate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          sheetId: 5,
          blockType: 'Motor Nameplate',
          templateId: 1,
          initialValues: { mfr: 'Acme', model: 'X1' },
        }),
        expect.objectContaining({ userId: 1 })
      )
    })
  })

  describe('PATCH /api/backend/ratings/:id', () => {
    it('updates block and returns block with entries', async () => {
      mockUpdate.mockResolvedValue({
        block: {
          ratingsBlockId: 10,
          sheetId: 5,
          blockType: 'Ratings',
          sourceValueSetId: null,
          lockedAt: null,
          lockedBy: null,
          notes: 'Updated',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-02'),
        },
        entries: [
          { entryId: 1, ratingsBlockId: 10, key: 'MAWP', value: '100', uom: 'bar', orderIndex: 0 },
        ],
      })

      const res = await request(app)
        .patch('/api/backend/ratings/10')
        .set('Cookie', [authCookie])
        .send({ blockType: 'Ratings', notes: 'Updated', entries: [{ key: 'MAWP', value: '100', uom: 'bar' }] })

      expect(res.status).toBe(200)
      expect(res.body.block.notes).toBe('Updated')
      expect(res.body.entries[0].key).toBe('MAWP')
      expect(mockUpdate).toHaveBeenCalledWith(
        1,
        10,
        expect.objectContaining({
          blockType: 'Ratings',
          notes: 'Updated',
          entries: expect.any(Array),
        }),
        expect.objectContaining({ userId: 1 })
      )
    })

    it('returns 409 when block is locked', async () => {
      mockUpdate.mockRejectedValue(new AppError('Ratings block is locked', 409))

      const res = await request(app)
        .patch('/api/backend/ratings/10')
        .set('Cookie', [authCookie])
        .send({ blockType: 'Ratings' })

      expect(res.status).toBe(409)
      expect(res.body?.error).toMatch(/locked/i)
    })

    it('returns 400 when too many entries on PATCH', async () => {
      const entries = Array.from({ length: 201 }, (_, i) => ({ key: `k${i}`, value: 'v' }))

      const res = await request(app)
        .patch('/api/backend/ratings/10')
        .set('Cookie', [authCookie])
        .send({ entries })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/Invalid ratings payload/i)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('returns 400 when templated block has unknown entry key', async () => {
      mockUpdate.mockRejectedValue(new AppError('Invalid ratings payload: unknown entry key', 400))

      const res = await request(app)
        .patch('/api/backend/ratings/10')
        .set('Cookie', [authCookie])
        .send({ entries: [{ key: 'unknownKey', value: 'x' }] })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/unknown entry key|Invalid ratings payload/i)
    })

    it('returns 400 when templated block is missing required field', async () => {
      mockUpdate.mockRejectedValue(new AppError('Invalid ratings payload: required field missing', 400))

      const res = await request(app)
        .patch('/api/backend/ratings/10')
        .set('Cookie', [authCookie])
        .send({ entries: [] })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/required field missing|Invalid ratings payload/i)
    })

    it('accepts partial PATCH for templated block and returns full entry set (merge contract)', async () => {
      mockUpdate.mockResolvedValue({
        block: {
          ratingsBlockId: 10,
          sheetId: 5,
          blockType: 'Motor Nameplate',
          ratingsBlockTemplateId: 1,
          sourceValueSetId: null,
          lockedAt: null,
          lockedBy: null,
          notes: null,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-02'),
        },
        entries: [
          { entryId: 1, ratingsBlockId: 10, key: 'mfr', value: 'Acme', uom: null, orderIndex: 0, templateFieldId: 1 },
          { entryId: 2, ratingsBlockId: 10, key: 'model', value: 'X1', uom: null, orderIndex: 1, templateFieldId: 2 },
        ],
      })

      const res = await request(app)
        .patch('/api/backend/ratings/10')
        .set('Cookie', [authCookie])
        .send({ entries: [{ key: 'mfr', value: 'Acme' }] })

      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(1, 10, expect.objectContaining({ entries: expect.any(Array) }), expect.any(Object))
      expect(res.body.entries).toBeDefined()
      expect(Array.isArray(res.body.entries)).toBe(true)
      const keys = res.body.entries.map((e: { key: string }) => e.key)
      expect(keys).toContain('mfr')
      expect(keys).toContain('model')
    })
  })

  describe('DELETE /api/backend/ratings/:id', () => {
    it('deletes block', async () => {
      mockRemove.mockResolvedValue(true)

      const res = await request(app)
        .delete('/api/backend/ratings/10')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(res.body.deleted).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith(1, 10, expect.objectContaining({ userId: 1 }))
    })

    it('returns 404 when block not found', async () => {
      mockRemove.mockRejectedValue(new AppError('Ratings block not found', 404))

      const res = await request(app)
        .delete('/api/backend/ratings/999')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(404)
      expect(res.body?.error).toMatch(/not found/i)
    })

    it('returns 409 when block is locked', async () => {
      mockRemove.mockRejectedValue(new AppError('Ratings block is locked', 409))

      const res = await request(app)
        .delete('/api/backend/ratings/10')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(409)
      expect(res.body?.error).toMatch(/locked/i)
    })
  })

  describe('POST /api/backend/ratings/:id/lock', () => {
    const lockedBlock = {
      block: {
        ratingsBlockId: 10,
        sheetId: 5,
        blockType: 'Nameplate',
        sourceValueSetId: null,
        lockedAt: new Date('2025-01-02'),
        lockedBy: 1,
        notes: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      },
      entries: [],
    }

    it('locks block successfully when sheet is approved', async () => {
      mockLock.mockResolvedValue(lockedBlock)

      const res = await request(app)
        .post('/api/backend/ratings/10/lock')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(res.body.block.lockedAt).toBeDefined()
      expect(res.body.block.lockedBy).toBe(1)
      expect(mockLock).toHaveBeenCalledWith(1, 10, 1, expect.objectContaining({ userId: 1 }))
    })

    it('returns 409 when sheet is not approved', async () => {
      mockLock.mockRejectedValue(
        new AppError('Ratings can only be locked for approved datasheets.', 409)
      )

      const res = await request(app)
        .post('/api/backend/ratings/10/lock')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(409)
      expect(res.body?.error).toMatch(/approved datasheets/i)
    })

    it('returns 200 idempotent when block already locked', async () => {
      mockLock.mockResolvedValue(lockedBlock)

      const res = await request(app)
        .post('/api/backend/ratings/10/lock')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(res.body.block.lockedAt).toBeDefined()
      expect(mockLock).toHaveBeenCalledWith(1, 10, 1, expect.any(Object))
    })
  })

  describe('POST /api/backend/ratings/:id/unlock', () => {
    const unlockedBlock = {
      block: {
        ratingsBlockId: 10,
        sheetId: 5,
        blockType: 'Nameplate',
        sourceValueSetId: null,
        lockedAt: null,
        lockedBy: null,
        notes: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      },
      entries: [],
    }

    it('unlocks block when user is admin', async () => {
      currentTestUserIsAdmin = true
      mockUnlock.mockResolvedValue(unlockedBlock)

      const res = await request(app)
        .post('/api/backend/ratings/10/unlock')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(res.body.block.lockedAt).toBeNull()
      expect(res.body.block.lockedBy).toBeNull()
      expect(mockUnlock).toHaveBeenCalledWith(1, 10, expect.objectContaining({ userId: 1 }))
    })

    it('returns 403 when user is not admin', async () => {
      currentTestUserIsAdmin = false
      const nonAdminToken = makeToken({ userId: 1, accountId: 1, roleId: 2, role: 'User' })
      const nonAdminCookie = `token=${nonAdminToken}`

      const res = await request(app)
        .post('/api/backend/ratings/10/unlock')
        .set('Cookie', [nonAdminCookie])

      expect(res.status).toBe(403)
      expect(res.body?.error).toMatch(/admin|superadmin/i)
      expect(mockUnlock).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/backend/ratings/templates', () => {
    it('returns 200 and array with at least NEMA_MG1 and ASME_VIII templates', async () => {
      mockListRatingsTemplates.mockResolvedValue([
        { id: 1, accountId: null, blockType: 'Motor Nameplate', standardCode: 'NEMA_MG1', standardRef: null, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 2, accountId: null, blockType: 'Pressure Vessel Nameplate', standardCode: 'ASME_VIII', standardRef: null, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ])

      const res = await request(app)
        .get('/api/backend/ratings/templates')
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      const standardCodes = res.body.map((t: { standardCode?: string }) => t.standardCode)
      expect(standardCodes.some((c: string) => c && c.includes('NEMA_MG1'))).toBe(true)
      expect(standardCodes.some((c: string) => c && c.includes('ASME_VIII'))).toBe(true)
    })
  })

  describe('GET /api/backend/ratings/templates/:id', () => {
    it('returns 200 with template id and fields ordered by orderIndex, including expected keys (e.g. mfr)', async () => {
      mockListRatingsTemplates.mockResolvedValue([
        { id: 100, accountId: null, blockType: 'Motor Nameplate', standardCode: 'NEMA_MG1', standardRef: null, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 101, accountId: null, blockType: 'Pressure Vessel Nameplate', standardCode: 'ASME_VIII', standardRef: null, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ])
      const listRes = await request(app)
        .get('/api/backend/ratings/templates')
        .set('Cookie', [authCookie])
      expect(listRes.status).toBe(200)
      const nemaTemplate = listRes.body.find((t: { standardCode?: string }) => t.standardCode === 'NEMA_MG1')
      expect(nemaTemplate).toBeDefined()
      const templateId = nemaTemplate.id

      mockGetRatingsTemplateById.mockResolvedValue({
        template: { id: templateId, accountId: null, blockType: 'Motor Nameplate', standardCode: 'NEMA_MG1', standardRef: null, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
        fields: [
          { templateFieldId: 1, ratingsBlockTemplateId: templateId, fieldKey: 'mfr', label: 'Manufacturer', dataType: 'string', uom: null, isRequired: true, orderIndex: 0 },
          { templateFieldId: 2, ratingsBlockTemplateId: templateId, fieldKey: 'model', label: 'Model', dataType: 'string', uom: null, isRequired: false, orderIndex: 1 },
        ],
      })

      const res = await request(app)
        .get(`/api/backend/ratings/templates/${templateId}`)
        .set('Cookie', [authCookie])

      expect(res.status).toBe(200)
      expect(res.body.template).toBeDefined()
      expect(res.body.template.id).toBe(templateId)
      expect(res.body.fields).toBeDefined()
      expect(Array.isArray(res.body.fields)).toBe(true)
      for (let i = 1; i < res.body.fields.length; i++) {
        expect(res.body.fields[i].orderIndex).toBeGreaterThanOrEqual(res.body.fields[i - 1].orderIndex)
      }
      const fieldKeys = res.body.fields.map((f: { fieldKey?: string }) => f.fieldKey)
      expect(fieldKeys).toContain('mfr')
    })
  })
})
