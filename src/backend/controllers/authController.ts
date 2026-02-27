// src/backend/controllers/authController.ts
import type { Request, Response } from 'express'
import type { JwtPayload as CustomJwtPayload } from '../../domain/auth/JwtTypes'
import { loginWithEmailAndPassword } from '../services/authService'
import jwt from 'jsonwebtoken'
import { getUserById } from '../services/usersService'
import { getAccountContextForUserAndAccount } from '../database/accountContextQueries'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables')
}

// POST /login
export const loginHandler = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body

  try {
    const result = await loginWithEmailAndPassword(email, password)

    if (!result) {
      res.status(401).json({ message: 'Invalid email or password' })
      return
    }

    res
      .cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60, // 60 minutes
      })
      .status(200)
      .json({
        user: result.payload,
        message: 'Login successful',
      })
  } catch (error) {
    console.error('❌ Login error:', error)
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
 * Helper: Sets auth cookie for a user by userId and accountId.
 * Fetches user data by userId, builds token payload using account-specific context,
 * signs token, and sets HttpOnly cookie.
 */
export async function setAuthCookieForUser(
  res: Response,
  userId: number,
  accountId: number,
  email?: string,
): Promise<void> {
  const user = await getUserById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  const ctx = await getAccountContextForUserAndAccount(userId, accountId)

  const payload: CustomJwtPayload = ctx
    ? {
        userId,
        roleId: ctx.roleId,
        role: ctx.roleName,
        email: user.Email ?? email ?? '',
        name: `${user.FirstName ?? ''} ${user.LastName ?? ''}`.trim(),
        profilePic: user.ProfilePic ?? null,
        permissions: ctx.permissions,
        accountId: ctx.accountId,
      }
    : {
        userId,
        roleId: user.RoleID ?? 0,
        role: user.RoleName ?? '',
        email: user.Email ?? email ?? '',
        name: `${user.FirstName ?? ''} ${user.LastName ?? ''}`.trim(),
        profilePic: user.ProfilePic ?? null,
        permissions: [],
        accountId,
      }

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined')
  }
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '60m',
  })

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60, // 60 minutes
  })
}

// POST /logout
export const logoutHandler = (req: Request, res: Response): void => {
  res.clearCookie('token', {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  res.status(200).json({ message: 'Logout successful' })
}

// GET /session (verifyToken already ran)
export const getSession = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'No session' })
    return
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
