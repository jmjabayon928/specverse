/**
 * Unit tests for apiJson.server.ts — verify 401/403 error prefix behavior
 */
jest.mock('server-only', () => ({}), { virtual: true })

// Mock Next.js headers
const mockHeaders = new Map<string, string>()
const mockHeadersGet = jest.fn((name: string) => mockHeaders.get(name) ?? null)

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve({ get: mockHeadersGet })),
}))

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('notFound() called')
  }),
}))

import { apiJson } from '../../src/utils/apiJson.server'

// Mock global fetch
const originalFetch = global.fetch
beforeAll(() => {
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

beforeEach(() => {
  jest.clearAllMocks()
  mockHeaders.clear()
  mockHeaders.set('host', 'localhost:3000')
  mockHeaders.set('x-forwarded-proto', 'http')
})

describe('apiJson error handling', () => {
  it('throws HTTP_401: prefix for 401 status', async () => {
    const mockFetch = global.fetch as jest.Mock
    const mockResponse = {
      status: 401,
      ok: false,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      text: jest.fn().mockResolvedValue('Unauthorized'),
      clone: jest.fn().mockReturnThis(),
    }
    mockFetch.mockResolvedValueOnce(mockResponse)

    const error = await apiJson('/api/backend/test').catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/^HTTP_401:/)
  })

  it('throws HTTP_403: prefix for 403 status', async () => {
    const mockFetch = global.fetch as jest.Mock
    const mockResponse = {
      status: 403,
      ok: false,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      text: jest.fn().mockResolvedValue('Forbidden'),
      clone: jest.fn().mockReturnThis(),
    }
    mockFetch.mockResolvedValueOnce(mockResponse)

    const error = await apiJson('/api/backend/test').catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/^HTTP_403:/)
  })

  it('does not add prefix for other error statuses', async () => {
    const mockFetch = global.fetch as jest.Mock
    const mockResponse = {
      status: 500,
      ok: false,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      text: jest.fn().mockResolvedValue('Internal Server Error'),
      clone: jest.fn().mockReturnThis(),
    }
    mockFetch.mockResolvedValueOnce(mockResponse)

    const error = await apiJson('/api/backend/test').catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).not.toMatch(/^HTTP_401:/)
    expect(error.message).not.toMatch(/^HTTP_403:/)
    expect(error.message).toMatch(/^API error 500/)
  })

  it('includes requestId in error message when present', async () => {
    mockHeaders.set('x-request-id', 'test-request-123')
    const mockFetch = global.fetch as jest.Mock
    const mockResponse = {
      status: 401,
      ok: false,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      text: jest.fn().mockResolvedValue('Unauthorized'),
      clone: jest.fn().mockReturnThis(),
    }
    mockFetch.mockResolvedValueOnce(mockResponse)

    const error = await apiJson('/api/backend/test').catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/^HTTP_401:/)
    expect(error.message).toContain('[requestId: test-request-123]')
  })
})
