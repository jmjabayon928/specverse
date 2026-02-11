import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import AccountSwitcher from '../../src/components/account/AccountSwitcher'

const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

jest.mock('../../src/hooks/useSession', () => ({
  useSession: jest.fn(),
}))
const useSessionMock = jest.requireMock('../../src/hooks/useSession').useSession as jest.Mock

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}))

describe('AccountSwitcher', () => {
  beforeEach(() => {
    mockRefresh.mockClear()
    useSessionMock.mockReturnValue({
      user: { userId: 1, roleId: 1, role: 'Admin', permissions: [] },
      loading: false,
      refetchSession: jest.fn().mockResolvedValue(undefined),
    })
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders nothing when user is null', () => {
    useSessionMock.mockReturnValue({ user: null, loading: false })
    const { container } = render(<AccountSwitcher />)
    expect(container.firstChild).toBeNull()
  })

  it('fetches accounts and shows current account name', async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accounts: [
          { accountId: 1, accountName: 'Acme', slug: 'acme', isActive: true, roleName: 'Admin' },
          { accountId: 2, accountName: 'Beta', slug: 'beta', isActive: false, roleName: 'User' },
        ],
        activeAccountId: 1,
      }),
    })
    render(<AccountSwitcher />)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/backend/accounts', expect.objectContaining({ credentials: 'include' }))
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch account/i })).toHaveTextContent('Acme')
    })
  })

  it('shows stable loading state before fetch completes', async () => {
    let resolveFetch: (value: unknown) => void
    ;(globalThis.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    render(<AccountSwitcher />)
    expect(screen.getByRole('button', { name: /switch account/i })).toHaveTextContent('Loading…')
    resolveFetch!({
      ok: true,
      json: async () => ({ accounts: [], activeAccountId: null }),
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch account/i })).toHaveTextContent('No account')
    })
  })

  it('shows "Select an account" when activeAccountId is missing', async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accounts: [{ accountId: 1, accountName: 'Acme', slug: 'acme', isActive: false, roleName: 'User' }],
        activeAccountId: null,
      }),
    })
    render(<AccountSwitcher />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch account/i })).toHaveTextContent('Select an account')
    })
  })

  it('on account selection calls POST active-account then refresh', async () => {
    const refetchSessionMock = jest.fn().mockResolvedValue(undefined)
    useSessionMock.mockReturnValue({
      user: { userId: 1, roleId: 1, role: 'Admin', permissions: [] },
      loading: false,
      refetchSession: refetchSessionMock,
    })
    const user = userEvent.setup()
    ;(globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accounts: [
            { accountId: 1, accountName: 'Acme', slug: 'acme', isActive: true, roleName: 'Admin' },
            { accountId: 2, accountName: 'Beta', slug: 'beta', isActive: false, roleName: 'User' },
          ],
          activeAccountId: 1,
        }),
      })
      .mockResolvedValueOnce({ ok: true })
    render(<AccountSwitcher />)
    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument()
    })
    const trigger = screen.getByRole('button', { name: /switch account/i })
    await user.click(trigger)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Beta/i })).toBeInTheDocument()
    })
    const betaOption = screen.getByRole('option', { name: /Beta/i })
    await user.click(betaOption)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/backend/sessions/active-account',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: 2 }),
        })
      )
      expect(refetchSessionMock).toHaveBeenCalledTimes(1)
      expect(mockRefresh).toHaveBeenCalled()
    })
  })
})
