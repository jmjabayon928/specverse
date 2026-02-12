// src/backend/controllers/invitesController.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import {
  createOrResendInvite,
  listInvites,
  resendInvite,
  revokeInvite,
  devAcceptLink,
  getByToken,
  acceptInvite,
  acceptInvitePublic,
  declineInvite,
} from '../services/invitesService'
import { parseIntParam, asSingleString } from '../utils/requestParam'

export const env = { isProdEnv: (): boolean => process.env.NODE_ENV === 'production' }

/**
 * POST /api/backend/invites
 * Body: { email: string, roleId: number }. Creates or resends (rotate token) if pending exists.
 */
export const create: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }

  const userId = req.user?.userId
  if (typeof userId !== 'number' || !Number.isFinite(userId)) {
    res.status(403).json({ message: 'Unauthorized' })
    return
  }

  const body = req.body as { email?: unknown; roleId?: unknown }
  const rawEmail = body.email
  if (rawEmail === undefined || rawEmail === null || typeof rawEmail !== 'string') {
    res.status(400).json({ message: 'email is required' })
    return
  }
  const email = String(rawEmail).trim()
  if (!email) {
    res.status(400).json({ message: 'email is required' })
    return
  }

  const rawRoleId = body.roleId
  if (rawRoleId === undefined || rawRoleId === null) {
    res.status(400).json({ message: 'roleId is required' })
    return
  }
  const roleId = typeof rawRoleId === 'number' ? rawRoleId : Number.parseInt(String(rawRoleId), 10)
  if (!Number.isFinite(roleId) || roleId <= 0) {
    res.status(400).json({ message: 'roleId must be a positive number' })
    return
  }

  try {
    const originFromRequest = `${req.protocol}://${req.get('host')}`
    const result = await createOrResendInvite(accountId, userId, email, roleId, {
      route: req.originalUrl,
      method: req.method,
    }, originFromRequest)
    const status = result.resent ? 200 : 201
    res.status(status).json(result)
  } catch (err) {
    const code = (err as Error & { statusCode?: number }).statusCode
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
 * GET /api/backend/invites?scope=pending|all — list invites for active account.
 * Default: scope=pending (preserves existing behavior).
 */
export const list: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }

  try {
    const rawScope = asSingleString(req.query.scope as string | string[] | undefined)
    const normalized = rawScope != null ? rawScope.trim().toLowerCase() : ''
    const scope = normalized === '' ? 'pending' : normalized
    if (scope !== 'pending' && scope !== 'all') {
      res.status(400).json({ message: "Invalid scope. Expected 'pending' or 'all'." })
      return
    }

    const invites = await listInvites(accountId, scope)
    res.status(200).json({ invites })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/backend/invites/:id/dev-accept-link — DEV-only: rotate token, return accept URL (no email). 404 when NODE_ENV === 'production'.
 */
export const devAcceptLinkHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (env.isProdEnv()) {
    res.status(404).json({ message: 'Not found' })
    return
  }

  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }

  const inviteId = parseIntParam(req.params.id)
  if (inviteId === undefined || inviteId <= 0) {
    res.status(404).json({ message: 'Invite not found' })
    return
  }

  try {
    const originFromRequest = `${req.protocol}://${req.get('host')}`
    const result = await devAcceptLink(accountId, inviteId, originFromRequest)
    res.status(200).json(result)
  } catch (err) {
    const code = (err as Error & { statusCode?: number }).statusCode
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    if (code === 410) {
      res.status(410).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}

/**
 * POST /api/backend/invites/:id/resend — rotate token and resend.
 */
export const resend: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }

  const userId = req.user?.userId
  if (typeof userId !== 'number' || !Number.isFinite(userId)) {
    res.status(403).json({ message: 'Unauthorized' })
    return
  }

  const inviteId = parseIntParam(req.params.id)
  if (inviteId === undefined || inviteId <= 0) {
    res.status(404).json({ message: 'Invite not found' })
    return
  }

  try {
    const originFromRequest = `${req.protocol}://${req.get('host')}`
    const invite = await resendInvite(accountId, inviteId, userId, {
      route: req.originalUrl,
      method: req.method,
      statusCode: 200,
    }, originFromRequest)
    res.status(200).json(invite)
  } catch (err) {
    const code = (err as Error & { statusCode?: number }).statusCode
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}

/**
 * POST /api/backend/invites/:id/revoke — set Status=Revoked.
 */
export const revoke: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const accountId = req.user?.accountId
  if (typeof accountId !== 'number' || !Number.isFinite(accountId)) {
    res.status(403).json({ message: 'Missing account context' })
    return
  }

  const userId = req.user?.userId
  if (typeof userId !== 'number' || !Number.isFinite(userId)) {
    res.status(403).json({ message: 'Unauthorized' })
    return
  }

  const inviteId = parseIntParam(req.params.id)
  if (inviteId === undefined || inviteId <= 0) {
    res.status(404).json({ message: 'Invite not found' })
    return
  }

  try {
    await revokeInvite(accountId, inviteId, userId, {
      route: req.originalUrl,
      method: req.method,
      statusCode: 204,
    })
    res.status(204).send()
  } catch (err) {
    const code = (err as Error & { statusCode?: number }).statusCode
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}

