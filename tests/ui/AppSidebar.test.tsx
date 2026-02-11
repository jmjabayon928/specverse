// tests/ui/AppSidebar.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AppSidebar from '../../src/layout/AppSidebar'
import { PERMISSIONS } from '../../src/constants/permissions'

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

jest.mock('../../src/context/SidebarContext', () => ({
  useSidebar: () => ({
    isExpanded: true,
    isMobileOpen: false,
    isHovered: false,
    setIsHovered: jest.fn(),
  }),
}))

jest.mock('../../src/hooks/useSession', () => ({
  useSession: jest.fn(),
}))

const useSessionMock = jest.requireMock('../../src/hooks/useSession').useSession as jest.Mock

describe('AppSidebar role gating', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('hides Administration and Audit Logs for non-admin', () => {
    useSessionMock.mockReturnValue({
      user: { role: 'Viewer', permissions: [PERMISSIONS.DASHBOARD_VIEW], userId: 1, roleId: 1 },
      loading: false,
    })

    render(<AppSidebar />)

    expect(screen.queryByText('Administration')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /audit logs/i })).not.toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
  })

  it('shows Administration and Audit Logs for admin', () => {
    useSessionMock.mockReturnValue({
      user: { role: 'Admin', permissions: [], userId: 1, roleId: 1 },
      loading: false,
    })

    render(<AppSidebar />)

    expect(screen.getByText('Administration')).toBeInTheDocument()
    const auditLogsLinks = screen.getAllByRole('link', { name: /audit logs/i })
    expect(auditLogsLinks.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows skeleton nav while loading', () => {
    useSessionMock.mockReturnValue({
      user: null,
      loading: true,
    })

    render(<AppSidebar />)

    const list = document.querySelector('ul[aria-hidden="true"]')
    expect(list).toBeInTheDocument()
  })

  it('shows Dashboard, Analytics, Reports when user has DASHBOARD_VIEW only', () => {
    useSessionMock.mockReturnValue({
      user: { role: 'Viewer', permissions: [PERMISSIONS.DASHBOARD_VIEW], userId: 1, roleId: 1 },
      loading: false,
    })

    render(<AppSidebar />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.queryByText('DataSheets')).not.toBeInTheDocument()
    expect(screen.queryByText('Project Estimation')).not.toBeInTheDocument()
    expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
  })

  it('shows Estimation and Inventory for Engineer', () => {
    useSessionMock.mockReturnValue({
      user: {
        role: 'Engineer',
        permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.ESTIMATION_VIEW, PERMISSIONS.INVENTORY_VIEW],
        userId: 1,
        roleId: 1,
      },
      loading: false,
    })

    render(<AppSidebar />)

    expect(screen.getByText('DataSheets')).toBeInTheDocument()
    expect(screen.getByText('Project Estimation')).toBeInTheDocument()
    expect(screen.getByText('Inventory')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /estimation list/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /inventory items/i })).toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
    expect(screen.queryByText('Reports')).not.toBeInTheDocument()
  })
})
