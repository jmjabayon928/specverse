// src/backend/utils/inviteTokenUtils.ts
import crypto from 'node:crypto'

/**
 * Generates a cryptographically secure token for invite links. Single use; store only hash.
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Returns SHA-256 hash of the token as 64-char hex (for storage in TokenHash).
 */
export function inviteTokenSha256Hex(plain: string): string {
  return crypto.createHash('sha256').update(plain, 'utf8').digest('hex')
}
