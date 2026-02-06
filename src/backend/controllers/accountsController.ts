// src/backend/controllers/accountsController.ts
import type { Request, Response, NextFunction } from 'express'
import { listAccountsForUser as svcList } from '../services/accountsService'

/**
 * GET /api/backend/accounts
 * verifyToken only. Returns accounts where user has active membership + activeAccountId.
 */
export async function listAccounts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.userId
  if (typeof userId !== 'number' || !Number.isFinite(userId)) {
    res.status(403).json({ message: 'Missing user in request' })
    return
  }

  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }

  try {
    const result = await svcList(userId, accountId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
