// src/backend/controllers/sessionsController.ts
import type { Request, Response, NextFunction } from 'express'
import { setActiveAccount as setActiveAccountService } from '../services/sessionsService'

type SetActiveAccountBody = { accountId?: unknown }

/**
 * POST /api/backend/sessions/active-account
 * Body: { accountId: number }
 * Requires verifyToken. Validates active membership then upserts UserActiveAccount. Returns 204.
 */
export async function setActiveAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.userId
  if (typeof userId !== 'number' || !Number.isFinite(userId)) {
    res.status(403).json({ message: 'Missing user in request' })
    return
  }

  const body = req.body as SetActiveAccountBody
  const raw = body.accountId
  if (raw === undefined || raw === null) {
    res.status(400).json({ message: 'accountId is required' })
    return
  }

  const accountId = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(accountId) || accountId <= 0) {
    res.status(400).json({ message: 'accountId must be a positive number' })
    return
  }

  try {
    await setActiveAccountService(userId, accountId)
    res.status(204).send()
  } catch (err) {
    const statusCode = (err as Error & { statusCode?: number }).statusCode
    if (statusCode === 403) {
      res.status(403).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}
