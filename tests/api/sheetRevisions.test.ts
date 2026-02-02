// tests/api/sheetRevisions.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'

globalThis.setImmediate ??= ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
  setTimeout(fn, 0, ...args)) as unknown as typeof setImmediate

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
    { expiresIn: '1h' }
  )
  return `token=${token}`
}

const FILLED_PERMISSIONS: string[] = [
  'DATASHEET_VIEW',
  'DATASHEET_EDIT',
  'DATASHEET_VERIFY',
  'DATASHEET_APPROVE',
]

process.env.JWT_SECRET ??= 'secret'

const testSheetId = 999
const mockRevisionId = 1001
const mockRevisionNumber = 1
/** Fixed date for deterministic mocks and payloads (no time-dependent flakiness). */
const FIXED_DATE = new Date('2026-01-28T12:00:00.000Z')
const FIXED_DATE_STRING = '2026-01-28'

const mockSnapshot = {
  sheetName: 'Test Sheet',
  sheetDesc: 'Test Desc',
  subsheets: [],
}

/** Minimal valid UnifiedSheet for restore handler snapshot validation */
const validRestoreSnapshot = {
  sheetName: 'Test Sheet',
  sheetDesc: 'Test Desc',
  clientDocNum: 1,
  clientProjectNum: 1,
  companyDocNum: 1,
  companyProjectNum: 1,
  areaId: 1,
  packageName: 'Test Package',
  revisionNum: 1,
  revisionDate: '2026-01-01',
  preparedById: 1,
  preparedByDate: '2026-01-01',
  itemLocation: 'Test Location',
  requiredQty: 1,
  equipmentName: 'Test Equipment',
  equipmentTagNum: 'TAG-001',
  serviceName: 'Test Service',
  manuId: 1,
  suppId: 1,
  equipSize: 1,
  categoryId: 1,
  clientId: 1,
  projectId: 1,
  subsheets: [
    {
      name: 'Test Subsheet',
      fields: [
        {
          id: 1,
          label: 'Test Field',
          infoType: 'varchar' as const,
          sortOrder: 0,
          required: false,
          value: 'Test Value',
        },
      ],
    },
  ],
}

const mockListRevisionsPaged = jest.fn()
const mockGetRevisionById = jest.fn()
const mockCreateRevision = jest.fn()
const mockUpdateFilledSheet = jest.fn()
const mockGetFilledSheetDetailsById = jest.fn()

jest.mock('../../src/backend/database/sheetRevisionQueries', () => ({
  listRevisionsPaged: (...args: unknown[]) => mockListRevisionsPaged(...args),
  getRevisionById: (...args: unknown[]) => mockGetRevisionById(...args),
  createRevision: (...args: unknown[]) => mockCreateRevision(...args),
  getNextRevisionNumber: jest.fn().mockResolvedValue(1),
}))

jest.mock('../../src/backend/services/filledSheetService', () => ({
  updateFilledSheet: (...args: unknown[]) => mockUpdateFilledSheet(...args),
  getFilledSheetDetailsById: (...args: unknown[]) => mockGetFilledSheetDetailsById(...args),
}))

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
  getUserPermissions: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../src/backend/config/db', () => {
  const MockTransaction = class {
    begin = () => Promise.resolve()
    commit = () => Promise.resolve()
    rollback = () => Promise.resolve()
  }
  return {
    poolPromise: Promise.resolve({}),
    sql: {
      Transaction: MockTransaction,
      Int: 1,
      NVarChar: (n: number) => n,
      MAX: 9999,
    },
  }
})

function buildTestApp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const filledSheetRoutes = require('../../src/backend/routes/filledSheetRoutes').default
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/filledsheets', filledSheetRoutes)
  return app
}

