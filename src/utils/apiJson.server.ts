import 'server-only'

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

type ApiJsonOptions = {
  cache?: RequestCache
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
}

/**
 * Server-side API fetch helper for same-origin calls to /api/backend/*.
 * - Automatically forwards incoming cookies
 * - Builds absolute URL from request headers
 * - 404 => notFound()
 * - Non-JSON / invalid JSON => throws with a snippet for easier debugging
 */
export async function apiJson<T>(path: string, options?: ApiJsonOptions): Promise<T> {
  const hdrs = await headers()

  const cookieHeader = hdrs.get('cookie') ?? ''
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'

  const fullUrl = path.startsWith('http') ? path : `${proto}://${host}${path}`

  const reqId =
    hdrs.get('x-request-id') ??
    hdrs.get('request-id') ??
    null

  const res = await fetch(fullUrl, {
    method: options?.method ?? 'GET',
    cache: options?.cache ?? 'no-store',
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(options?.headers ?? {}),
      ...(options?.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options?.body,
  })

  if (res.status === 404) {
    // Standard SSR behavior: surface Next.js 404 page
    notFound()
  }

  if (!res.ok) {
    const snippet = await safeTextSnippet(res)
    const suffix = reqId ? ` [requestId: ${reqId}]` : ''
    throw new Error(`API error ${res.status} from ${path}${suffix}: ${snippet}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const snippet = await safeTextSnippet(res)
    const suffix = reqId ? ` [requestId: ${reqId}]` : ''
    throw new Error(`API error 200 from ${path}${suffix}: Non-JSON response: ${snippet}`)
  }

  const cloned = res.clone()
  try {
    const json = (await res.json()) as unknown
    return json as T
  } catch {
    const snippet = await safeTextSnippet(cloned)
    const suffix = reqId ? ` [requestId: ${reqId}]` : ''
    throw new Error(`API error 200 from ${path}${suffix}: Invalid JSON: ${snippet}`)
  }
}

async function safeTextSnippet(res: Response): Promise<string> {
  try {
    const text = await res.text()
    return text.length > 300 ? `${text.slice(0, 300)}…` : text
  } catch {
    return '[unable to read response body]'
  }
}