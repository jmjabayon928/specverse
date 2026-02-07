'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

export type AccountRow = {
  accountId: number
  accountName: string
  slug: string
  isActive: boolean
  // list endpoint may include roleName; keep if present but don't render it
  roleName?: string
}

type Props = {
  initialAccounts: AccountRow[]
}

function apiBase(): string {
  if (typeof window !== 'undefined') return ''
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
}

async function readServerMessage(res: Response): Promise<string | undefined> {
  const j = await res.json().catch(() => ({}))
  const msg = (j as { message?: string }).message ?? (j as { error?: string }).error
  return typeof msg === 'string' ? msg : undefined
}

function errorMessageForStatus(status: number, fallback: string): string {
  if (status === 403) return "You don't have permission."
  if (status === 401) return 'Please sign in again.'
  return fallback
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; initial?: never }
  | { open: true; mode: 'edit'; initial: AccountRow }

export default function AccountsTable({ initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const byId = useMemo(() => new Map(accounts.map((a) => [a.accountId, a])), [accounts])

  const onToggleActive = useCallback(async (accountId: number) => {
    const current = byId.get(accountId)
    if (!current) return

    setUpdatingId(accountId)
    try {
      const res = await fetch(`${apiBase()}/api/backend/accounts/${accountId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current.isActive }),
      })

      if (!res.ok) {
        if (res.status === 409) {
          toast.error('Slug is already in use')
          return
        }
        const serverMessage = await readServerMessage(res)
        toast.error(serverMessage ?? errorMessageForStatus(res.status, 'Failed to update account'))
        return
      }

      const updated: AccountRow = await res.json()
      setAccounts((prev) =>
        prev.map((a) => (a.accountId === accountId ? { ...a, ...updated, roleName: a.roleName } : a)),
      )
      toast.success(updated.isActive ? 'Account activated' : 'Account deactivated')
    } catch {
      toast.error('Failed to update account')
    } finally {
      setUpdatingId(null)
    }
  }, [byId])

  const openCreate = () => setModal({ open: true, mode: 'create' })
  const openEdit = (a: AccountRow) => setModal({ open: true, mode: 'edit', initial: a })
  const closeModal = () => setModal({ open: false })

  const handleCreate = useCallback(async (payload: { accountName: string; slug: string }): Promise<void> => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${apiBase()}/api/backend/accounts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        if (res.status === 409) {
          toast.error('Slug is already in use')
          return
        }
        const serverMessage = await readServerMessage(res)
        if (res.status === 400 && serverMessage) {
          toast.error(serverMessage)
          return
        }
        toast.error(serverMessage ?? errorMessageForStatus(res.status, 'Failed to create account'))
        return
      }

      const created: AccountRow = await res.json()
      setAccounts((prev) => [...prev, created])
      toast.success('Account created')
      closeModal()
    } catch {
      toast.error('Failed to create account')
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting])

  const handleEdit = useCallback(
    async (accountId: number, payload: { accountName: string; slug: string; isActive: boolean }): Promise<void> => {
      if (isSubmitting) return
      setIsSubmitting(true)
      try {
        const res = await fetch(`${apiBase()}/api/backend/accounts/${accountId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          if (res.status === 409) {
            toast.error('Slug is already in use')
            return
          }
          const serverMessage = await readServerMessage(res)
          if (res.status === 400 && serverMessage) {
            toast.error(serverMessage)
            return
          }
          toast.error(serverMessage ?? errorMessageForStatus(res.status, 'Failed to update account'))
          return
        }

        const updated: AccountRow = await res.json()
        setAccounts((prev) =>
          prev.map((a) => (a.accountId === accountId ? { ...a, ...updated, roleName: a.roleName } : a)),
        )
        toast.success('Account updated')
        closeModal()
      } catch {
        toast.error('Failed to update account')
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <button type="button" onClick={openCreate} className="border rounded px-3 py-2">
          + New Account
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Account Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Slug
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Active
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {accounts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No accounts.
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.accountId}>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  <span className="block font-medium">{a.accountName}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{a.slug}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={updatingId === a.accountId}
                    onClick={() => void onToggleActive(a.accountId)}
                    className={`rounded px-2 py-1 text-sm font-medium ${
                      a.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    } disabled:opacity-50`}
                  >
                    {a.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={updatingId === a.accountId}
                    onClick={() => openEdit(a)}
                    className="underline text-sm disabled:opacity-50"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.open && modal.mode === 'create' && (
        <CreateAccountModal
          isSubmitting={isSubmitting}
          onClose={closeModal}
          onSubmit={handleCreate}
        />
      )}

      {modal.open && modal.mode === 'edit' && (
        <EditAccountModal
          isSubmitting={isSubmitting}
          initial={modal.initial}
          onClose={closeModal}
          onSubmit={(payload) => handleEdit(modal.initial.accountId, payload)}
        />
      )}
    </div>
  )
}

function CreateAccountModal(props: Readonly<{
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: { accountName: string; slug: string }) => Promise<void> | void
}>) {
  const { onClose, onSubmit, isSubmitting } = props
  const [accountName, setAccountName] = useState('')
  const [slug, setSlug] = useState('')
  const submittingRef = useRef(false)

  const submit = async () => {
    // Let backend validate; keep UI minimal.
    if (isSubmitting) return
    if (submittingRef.current) return
    submittingRef.current = true
    try {
    await onSubmit({ accountName, slug })
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-xl space-y-3 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          New Account
        </h2>
        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
            Account Name
            <input
              className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:text-white"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              disabled={isSubmitting}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
            Slug
            <input
              className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:text-white"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isSubmitting}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 border rounded" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="px-3 py-2 border rounded" onClick={submit} disabled={isSubmitting}>
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

function EditAccountModal(props: Readonly<{
  isSubmitting: boolean
  initial: AccountRow
  onClose: () => void
  onSubmit: (payload: { accountName: string; slug: string; isActive: boolean }) => Promise<void> | void
}>) {
  const { initial, onClose, onSubmit, isSubmitting } = props

  const [accountName, setAccountName] = useState(initial.accountName)
  const [slug, setSlug] = useState(initial.slug)
  const [isActive, setIsActive] = useState<boolean>(initial.isActive)
  const submittingRef = useRef(false)

  const submit = async () => {
    // Let backend validate; keep UI minimal.
    if (isSubmitting) return
    if (submittingRef.current) return
    submittingRef.current = true
    try {
    await onSubmit({ accountName, slug, isActive })
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-xl space-y-3 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Account</h2>
        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
            Account Name
            <input
              className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:text-white"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              disabled={isSubmitting}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
            Slug
            <input
              className="border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:text-white"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isSubmitting}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSubmitting}
            />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 border rounded" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="px-3 py-2 border rounded" onClick={submit} disabled={isSubmitting}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

