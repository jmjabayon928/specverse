import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PERMISSIONS } from '../../../src/constants/permissions'
import MembersTable from '../../../src/app/(admin)/settings/members/MembersTable'
import type { MemberRow, RoleOption } from '../../../src/app/(admin)/settings/members/MembersTable'

const member: MemberRow = {
  accountMemberId: 10,
  userId: 2,
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  roleId: 2,
  roleName: 'User',
  isActive: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const roles: RoleOption[] = [
  { roleId: 1, roleName: 'Admin' },
  { roleId: 2, roleName: 'User' },
]

describe('MembersTable', () => {
  it('renders members and shows role select and status toggle disabled without permissions', () => {
    render(
      <MembersTable members={[member]} roles={roles} permissions={[]} />
    )
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    const roleSelect = screen.getByRole('combobox')
    const statusButton = screen.getByRole('button', { name: /active/i })
    expect(roleSelect).toBeDisabled()
    expect(statusButton).toBeDisabled()
  })

  it('enables role select when user has ACCOUNT_ROLE_MANAGE', () => {
    render(
      <MembersTable
        members={[member]}
        roles={roles}
        permissions={[PERMISSIONS.ACCOUNT_ROLE_MANAGE]}
      />
    )
    const roleSelect = screen.getByRole('combobox')
    const statusButton = screen.getByRole('button', { name: /active/i })
    expect(roleSelect).not.toBeDisabled()
    expect(statusButton).toBeDisabled()
  })

  it('enables status toggle when user has ACCOUNT_USER_MANAGE', () => {
    render(
      <MembersTable
        members={[member]}
        roles={roles}
        permissions={[PERMISSIONS.ACCOUNT_USER_MANAGE]}
      />
    )
    const roleSelect = screen.getByRole('combobox')
    const statusButton = screen.getByRole('button', { name: /active/i })
    expect(roleSelect).toBeDisabled()
    expect(statusButton).not.toBeDisabled()
  })

  it('enables both controls when user has ACCOUNT_ROLE_MANAGE and ACCOUNT_USER_MANAGE', () => {
    render(
      <MembersTable
        members={[member]}
        roles={roles}
        permissions={[PERMISSIONS.ACCOUNT_ROLE_MANAGE, PERMISSIONS.ACCOUNT_USER_MANAGE]}
      />
    )
    const roleSelect = screen.getByRole('combobox')
    const statusButton = screen.getByRole('button', { name: /active/i })
    expect(roleSelect).not.toBeDisabled()
    expect(statusButton).not.toBeDisabled()
  })

  it('shows empty state when no members', () => {
    render(<MembersTable members={[]} roles={roles} permissions={[]} />)
    expect(screen.getByText(/no members in this account/i)).toBeInTheDocument()
  })
})
