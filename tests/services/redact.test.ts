// tests/services/redact.test.ts
import { redactInviteUrl, redactEmail } from '../../src/backend/utils/redact'

describe('redactInviteUrl', () => {
  it('redacts token query param when present', () => {
    const url = 'https://app.example.com/invite/accept?token=secret123&foo=bar'
    expect(redactInviteUrl(url)).toBe(
      'https://app.example.com/invite/accept?token=%5BREDACTED%5D&foo=bar',
    )
  })

  it('redacts token when it is the only query param', () => {
    const url = 'https://app.example.com/invite/accept?token=abc'
    expect(redactInviteUrl(url)).toContain('token=')
    expect(redactInviteUrl(url)).not.toContain('abc')
    expect(redactInviteUrl(url)).toContain('REDACTED')
  })

  it('leaves URL unchanged when token param missing', () => {
    const url = 'https://app.example.com/invite/accept?scope=all'
    expect(redactInviteUrl(url)).toBe(url)
  })

  it('leaves URL unchanged when no query string', () => {
    const url = 'https://app.example.com/invite/accept'
    expect(redactInviteUrl(url)).toBe(url)
  })

  it('returns safe fallback for invalid URL strings', () => {
    expect(redactInviteUrl('not-a-url')).toBe('[invalid-url]')
    expect(redactInviteUrl('://missing-host')).toBe('[invalid-url]')
    expect(redactInviteUrl('')).toBe('')
  })

  it('does not throw on invalid URL strings', () => {
    expect(() => redactInviteUrl('not-a-url')).not.toThrow()
    expect(() => redactInviteUrl('://bad')).not.toThrow()
  })
})

describe('redactEmail', () => {
  it('masks local part and keeps domain', () => {
    expect(redactEmail('user@example.com')).toBe('u***r@example.com')
    expect(redactEmail('admin@specverse.io')).toBe('a***n@specverse.io')
  })

  it('handles short local part (<= 2 chars)', () => {
    expect(redactEmail('a@b.com')).toBe('a***@b.com')
    expect(redactEmail('ab@x.org')).toBe('a***@x.org')
  })

  it('returns [redacted] for empty string', () => {
    expect(redactEmail('')).toBe('[redacted]')
  })

  it('returns [redacted] for string with no @', () => {
    expect(redactEmail('no-at-sign')).toBe('[redacted]')
  })

  it('returns [redacted] when @ is at start', () => {
    expect(redactEmail('@domain.com')).toBe('[redacted]')
  })

  it('handles non-string safely (returns [redacted] for empty-like)', () => {
    expect(redactEmail('')).toBe('[redacted]')
  })
})
