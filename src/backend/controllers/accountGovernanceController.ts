import type { Request, Response, NextFunction } from 'express'
import {
  updateAccountStatus as svcUpdateStatus,
  transferOwnership as svcTransfer,
  softDeleteAccount as svcSoftDelete,
} from '../services/accountGovernanceService'
import { logAuditAction } from '../utils/logAuditAction'

function getStatusCode(err: unknown): number | null {
  const code = (err as Error & { statusCode?: number }).statusCode
  return typeof code === 'number' ? code : null
}

export async function patchStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
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
    const result = await svcUpdateStatus(accountId, isActive)
    await logAuditAction({
      action: 'account.status_changed',
      performedBy: req.user!.userId,
      tableName: 'Accounts',
      recordId: req.user!.accountId,
      route: req.originalUrl ?? null,
      method: req.method ?? null,
      statusCode: 200,
      changes: { isActive: result.isActive },
    })
    res.status(200).json(result)
  } catch (err) {
    const code = getStatusCode(err)
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}

export async function postTransferOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }
  const currentOwnerUserId = req.user?.ownerUserId ?? null
  const body = req.body as { targetUserId?: unknown }
  const raw = body.targetUserId
  if (raw === undefined || raw === null) {
    res.status(400).json({ message: 'targetUserId is required' })
    return
  }
  const targetUserId = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    res.status(400).json({ message: 'targetUserId must be a positive number' })
    return
  }
  try {
    const result = await svcTransfer(accountId, currentOwnerUserId, targetUserId)
    await logAuditAction({
      action: 'account.ownership_transferred',
      performedBy: req.user!.userId,
      tableName: 'Accounts',
      recordId: req.user!.accountId,
      route: req.originalUrl ?? null,
      method: req.method ?? null,
      statusCode: 200,
      changes: { fromOwnerUserId: currentOwnerUserId ?? null, toOwnerUserId: targetUserId },
    })
    res.status(200).json(result)
  } catch (err) {
    const code = getStatusCode(err)
    if (code === 400) {
      res.status(400).json({ message: (err as Error).message })
      return
    }
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}

export async function deleteAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }
  try {
    const result = await svcSoftDelete(accountId)
    await logAuditAction({
      action: 'account.soft_deleted',
      performedBy: req.user!.userId,
      tableName: 'Accounts',
      recordId: req.user!.accountId,
      route: req.originalUrl ?? null,
      method: req.method ?? null,
      statusCode: 200,
      changes: { isActive: false },
    })
    res.status(200).json(result)
  } catch (err) {
    const code = getStatusCode(err)
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}
