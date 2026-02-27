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
 */
export function setSidCookie(res: Response, sid: string): void {
  res.cookie('sid', sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  })
}

/**
 * Clears the sid cookie.
 */
export function clearSidCookie(res: Response): void {
  res.clearCookie('sid', {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

/**
 * Gets the session expiration date (now + TTL).
 */
export function getSessionExpiresAt(): Date {
  return new Date(Date.now() + SESSION_TTL_MS)
}
