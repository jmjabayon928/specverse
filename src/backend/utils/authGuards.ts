// src/backend/utils/authGuards.ts

import type { Request, NextFunction } from 'express'
import { AppError } from '@/backend/errors/AppError'

/**
 * Read accountId from req.user. If missing or not a finite number, call next(AppError 401) and return null.
 * Use in route handlers: const accountId = mustGetAccountId(req, next); if (accountId == null) return
 */
export function mustGetAccountId(req: Request, next: NextFunction): number | null {
  const raw = req.user?.accountId
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    next(new AppError('Unauthorized', 401))
    return null
  }
  return raw
}
