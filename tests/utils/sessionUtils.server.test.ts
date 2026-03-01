/**
 * buildSessionUrl: absolute URL for /api/backend/auth/session with dev host canonicalization.
 */
import { buildSessionUrl } from '../../src/utils/sessionUtils.server'

function makeHeaders(entries: Record<string, string | null>): { get(name: string): string | null } {
  return {
    get(name: string): string | null {
      return entries[name] ?? null
    },
  }
}

describe('buildSessionUrl', () => {
  it('canonicalizes 127.0.0.1:3000 to localhost:3000 with http', () => {
    const hdrs = makeHeaders({ 'x-forwarded-proto': 'http', host: '127.0.0.1:3000' })
    expect(buildSessionUrl(hdrs)).toBe('http://localhost:3000/api/backend/auth/session')
  })

  it('leaves localhost:3000 unchanged', () => {
    const hdrs = makeHeaders({ 'x-forwarded-proto': 'http', host: 'localhost:3000' })
    expect(buildSessionUrl(hdrs)).toBe('http://localhost:3000/api/backend/auth/session')
  })

  it('uses x-forwarded-host when present over host', () => {
    const hdrs = makeHeaders({
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'app.example.com',
      host: 'localhost:3000',
    })
    expect(buildSessionUrl(hdrs)).toBe('https://app.example.com/api/backend/auth/session')
  })

  it('canonicalizes 127.0.0.1 (no port) to localhost', () => {
    const hdrs = makeHeaders({ 'x-forwarded-proto': 'http', host: '127.0.0.1' })
    expect(buildSessionUrl(hdrs)).toBe('http://localhost/api/backend/auth/session')
  })

  it('throws when host is missing', () => {
    const hdrs = makeHeaders({ 'x-forwarded-proto': 'http' })
    expect(() => buildSessionUrl(hdrs)).toThrow('Missing host header for session URL')
  })
})
