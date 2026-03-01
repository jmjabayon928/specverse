// src/backend/utils/sessionCookie.ts
import type { Response } from 'express'
import crypto from 'crypto'

const SESSION_TTL_MS = 1000 * 60 * 60 // 60 minutes

/**
 * Generates a new opaque session ID (sid).
 */
export function generateSid(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Sets the sid cookie on the response.
 * @param isSecureRequest - When true (e.g. req.secure behind HTTPS proxy), cookie is Secure. When undefined, falls back to NODE_ENV === 'production'.
 */
export function setSidCookie(res: Response, sid: string, isSecureRequest?: boolean): void {
  const secure = Boolean(isSecureRequest) || process.env.NODE_ENV === 'production'
  res.cookie('sid', sid, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  })
}

/**
 * Clears the sid cookie.
 * @param isSecureRequest - Must match the secure option used when the cookie was set (e.g. req.secure).
 */
export function clearSidCookie(res: Response, isSecureRequest?: boolean): void {
  const secure = Boolean(isSecureRequest) || process.env.NODE_ENV === 'production'
  res.clearCookie('sid', {
    path: '/',
    sameSite: 'lax',
    secure,
  })
}

/**
 * Gets the session expiration date (now + TTL).
 */
export function getSessionExpiresAt(): Date {
  return new Date(Date.now() + SESSION_TTL_MS)
}
