// tests/api/instrument-loops.test.ts
import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppError } from '../../src/backend/errors/AppError'
import app from '../../src/backend/app'
import { PERMISSIONS } from '../../src/constants/permissions'

let currentTestAccountId = 1
jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const helper = jest.requireActual('../helpers/authMiddlewareMock')
  return (helper as typeof import('../helpers/authMiddlewareMock')).createAuthMiddlewareMock({
    actual,
    mode: 'passthrough',
  })
})

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}))

const mockListLoops = jest.fn()
const mockGetLoopWithMembers = jest.fn()

jest.mock('../../src/backend/services/instrumentLoopsService', () => ({
  listLoops: (...args: unknown[]) => mockListLoops(...args),
  getLoopWithMembers: (...args: unknown[]) => mockGetLoopWithMembers(...args),
}))

describe('Instrument Loops API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentTestAccountId = 1
  })

  describe('GET /api/backend/instrument-loops', () => {
    it('returns list of loops', async () => {
      mockListLoops.mockResolvedValue([
        {
          loopId: 1,
          loopTag: 'LC-101',
          loopTagNorm: 'LC-101',
          status: 'Active',
          accountId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      ])

      const res = await request(app).get('/api/backend/instrument-loops')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].loopId).toBe(1)
      expect(res.body[0].loopTag).toBe('LC-101')
      expect(mockListLoops).toHaveBeenCalledWith(1)
    })
  })

  describe('GET /api/backend/instrument-loops/:loopId', () => {
    it('returns loop with members', async () => {
      mockGetLoopWithMembers.mockResolvedValue({
        loopId: 1,
        loopTag: 'LC-101',
        loopTagNorm: 'LC-101',
        status: 'Active',
        accountId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        members: [
          { instrumentId: 10, instrumentTag: 'PT-101', role: 'Primary' },
        ],
      })

      const res = await request(app).get('/api/backend/instrument-loops/1')

      expect(res.status).toBe(200)
      expect(res.body.loopId).toBe(1)
      expect(res.body.loopTag).toBe('LC-101')
      expect(res.body.members).toHaveLength(1)
      expect(res.body.members[0].instrumentTag).toBe('PT-101')
      expect(mockGetLoopWithMembers).toHaveBeenCalledWith(1, 1)
    })

    it('returns 404 when loop not found', async () => {
      mockGetLoopWithMembers.mockRejectedValue(new AppError('Loop not found', 404))
      const res = await request(app).get('/api/backend/instrument-loops/999')
      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid loop id', async () => {
      const res = await request(app).get('/api/backend/instrument-loops/abc')
      expect(res.status).toBe(400)
    })
  })
})
