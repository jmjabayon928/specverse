// src/backend/controllers/platformAdminsController.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import {
  listActivePlatformAdmins,
  revokePlatformAdmin,
  grantPlatformAdmin,
} from '../database/platformAdminQueries'
import { logAuditAction } from '../utils/logAuditAction'

export async function listPlatformAdmins(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rows = await listActivePlatformAdmins()
    res.status(200).json(rows)
  } catch (err) {
    next(err)
  }
}

export const revokePlatformAdminHandler: RequestHandler = async (req, res) => {
  const rawUserId = (req.params as { userId?: string }).userId
  if (rawUserId === undefined || rawUserId === '') {
    res.status(400).json({ message: 'userId is required' })
    return
  }
  const targetUserId = Number.parseInt(rawUserId, 10)
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    res.status(400).json({ message: 'Invalid userId' })
    return
  }

  const actorUserId = req.user?.userId
  if (typeof actorUserId !== 'number' || !Number.isFinite(actorUserId)) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  if (targetUserId === actorUserId) {
    res.status(400).json({ message: 'Cannot revoke your own platform admin access' })
    return
  }

  const updated = await revokePlatformAdmin({
    targetUserId,
    revokedByUserId: actorUserId,
  })
  if (!updated) {
    res.status(404).json({ message: 'Platform admin not found or already revoked' })
    return
  }

  await logAuditAction({
    action: 'PLATFORM_ADMIN_REVOKE',
    performedBy: actorUserId,
    tableName: 'PlatformAdmins',
    recordId: targetUserId,
    route: req.originalUrl ?? null,
    method: req.method ?? null,
    statusCode: 200,
    changes: { targetUserId, revokedByUserId: actorUserId },
  })

  res.status(200).json({ ok: true })
}

export const grantPlatformAdminHandler: RequestHandler = async (req, res) => {
  const rawUserId = (req.params as { userId?: string }).userId
  if (rawUserId === undefined || rawUserId === '') {
    res.status(400).json({ message: 'userId is required' })
    return
  }
  const targetUserId = Number.parseInt(rawUserId, 10)
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    res.status(400).json({ message: 'Invalid userId' })
    return
  }

  const actorUserId = req.user?.userId
  if (typeof actorUserId !== 'number' || !Number.isFinite(actorUserId)) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const result = await grantPlatformAdmin({
    targetUserId,
    grantedByUserId: actorUserId,
  })

  if (result === 'already_active') {
    res.status(409).json({ message: 'User is already a platform admin' })
    return
  }

  const statusCode = result === 'inserted' ? 201 : 200
  await logAuditAction({
    action: 'PLATFORM_ADMIN_GRANT',
    performedBy: actorUserId,
    tableName: 'PlatformAdmins',
    recordId: targetUserId,
    route: req.originalUrl ?? null,
    method: req.method ?? null,
    statusCode,
    changes: { targetUserId, grantedByUserId: actorUserId, result },
  })

  res.status(statusCode).json({ ok: true, result })
}
