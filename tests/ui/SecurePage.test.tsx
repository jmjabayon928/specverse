// tests/ui/SecurePage.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SecurePage from '../../src/components/security/SecurePage'
import { PERMISSIONS } from '../../src/constants/permissions'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../../src/hooks/useSession', () => ({
  useSession: jest.fn(),
}))

const useSessionMock = jest.requireMock('../../src/hooks/useSession').useSession as jest.Mock

describe('SecurePage gating', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSessionMock.mockReturnValue({
      user: {
        role: 'Engineer',
        permissions: [PERMISSIONS.DATASHEET_VIEW],
        userId: 1,
        roleId: 1,
      },
      loading: false,
    })
  })

  it('redirects to /unauthorized when user lacks required permission', () => {
    render(
      <SecurePage requiredPermission={PERMISSIONS.DATASHEET_APPROVE}>
        <span>Protected content</span>
      </SecurePage>
    )

    expect(mockPush).toHaveBeenCalledWith('/unauthorized')
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('does not redirect when user has required permission', () => {
    render(
      <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
        <span>Protected content</span>
      </SecurePage>
    )

    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('redirects to /unauthorized when requiredRole does not match', () => {
    useSessionMock.mockReturnValue({
      user: { role: 'Engineer', permissions: [], userId: 1, roleId: 1 },
      loading: false,
    })

    render(
      <SecurePage requiredRole="Admin">
        <span>Admin content</span>
      </SecurePage>
    )

    expect(mockPush).toHaveBeenCalledWith('/unauthorized')
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })

  it('does not redirect when requiredRole matches (case-insensitive)', () => {
    useSessionMock.mockReturnValue({
      user: { role: 'Admin', permissions: [], userId: 1, roleId: 1 },
      loading: false,
    })

    render(
      <SecurePage requiredRole="Admin">
        <span>Admin content</span>
      </SecurePage>
    )

    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })
})