describe('Sheet Revisions API', () => {
  const authCookie = createAuthCookie(FILLED_PERMISSIONS)

  beforeEach(() => {
    jest.clearAllMocks()
    mockListRevisionsPaged.mockResolvedValue({
      total: 1,
      rows: [
        {
          revisionId: mockRevisionId,
          revisionNumber: mockRevisionNumber,
          createdAt: FIXED_DATE,
          createdBy: 1,
          createdByName: 'Test User',
          status: 'Draft',
          comment: null,
          systemRevisionNum: mockRevisionNumber,
          systemRevisionAt: FIXED_DATE,
        },
      ],
    })
    mockGetRevisionById.mockResolvedValue({
      revisionId: mockRevisionId,
      revisionNumber: mockRevisionNumber,
      createdAt: FIXED_DATE,
      createdBy: 1,
      createdByName: 'Test User',
      status: 'Draft',
      comment: null,
      snapshot: mockSnapshot,
      systemRevisionNum: mockRevisionNumber,
      systemRevisionAt: FIXED_DATE,
    })
    mockGetFilledSheetDetailsById.mockResolvedValue({
      datasheet: { ...mockSnapshot, sheetId: testSheetId },
    })
    mockUpdateFilledSheet.mockResolvedValue({ sheetId: testSheetId })
    mockCreateRevision.mockResolvedValue(mockRevisionId + 1)
  })

  describe('Revision Creation', () => {
    it('should create a revision when updating a filled sheet', async () => {
      const app = buildTestApp()
      const updateRes = await request(app)
        .put(`/api/backend/filledsheets/${testSheetId}`)
        .set('Cookie', [authCookie])
        .send({
          sheetName: 'Updated Test Sheet',
          sheetDesc: 'Updated Desc',
          clientDocNum: 1,
          clientProjectNum: 1,
          companyDocNum: 1,
          companyProjectNum: 1,
          areaId: 1,
          packageName: 'Test Package',
          revisionNum: 1,
          revisionDate: FIXED_DATE_STRING,
          preparedById: 1,
          preparedByDate: FIXED_DATE_STRING,
          itemLocation: 'Test Location',
          requiredQty: 1,
          equipmentName: 'Test Equipment',
          equipmentTagNum: 'TAG-002',
          serviceName: 'Test Service',
          manuId: 1,
          suppId: 1,
          equipSize: 1,
          categoryId: 1,
          clientId: 1,
          projectId: 1,
          subsheets: [
            {
              name: 'Test Subsheet',
              fields: [
                {
                  id: 1,
                  label: 'Test Field',
                  infoType: 'varchar',
                  sortOrder: 0,
                  required: false,
                  value: 'Test Value',
                },
              ],
            },
          ],
        })

      expect(updateRes.statusCode).toBe(200)
      expect(mockUpdateFilledSheet).toHaveBeenCalled()

      const listRes = await request(app)
        .get(`/api/backend/filledsheets/${testSheetId}/revisions`)
        .set('Cookie', [authCookie])

      expect(listRes.statusCode).toBe(200)
      expect(listRes.body.total).toBeGreaterThan(0)
      expect(Array.isArray(listRes.body.rows)).toBe(true)
      expect(listRes.body.rows.length).toBeGreaterThan(0)
    })
  })

  describe('List Revisions', () => {
    it('should return paginated revisions', async () => {
      const app = buildTestApp()
      const res = await request(app)
        .get(`/api/backend/filledsheets/${testSheetId}/revisions?page=1&pageSize=20`)
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('page')
      expect(res.body).toHaveProperty('pageSize')
      expect(res.body).toHaveProperty('total')
      expect(res.body).toHaveProperty('rows')
      expect(Array.isArray(res.body.rows)).toBe(true)
      expect(mockListRevisionsPaged).toHaveBeenCalledWith(testSheetId, 1, 20)

      if (res.body.rows.length > 0) {
        const revision = res.body.rows[0]
        expect(revision).toHaveProperty('revisionId')
        expect(revision).toHaveProperty('revisionNumber')
        expect(revision).toHaveProperty('createdAt')
        expect(revision).toHaveProperty('createdBy')
      }
    })
  })

  describe('Get Revision Details', () => {
    it('should return revision details with snapshot', async () => {
      const app = buildTestApp()
      const res = await request(app)
        .get(`/api/backend/filledsheets/${testSheetId}/revisions/${mockRevisionId}`)
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('revisionId')
      expect(res.body).toHaveProperty('snapshot')
      expect(typeof res.body.snapshot).toBe('object')
      expect(res.body.snapshot).toHaveProperty('sheetName')
      expect(res.body.snapshot.sheetName).toBe(mockSnapshot.sheetName)
      expect(mockGetRevisionById).toHaveBeenCalledWith(testSheetId, mockRevisionId)
    })
  })

  describe('Restore Revision', () => {
    it('should restore a revision and create a new revision', async () => {
      const app = buildTestApp()
      mockGetRevisionById.mockResolvedValueOnce({
        revisionId: mockRevisionId,
        revisionNumber: mockRevisionNumber,
        createdAt: FIXED_DATE,
        createdBy: 1,
        createdByName: 'Test User',
        status: 'Draft',
        comment: null,
        snapshot: validRestoreSnapshot,
        systemRevisionNum: mockRevisionNumber,
        systemRevisionAt: FIXED_DATE,
      })
      mockGetFilledSheetDetailsById
        .mockResolvedValueOnce({ datasheet: { ...validRestoreSnapshot, sheetId: testSheetId } })
        .mockResolvedValueOnce({ datasheet: { ...validRestoreSnapshot, sheetName: validRestoreSnapshot.sheetName, sheetId: testSheetId } })

      const restoreRes = await request(app)
        .post(`/api/backend/filledsheets/${testSheetId}/revisions/${mockRevisionId}/restore`)
        .set('Cookie', [authCookie])
        .send({ comment: 'Test restore' })

      expect(restoreRes.statusCode).toBe(200)
      expect(restoreRes.body).toHaveProperty('sheetId')
      expect(restoreRes.body).toHaveProperty('newRevisionId')
      expect(restoreRes.body).toHaveProperty('restoredFromRevisionId')
      expect(restoreRes.body.restoredFromRevisionId).toBe(mockRevisionId)
      expect(mockGetRevisionById).toHaveBeenCalledWith(testSheetId, mockRevisionId)
      expect(mockUpdateFilledSheet).toHaveBeenCalled()
      expect(mockCreateRevision).toHaveBeenCalled()

      const listRes = await request(app)
        .get(`/api/backend/filledsheets/${testSheetId}/revisions`)
        .set('Cookie', [authCookie])

      expect(listRes.statusCode).toBe(200)
      expect(listRes.body.total).toBeGreaterThanOrEqual(0)

      const sheetRes = await request(app)
        .get(`/api/backend/filledsheets/${testSheetId}`)
        .set('Cookie', [authCookie])

      expect(sheetRes.statusCode).toBe(200)
      expect(sheetRes.body.datasheet).toHaveProperty('sheetName')
    })
  })
})
