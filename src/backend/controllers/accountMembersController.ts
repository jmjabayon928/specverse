// src/backend/controllers/accountMembersController.ts
import type { Request, Response, NextFunction } from 'express'
import {
  listMembers as svcList,
  updateMemberRole as svcUpdateRole,
  updateMemberStatus as svcUpdateStatus,
} from '../services/accountMembersService'
import { parseIntParam } from '../utils/requestParam'

/**
 * GET /api/backend/account-members
 * verifyToken + ACCOUNT_VIEW. Uses req.user.accountId only.
 * Safety net: if no active account selected, return 409.
 */
export async function listMembers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(409).json({ message: 'No active account selected' })
    return
  }

  try {
    const members = await svcList(accountId)
    res.status(200).json({ members })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/backend/account-members/:id/role
 * Body: { roleId: number } (required)
 */
export async function updateRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }

  const accountMemberId = parseIntParam(req.params.id)
  if (accountMemberId === undefined || accountMemberId <= 0) {
    res.status(404).json({ message: 'Account member not found' })
    return
  }

  const body = req.body as { roleId?: unknown }
  const raw = body.roleId
  if (raw === undefined || raw === null) {
    res.status(400).json({ message: 'roleId is required' })
    return
  }
  const roleId = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(roleId) || roleId <= 0) {
    res.status(400).json({ message: 'roleId must be a positive number' })
    return
  }

  try {
    const member = await svcUpdateRole(accountId, accountMemberId, roleId)
    res.status(200).json(member)
  } catch (err) {
    const code = (err as Error & { statusCode?: number }).statusCode
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    if (code === 403) {
      res.status(403).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}

/**
 * PATCH /api/backend/account-members/:id/status
 * Body: { isActive: boolean } (required)
 */
export async function updateStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }

  const accountMemberId = parseIntParam(req.params.id)
  if (accountMemberId === undefined || accountMemberId <= 0) {
    res.status(404).json({ message: 'Account member not found' })
    return
  }

  const body = req.body as { isActive?: unknown }
  const raw = body.isActive
  if (raw === undefined || raw === null) {
    res.status(400).json({ message: 'isActive is required' })
    return
  }
  const isActive = typeof raw === 'boolean' ? raw : String(raw).toLowerCase() === 'true'

  try {
    const member = await svcUpdateStatus(accountId, accountMemberId, isActive)
    res.status(200).json(member)
  } catch (err) {
    const code = (err as Error & { statusCode?: number }).statusCode
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    if (code === 403) {
      res.status(403).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}
