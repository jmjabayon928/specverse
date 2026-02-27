import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useSessionMonitor } from '../../src/hooks/useSessionMonitor'

const mockPush = jest.fn()
const mockPathname = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}))

function Wrapper() {
  useSessionMonitor({ timeoutMinutes: 30, warningDuration: 30 })
  return <div>monitor</div>
}

describe('useSessionMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPathname.mockReturnValue('/dashboard')
    globalThis.fetch = jest.fn()
  })

  it('does not call router.push(/login) on mount when session returns 200', async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<Wrapper />)
    await Promise.resolve()
    await Promise.resolve()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('calls router.push(/login) when session returns 401 and not on login page', async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 })
    render(<Wrapper />)
    await Promise.resolve()
    await Promise.resolve()
    expect(mockPush).toHaveBeenCalledWith('/login?reason=session_401&from=useSessionMonitor&status=401')
  })

  it('does not redirect when session returns 500', async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 })
    render(<Wrapper />)
    await Promise.resolve()
    await Promise.resolve()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not redirect when session returns 403', async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 })
    render(<Wrapper />)
    await Promise.resolve()
    await Promise.resolve()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not redirect when fetch rejects', async () => {
    ;(globalThis.fetch as jest.Mock).mockRejectedValue(new Error('network error'))
    render(<Wrapper />)
    await Promise.resolve()
    await Promise.resolve()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
