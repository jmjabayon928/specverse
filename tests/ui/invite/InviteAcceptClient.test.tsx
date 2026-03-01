/**
 * InviteAcceptClient: timeout guard and error state when fetch never resolves.
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import InviteAcceptClient from '../../../src/app/invite/accept/InviteAcceptClient'

const TIMEOUT_MS = 15000

const mockReplace = jest.fn()
const mockGet = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? mockGet() : null),
  }),
}))

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) {
    return <a href={href}>{children}</a>
  }
})

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

describe('InviteAcceptClient timeout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockReturnValue('test-token')
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('leaves loading and shows error state when validate fetch never resolves within TIMEOUT_MS', async () => {
    const neverResolving = new Promise<Response>(() => {})
    const mockFetch = jest.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/invites/validate')) return neverResolving
      return Promise.resolve({ ok: true, status: 401 })
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    render(<InviteAcceptClient />)

    expect(screen.getByText(/Loading invite/i)).toBeInTheDocument()

    await act(async () => {
      jest.advanceTimersByTime(TIMEOUT_MS)
    })

    expect(screen.queryByText(/Loading invite/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Try again/i })).toBeInTheDocument()
  })
})
