'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import toast from 'react-hot-toast'

type AccountItem = { accountId: number; accountName: string; slug: string; isActive: boolean; roleName: string }

type AccountsResponse = { accounts: AccountItem[]; activeAccountId: number }

function toastMessageForStatus(status: number, fallback: string): string {
  if (status === 409) return 'No active account selected. Use the account switcher to select an account.'
  if (status === 403) return "You don't have permission."
  if (status === 401) return 'Please sign in again.'
  return fallback
}

export default function AccountSwitcher() {
  const { user } = useSession()
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!user) return
    const ac = new AbortController()
    setLoading(true)
    let completed = false
    fetch('/api/backend/accounts', { credentials: 'include', signal: ac.signal })
      .then(async (res) => {
        if (ac.signal.aborted) return
        if (!res.ok) {
          setAccounts([])
          setActiveAccountId(null)
          return
        }
        const data: AccountsResponse = await res.json()
        if (ac.signal.aborted) return
        setAccounts(Array.isArray(data.accounts) ? data.accounts : [])
        setActiveAccountId(
          typeof data.activeAccountId === 'number' && Number.isFinite(data.activeAccountId)
            ? data.activeAccountId
            : null
        )
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
        setAccounts([])
        setActiveAccountId(null)
      })
      .finally(() => {
        completed = true
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => {
      ac.abort()
      if (!completed) setLoading(false)
    }
  }, [user])

  const handleSelect = useCallback(
    async (accountId: number) => {
      if (accountId === activeAccountId) {
        setOpen(false)
        return
      }
      setOpen(false)
      try {
        const res = await fetch('/api/backend/sessions/active-account', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          const msg = toastMessageForStatus(res.status, (j as { message?: string }).message ?? 'Failed to switch account')
          toast.error(msg)
          return
        }
        setActiveAccountId(accountId)
        router.refresh()
      } catch {
        toast.error('Failed to switch account')
      }
    },
    [activeAccountId, router]
  )

  if (!user) return null

  const current = activeAccountId != null ? accounts.find((a) => a.accountId === activeAccountId) : null
  const label = current?.accountName ?? (activeAccountId == null && accounts.length === 0 ? 'No account' : 'Select an account')

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        aria-label="Switch account"
        aria-expanded={open}
      >
        <span className={`max-w-[140px] truncate ${loading ? 'animate-pulse text-gray-500 dark:text-gray-400' : ''}`}>
          {loading ? 'Loading…' : label}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1 max-h-60 w-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          role="listbox"
        >
          {accounts.length === 0 && !loading && (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No accounts</div>
          )}
          {accounts.map((a) => (
            <button
              key={a.accountId}
              type="button"
              role="option"
              aria-selected={a.accountId === activeAccountId}
              onClick={() => void handleSelect(a.accountId)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                a.accountId === activeAccountId ? 'bg-gray-50 dark:bg-gray-700/50 font-medium' : ''
              }`}
            >
              <span className="block truncate">{a.accountName}</span>
              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{a.roleName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
