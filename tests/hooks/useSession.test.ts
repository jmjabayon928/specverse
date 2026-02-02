// tests/hooks/useSession.test.ts
// Ensures useSession sets loading true when not on login page so LayoutWithSidebar
// does not redirect to /login before session fetch completes (fixes login bounce).

import { renderHook, waitFor } from '@testing-library/react'
import { useSession } from '../../src/hooks/useSession'

const mockUsePathname = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

describe('useSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('sets loading true when pathname is not login so layout does not redirect before fetch', async () => {
    mockUsePathname.mockReturnValue('/dashboard')
    const neverResolve = new Promise<Response>(() => {})
    ;(global.fetch as jest.Mock).mockReturnValue(neverResolve)

    const { result } = renderHook(() => useSession())

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/backend/auth/session',
        expect.objectContaining({ credentials: 'include' })
      )
    })

    expect(result.current.loading).toBe(true)
  })

  it('sets loading false on login page without fetching', () => {
    mockUsePathname.mockReturnValue('/login')

    const { result } = renderHook(() => useSession())

    expect(result.current.loading).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
