// src/backend/middleware/authMiddleware.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { AppError } from '../errors/AppError'
import type { JwtPayload as CustomJwtPayload } from '../../domain/auth/JwtTypes'
import { checkUserPermission } from '../database/permissionQueries'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables')
}

/** Optional auth: sets req.user when cookie/header present; never fails. Use for routes that accept either session or token param. */
export const optionalVerifyToken: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]
  if (!token) {
    next()
    return
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomJwtPayload
    if (decoded.userId && decoded.role) {
      req.user = {
        userId: decoded.userId,
        roleId: decoded.roleId,
        role: decoded.role,
        email: decoded.email,
        name: decoded.name,
        profilePic: decoded.profilePic ?? undefined,
        permissions: decoded.permissions ?? [],
      }
    }
  } catch {
    // ignore invalid token; route handler will require token param or session
  }
  next()
}

export const verifyToken: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.skipAuth) {
    console.log('✅ Skipping auth for test')
    next()
    return
  }

  const token = req.cookies.token || req.headers.authorization?.split(' ')[1]

  if (!token) {
    console.warn('⛔ No token received')
    next(new AppError('Unauthorized - No token', 401))
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomJwtPayload

    if (!decoded.userId || !decoded.role) {
      console.warn('⛔ Token payload missing required fields')
      next(new AppError('Invalid token payload', 403))
      return
    }

    req.user = {
      userId: decoded.userId,
      roleId: decoded.roleId,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
      profilePic: decoded.profilePic ?? undefined,
      permissions: decoded.permissions ?? [],
    }

    next()
  } catch (error) {
    console.error('❌ Token verification error:', error)
    next(new AppError('Invalid or expired session', 403))
  }
}

export const requirePermission = (permissionKey: string): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Missing user in request', 403))
        return
      }

      const hasPermission = await checkUserPermission(req.user.userId, permissionKey)

      if (!hasPermission) {
        next(new AppError('Permission denied', 403))
        return
      }

      next()
    } catch (error) {
      console.error('Permission middleware error:', error)
      next(new AppError('Server error', 500))
    }
  }
}
