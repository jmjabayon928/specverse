import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import InviteAcceptPage from '../../../src/app/invite/accept/page'

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

describe('InviteAcceptPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockReturnValue(null)
    globalThis.fetch = jest.fn()
  })

  it('shows invalid invite link when token is missing', async () => {
    mockGet.mockReturnValue(null)
    render(<InviteAcceptPage />)
    await waitFor(() => {
      expect(screen.getByText(/Invalid invite link/i)).toBeInTheDocument()
      expect(screen.getByText(/missing the invite token/i)).toBeInTheDocument()
    })
  })

  it('shows invalid or expired when by-token returns 404', async () => {
    mockGet.mockReturnValue('some-token')
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<InviteAcceptPage />)
    await waitFor(() => {
      expect(screen.getByText(/Invalid or expired invite/i)).toBeInTheDocument()
    })
  })

  it('shows expired message when status is expired', async () => {
    mockGet.mockReturnValue('some-token')
    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accountName: 'Acme', status: 'expired', expiresAt: '2020-01-01' }),
    })
    render(<InviteAcceptPage />)
    await waitFor(() => {
      expect(screen.getByText(/This invite has expired/i)).toBeInTheDocument()
    })
  })

  it('shows already accepted when status is accepted', async () => {
    mockGet.mockReturnValue('some-token')
    ;(globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accountName: 'Acme', status: 'accepted', expiresAt: '2025-01-01' }),
      })
    render(<InviteAcceptPage />)
    await waitFor(() => {
      expect(screen.getByText(/already been accepted/i)).toBeInTheDocument()
    })
  })

  it('shows sign in to accept when pending and not signed in', async () => {
    mockGet.mockReturnValue('some-token')
    ;(globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accountName: 'Acme', status: 'pending', expiresAt: '2025-01-01' }),
      })
      .mockResolvedValueOnce({ ok: false })
    render(<InviteAcceptPage />)
    await waitFor(() => {
      expect(screen.getByText(/invited to join Acme/i)).toBeInTheDocument()
      expect(screen.getByText(/Sign in with the email/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Sign in to accept/i })).toHaveAttribute(
        'href',
        expect.stringContaining('login')
      )
    })
  })

  it('shows Accept and Decline when pending and signed in', async () => {
    mockGet.mockReturnValue('some-token')
    ;(globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accountName: 'Acme', status: 'pending', expiresAt: '2025-01-01' }),
      })
      .mockResolvedValueOnce({ ok: true })
    render(<InviteAcceptPage />)
    await waitFor(() => {
      expect(screen.getByText(/invited to join Acme/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Accept invite/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument()
    })
  })

  it('shows email mismatch when accept returns 403', async () => {
    mockGet.mockReturnValue('some-token')
    ;(globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accountName: 'Acme', status: 'pending', expiresAt: '2025-01-01' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Email mismatch' }),
      })
    render(<InviteAcceptPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Accept invite/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Accept invite/i }))
    await waitFor(() => {
      expect(screen.getByText(/Email does not match/i)).toBeInTheDocument()
      expect(screen.getByText(/sign in with the email address that received this invite/i)).toBeInTheDocument()
    })
  })

  it('shows success and redirects when accept succeeds', async () => {
    mockGet.mockReturnValue('some-token')
    ;(globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accountName: 'Acme', status: 'pending', expiresAt: '2025-01-01' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accountId: 1, accountName: 'Acme' }) })
    render(<InviteAcceptPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Accept invite/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Accept invite/i }))
    await waitFor(() => {
      expect(screen.getByText(/You've joined Acme/i)).toBeInTheDocument()
      expect(screen.getByText(/Redirecting to dashboard/i)).toBeInTheDocument()
    })
    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/dashboard')
      },
      { timeout: 3000 },
    )
  })
})