/**
 * GET /api/backend/invites/by-token?token=... — public; returns { accountName, status, expiresAt }.
 */
export const byToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = asSingleString(req.query.token as string | string[] | undefined)
  if (!token || !token.trim()) {
    res.status(400).json({ message: 'token is required' })
    return
  }

  try {
    const result = await getByToken(token.trim())
    if (!result) {
      res.status(404).json({ message: 'Invite not found' })
      return
    }
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/backend/invites/accept — body { token }. Requires signed-in user; email must match invite.
 */
export const accept: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userId = req.user?.userId
  if (typeof userId !== 'number' || !Number.isFinite(userId)) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const userEmail = req.user?.email
  if (typeof userEmail !== 'string' || !userEmail.trim()) {
    res.status(403).json({ message: 'User email is required to accept invite' })
    return
  }

  const body = req.body as { token?: unknown }
  const rawToken = body.token
  if (rawToken === undefined || rawToken === null || typeof rawToken !== 'string') {
    res.status(400).json({ message: 'token is required' })
    return
  }
  const token = String(rawToken).trim()
  if (!token) {
    res.status(400).json({ message: 'token is required' })
    return
  }

  try {
    const result = await acceptInvite(userId, userEmail, token, {
      route: req.originalUrl,
      method: req.method,
      statusCode: 200,
    })
    res.status(200).json(result)
  } catch (err) {
    const code = (err as Error & { statusCode?: number }).statusCode
    if (code === 404 || code === 410) {
      res.status(code).json({ message: (err as Error).message })
      return
    }
    if (code === 403) {
      res.status(403).json({ message: (err as Error).message })
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
 * POST /api/backend/invites/accept-public — body { token, firstName, lastName, password }. Public; no auth.
 */
export const acceptPublic: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const body = req.body as { token?: unknown; firstName?: unknown; lastName?: unknown; password?: unknown }
  const rawToken = body.token
  if (rawToken === undefined || rawToken === null || typeof rawToken !== 'string') {
    res.status(400).json({ message: 'token is required' })
    return
  }
  const token = String(rawToken).trim()
  if (!token) {
    res.status(400).json({ message: 'token is required' })
    return
  }
  const firstName = body.firstName != null ? String(body.firstName).trim() : ''
  const lastName = body.lastName != null ? String(body.lastName).trim() : ''
  const password = body.password != null ? String(body.password).trim() : ''
  if (!firstName || !lastName || !password) {
    res.status(400).json({ message: 'firstName, lastName, and password are required' })
    return
  }

  try {
    const result = await acceptInvitePublic(
      { token, firstName, lastName, password },
      { route: req.originalUrl, method: req.method, statusCode: 200 },
    )
    res.status(200).json(result)
  } catch (err) {
    const code = (err as Error & { statusCode?: number }).statusCode
    if (code === 400) {
      res.status(400).json({ message: (err as Error).message })
      return
    }
    if (code === 404) {
      res.status(404).json({ message: (err as Error).message })
      return
    }
    if (code === 410) {
      res.status(410).json({ message: (err as Error).message })
      return
    }
    if (code === 409) {
      res.status(409).json({ message: (err as Error).message })
      return
    }
    if (code === 500) {
      res.status(500).json({ message: 'An error occurred while accepting the invite. Please try again.' })
      return
    }
    next(err)
  }
}

/**
 * POST /api/backend/invites/decline — body { token }. Public or auth-optional.
 */
export const decline: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const body = req.body as { token?: unknown }
  const rawToken = body.token
  if (rawToken === undefined || rawToken === null || typeof rawToken !== 'string') {
    res.status(400).json({ message: 'token is required' })
    return
  }
  const token = String(rawToken).trim()
  if (!token) {
    res.status(400).json({ message: 'token is required' })
    return
  }

  const performedBy = req.user?.userId != null && Number.isFinite(req.user.userId)
    ? req.user.userId
    : null
  const userEmail = req.user?.email

  try {
    await declineInvite(token, performedBy, userEmail, {
      route: req.originalUrl,
      method: req.method,
      statusCode: 204,
    })
    res.status(204).send()
  } catch (err) {
    const code = (err as Error & { statusCode?: number }).statusCode
    if (code === 404 || code === 410) {
      res.status(code).json({ message: (err as Error).message })
      return
    }
    if (code === 403) {
      res.status(403).json({ message: (err as Error).message })
      return
    }
    next(err)
  }
}
