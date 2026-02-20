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

  it('fetches session on login page and eventually sets loading false', async () => {
    mockUsePathname.mockReturnValue('/login')
  
    const mockRes = {
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    } as unknown as Response
  
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockRes)
  
    const { result } = renderHook(() => useSession())
  
    // New behavior: we still fetch on /login, so loading starts true
    expect(result.current.loading).toBe(true)
  
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/backend/auth/session',
        expect.objectContaining({ credentials: 'include' })
      )
    })
  
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  
    expect(result.current.user).toBeNull()
  })
})
