// tests/api/schedules.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET ??= 'secret'

let currentTestAccountId = 1

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { createAuthMiddlewareMock } = jest.requireActual('../helpers/authMiddlewareMock')
  return createAuthMiddlewareMock({ actual, mode: 'token' })
})

function makeToken(payload: { userId: number; accountId: number; role?: string }): string {
  return jwt.sign(
    {
      userId: payload.userId,
      accountId: payload.accountId,
      email: 'test@example.com',
      role: payload.role ?? 'Admin',
      permissions: [PERMISSIONS.SCHEDULES_VIEW, PERMISSIONS.SCHEDULES_EDIT],
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
}

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const mockList = jest.fn()
const mockCount = jest.fn()
const mockSearchSheetOptions = jest.fn()
const mockSearchFacilityOptions = jest.fn()
const mockSearchSpaceOptions = jest.fn()
const mockSearchSystemOptions = jest.fn()
const mockGetDetail = jest.fn()
const mockCreateSchedule = jest.fn()
const mockPatchSchedule = jest.fn()
const mockReplaceColumns = jest.fn()

const mockGetScheduleById = jest.fn()
const mockGetScheduleColumns = jest.fn()
const mockReplaceScheduleEntries = jest.fn()
const mockRunInTransaction = jest.fn()

jest.mock('../../src/backend/repositories/schedulesRepository', () => {
  const actual = jest.requireActual('../../src/backend/repositories/schedulesRepository')
  return {
    ...actual,
    getScheduleById: (...args: unknown[]) => mockGetScheduleById(...args),
    getScheduleColumns: (...args: unknown[]) => mockGetScheduleColumns(...args),
    replaceScheduleEntries: (...args: unknown[]) => mockReplaceScheduleEntries(...args),
  }
})

jest.mock('../../src/backend/repositories/assetsRepository', () => {
  const actual = jest.requireActual('../../src/backend/repositories/assetsRepository')
  return {
    ...actual,
    assetBelongsToAccount: jest.fn().mockResolvedValue(true),
  }
})

jest.mock('../../src/backend/services/filledSheetService', () => {
  const actual = jest.requireActual('../../src/backend/services/filledSheetService')
  return {
    ...actual,
    runInTransaction: (...args: unknown[]) => mockRunInTransaction(...args),
  }
})

jest.mock('../../src/backend/services/schedulesService', () => {
  const actual = jest.requireActual('../../src/backend/services/schedulesService')
  return {
    list: (...args: unknown[]) => mockList(...args),
    count: (...args: unknown[]) => mockCount(...args),
    searchSheetOptions: (...args: unknown[]) => mockSearchSheetOptions(...args),
    searchFacilityOptions: (...args: unknown[]) => mockSearchFacilityOptions(...args),
    searchSpaceOptions: (...args: unknown[]) => mockSearchSpaceOptions(...args),
    searchSystemOptions: (...args: unknown[]) => mockSearchSystemOptions(...args),
    getDetail: (...args: unknown[]) => mockGetDetail(...args),
    createSchedule: (...args: unknown[]) => mockCreateSchedule(...args),
    patchSchedule: (...args: unknown[]) => mockPatchSchedule(...args),
    replaceColumns: (...args: unknown[]) => mockReplaceColumns(...args),
    replaceEntries: actual.replaceEntries,
  }
})

const fakeSchedule = {
  scheduleId: 10,
  accountId: 1,
  name: 'Test',
  scope: null,
  disciplineId: null,
  subtypeId: null,
  clientId: null,
  projectId: null,
  createdAt: new Date(),
  createdBy: null,
  updatedAt: new Date(),
  updatedBy: null,
}

describe('Schedules API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentTestAccountId = 1
    mockGetScheduleById.mockResolvedValue(fakeSchedule)
    mockGetScheduleColumns.mockResolvedValue([])
    mockReplaceScheduleEntries.mockResolvedValue(undefined)
    mockRunInTransaction.mockImplementation((cb: (tx: unknown) => Promise<void>) => cb({}))
  })

  describe('GET /api/backend/schedules', () => {
    it('returns list of schedules', async () => {
      mockList.mockResolvedValue([
        { scheduleId: 1, name: 'HVAC Schedule', scope: null, accountId: 1 },
      ])

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].scheduleId).toBe(1)
      expect(mockList).toHaveBeenCalledWith(1, expect.any(Object), { page: 1, limit: 25 })
    })

    it('defaults pagination when not provided', async () => {
      mockList.mockResolvedValue([])

      const token = makeToken({ userId: 1, accountId: 1 })
      await request(app)
        .get('/api/backend/schedules')
        .set('Cookie', [`token=${token}`])

      expect(mockList).toHaveBeenCalledWith(1, expect.any(Object), { page: 1, limit: 25 })
    })

    it('returns 400 for invalid limit', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules?limit=999')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(400)
      expect(res.body?.error ?? res.body?.message).toMatch(/invalid page\/limit/i)
      expect(mockList).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid page', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules?page=0')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(400)
      expect(mockList).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/backend/schedules/count', () => {
    it('returns total', async () => {
      mockCount.mockResolvedValue(123)

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/count')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(123)
      expect(mockCount).toHaveBeenCalledWith(1, expect.any(Object))
    })

    it('returns 400 for invalid clientId', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/count?clientId=abc')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(400)
      expect(mockCount).not.toHaveBeenCalled()
    })

    it('returns 400 when page is provided', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/count?page=1')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(400)
      expect(mockCount).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/backend/schedules/sheet-options', () => {
    it('returns items when q and limit provided', async () => {
      mockSearchSheetOptions.mockResolvedValue([
        { sheetId: 101, sheetName: 'Pump Datasheet', status: 'Verified', disciplineName: 'Mechanical', subtypeName: 'Pump' },
      ])

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/sheet-options?q=pump&limit=20')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.total).toBe(1)
      expect(res.body.items[0].sheetId).toBe(101)
      expect(res.body.items[0].sheetName).toBe('Pump Datasheet')
      expect(res.body.items[0].status).toBe('Verified')
      expect(mockSearchSheetOptions).toHaveBeenCalledWith(1, { q: 'pump', limit: 20 })
    })

    it('returns 400 for invalid limit', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/sheet-options?q=pump&limit=999')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(400)
      expect(mockSearchSheetOptions).not.toHaveBeenCalled()
    })

    it('returns empty items when q missing', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/sheet-options')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.items).toEqual([])
      expect(res.body.total).toBe(0)
      expect(mockSearchSheetOptions).not.toHaveBeenCalled()
    })

    it('returns empty items when q length < 2 and service not called', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/sheet-options?q=p')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.items).toEqual([])
      expect(res.body.total).toBe(0)
      expect(mockSearchSheetOptions).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/backend/schedules/facility-options', () => {
    it('returns items when q and limit provided', async () => {
      mockSearchFacilityOptions.mockResolvedValue([
        { facilityId: 1, facilityName: 'Building A' },
      ])

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/facility-options?q=building&limit=20')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].facilityId).toBe(1)
      expect(res.body.items[0].facilityName).toBe('Building A')
      expect(mockSearchFacilityOptions).toHaveBeenCalledWith(1, { q: 'building', limit: 20 })
    })

    it('returns 400 for invalid limit', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/facility-options?q=building&limit=999')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(400)
      expect(mockSearchFacilityOptions).not.toHaveBeenCalled()
    })

    it('returns empty items when q length < 2', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/facility-options?q=b')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.items).toEqual([])
      expect(mockSearchFacilityOptions).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/backend/schedules/space-options', () => {
    it('returns items when facilityId, q and limit provided', async () => {
      mockSearchSpaceOptions.mockResolvedValue([
        { spaceId: 1, spaceName: 'Room 101' },
      ])

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/space-options?facilityId=1&q=room&limit=20')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].spaceId).toBe(1)
      expect(res.body.items[0].spaceName).toBe('Room 101')
      expect(mockSearchSpaceOptions).toHaveBeenCalledWith(1, { facilityId: 1, q: 'room', limit: 20 })
    })

    it('returns 400 when facilityId missing', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/space-options?q=room')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(400)
      expect(mockSearchSpaceOptions).not.toHaveBeenCalled()
    })

    it('returns empty items when q length < 2', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/space-options?facilityId=1&q=r')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.items).toEqual([])
      expect(mockSearchSpaceOptions).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/backend/schedules/system-options', () => {
    it('returns items when facilityId, q and limit provided', async () => {
      mockSearchSystemOptions.mockResolvedValue([
        { systemId: 1, systemName: 'HVAC System' },
      ])

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/system-options?facilityId=1&q=hvac&limit=20')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].systemId).toBe(1)
      expect(res.body.items[0].systemName).toBe('HVAC System')
      expect(mockSearchSystemOptions).toHaveBeenCalledWith(1, { facilityId: 1, q: 'hvac', limit: 20 })
    })

    it('returns 400 when facilityId missing', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/system-options?q=hvac')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(400)
      expect(mockSearchSystemOptions).not.toHaveBeenCalled()
    })

    it('returns empty items when q length < 2', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/system-options?facilityId=1&q=h')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.items).toEqual([])
      expect(mockSearchSystemOptions).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/backend/schedules', () => {
    it('creates schedule', async () => {
      const created = {
        scheduleId: 5,
        accountId: 1,
        name: 'New Schedule',
        scope: null,
        disciplineId: 1,
        subtypeId: 2,
        clientId: null,
        projectId: null,
        createdAt: new Date(),
        createdBy: 1,
        updatedAt: new Date(),
        updatedBy: 1,
      }
      mockCreateSchedule.mockResolvedValue(created)

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/schedules')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'New Schedule', disciplineId: 1, subtypeId: 2 })

      expect(res.status).toBe(201)
      expect(res.body.scheduleId).toBe(5)
      expect(mockCreateSchedule).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'New Schedule', disciplineId: 1, subtypeId: 2 }), 1)
    })

    it('returns 400 for invalid body', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/schedules')
        .set('Cookie', [`token=${token}`])
        .send({})

      expect(res.status).toBe(400)
      expect(mockCreateSchedule).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid scope', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/schedules')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'Test', disciplineId: 1, subtypeId: 2, scope: 'Invalid' })

      expect(res.status).toBe(400)
      expect(mockCreateSchedule).not.toHaveBeenCalled()
    })

    it('returns 400 when spaceId provided without facilityId', async () => {
      mockCreateSchedule.mockRejectedValue(new AppError('FacilityID is required when SpaceID or SystemID is provided', 400))

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/schedules')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'Test', disciplineId: 1, subtypeId: 2, spaceId: 1 })

      expect(res.status).toBe(400)
      expect(res.body?.error ?? res.body?.message).toMatch(/facilityid.*required/i)
    })

    it('returns 400 when systemId provided without facilityId', async () => {
      mockCreateSchedule.mockRejectedValue(new AppError('FacilityID is required when SpaceID or SystemID is provided', 400))

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .post('/api/backend/schedules')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'Test', disciplineId: 1, subtypeId: 2, systemId: 1 })

      expect(res.status).toBe(400)
      expect(res.body?.error ?? res.body?.message).toMatch(/facilityid.*required/i)
    })
  })

  describe('GET /api/backend/schedules/:scheduleId', () => {
    it('returns schedule detail with empty columns and entries', async () => {
      const detail = {
        schedule: { scheduleId: 10, name: 'Test', scope: null, accountId: 1 },
        columns: [],
        entries: [],
        values: [],
      }
      mockGetDetail.mockResolvedValue(detail)

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/10')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(200)
      expect(res.body.schedule.scheduleId).toBe(10)
      expect(res.body.columns).toEqual([])
      expect(res.body.entries).toEqual([])
      expect(mockGetDetail).toHaveBeenCalledWith(1, 10)
    })

    it('returns 404 when schedule not found', async () => {
      mockGetDetail.mockResolvedValue(null)

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/999')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(404)
      expect(res.body?.error).toMatch(/not found/i)
    })

    it('returns 400 for invalid schedule id', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .get('/api/backend/schedules/abc')
        .set('Cookie', [`token=${token}`])

      expect(res.status).toBe(400)
      expect(mockGetDetail).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /api/backend/schedules/:scheduleId', () => {
    it('updates schedule metadata', async () => {
      mockPatchSchedule.mockResolvedValue(undefined)

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .patch('/api/backend/schedules/10')
        .set('Cookie', [`token=${token}`])
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(mockPatchSchedule).toHaveBeenCalledWith(1, 10, expect.objectContaining({ name: 'Updated Name' }), 1)
    })

    it('returns 400 when spaceId provided without facilityId', async () => {
      mockPatchSchedule.mockRejectedValue(new AppError('FacilityID is required when SpaceID or SystemID is provided', 400))

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .patch('/api/backend/schedules/10')
        .set('Cookie', [`token=${token}`])
        .send({ spaceId: 1 })

      expect(res.status).toBe(400)
      expect(res.body?.error ?? res.body?.message).toMatch(/facilityid.*required/i)
    })

    it('returns 400 when systemId provided without facilityId', async () => {
      mockPatchSchedule.mockRejectedValue(new AppError('FacilityID is required when SpaceID or SystemID is provided', 400))

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .patch('/api/backend/schedules/10')
        .set('Cookie', [`token=${token}`])
        .send({ systemId: 1 })

      expect(res.status).toBe(400)
      expect(res.body?.error ?? res.body?.message).toMatch(/facilityid.*required/i)
    })
  })

  describe('PUT /api/backend/schedules/:scheduleId/columns', () => {
    it('replace-all columns', async () => {
      const returned = [
        { scheduleColumnId: 1, columnKey: 'tag', columnLabel: 'Tag', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true },
      ]
      mockReplaceColumns.mockResolvedValue(returned)

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
        .set('Cookie', [`token=${token}`])
        .send({
          columns: [{ columnKey: 'tag', columnLabel: 'Tag', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true }],
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(mockReplaceColumns).toHaveBeenCalledWith(1, 10, expect.any(Array), 1)
    })

    it('returns 400 on duplicate column key in payload', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
        .set('Cookie', [`token=${token}`])
        .send({
          columns: [
            { columnKey: 'tag', columnLabel: 'Tag', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true },
            { columnKey: 'tag', columnLabel: 'Tag2', dataType: 'string', displayOrder: 1, isRequired: false, isEditable: true },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body?.error ?? res.body?.message).toMatch(/duplicate columnkey/i)
      expect(mockReplaceColumns).not.toHaveBeenCalled()
    })

    it('returns 400 when columnKey normalizes to empty', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
        .set('Cookie', [`token=${token}`])
        .send({
          columns: [
            { columnKey: '   ', columnLabel: 'Tag', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body?.error).toBeDefined()
      expect(mockReplaceColumns).not.toHaveBeenCalled()
    })

    it('returns 400 when columns contain duplicate columnKey after normalization', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
        .set('Cookie', [`token=${token}`])
        .send({
          columns: [
            { columnKey: 'Tag Name', columnLabel: 'Tag Name', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true },
            { columnKey: 'tag-name', columnLabel: 'Tag Name 2', dataType: 'string', displayOrder: 1, isRequired: false, isEditable: true },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body?.error ?? res.body?.message).toMatch(/duplicate columnkey/i)
      expect(mockReplaceColumns).not.toHaveBeenCalled()
    })

    it('accepts columnKey "Tag Name" and canonicalizes to tag_name', async () => {
      const returned = [
        { scheduleColumnId: 1, columnKey: 'tag_name', columnLabel: 'Tag', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true },
      ]
      mockReplaceColumns.mockResolvedValue(returned)

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
        .set('Cookie', [`token=${token}`])
        .send({
          columns: [
            { columnKey: 'Tag Name', columnLabel: 'Tag', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true },
          ],
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].columnKey).toBe('tag_name')
      expect(mockReplaceColumns).toHaveBeenCalledWith(1, 10, expect.arrayContaining([expect.objectContaining({ columnKey: 'tag_name' })]), 1)
    })
  })

  describe('PUT /api/backend/schedules/:scheduleId/entries', () => {
    it('replace-all entries', async () => {
      mockGetScheduleColumns.mockResolvedValue([
        { scheduleColumnId: 1, columnKey: 'tag', columnLabel: 'Tag', dataType: 'string', enumOptionsJson: null, displayOrder: 0, isRequired: false, isEditable: true, createdAt: new Date(), createdBy: null },
      ])

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/10/entries')
        .set('Cookie', [`token=${token}`])
        .send({
          entries: [
            { assetId: 1, sheetId: null, values: [{ columnKey: 'tag', valueString: 'PT-001' }] },
          ],
        })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(mockReplaceScheduleEntries).toHaveBeenCalled()
    })

    it('returns 400 on unknown columnKey', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/10/entries')
        .set('Cookie', [`token=${token}`])
        .send({
          entries: [
            { assetId: 1, values: [{ columnKey: 'foo', valueString: 'x' }] },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/unknown columnKey|Unknown/i)
    })

    it('returns 404 when schedule not found', async () => {
      mockGetScheduleById.mockResolvedValue(null)

      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/999/entries')
        .set('Cookie', [`token=${token}`])
        .send({ entries: [] })

      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid schedule id', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/invalid/entries')
        .set('Cookie', [`token=${token}`])
        .send({ entries: [] })

      expect(res.status).toBe(400)
      expect(mockReplaceScheduleEntries).not.toHaveBeenCalled()
    })

    it('returns 400 when value item has multiple typed values in one cell', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/10/entries')
        .set('Cookie', [`token=${token}`])
        .send({
          entries: [
            {
              assetId: 1,
              values: [
                { columnKey: 'tag', valueString: 'PT-001', valueNumber: 42 },
              ],
            },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body?.error).toBeDefined()
      expect(mockReplaceScheduleEntries).not.toHaveBeenCalled()
    })

    it('returns 400 when entries contain duplicate assetId', async () => {
      const token = makeToken({ userId: 1, accountId: 1 })
      const res = await request(app)
        .put('/api/backend/schedules/10/entries')
        .set('Cookie', [`token=${token}`])
        .send({
          entries: [
            { assetId: 1, sheetId: null, values: [] },
            { assetId: 1, sheetId: null, values: [] },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body?.error).toMatch(/duplicate assetId/i)
      expect(mockReplaceScheduleEntries).not.toHaveBeenCalled()
    })
  })

  describe('account scoping', () => {
    it('uses account from auth for get detail', async () => {
      currentTestAccountId = 42
      mockGetDetail.mockResolvedValue(null)

      const token = makeToken({ userId: 1, accountId: 42 })
      await request(app)
        .get('/api/backend/schedules/10')
        .set('Cookie', [`token=${token}`])

      expect(mockGetDetail).toHaveBeenCalledWith(42, 10)
    })
  })

  describe('permission gating', () => {
    it('schedule routes use SCHEDULES_VIEW and SCHEDULES_EDIT', () => {
      const path = require('path')
      const fs = require('fs')
      const routesPath = path.join(__dirname, '../../src/backend/routes/schedulesRoutes.ts')
      const content = fs.readFileSync(routesPath, 'utf8')
      expect(content).toContain('SCHEDULES_VIEW')
      expect(content).toContain('SCHEDULES_EDIT')
      expect(content).not.toMatch(/requirePermission\s*\(\s*PERMISSIONS\.DATASHEET_(VIEW|EDIT)/)
    })

    it('returns 403 when lacking SCHEDULES_EDIT', async () => {
      const { checkUserPermission } = require('../../src/backend/database/permissionQueries')
      ;(checkUserPermission as jest.Mock).mockResolvedValue(false)

      const token = makeToken({ userId: 1, accountId: 1, role: 'Viewer' })
      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
        .set('Cookie', [`token=${token}`])
        .send({
          columns: [{ columnKey: 'tag', columnLabel: 'Tag', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true }],
        })

      expect(res.status).toBe(403)
      expect(mockReplaceColumns).not.toHaveBeenCalled()
      ;(checkUserPermission as jest.Mock).mockResolvedValue(true)
    })
  })
})
