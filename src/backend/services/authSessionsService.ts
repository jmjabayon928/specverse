// src/backend/services/authSessionsService.ts
import type { Request } from 'express'
import { findActiveSessionBySidHash, revokeSessionBySidHash, hashSid } from '../repositories/authSessionsRepository'
import { getUserById } from './usersService'
import { getAccountContextForUserAndAccount } from '../database/accountContextQueries'
import { isUserPlatformAdmin } from '../database/platformAdminPort'
import type { AuthSessionData } from '../domain/authSessionTypes'

/**
 * Gets the sid cookie value from the request.
 */
export function getSidFromRequest(req: Request): string | null {
  return req.cookies?.sid ?? null
}

/**
 * Loads session data for a given sid cookie value.
 * Returns null if session is invalid, expired, or revoked.
 */
export async function loadSessionData(sid: string): Promise<AuthSessionData | null> {
  const sidHash = hashSid(sid)
  const session = await findActiveSessionBySidHash(sidHash)
  if (!session) {
    return null
  }

  const user = await getUserById(session.UserID)
  if (!user) {
    return null
  }

  const accountId = session.AccountID
  const ctx = accountId ? await getAccountContextForUserAndAccount(session.UserID, accountId) : null

  const isSuperadmin = await isUserPlatformAdmin(session.UserID)

  return {
    userId: session.UserID,
    accountId: ctx?.accountId ?? accountId ?? null,
    roleId: ctx?.roleId ?? user.RoleID ?? 0,
    role: ctx?.roleName ?? user.RoleName ?? '',
    email: user.Email ?? '',
    name: `${user.FirstName ?? ''} ${user.LastName ?? ''}`.trim(),
    profilePic: user.ProfilePic ?? null,
    permissions: ctx?.permissions ?? [],
    isSuperadmin,
  }
}

/**
 * Revokes a session by sid cookie value.
 */
export async function revokeSession(sid: string): Promise<void> {
  const sidHash = hashSid(sid)
  await revokeSessionBySidHash(sidHash)
}
