// src/backend/middleware/authMiddleware.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { AppError } from '../errors/AppError'
import type { JwtPayload as CustomJwtPayload } from '../../domain/auth/JwtTypes'
import { checkUserPermission } from '../database/permissionQueries'
import {
  getAccountContextForUser,
  getAccountContextForUserAndAccount,
  getDefaultAccountId,
  getActiveAccountId,
} from '../database/accountContextQueries'
import {
  getActiveAccountId as getStoredActiveAccountId,
  clearActiveAccount,
} from '../repositories/userActiveAccountRepository'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables')
}

/** Optional auth: sets req.user when cookie/header present; never fails. Use for routes that accept either session or token param. */
export const optionalVerifyToken: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]
  if (!token) {
    next()
    return
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomJwtPayload
    if (decoded.userId && decoded.role) {
      req.user = {
        userId: decoded.userId,
        roleId: decoded.roleId,
        role: decoded.role,
        email: decoded.email,
        name: decoded.name,
        profilePic: decoded.profilePic ?? undefined,
        permissions: decoded.permissions ?? [],
        accountId: decoded.accountId,
        isSuperadmin: decoded.isSuperadmin,
      }
    }
  } catch {
    // ignore invalid token; route handler will require token param or session
  }
  next()
}

function parseCsvEnv(name: string): string[] {
  const raw = process.env[name]
  if (!raw) return []
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function isPlatformSuperadmin(user: { userId: number; email?: string }): boolean {
  const ids = parseCsvEnv('SUPERADMIN_USER_IDS')
  const emails = parseCsvEnv('SUPERADMIN_EMAILS').map(e => e.toLowerCase())

  if (ids.includes(String(user.userId))) return true
  if (user.email && emails.includes(user.email.toLowerCase())) return true

  return false
}

function getRequestPath(req: Request): string {
  if (typeof req.path === 'string') {
    return req.path
  }
  const raw = req.originalUrl || req.url || ''
  const qIndex = raw.indexOf('?')
  if (qIndex === -1) {
    return raw
  }
  return raw.slice(0, qIndex)
}

function isPlatformOverrideRoute(req: Request): boolean {
  const path = getRequestPath(req)
  return path.startsWith('/api/backend/platform/')
}

function isDiagnosticsOverrideRoute(req: Request): boolean {
  const path = getRequestPath(req)
  return path.startsWith('/api/backend/diagnostics/')
}

async function attachAccountContext(req: Request): Promise<void> {
  if (!req.user) {
    throw new AppError('Missing user in request', 403)
  }

  // Superadmin is backend-only and explicit. For tenant-data endpoints, superadmin
  // can optionally choose an account via header; otherwise we fall back to default account.
  const superadmin = isPlatformSuperadmin({ userId: req.user.userId, email: req.user.email })
  req.user.isSuperadmin = superadmin

  const headerAccountId = req.headers['x-specverse-account-id']
  const headerAccountIdValue =
    typeof headerAccountId === 'string' ? headerAccountId : Array.isArray(headerAccountId) ? headerAccountId[0] : undefined
  const hasHeader = !!headerAccountIdValue

  // Header-based override is allowed ONLY on platform/diagnostics routes.
  const isPlatformRoute = isPlatformOverrideRoute(req)
  const isDiagnosticsRoute = isDiagnosticsOverrideRoute(req)

  if (hasHeader) {
    if (!superadmin) {
      throw new AppError('Account override is not permitted on this endpoint', 403)
    }

    if (!isPlatformRoute && !isDiagnosticsRoute) {
      throw new AppError('Account override is not permitted on this endpoint', 403)
    }

    if (!headerAccountIdValue) {
      throw new AppError('Missing x-specverse-account-id header', 400)
    }

    const parsed = Number.parseInt(headerAccountIdValue, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError('Invalid x-specverse-account-id header', 400)
    }

    if (isDiagnosticsRoute && req.method.toUpperCase() !== 'GET') {
      throw new AppError('Diagnostics override allowed for GET only', 403)
    }

    const activeId = await getActiveAccountId(parsed)
    if (!activeId) {
      throw new AppError('Account not found or inactive for override', 404)
    }

    console.warn(
      '[SuperadminAccountOverride] userId=%s email=%s accountId=%s path=%s',
      String(req.user.userId),
      req.user.email ?? '',
      String(activeId),
      req.originalUrl ?? req.url ?? '',
    )

    req.user.accountId = activeId
    req.user.isSuperadmin = true
    return
  }

  const storedAccountId = await getStoredActiveAccountId(req.user.userId)
  if (storedAccountId !== null) {
    const storedCtx = await getAccountContextForUserAndAccount(req.user.userId, storedAccountId)
    if (storedCtx) {
      req.user.accountId = storedCtx.accountId
      req.user.roleId = storedCtx.roleId
      req.user.role = storedCtx.roleName
      req.user.permissions = storedCtx.permissions
      return
    }
    await clearActiveAccount(req.user.userId)
  }

  const ctx = await getAccountContextForUser(req.user.userId)
  if (ctx) {
    req.user.accountId = ctx.accountId
    // Align role/permissions with account membership (AccountMembers.RoleID)
    req.user.roleId = ctx.roleId
    req.user.role = ctx.roleName
    req.user.permissions = ctx.permissions
    return
  }

  // No membership: allow superadmin to operate using default account only.
  if (superadmin) {
    const defaultAccountId = await getDefaultAccountId()
    if (!defaultAccountId) {
      throw new AppError("Default account (Slug = 'default') not found", 500)
    }
    req.user.accountId = defaultAccountId
    return
  }

  throw new AppError('No active account membership', 403)
}

/** Validates JWT and sets req.user; does NOT attach account context. Use for routes that need a signed-in user without account scope (e.g. invite accept). */
export const verifyTokenOnly: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.skipAuth) {
    next()
    return
  }

  const token = req.cookies?.token ?? req.headers.authorization?.split(' ')[1]
  if (!token) {
    next(new AppError('Unauthorized - No token', 401))
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomJwtPayload
    if (!decoded.userId) {
      next(new AppError('Invalid token payload', 403))
      return
    }
    req.user = {
      userId: decoded.userId,
      roleId: decoded.roleId,
      role: decoded.role ?? undefined,
      email: decoded.email,
      name: decoded.name,
      profilePic: decoded.profilePic ?? undefined,
      permissions: decoded.permissions ?? [],
      accountId: decoded.accountId,
      isSuperadmin: decoded.isSuperadmin,
    }
    next()
  } catch (error) {
    if (error instanceof AppError) {
      next(error)
      return
    }
    next(new AppError('Invalid or expired session', 403))
  }
}

