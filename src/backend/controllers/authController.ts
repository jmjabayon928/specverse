// src/backend/controllers/authController.ts
import type { Request, Response } from 'express'
import type { JwtPayload as CustomJwtPayload } from '../../domain/auth/JwtTypes'
import { loginWithEmailAndPassword } from '../services/authService'
import { getUserById } from '../services/usersService'
import { getAccountContextForUser } from '../database/accountContextQueries'
import { generateSid, setSidCookie, clearSidCookie, getSessionExpiresAt } from '../utils/sessionCookie'
import { createAuthSession, hashSid } from '../repositories/authSessionsRepository'

// POST /login
export const loginHandler = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body

  const isDevOrStage = process.env.NODE_ENV !== 'production'

  try {
    const result = await loginWithEmailAndPassword(email, password)

    if (!result) {
      if (isDevOrStage) {
        console.info(JSON.stringify({
          event: 'auth.login',
          success: false,
          reason: 'Invalid email or password',
        }))
      }
      res.status(401).json({ message: 'Invalid email or password' })
      return
    }

    const userId = result.payload.userId
    const accountId = result.payload.accountId ?? null

    // Get active account context for session storage
    const ctx = await getAccountContextForUser(userId)
    const sessionAccountId = ctx?.accountId ?? accountId ?? null

    const sid = generateSid()
    const sidHash = hashSid(sid)
    const expiresAt = getSessionExpiresAt()

    await createAuthSession(sidHash, userId, sessionAccountId, expiresAt)

    setSidCookie(res, sid, req.secure)

    if (isDevOrStage) {
      console.info(JSON.stringify({
        event: 'auth.login',
        success: true,
        userId,
      }))
    }

    res.status(200).json({ message: 'Login successful' })
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction) {
      res.status(500).json({ message: 'Internal server error' })
      return
    }
    const err = error instanceof Error ? error : new Error(String(error))
    const stackLines = (err.stack ?? '')
      .split('\n')
      .slice(0, 5)
      .join('\n')
    res.status(500).json({
      message: 'Internal server error',
      diagnostic: {
        name: err.name,
        message: err.message,
        stack: stackLines || undefined,
      },
    })
  }
}

/**
 * Helper: Creates an auth session and sets sid cookie for a user by userId and accountId.
 */
export async function setAuthCookieForUser(
  res: Response,
  userId: number,
  accountId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API compatibility with invitesController
  _email?: string,
): Promise<void> {
  const user = await getUserById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  const sid = generateSid()
  const sidHash = hashSid(sid)
  const expiresAt = getSessionExpiresAt()

  await createAuthSession(sidHash, userId, accountId, expiresAt)

  setSidCookie(res, sid, undefined)
}

// POST /logout
export const logoutHandler = async (req: Request, res: Response): Promise<void> => {
  const isDevOrStage = process.env.NODE_ENV !== 'production'
  const userId = req.user?.userId

  const sid = req.cookies?.sid
  if (sid) {
    const { revokeSession } = await import('../services/authSessionsService')
    await revokeSession(sid).catch(() => {
      // Ignore errors during revocation (session may already be revoked/expired)
    })
  }

  clearSidCookie(res, req.secure)

  if (isDevOrStage && userId) {
    console.info(JSON.stringify({
      event: 'auth.logout',
      userId,
    }))
  }

  res.status(204).send()
}

// GET /session (verifyToken already ran)
export const getSession = async (req: Request, res: Response): Promise<void> => {
  const isDevOrStage = process.env.NODE_ENV !== 'production'
  const cookiePresent = Boolean(req.cookies?.sid)

  if (!req.user) {
    if (isDevOrStage) {
      console.info(JSON.stringify({
        event: 'auth.session',
        cookiePresent,
        sessionFound: false,
      }))
    }
    res.status(401).json({ message: 'No session' })
    return
  }

  if (isDevOrStage) {
    console.info(JSON.stringify({
      event: 'auth.session',
      cookiePresent,
      sessionFound: true,
    }))
  }

  const user = req.user as CustomJwtPayload

  const isPlatformAdmin = Boolean(user.isSuperadmin)
  const permissionsCount = Array.isArray(user.permissions) ? user.permissions.length : 0

  res.status(200).json({
    userId: user.userId,
    roleId: user.roleId,
    role: user.role,
    roleName: user.role ?? null,
    name: user.name ?? '',
    email: user.email ?? '',
    profilePic: user.profilePic ?? '',
    permissions: user.permissions ?? [],
    permissionsCount,
    accountId: user.accountId ?? null,
    isSuperadmin: user.isSuperadmin ?? false,
    isPlatformAdmin,
    isOwner: Boolean(user.isOwner),
    ownerUserId: user.ownerUserId ?? null,
  })
}

// GET /me
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    res.status(200).json({ user: req.user })
  } catch (error) {
    console.error('❌ Error in getProfile:', error)
    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction) {
      res.status(500).json({ message: 'Failed to fetch user profile' })
      return
    }
    const err = error instanceof Error ? error : new Error(String(error))
    const stackLines = (err.stack ?? '')
      .split('\n')
      .slice(0, 5)
      .join('\n')
    res.status(500).json({
      message: 'Failed to fetch user profile',
      diagnostic: {
        name: err.name,
        message: err.message,
        stack: stackLines || undefined,
      },
    })
  }
}
