// src/backend/middleware/requireAdmin.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppError } from '../errors/AppError'

/**
 * Middleware to require admin role.
 * Must be used after verifyToken middleware.
 */
export const requireAdmin: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next(new AppError('Missing user in request', 403))
    return
  }

  const userRole = req.user.role?.toLowerCase()
  if (userRole !== 'admin') {
    next(new AppError('Admin access required', 403))
    return
  }

  next()
}
