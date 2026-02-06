'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type InviteStatus = 'pending' | 'expired' | 'accepted' | 'revoked' | 'declined'

type ByTokenData = {
  accountName: string
  status: InviteStatus
  expiresAt: string
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'missing_token' }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'used_or_revoked'; status: InviteStatus }
  | { kind: 'pending_signed_out'; data: ByTokenData }
  | { kind: 'pending_signed_in'; data: ByTokenData }
  | { kind: 'accepting' }
  | { kind: 'email_mismatch' }
  | { kind: 'declined' }
  | { kind: 'success'; accountName: string }

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

export default function InviteAcceptClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<PageState>({ kind: 'loading' })

  const fetchByToken = useCallback(async (t: string): Promise<ByTokenData | null> => {
    const res = await fetch(`${baseUrl}/api/backend/invites/by-token?token=${encodeURIComponent(t)}`, {
      credentials: 'include',
    })
    if (!res.ok) return null
    const data = (await res.json()) as ByTokenData
    return data
  }, [])

  const checkSession = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`${baseUrl}/api/backend/auth/session`, { credentials: 'include' })
    return res.ok
  }, [])

  useEffect(() => {
    if (!token || !token.trim()) {
      setState({ kind: 'missing_token' })
      return
    }

    let cancelled = false
    const run = async () => {
      const data = await fetchByToken(token.trim())
      if (cancelled) return
      if (!data) {
        setState({ kind: 'invalid' })
        return
      }
      if (data.status === 'expired') {
        setState({ kind: 'expired' })
        return
      }
      if (data.status === 'accepted' || data.status === 'revoked' || data.status === 'declined') {
        setState({ kind: 'used_or_revoked', status: data.status })
        return
      }
      const signedIn = await checkSession()
      if (cancelled) return
      if (signedIn) {
        setState({ kind: 'pending_signed_in', data })
        return
      }
      setState({ kind: 'pending_signed_out', data })
    }
    run()
    return () => {
      cancelled = true
    }
  }, [token, fetchByToken, checkSession])

  const handleAccept = async () => {
    if (!token || state.kind !== 'pending_signed_in') return
    setState({ kind: 'accepting' })
    try {
      const res = await fetch(`${baseUrl}/api/backend/invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
        credentials: 'include',
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setState({ kind: 'success', accountName: (body as { accountName?: string }).accountName ?? 'Account' })
        setTimeout(() => router.replace('/dashboard'), 2000)
        return
      }
      if (res.status === 403) {
        setState({ kind: 'email_mismatch' })
        return
      }
      setState({ kind: 'invalid' })
    } catch {
      setState({ kind: 'invalid' })
    }
  }

  const handleDecline = async () => {
    if (!token || (state.kind !== 'pending_signed_in' && state.kind !== 'pending_signed_out')) return
    try {
      await fetch(`${baseUrl}/api/backend/invites/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
        credentials: 'include',
      })
      setState({ kind: 'declined' })
    } catch {
      setState({ kind: 'invalid' })
    }
  }

  const loginUrl = token
    ? `/login?returnUrl=${encodeURIComponent(`/invite/accept?token=${encodeURIComponent(token)}`)}`
    : '/login'

  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <p className="text-gray-600 dark:text-gray-400">Loading invite...</p>
      </div>
    )
  }

  if (state.kind === 'missing_token') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">Invalid invite link</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">This link is missing the invite token.</p>
        <Link href="/login" className="text-primary-600 hover:underline dark:text-primary-400">
          Go to sign in
        </Link>
      </div>
    )
  }

  if (state.kind === 'invalid') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">Invalid or expired invite</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">This invite link is not valid.</p>
        <Link href="/login" className="text-primary-600 hover:underline dark:text-primary-400">
          Go to sign in
        </Link>
      </div>
    )
  }

  if (state.kind === 'expired') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">This invite has expired</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">Ask the account admin to send a new invite.</p>
        <Link href="/login" className="text-primary-600 hover:underline dark:text-primary-400">
          Go to sign in
        </Link>
      </div>
    )
  }

  if (state.kind === 'used_or_revoked') {
    const message =
      state.status === 'accepted'
        ? 'This invite has already been accepted.'
        : state.status === 'revoked'
          ? 'This invite has been cancelled.'
          : 'This invite has been declined.'
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">{message}</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">The link can no longer be used.</p>
        <Link href="/login" className="text-primary-600 hover:underline dark:text-primary-400">
          Go to sign in
        </Link>
      </div>
    )
  }

  if (state.kind === 'pending_signed_out') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
          You&apos;re invited to join {state.data.accountName}
        </h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          Sign in with the email address that received the invite to accept.
        </p>
        <Link
          href={loginUrl}
          className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
        >
          Sign in to accept
        </Link>
      </div>
    )
  }

  if (state.kind === 'pending_signed_in') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
          You&apos;re invited to join {state.data.accountName}
        </h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">Accept to join this account with your current sign-in.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
          >
            Accept invite
          </button>
          <button
            type="button"
            onClick={handleDecline}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  if (state.kind === 'accepting') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <p className="text-gray-600 dark:text-gray-400">Accepting invite...</p>
      </div>
    )
  }

  if (state.kind === 'email_mismatch') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-red-600 dark:text-red-400">Email does not match</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          You must sign in with the email address that received this invite.
        </p>
        <Link href={loginUrl} className="text-primary-600 hover:underline dark:text-primary-400">
          Sign in with a different account
        </Link>
      </div>
    )
  }

  if (state.kind === 'declined') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">Invite declined</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">You have declined this invite.</p>
        <Link href="/dashboard" className="text-primary-600 hover:underline dark:text-primary-400">
          Go to dashboard
        </Link>
      </div>
    )
  }

  if (state.kind === 'success') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-green-600 dark:text-green-400">You&apos;ve joined {state.accountName}</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">Redirecting to dashboard...</p>
      </div>
    )
  }

  return null
}
