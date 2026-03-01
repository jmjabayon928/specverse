/**
 * Regression: missing_token and missing_session both show the same login reason message.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import LoginClient from '../../../src/app/login/LoginClient'

const mockGet = jest.fn()
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockGet(key),
  }),
}))

jest.mock('../../../src/hooks/useSession', () => ({
  useSession: () => ({ refetchSession: jest.fn() }),
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
