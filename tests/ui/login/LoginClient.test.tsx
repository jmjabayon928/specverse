/**
 * Regression: missing_token and missing_session both show the same login reason message.
 * returnUrl: safe same-origin redirect after login.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import LoginClient from '../../../src/app/login/LoginClient'

const mockGet = jest.fn()
const mockRefetchSession = jest.fn()
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockGet(key),
  }),
}))

jest.mock('../../../src/hooks/useSession', () => ({
  useSession: () => ({ refetchSession: mockRefetchSession }),
}))

describe('LoginClient reason message', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockImplementation((key: string) => (key === 'status' ? '' : undefined))
  })

  it('shows session cookie message when reason=missing_token', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'reason') return 'missing_token'
      if (key === 'status') return ''
      return undefined
    })
    render(<LoginClient />)
    expect(screen.getByRole('alert')).toHaveTextContent(/session cookie was missing/i)
  })

  it('shows session cookie message when reason=missing_session', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'reason') return 'missing_session'
      if (key === 'status') return ''
      return undefined
    })
    render(<LoginClient />)
    expect(screen.getByRole('alert')).toHaveTextContent(/session cookie was missing/i)
  })
})

describe('LoginClient returnUrl redirect', () => {
  const mockReplace = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockImplementation((key: string) => {
      if (key === 'reason' || key === 'status') return ''
      return undefined
    })
    mockRefetchSession.mockResolvedValue(true)
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as typeof fetch
    Object.defineProperty(window, 'location', { value: { replace: mockReplace }, writable: true })
  })

  it('redirects to returnUrl when login succeeds and returnUrl is safe same-origin path', async () => {
    const safeReturn = '/invite/accept?token=abc'
    mockGet.mockImplementation((key: string) => {
      if (key === 'returnUrl') return safeReturn
      if (key === 'reason' || key === 'status') return ''
      return undefined
    })
    render(<LoginClient />)
    fireEvent.change(screen.getByPlaceholderText(/info@gmail.com/i), { target: { value: 'u@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'password1!' } })
    fireEvent.submit(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(safeReturn)
    })
  })

  it('redirects to /dashboard when returnUrl is https URL and login succeeds', async () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'returnUrl') return 'https://evil.com'
      if (key === 'reason' || key === 'status') return ''
      return undefined
    })
    render(<LoginClient />)
    fireEvent.change(screen.getByPlaceholderText(/info@gmail.com/i), { target: { value: 'u@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'password1!' } })
    fireEvent.submit(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('redirects to /dashboard when returnUrl starts with // and login succeeds', async () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'returnUrl') return '//evil.com/path'
      if (key === 'reason' || key === 'status') return ''
      return undefined
    })
    render(<LoginClient />)
    fireEvent.change(screen.getByPlaceholderText(/info@gmail.com/i), { target: { value: 'u@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'password1!' } })
    fireEvent.submit(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
  })
})
