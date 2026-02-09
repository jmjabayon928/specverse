'use client'

import React, { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { PERMISSIONS } from '@/constants/permissions'

export type MemberRow = {
  accountMemberId: number
  userId: number
  email: string | null
  firstName: string | null
  lastName: string | null
  roleId: number
  roleName: string
  isActive: boolean
  isOwner?: boolean
  createdAt: string
  updatedAt: string
}

export type RoleOption = { roleId: number; roleName: string }

type Props = {
  members: MemberRow[]
  roles: RoleOption[]
  permissions: string[]
}

function apiBase(): string {
  if (typeof window !== 'undefined') return ''
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
}

function errorMessageForStatus(status: number, serverMessage: string | undefined, fallback: string): string {
  if (status === 403) return "You don't have permission."
  if (status === 401) return 'Please sign in again.'
  if (status === 409) return serverMessage ?? 'No active account selected.'
  return serverMessage ?? fallback
}

export default function MembersTable({ members: initialMembers, roles, permissions }: Props) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const canChangeRole = permissions.includes(PERMISSIONS.ACCOUNT_ROLE_MANAGE)
  const canChangeStatus = permissions.includes(PERMISSIONS.ACCOUNT_USER_MANAGE)

  const updateRole = useCallback(
    async (accountMemberId: number, roleId: number) => {
      setUpdatingId(accountMemberId)
      try {
        const res = await fetch(`${apiBase()}/api/backend/account-members/${accountMemberId}/role`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleId }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          const msg = (j as { message?: string }).message
          toast.error(errorMessageForStatus(res.status, msg, 'Failed to update role'))
          return
        }
        const updated: MemberRow = await res.json()
        setMembers((prev) => prev.map((m) => (m.accountMemberId === accountMemberId ? updated : m)))
        toast.success('Role updated')
      } catch {
        toast.error('Failed to update role')
      } finally {
        setUpdatingId(null)
      }
    },
    []
  )

  const updateStatus = useCallback(
    async (accountMemberId: number, isActive: boolean) => {
      setUpdatingId(accountMemberId)
      try {
        const res = await fetch(`${apiBase()}/api/backend/account-members/${accountMemberId}/status`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          const msg = (j as { message?: string }).message
          toast.error(errorMessageForStatus(res.status, msg, 'Failed to update status'))
          return
        }
        const updated: MemberRow = await res.json()
        setMembers((prev) => prev.map((m) => (m.accountMemberId === accountMemberId ? updated : m)))
        toast.success(isActive ? 'Member activated' : 'Member deactivated')
      } catch {
        toast.error('Failed to update status')
      } finally {
        setUpdatingId(null)
      }
    },
    []
  )

  const name = (m: MemberRow) => [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || '—'

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Name / Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Role
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          {members.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No members in this account.
              </td>
            </tr>
          )}
          {members.map((m) => (
            <tr key={m.accountMemberId}>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                <span className="block font-medium">{name(m)}</span>
                {m.isOwner && (
                  <span className="ml-1.5 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Owner
                  </span>
                )}
                {m.email && <span className="block text-gray-500 dark:text-gray-400">{m.email}</span>}
              </td>
              <td className="px-4 py-3">
                <select
                  value={m.roleId}
                  disabled={!canChangeRole || updatingId === m.accountMemberId}
                  onChange={(e) => void updateRole(m.accountMemberId, Number(e.target.value))}
                  className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                >
                  {roles.map((r) => (
                    <option key={r.roleId} value={r.roleId}>
                      {r.roleName}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  disabled={!canChangeStatus || updatingId === m.accountMemberId || m.isOwner}
                  onClick={() => void updateStatus(m.accountMemberId, !m.isActive)}
                  className={`rounded px-2 py-1 text-sm font-medium ${
                    m.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  } disabled:opacity-50`}
                >
                  {m.isActive ? 'Active' : 'Inactive'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
