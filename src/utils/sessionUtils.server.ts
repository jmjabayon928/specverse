// src/utils/sessionUtils.server.ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { UserSession } from '@/domain/auth/sessionTypes'

/**
 * Use this in protected pages.
 * Redirects to /login when there is no valid session.
 */
export async function requireAuth(): Promise<UserSession> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login')
    throw new Error('Redirected due to missing token')
  }

  try {
    // In local dev, NEXT_PUBLIC_API_BASE_URL may be unset (uses Next.js rewrites)
    // In stage/prod, it's set to the frontend domain
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const sessionUrl = baseUrl
      ? `${baseUrl}/api/backend/auth/session`
      : '/api/backend/auth/session'

    const res = await fetch(sessionUrl, {
      method: 'GET',
      headers: {
        Cookie: `token=${token}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      redirect('/login')
      throw new Error('Redirected due to invalid token')
    }

    const session: UserSession = await res.json()

    // Ensure required fields exist to prevent user?.userId errors
    if (!session.userId || !session.roleId) {
      redirect('/login')
      throw new Error('Redirected due to incomplete session')
    }

    return session
  } catch {
    redirect('/login')
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

  if (!token) {
    return null
  }

  try {
    // In local dev, NEXT_PUBLIC_API_BASE_URL may be unset (uses Next.js rewrites)
    // In stage/prod, it's set to the frontend domain
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    const sessionUrl = baseUrl
      ? `${baseUrl}/api/backend/auth/session`
      : '/api/backend/auth/session'

    const res = await fetch(sessionUrl, {
      method: 'GET',
      headers: {
        Cookie: `token=${token}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return null
    }

    const session: UserSession = await res.json()

    if (!session.userId || !session.roleId) {
      return null
    }

    return session
  } catch {
    return null
  }
}