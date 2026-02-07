'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

const isProd = process.env.NODE_ENV === 'production'

type InviteStatus = 'pending' | 'expired' | 'accepted' | 'revoked' | 'declined'

type ByTokenData = {
  accountName: string
  status: InviteStatus
  expiresAt: string
  email: string
  roleId: number
  roleName: string | null
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
  | { kind: 'accept_public_error'; message: string; showSignInLink?: boolean }
  | { kind: 'email_mismatch' }
  | { kind: 'declined' }
  | { kind: 'success'; accountName: string; redirectTo?: 'dashboard' | 'login' }

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

function validatePassword(pwd: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (pwd.length < 8) errors.push('At least 8 characters')
  if (!/[A-Z]/.test(pwd)) errors.push('1 uppercase letter')
  if (!/[a-z]/.test(pwd)) errors.push('1 lowercase letter')
  if (!/[0-9]/.test(pwd)) errors.push('1 number')
  if (!/[^A-Za-z0-9]/.test(pwd)) errors.push('1 special character')
  return { valid: errors.length === 0, errors }
}

function passwordInlineMessage(pwd: string): string | null {
  if (pwd.length < 8) return 'Password must be at least 8 characters'
  const check = validatePassword(pwd)
  if (!check.valid) return 'Password must include: uppercase, lowercase, number, special character'
  return null
}

export default function InviteAcceptClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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
        setState({ kind: 'success', accountName: (body as { accountName?: string }).accountName ?? 'Account', redirectTo: 'dashboard' })
        setTimeout(() => router.replace('/dashboard'), 2000)
        return
      }
      if (res.status === 403) {
        setState({ kind: 'email_mismatch' })
        return
      }
      if (res.status === 410) {
        setState({ kind: 'accept_public_error', message: 'Invite expired or already used.' })
        return
      }
      setState({ kind: 'invalid' })
    } catch {
      setState({ kind: 'invalid' })
    }
  }

  const handleAcceptPublic = async () => {
    if (submitLoading) return
    if (!token || state.kind !== 'pending_signed_out') return
    const errs: Record<string, string> = {}
    const f = firstName.trim()
    const l = lastName.trim()
    const p = password
    const cp = confirmPassword
    if (!f) errs.firstName = 'First name is required'
    if (!l) errs.lastName = 'Last name is required'
    const pwMsg = passwordInlineMessage(p)
    if (pwMsg) errs.password = pwMsg
    if (p !== cp) errs.confirmPassword = 'Passwords do not match'
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitLoading(true)
    setFieldErrors({})
    try {
      const res = await fetch(`${baseUrl}/api/backend/invites/accept-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token: token.trim(),
          firstName: f,
          lastName: l,
          password: p,
        }),
      })
      const body = await res.json().catch(() => ({} as Record<string, unknown>))
      const msg = (body as { message?: string }).message ?? (body as { error?: string }).error
      if (res.status === 200 || res.status === 201) {
        setState({ kind: 'success', accountName: (body as { accountName?: string }).accountName ?? 'Account', redirectTo: 'login' })
        setTimeout(() => router.replace('/login'), 2000)
        return
      }
      if (res.status === 409) {
        setState({ kind: 'accept_public_error', message: msg ?? 'Account already exists. Please sign in to accept this invite.', showSignInLink: true })
        return
      }
      if (res.status === 410) {
        setState({ kind: 'accept_public_error', message: msg ?? 'Invite expired or already used.' })
        return
      }
      if (res.status === 404) {
        setState({ kind: 'accept_public_error', message: msg ?? 'Invalid invite token.' })
        return
      }
      if (res.status === 400) {
        setFieldErrors({ form: msg ?? 'Invalid input.' })
        return
      }
      setFieldErrors({ form: msg ?? 'Something went wrong. Please try again.' })
    } catch {
      setFieldErrors({ form: 'Something went wrong. Please try again.' })
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDecline = async () => {
    if (!token || (state.kind !== 'pending_signed_in' && state.kind !== 'pending_signed_out')) return
    try {
      const res = await fetch(`${baseUrl}/api/backend/invites/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
        credentials: 'include',
      })
      if (res.status === 204) {
        setState({ kind: 'declined' })
        return
      }
      const j = await res.json().catch(() => ({} as Record<string, unknown>))
      const message = typeof (j as { message?: unknown }).message === 'string' ? (j as { message: string }).message : undefined
      if (res.status === 403) {
        setState({ kind: 'email_mismatch' })
        return
      }
      toast.error(message ?? 'Something went wrong.')
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

  if (state.kind === 'accept_public_error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-red-600 dark:text-red-400">{state.message}</h1>
        {state.showSignInLink && (
          <Link href={loginUrl} className="mt-4 text-primary-600 hover:underline dark:text-primary-400">
            Sign in
          </Link>
        )}
      </div>
    )
  }

  if (state.kind === 'pending_signed_out') {
    const d = state.data
    const roleLabel = d.roleName ?? (d.roleId != null ? `Role #${d.roleId}` : '—')
    const firstNameErr = firstName.trim() === '' ? 'First name is required' : null
    const lastNameErr = lastName.trim() === '' ? 'Last name is required' : null
    const passwordErr = passwordInlineMessage(password)
    const confirmErr = password !== confirmPassword ? 'Passwords do not match' : null
    const formValid =
      firstName.trim() !== '' &&
      lastName.trim() !== '' &&
      validatePassword(password).valid &&
      password === confirmPassword
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
          You&apos;re invited to join {d.accountName}
        </h1>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Account: {d.accountName} · Role: {roleLabel}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleAcceptPublic()
          }}
          className="space-y-4"
        >
          {fieldErrors.form && (
            <p className="text-sm text-red-600 dark:text-red-400">{fieldErrors.form}</p>
          )}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              autoComplete="given-name"
            />
            {(firstNameErr ?? fieldErrors.firstName) && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{firstNameErr ?? fieldErrors.firstName}</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              autoComplete="family-name"
            />
            {(lastNameErr ?? fieldErrors.lastName) && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{lastNameErr ?? fieldErrors.lastName}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              autoComplete="new-password"
            />
            {(passwordErr ?? fieldErrors.password) && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordErr ?? fieldErrors.password}</p>
            )}
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <p className="font-medium">Password requirements:</p>
              <ul className="mt-1 list-inside space-y-0.5">
                <li className={password.length >= 8 ? 'text-green-600' : ''}>At least 8 characters</li>
                <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>1 uppercase letter</li>
                <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>1 lowercase letter</li>
                <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>1 number</li>
                <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-600' : ''}>1 special character</li>
              </ul>
            </div>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm password <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              autoComplete="new-password"
            />
            {(confirmErr ?? fieldErrors.confirmPassword) && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{confirmErr ?? fieldErrors.confirmPassword}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!formValid || submitLoading}
              className="min-h-[44px] rounded-lg px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {submitLoading ? 'Creating account...' : 'Create account & join'}
            </button>
            {!isProd && (
              <button
                type="button"
                onClick={() => {
                  if (!navigator.clipboard?.writeText) {
                    toast.error('Clipboard unavailable')
                    return
                  }
                  navigator.clipboard.writeText(window.location.href).then(
                    () => toast.success('Invite link copied'),
                    () => toast.error('Clipboard unavailable'),
                  )
                }}
                className="rounded-lg px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300"
              >
                Copy invite link
              </button>
            )}
          </div>
        </form>
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
            className="rounded-lg px-4 py-2 text-white bg-blue-600 hover:bg-blue-700"
          >
            Accept invite
          </button>
          <button
            type="button"
            onClick={handleDecline}
            className="rounded-lg px-4 py-2 text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-300"
          >
            Decline
          </button>
          {!isProd && (
            <button
              type="button"
              onClick={() => {
                if (!navigator.clipboard?.writeText) {
                  toast.error('Clipboard unavailable')
                  return
                }
                navigator.clipboard.writeText(window.location.href).then(
                  () => toast.success('Invite link copied'),
                  () => toast.error('Clipboard unavailable'),
                )
              }}
              className="rounded-lg px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300"
            >
              Copy invite link
            </button>
          )}
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
    const toLogin = state.redirectTo === 'login'
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold text-green-600 dark:text-green-400">You&apos;ve joined {state.accountName}</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          {toLogin ? 'Redirecting to sign in...' : 'Redirecting to dashboard...'}
        </p>
      </div>
    )
  }

  return null
}
