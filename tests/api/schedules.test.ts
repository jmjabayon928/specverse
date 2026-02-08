// tests/api/schedules.test.ts
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
      isSuperadmin: false,
      permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT],
    }
    next()
  },
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  optionalVerifyToken: (_req: Request, _res: Response, next: NextFunction) => next(),
  verifyTokenOnly: (_req: Request, _res: Response, next: NextFunction) => next(),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const mockList = jest.fn()
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

      const res = await request(app).get('/api/backend/schedules')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].scheduleId).toBe(1)
      expect(mockList).toHaveBeenCalledWith(1, expect.any(Object))
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

      const res = await request(app)
        .post('/api/backend/schedules')
        .send({ name: 'New Schedule', disciplineId: 1, subtypeId: 2 })

      expect(res.status).toBe(201)
      expect(res.body.scheduleId).toBe(5)
      expect(mockCreateSchedule).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'New Schedule', disciplineId: 1, subtypeId: 2 }), 1)
    })

    it('returns 400 for invalid body', async () => {
      const res = await request(app)
        .post('/api/backend/schedules')
        .send({})

      expect(res.status).toBe(400)
      expect(mockCreateSchedule).not.toHaveBeenCalled()
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

      const res = await request(app).get('/api/backend/schedules/10')

      expect(res.status).toBe(200)
      expect(res.body.schedule.scheduleId).toBe(10)
      expect(res.body.columns).toEqual([])
      expect(res.body.entries).toEqual([])
      expect(mockGetDetail).toHaveBeenCalledWith(1, 10)
    })

    it('returns 404 when schedule not found', async () => {
      mockGetDetail.mockResolvedValue(null)

      const res = await request(app).get('/api/backend/schedules/999')

      expect(res.status).toBe(404)
      expect(res.body?.error).toMatch(/not found/i)
    })

    it('returns 400 for invalid schedule id', async () => {
      const res = await request(app).get('/api/backend/schedules/abc')

      expect(res.status).toBe(400)
      expect(mockGetDetail).not.toHaveBeenCalled()
    })
  })

  describe('PUT /api/backend/schedules/:scheduleId/columns', () => {
    it('replace-all columns', async () => {
      const returned = [
        { scheduleColumnId: 1, columnKey: 'tag', columnLabel: 'Tag', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true },
      ]
      mockReplaceColumns.mockResolvedValue(returned)

      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
        .send({
          columns: [{ columnKey: 'tag', columnLabel: 'Tag', dataType: 'string', displayOrder: 0, isRequired: false, isEditable: true }],
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(mockReplaceColumns).toHaveBeenCalledWith(1, 10, expect.any(Array), 1)
    })

    it('returns 400 on duplicate column key in payload', async () => {
      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
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
      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
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
      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
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

      const res = await request(app)
        .put('/api/backend/schedules/10/columns')
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

      const res = await request(app)
        .put('/api/backend/schedules/10/entries')
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
      const res = await request(app)
        .put('/api/backend/schedules/10/entries')
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

      const res = await request(app)
        .put('/api/backend/schedules/999/entries')
        .send({ entries: [] })

      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid schedule id', async () => {
      const res = await request(app)
        .put('/api/backend/schedules/invalid/entries')
        .send({ entries: [] })

      expect(res.status).toBe(400)
      expect(mockReplaceScheduleEntries).not.toHaveBeenCalled()
    })

    it('returns 400 when value item has multiple typed values in one cell', async () => {
      const res = await request(app)
        .put('/api/backend/schedules/10/entries')
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
      const res = await request(app)
        .put('/api/backend/schedules/10/entries')
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

      await request(app).get('/api/backend/schedules/10')

      expect(mockGetDetail).toHaveBeenCalledWith(42, 10)
    })
  })
})
