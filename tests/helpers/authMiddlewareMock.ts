import type { Request, RequestHandler } from 'express'
import { AppError } from '../../src/backend/errors/AppError'

export type UserClaims = {
  userId: number
  accountId: number
  isOwner?: boolean
  permissions?: string[]
  roleId?: number
  role?: string
}

type ExtendedRequest = Request & {
  user?: {
    userId: number
    accountId?: number
    isOwner?: boolean
    permissions?: string[]
    [key: string]: unknown
  }
}

export function parseTokenFromReq(req: Request): string | null {
  const cookieHeader = (req.headers && (req.headers.cookie as string | undefined)) ?? undefined
  if (cookieHeader) {
    const parts = cookieHeader.split(';').map(p => p.trim())
    for (const part of parts) {
      if (part.startsWith('token=')) {
        return part.slice('token='.length)
      }
    }
  }

  const auth = (req.headers && (req.headers.authorization as string | undefined)) ?? undefined
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length)
  }

  return null
}

function base64UrlToBase64(input: string): string {
  return input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
}

export function makeUserFromToken(token: string): UserClaims | null {
  try {
    if (!token) return null

    // JWT-like: header.payload.signature
    const parts = token.split('.')
    if (parts.length === 3) {
      const payloadB64 = base64UrlToBase64(parts[1])
      const decoded = Buffer.from(payloadB64, 'base64').toString('utf8')
      const parsed = JSON.parse(decoded) as Record<string, unknown>
      const userIdRaw = parsed.userId ?? parsed.id ?? parsed.user_id
      const accountIdRaw = parsed.accountId ?? parsed.account_id
      const userId = typeof userIdRaw === 'number' ? userIdRaw : typeof userIdRaw === 'string' ? Number(userIdRaw) : NaN
      const accountId = typeof accountIdRaw === 'number' ? accountIdRaw : typeof accountIdRaw === 'string' ? Number(accountIdRaw) : NaN
      if (Number.isFinite(userId) && Number.isFinite(accountId)) {
        const isOwner = parsed.isOwner === true || parsed.is_owner === true
        const permissions = Array.isArray(parsed.permissions) ? (parsed.permissions as string[]) : undefined
        const roleIdRaw = parsed.roleId ?? parsed.role_id
        const roleId = typeof roleIdRaw === 'number' ? roleIdRaw : typeof roleIdRaw === 'string' ? Number(roleIdRaw) : undefined
        const role = typeof parsed.role === 'string' ? parsed.role : undefined
        return { userId, accountId, isOwner, permissions, roleId: Number.isFinite(roleId) ? roleId : undefined, role }
      }
      return null
    }

    // JSON string token
    if (token.trim().startsWith('{')) {
      const parsed = JSON.parse(token) as Record<string, unknown>
      const userIdRaw = parsed.userId ?? parsed.id ?? parsed.user_id
      const accountIdRaw = parsed.accountId ?? parsed.account_id
      const userId = typeof userIdRaw === 'number' ? userIdRaw : typeof userIdRaw === 'string' ? Number(userIdRaw) : NaN
      const accountId = typeof accountIdRaw === 'number' ? accountIdRaw : typeof accountIdRaw === 'string' ? Number(accountIdRaw) : NaN
      if (Number.isFinite(userId) && Number.isFinite(accountId)) {
        const isOwner = parsed.isOwner === true || parsed.is_owner === true
        const permissions = Array.isArray(parsed.permissions) ? (parsed.permissions as string[]) : undefined
        const roleIdRaw = parsed.roleId ?? parsed.role_id
        const roleId = typeof roleIdRaw === 'number' ? roleIdRaw : typeof roleIdRaw === 'string' ? Number(roleIdRaw) : undefined
        const role = typeof parsed.role === 'string' ? parsed.role : undefined
        return { userId, accountId, isOwner, permissions, roleId: Number.isFinite(roleId) ? roleId : undefined, role }
      }
      return null
    }

    return null
  } catch {
    return null
  }
}

export function createAuthMiddlewareMock(args: {
  actual: unknown
  mode?: 'passthrough' | 'token'
}): Record<string, unknown> {
  const { actual, mode = 'passthrough' } = args
  const actualObj = (actual as Record<string, unknown>) ?? {}

  const passthrough: RequestHandler = (_req, _res, next) => {
    const r = _req as unknown as Record<string, unknown>
    ;(r as Record<string, unknown>)['user'] = {
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      permissions: [],
    }
    next()
  }

  const verifyTokenHandler: RequestHandler = (req, _res, next) => {
    if (mode === 'passthrough') {
      next()
      return
    }

    // token mode: try to parse token and attach minimal user claims
    const token = parseTokenFromReq(req)
    if (!token) {
      next(new AppError('Unauthorized - No token', 401))
      return
    }

    const claims = makeUserFromToken(token)
    if (!claims) {
      // Token exists but doesn't have required userId/accountId
      next(new AppError('Unauthorized - Invalid token', 401))
      return
    }

    const r = req as unknown as Record<string, unknown>
    ;(r as Record<string, unknown>)['user'] = {
      userId: claims.userId,
      accountId: claims.accountId,
      isOwner: claims.isOwner,
      permissions: claims.permissions ?? [],
      roleId: claims.roleId,
      role: claims.role,
    }
    next()
  }

  const optionalVerifyTokenHandler: RequestHandler = (req, _res, next) => {
    if (mode === 'passthrough') {
      next()
      return
    }
    const token = parseTokenFromReq(req)
    if (token) {
      const claims = makeUserFromToken(token)
      if (claims) {
        const r = req as unknown as Record<string, unknown>
        ;(r as Record<string, unknown>)['user'] = {
          userId: claims.userId,
          accountId: claims.accountId,
          isOwner: claims.isOwner,
          permissions: claims.permissions ?? [],
        }
      }
    }
    next()
  }

  const verifyTokenOnlyHandler: RequestHandler = (_req, _res, next) => {
    next()
  }

  const requirePermissionFactory = (permissionKey: string): RequestHandler => {
    if (mode === 'passthrough') {
      return passthrough
    }
    // token mode: run same logic as real requirePermission but use permissionQueries (mocked in tests)
    return async (req, res, next) => {
      try {
        if (!req.user) {
          next(new AppError('Missing user in request', 403))
          return
        }
        const roleName =
          typeof req.user.role === 'string' ? (req.user.role ?? '').trim().toLowerCase() : ''
        const isAccountAdmin = req.user.roleId === 1 || roleName === 'admin'
        if (isAccountAdmin) {
          next()
          return
        }
        if (!req.user.accountId) {
          next(new AppError('Missing account context', 403))
          return
        }
        const { checkUserPermission } = require('../../src/backend/database/permissionQueries')
        const hasPermission = await checkUserPermission(
          req.user.userId,
          req.user.accountId,
          permissionKey
        )
        if (!hasPermission) {
          next(new AppError('Permission denied', 403))
          return
        }
        next()
      } catch (error) {
        next(error)
      }
    }
  }

  return {
    ...actualObj,
    verifyToken: verifyTokenHandler,
    optionalVerifyToken: optionalVerifyTokenHandler,
    verifyTokenOnly: verifyTokenOnlyHandler,
    requirePermission: requirePermissionFactory,
  }
}

