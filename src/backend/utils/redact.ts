// src/backend/utils/redact.ts

/**
 * Strips the token query parameter from invite URLs so we never log token-bearing URLs.
 * Returns the URL with token= replaced by token=[REDACTED] (preserves structure for debugging).
 */
export function redactInviteUrl(url: string): string {
  if (typeof url !== 'string' || url.length === 0) {
    return url
  }
  try {
    const u = new URL(url)
    if (u.searchParams.has('token')) {
      u.searchParams.set('token', '[REDACTED]')
      return u.toString()
    }
    return url
  } catch {
    return '[invalid-url]'
  }
}

/**
 * Masks an email for safe logging (e.g. a***@b.com).
 */
export function redactEmail(email: string): string {
  if (typeof email !== 'string' || email.length === 0) {
    return '[redacted]'
  }
  const at = email.indexOf('@')
  if (at <= 0) {
    return '[redacted]'
  }
  const local = email.slice(0, at)
  const domain = email.slice(at)
  if (local.length <= 2) {
    return `${local[0]}***${domain}`
  }
  return `${local[0]}***${local[local.length - 1]}${domain}`
}

const PII_KEYS = ['email', 'token', 'password'] as const

/**
 * Returns a copy of changes with PII keys redacted for safe logging.
 */
export function redactChangesForLog(changes: Record<string, string | number | boolean | null> | null): Record<string, string | number | boolean | null> | null {
  if (changes == null || typeof changes !== 'object') {
    return changes
  }
  const out: Record<string, string | number | boolean | null> = {}
  for (const [k, v] of Object.entries(changes)) {
    const keyLower = k.toLowerCase()
    if (PII_KEYS.some(pii => keyLower === pii) && typeof v === 'string') {
      out[k] = redactEmail(v)
      continue
    }
    out[k] = v
  }
  return out
}
