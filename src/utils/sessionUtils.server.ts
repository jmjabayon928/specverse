// src/utils/sessionUtils.server.ts
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { UserSession } from '@/domain/auth/sessionTypes'

type HeaderGetter = { get(name: string): string | null }

function canonicalizeHost(host: string): string {
  if (host.startsWith('127.0.0.1:')) {
    return 'localhost:' + host.slice('127.0.0.1:'.length)
  }
  if (host === '127.0.0.1') {
    return 'localhost'
  }
  return host
}

export function buildSessionUrl(hdrs: HeaderGetter): string {
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
  if (!host) {
    throw new Error('Missing host header for session URL')
  }
  const canonicalHost = canonicalizeHost(host)
  return new URL('/api/backend/auth/session', `${proto}://${canonicalHost}`).toString()
}

const loginUrl = (reason: string, from: string, status?: number): string => {
  const params = new URLSearchParams({ reason, from })
  if (typeof status === 'number') params.set('status', String(status))
  return `/login?${params.toString()}`
}

/**
 * Use this in protected pages.
 * Redirects to /login when there is no valid session.
 */
const AUTH_DEBUG = process.env.AUTH_DEBUG === '1'

export async function requireAuth(): Promise<UserSession> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (AUTH_DEBUG) {
    console.log('[AUTH_DEBUG] requireAuth token=', token ? 'present' : 'missing')
  }

  if (!token) {
    if (AUTH_DEBUG) {
      console.log('[AUTH_DEBUG] requireAuth redirect: missing token')
    }
    redirect(loginUrl('missing_token', 'requireAuth'))
    throw new Error('Redirected due to missing token')
  }

  try {
    const hdrs = await headers()
    const cookieHeader = hdrs.get('cookie') ?? ''
    const sessionFetchUrl = buildSessionUrl(hdrs)
    if (AUTH_DEBUG) {
      console.log('[AUTH_DEBUG] requireAuth sessionFetchUrl=', sessionFetchUrl)
    }
    const res = await fetch(sessionFetchUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })

    if (!res.ok) {
      if (AUTH_DEBUG) {
        console.log('[AUTH_DEBUG] requireAuth redirect: session endpoint returned non-ok', { status: res.status })
      }
      redirect(loginUrl('session_non_ok', 'requireAuth', res.status))
      throw new Error('Redirected due to invalid token')
    }

    const session: UserSession = await res.json()

    // Ensure required fields exist to prevent user?.userId errors
    if (!session.userId || !session.roleId) {
      if (AUTH_DEBUG) {
        console.log('[AUTH_DEBUG] requireAuth redirect: incomplete session payload')
      }
      redirect(loginUrl('session_incomplete', 'requireAuth'))
      throw new Error('Redirected due to incomplete session')
    }

    return session
  } catch (err: unknown) {
    if (AUTH_DEBUG) {
      console.log('[AUTH_DEBUG] requireAuth redirect: session fetch threw', { message: String(err) })
    }
    redirect(loginUrl('session_fetch_error', 'requireAuth'))
    throw new Error('Redirected due to session fetch error')
  }
}

/**
 * Use this when session is optional.
 * Returns null instead of redirecting.
 */
export default async function getUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (AUTH_DEBUG) {
    console.log('[AUTH_DEBUG] getUserSession token=', token ? 'present' : 'missing')
  }

  if (!token) {
    return null
  }

  try {
    const hdrs = await headers()
    const cookieHeader = hdrs.get('cookie') ?? ''
    const sessionFetchUrl = buildSessionUrl(hdrs)
    if (AUTH_DEBUG) {
      console.log('[AUTH_DEBUG] getUserSession sessionFetchUrl=', sessionFetchUrl)
    }
    const res = await fetch(sessionFetchUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })

    if (!res.ok) {
      if (AUTH_DEBUG) {
        console.log('[AUTH_DEBUG] getUserSession session endpoint returned non-ok', { status: res.status })
      }
      return null
    }

    const session: UserSession = await res.json()

    if (!session.userId || !session.roleId) {
      if (AUTH_DEBUG) {
        console.log('[AUTH_DEBUG] getUserSession incomplete session payload')
      }
      return null
    }

    return session
  } catch (err: unknown) {
    if (AUTH_DEBUG) {
      console.log('[AUTH_DEBUG] getUserSession session fetch threw', { message: String(err) })
    }
    return null
  }
}