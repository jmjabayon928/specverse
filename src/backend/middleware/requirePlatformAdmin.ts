// src/backend/middleware/requirePlatformAdmin.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppError } from '../errors/AppError'
import { isActivePlatformAdmin } from '../database/platformAdminQueries'

export const requirePlatformAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId
  if (typeof userId !== 'number' || !Number.isFinite(userId)) {
    next(new AppError('Unauthorized', 401))
    return
  }

  const isAdmin = await isActivePlatformAdmin(userId)
  if (!isAdmin) {
    next(new AppError('Platform admin access required', 403))
    return
  }

  next()
}
