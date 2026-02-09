// tests/api/instruments.test.ts
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

const mockListInstrumentsLinkedToSheet = jest.fn()
const mockLinkInstrumentToSheet = jest.fn()
const mockUnlinkInstrumentFromSheet = jest.fn()
const mockListInstruments = jest.fn()
const mockGetInstrument = jest.fn()
const mockCreateInstrument = jest.fn()
const mockUpdateInstrument = jest.fn()

jest.mock('../../src/backend/services/instrumentsService', () => ({
  listInstrumentsLinkedToSheet: (...args: unknown[]) => mockListInstrumentsLinkedToSheet(...args),
  linkInstrumentToSheet: (...args: unknown[]) => mockLinkInstrumentToSheet(...args),
  unlinkInstrumentFromSheet: (...args: unknown[]) => mockUnlinkInstrumentFromSheet(...args),
  listInstruments: (...args: unknown[]) => mockListInstruments(...args),
  getInstrument: (...args: unknown[]) => mockGetInstrument(...args),
  createInstrument: (...args: unknown[]) => mockCreateInstrument(...args),
  updateInstrument: (...args: unknown[]) => mockUpdateInstrument(...args),
}))

describe('Instruments API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentTestAccountId = 1
  })

  describe('GET /api/backend/datasheets/:sheetId/instruments', () => {
    it('returns linked instruments for sheet', async () => {
      mockListInstrumentsLinkedToSheet.mockResolvedValue([
        {
          instrumentId: 10,
          instrumentTag: 'PT-101',
          instrumentType: 'Pressure',
          loopTags: ['LC-101'],
          linkRole: null,
        },
      ])

      const res = await request(app).get('/api/backend/datasheets/5/instruments')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].instrumentId).toBe(10)
      expect(res.body[0].instrumentTag).toBe('PT-101')
      expect(mockListInstrumentsLinkedToSheet).toHaveBeenCalledWith(1, 5)
    })

    it('returns 400 for invalid sheet id', async () => {
      const res = await request(app).get('/api/backend/datasheets/abc/instruments')
      expect(res.status).toBe(400)
      expect(mockListInstrumentsLinkedToSheet).not.toHaveBeenCalled()
    })

    it('returns 404 when sheet not found', async () => {
      mockListInstrumentsLinkedToSheet.mockRejectedValue(
        new AppError('Sheet not found or does not belong to account', 404)
      )
      const res = await request(app).get('/api/backend/datasheets/999/instruments')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/backend/datasheets/:sheetId/instruments/:instrumentId/link', () => {
    it('links instrument to sheet', async () => {
      mockLinkInstrumentToSheet.mockResolvedValue(undefined)

      const res = await request(app)
        .post('/api/backend/datasheets/5/instruments/10/link')
        .send({ linkRole: 'Primary' })

      expect(res.status).toBe(201)
      expect(res.body.linked).toBe(true)
      expect(mockLinkInstrumentToSheet).toHaveBeenCalledWith(1, 5, 10, 'Primary', 1)
    })

    it('returns 400 for invalid ids', async () => {
      const res = await request(app).post('/api/backend/datasheets/abc/instruments/10/link')
      expect(res.status).toBe(400)
      const res2 = await request(app).post('/api/backend/datasheets/5/instruments/xyz/link')
      expect(res2.status).toBe(400)
    })
  })

  describe('DELETE /api/backend/datasheets/:sheetId/instruments/:instrumentId/link', () => {
    it('unlinks instrument from sheet', async () => {
      mockUnlinkInstrumentFromSheet.mockResolvedValue(undefined)

      const res = await request(app).delete('/api/backend/datasheets/5/instruments/10/link')

      expect(res.status).toBe(200)
      expect(res.body.unlinked).toBe(true)
      expect(mockUnlinkInstrumentFromSheet).toHaveBeenCalledWith(1, 5, 10, undefined)
    })
  })

  describe('GET /api/backend/instruments', () => {
    it('returns list of instruments', async () => {
      mockListInstruments.mockResolvedValue([
        {
          instrumentId: 1,
          accountId: 1,
          instrumentTag: 'PT-101',
          instrumentTagNorm: 'PT-101',
          instrumentType: 'Pressure',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const res = await request(app).get('/api/backend/instruments')
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].instrumentTag).toBe('PT-101')
      expect(mockListInstruments).toHaveBeenCalledWith(1, undefined)
    })

    it('passes q search param', async () => {
      mockListInstruments.mockResolvedValue([])
      await request(app).get('/api/backend/instruments?q=PT')
      expect(mockListInstruments).toHaveBeenCalledWith(1, 'PT')
    })
  })

  describe('GET /api/backend/instruments/:instrumentId', () => {
    it('returns instrument by id', async () => {
      mockGetInstrument.mockResolvedValue({
        instrumentId: 10,
        accountId: 1,
        instrumentTag: 'PT-101',
        instrumentTagNorm: 'PT-101',
        instrumentType: 'Pressure',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await request(app).get('/api/backend/instruments/10')
      expect(res.status).toBe(200)
      expect(res.body.instrumentId).toBe(10)
      expect(res.body.instrumentTag).toBe('PT-101')
    })

    it('returns 404 when not found', async () => {
      mockGetInstrument.mockResolvedValue(null)
      const res = await request(app).get('/api/backend/instruments/999')
      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid id', async () => {
      const res = await request(app).get('/api/backend/instruments/invalid')
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/backend/instruments', () => {
    it('creates instrument', async () => {
      mockCreateInstrument.mockResolvedValue({
        instrumentId: 20,
        accountId: 1,
        instrumentTag: 'TE-201',
        instrumentTagNorm: 'TE-201',
        instrumentType: 'Temperature',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await request(app)
        .post('/api/backend/instruments')
        .send({ instrumentTag: 'TE-201', instrumentType: 'Temperature' })

      expect(res.status).toBe(201)
      expect(res.body.instrumentId).toBe(20)
      expect(res.body.instrumentTag).toBe('TE-201')
      expect(mockCreateInstrument).toHaveBeenCalled()
    })

    it('returns 400 for invalid payload', async () => {
      const res = await request(app).post('/api/backend/instruments').send({})
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /api/backend/instruments/:instrumentId', () => {
    it('updates instrument', async () => {
      mockUpdateInstrument.mockResolvedValue({
        instrumentId: 10,
        accountId: 1,
        instrumentTag: 'PT-101-A',
        instrumentTagNorm: 'PT-101-A',
        instrumentType: 'Pressure',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await request(app)
        .patch('/api/backend/instruments/10')
        .send({ instrumentTag: 'PT-101-A' })

      expect(res.status).toBe(200)
      expect(res.body.instrumentTag).toBe('PT-101-A')
      expect(mockUpdateInstrument).toHaveBeenCalledWith(1, 10, expect.any(Object))
    })

    it('returns 400 for invalid id', async () => {
      const res = await request(app).patch('/api/backend/instruments/abc').send({ instrumentTag: 'X' })
      expect(res.status).toBe(400)
    })
  })
})