export const verifyToken: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.skipAuth) {
    console.log('✅ Skipping auth for test')
    next()
    return
  }

  const token = req.cookies.token || req.headers.authorization?.split(' ')[1]

  if (!token) {
    console.warn('⛔ No token received')
    next(new AppError('Unauthorized - No token', 401))
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomJwtPayload

    if (!decoded.userId || !decoded.role) {
      console.warn('⛔ Token payload missing required fields')
      next(new AppError('Invalid token payload', 403))
      return
    }

    req.user = {
      userId: decoded.userId,
      roleId: decoded.roleId,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
      profilePic: decoded.profilePic ?? undefined,
      permissions: decoded.permissions ?? [],
      accountId: decoded.accountId,
      isSuperadmin: decoded.isSuperadmin,
    }

    await attachAccountContext(req)
    next()
  } catch (error) {
    if (error instanceof AppError) {
      next(error)
      return
    }
  
    console.error('❌ Token verification error:', error)
    next(new AppError('Invalid or expired session', 403))
  }
}

export const requirePermission = (permissionKey: string): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Missing user in request', 403))
        return
      }

      if (!req.user.accountId) {
        next(new AppError('Missing account context', 403))
        return
      }

      const hasPermission = await checkUserPermission(req.user.userId, req.user.accountId, permissionKey)

      if (!hasPermission) {
        next(new AppError('Permission denied', 403))
        return
      }

      next()
    } catch (error) {
      console.error('Permission middleware error:', error)
      next(new AppError('Server error', 500))
    }
  }
}
