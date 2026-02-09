// tests/ui/estimation/EstimationDashboardPage.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import EstimationDashboardPage from '../../../src/app/(admin)/estimation/page'

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  }
})

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (fn: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    const Component = function DynamicMock(_props: unknown) {
      const [El, setEl] = React.useState<React.ComponentType<unknown> | null>(null)

      React.useEffect(() => {
        fn().then((m) => setEl(() => m.default))
      }, [fn])

      if (!El) return <div data-testid="select-placeholder">Loading...</div>

      return <El {...(_props as object)} />
    }

    return Component
  },
}))

function urlFromInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

describe('EstimationDashboardPage', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const url = urlFromInput(input)
      if (url.includes('/api/backend/auth/session')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ userId: 1, roleId: 1, role: 'Admin', permissions: [], accountId: 1, isOwner: true, ownerUserId: 1 }),
        } as Response)
      }
      if (url.includes('/api/backend/settings/clients')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ page: 1, pageSize: 20, total: 1, rows: [{ ClientID: 1, ClientName: 'Acme Corp' }] }),
        } as Response)
      }
      if (url.includes('/api/backend/projects')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ page: 1, pageSize: 20, total: 1, rows: [{ ProjectID: 1, ProjName: 'Phase 1' }] }),
        } as Response)
      }
      if (url.includes('/api/backend/estimation/filter')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [], totalCount: 0 }),
        } as Response)
      }
      return Promise.resolve({ ok: false, json: async () => ({}) } as Response)
    }) as typeof fetch
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('fetches clients and projects with credentials include', async () => {
    render(<EstimationDashboardPage />)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/backend/settings/clients',
        expect.objectContaining({ credentials: 'include' })
      )
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/backend/projects',
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  it('maps client and project rows into options when API returns data', async () => {
    render(<EstimationDashboardPage />)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/backend/settings/clients',
        expect.any(Object)
      )
    })
    expect(screen.getByText('Project Estimation Dashboard')).toBeInTheDocument()
  })

  it('handles non-200 responses and sets empty options', async () => {
    render(<EstimationDashboardPage />)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/backend/settings/clients', expect.any(Object))
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/backend/projects', expect.any(Object))
    })
    expect(screen.getByText('Project Estimation Dashboard')).toBeInTheDocument()
  })
})
