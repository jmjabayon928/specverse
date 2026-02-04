// src/backend/controllers/authController.ts
import type { Request, Response } from 'express'
import type { JwtPayload as CustomJwtPayload } from '../../domain/auth/JwtTypes'
import { loginWithEmailAndPassword } from '../services/authService'

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
    res.status(500).json({ message: 'Internal server error' })
  }
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

  res.status(200).json({
    userId: user.userId,
    roleId: user.roleId,
    role: user.role,
    name: user.name ?? '',
    email: user.email ?? '',
    profilePic: user.profilePic ?? '',
    permissions: user.permissions ?? [],
    accountId: user.accountId ?? null,
    isSuperadmin: user.isSuperadmin ?? false,
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
    res.status(500).json({ message: 'Failed to fetch user profile' })
  }
}
