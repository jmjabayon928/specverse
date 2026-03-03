import request from 'supertest'
import app from '../../src/backend/app'

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

const perfEnabled = process.env.PERF_TEST === '1'
const maybeIt = perfEnabled ? it : it.skip

describe('Assets list performance', () => {
  maybeIt('GET /api/backend/assets completes under 500ms', async () => {
    const start = Date.now()
    const res = await request(app).get('/api/backend/assets')
    const durationMs = Date.now() - start

    expect(res.status).toBe(200)
    expect(durationMs).toBeLessThan(500)
  })
})

