// Server-only: uses next/headers via backendFetch; .server.ts suffix prevents client bundling
import 'server-only'
import { notFound } from 'next/navigation'
import { backendFetch } from './backendFetch.server'

export interface ApiJsonOptions<T> {
  /**
   * If true, calls notFound() when response status is 404.
   * Default: true
   */
  notFoundOn404?: boolean
  /**
   * Type guard to assert payload shape. If provided and fails, throws Error.
   */
  assert?: (value: unknown) => value is T
  /**
   * Custom error message when assertion fails. Default: `Bad API payload from ${path}`
   */
  badPayloadMessage?: string
}

/**
 * Fetches JSON from a backend API endpoint with standardized error handling.
 * 
 * @param path - API endpoint path (e.g., '/api/backend/inventory/123')
 * @param init - RequestInit passed to backendFetch (must include cache: 'no-store')
 * @param opts - Options for error handling and payload validation
 * @returns Parsed JSON response, typed as T
 * @throws Error with endpoint path, status code, response text (first 300 chars), and requestId if present
 */
export async function apiJson<T>(
  path: string,
  init: RequestInit,
  opts: ApiJsonOptions<T> = {}
): Promise<T> {
  const { notFoundOn404 = true, assert, badPayloadMessage } = opts

  const res = await backendFetch(path, init)

  if (res.status === 404 && notFoundOn404) {
    notFound()
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const requestId = res.headers.get('x-request-id') ?? res.headers.get('request-id') ?? null
    const requestIdPart = requestId ? ` [requestId: ${requestId}]` : ''
    throw new Error(`API error ${res.status} from ${path}${requestIdPart}: ${text.slice(0, 300)}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '')
    const requestId = res.headers.get('x-request-id') ?? res.headers.get('request-id') ?? null
    const requestIdPart = requestId ? ` [requestId: ${requestId}]` : ''
    const snippet = text.slice(0, 300)
    throw new Error(`API error ${res.status} from ${path}${requestIdPart}: Non-JSON response: ${snippet}`)
  }

  const resClone = res.clone()
  let json: unknown
  try {
    json = await res.json()
  } catch {
    const text = await resClone.text().catch(() => '')
    const requestId = res.headers.get('x-request-id') ?? res.headers.get('request-id') ?? null
    const requestIdPart = requestId ? ` [requestId: ${requestId}]` : ''
    const snippet = text.slice(0, 300)
    throw new Error(`API error ${res.status} from ${path}${requestIdPart}: Invalid JSON: ${snippet}`)
  }

  if (assert && !assert(json)) {
    throw new Error(badPayloadMessage ?? `Bad API payload from ${path}`)
  }

  return json as T
}
