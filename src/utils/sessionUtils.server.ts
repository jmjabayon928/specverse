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
    console.warn('⚠️ No token found in cookies — redirecting to login')
    redirect('/login')
    throw new Error('Redirected due to missing token')
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/auth/session`,
      {
        method: 'GET',
        headers: {
          Cookie: `token=${token}`,
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      console.warn(
        '⚠️ Token found, but session validation failed — clearing cookie and redirecting'
      )
      // You can optionally clear the cookie on backend side too
      redirect('/login')
      throw new Error('Redirected due to invalid token')
    }

    const session: UserSession = await res.json()

    // Ensure required fields exist to prevent user?.userId errors
    if (!session.userId || !session.roleId) {
      console.error('❌ Incomplete session data received — redirecting')
      redirect('/login')
      throw new Error('Redirected due to incomplete session')
    }

    return session
  } catch (error) {
    console.error('❌ Error fetching session:', error)
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
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/auth/session`,
      {
        method: 'GET',
        headers: {
          Cookie: `token=${token}`,
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      return null
    }

    const session: UserSession = await res.json()

    if (!session.userId || !session.roleId) {
      return null
    }

    return session
  } catch (error) {
    console.error('❌ Error fetching optional session:', error)
    return null
  }
}