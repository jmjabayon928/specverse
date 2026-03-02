// Server-only: uses next/headers; .server.ts suffix prevents client bundling
import { headers } from 'next/headers'

export type AbsoluteUrlParts = { protocol: 'http' | 'https'; host: string }

/**
 * Infers protocol from host and x-forwarded-proto (pure, for testing).
 * Used when x-forwarded-proto is absent (e.g. local dev).
 */
export function inferProtocol(host: string, xForwardedProto: string | null): 'http' | 'https' {
  if (xForwardedProto != null && xForwardedProto !== '') {
    return xForwardedProto === 'http' ? 'http' : 'https'
  }
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'http'
  }
  return 'https'
}

/**
 * Builds an absolute URL from a path and request-derived parts.
 * Node fetch requires absolute URLs; relative paths like '/api/backend/...' fail in SSR.
 */
export function buildAbsoluteUrl(inputPath: string, parts: AbsoluteUrlParts): string {
  if (inputPath.startsWith('http://') || inputPath.startsWith('https://')) {
    return inputPath
  }
  const path = inputPath.startsWith('/') ? inputPath : `/${inputPath}`
  return `${parts.protocol}://${parts.host}${path}`
}

/**
 * Server-only fetch wrapper that builds an absolute URL from the current request
 * and forwards the cookie header so backend routes receive session.
 */
export async function backendFetch(inputPath: string, init?: RequestInit): Promise<Response> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  if (host === '') {
    throw new Error('Missing host header for backendFetch')
  }
  const protocol = inferProtocol(host, h.get('x-forwarded-proto'))
  const url = buildAbsoluteUrl(inputPath, { protocol, host })

  const cookie = h.get('cookie') ?? ''
  const merged = new Headers(init?.headers)
  const hasCookie = merged.get('cookie') != null
  if (!hasCookie && cookie !== '') {
    merged.set('cookie', cookie)
  }

  const finalInit: RequestInit = { ...init, headers: merged }
  if (finalInit.cache === undefined) {
    finalInit.cache = 'no-store'
  }
  return fetch(url, finalInit)
}
