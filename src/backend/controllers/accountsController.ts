// src/backend/controllers/accountsController.ts
import type { Request, Response, NextFunction } from 'express'
import {
  createAccount as svcCreate,
  getAccountById as svcGetById,
  listAccountsForUser as svcList,
  updateAccount as svcUpdate,
} from '../services/accountsService'

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

function parsePositiveInt(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function getStatusCode(err: unknown): number | null {
  const code = (err as Error & { statusCode?: number }).statusCode
  return typeof code === 'number' ? code : null
}

/**
 * GET /api/backend/accounts/:id
 * verifyToken + requireAdmin.
 */
export async function getAccountById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = parsePositiveInt(req.params.id)
  if (!accountId) {
    res.status(404).json({ message: 'Account not found' })
    return
  }

  try {
    const account = await svcGetById(accountId)
    res.status(200).json(account)
  } catch (err) {
    const code = getStatusCode(err)
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}

/**
 * POST /api/backend/accounts
 * verifyToken + requireAdmin.
 * Body: { accountName: string, slug: string }
 */
export async function createAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const body = req.body as { accountName?: unknown; slug?: unknown }
  const accountName = body.accountName
  const slug = body.slug
  if (typeof accountName !== 'string') {
    res.status(400).json({ message: 'accountName is required' })
    return
  }
  if (typeof slug !== 'string') {
    res.status(400).json({ message: 'slug is required' })
    return
  }

  try {
    const created = await svcCreate(accountName, slug)
    res.status(201).json(created)
  } catch (err) {
    const code = getStatusCode(err)
    if (code === 400) {
      res.status(400).json({ message: (err as Error).message })
      return
    }
    if (code === 409) {
      res.status(409).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}

/**
 * PATCH /api/backend/accounts/:id
 * verifyToken + requireAdmin.
 * Body: partial { accountName?, slug?, isActive? }
 */
export async function updateAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = parsePositiveInt(req.params.id)
  if (!accountId) {
    res.status(404).json({ message: 'Account not found' })
    return
  }

  const body = req.body as { accountName?: unknown; slug?: unknown; isActive?: unknown }
  if (body.accountName === undefined && body.slug === undefined && body.isActive === undefined) {
    res.status(400).json({ message: 'No fields to update' })
    return
  }
  const patch: { accountName?: string; slug?: string; isActive?: boolean } = {}

  if (body.accountName !== undefined) {
    if (typeof body.accountName !== 'string') {
      res.status(400).json({ message: 'accountName must be a string' })
      return
    }
    patch.accountName = body.accountName
  }
  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string') {
      res.status(400).json({ message: 'slug must be a string' })
      return
    }
    patch.slug = body.slug
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive === 'boolean') {
      patch.isActive = body.isActive
    } else if (typeof body.isActive === 'string') {
      const normalized = body.isActive.trim().toLowerCase()
      if (normalized !== 'true' && normalized !== 'false') {
        res.status(400).json({ message: 'isActive must be a boolean' })
        return
      }
      patch.isActive = normalized === 'true'
    } else {
      res.status(400).json({ message: 'isActive must be a boolean' })
      return
    }
  }

  try {
    const updated = await svcUpdate(accountId, patch)
    res.status(200).json(updated)
  } catch (err) {
    const code = getStatusCode(err)
    if (code === 400) {
      res.status(400).json({ message: (err as Error).message })
      return
    }
    if (code === 409) {
      res.status(409).json({ message: (err as Error).message })
      return
    }
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}
