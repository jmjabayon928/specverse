// src/utils/requireSession.ts

import { AppError } from '@/backend/errors/AppError'

type SessionInfo = {
  id: number
  role: string
  permissions: string[]
}

// No module-level cache to prevent stale unauth state after login
// Each call fetches fresh to avoid flicker
let cachedSessionPromise: Promise<SessionInfo> | null = null

const createSessionError = (message: string, status = 401): AppError => {
  return new AppError(message, status)
}

const handleSessionError = (error: unknown, base: string): never => {
  if (error instanceof AppError) {
    throw error
  }

  if (error instanceof Error) {
    throw createSessionError(`${base}: ${error.message}`)
  }

  throw createSessionError(`${base}: Unknown error`)
}

const fetchSessionOnce = async (): Promise<SessionInfo> => {
  try {
    const res = await fetch('/api/backend/auth/session', {
      method: 'GET',
      credentials: 'include',                      // required so cookies are sent
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      throw createSessionError('Not authenticated', res.status)
    }

    const user = await res.json()

    const isValid =
      user &&
      typeof user.userId === 'number' &&
      typeof user.role === 'string'

    if (!isValid) {
      throw createSessionError('Invalid session data', 500)
    }

    return {
      id: user.userId,
      role: user.role,
      permissions: Array.isArray(user.permissions)
        ? user.permissions
        : [],
    }
  } catch (error: unknown) {
    return handleSessionError(error, 'Failed to fetch session')
    // ^ never returns, satisfies TS return rule
  }
}

/**
 * requireSession()
 * ----------------
 * - Fetches session fresh each time (no persistent cache to avoid stale unauth).
 * - Deduplicates concurrent calls within same render cycle.
 * - Errors wrapped using AppError.
 */
export async function requireSession(): Promise<SessionInfo> {
  // If there's already a pending fetch, reuse it to deduplicate concurrent calls
  if (cachedSessionPromise) {
    return cachedSessionPromise
  }

  cachedSessionPromise = fetchSessionOnce()

  try {
    const session = await cachedSessionPromise
    return session
  } finally {
    cachedSessionPromise = null        // ensures retry if it fails once
  }
}
