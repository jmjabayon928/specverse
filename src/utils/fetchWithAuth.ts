// src/utils/fetchWithAuth.ts

import { buildApiPath } from '@/lib/apiClient'

export type ResponseParseMode = 'json' | 'text' | 'blob' | 'none'

export type FetchWithAuthOptions = RequestInit & {
  parseAs?: ResponseParseMode
}

const toHeaderObject = (
  headers: HeadersInit | undefined
): Record<string, string> => {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }

  if (headers) {
    return headers
  }

  return {}
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const hasHeader = (headers: HeadersInit | undefined, nameLower: string): boolean => {
  if (!headers) return false

  if (headers instanceof Headers) {
    for (const [key] of headers.entries()) {
      if (key.toLowerCase() === nameLower) return true
    }
    return false
  }

  if (Array.isArray(headers)) {
    for (const [key] of headers) {
      if (key.toLowerCase() === nameLower) return true
    }
    return false
  }

  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === nameLower) return true
  }

  return false
}

const shouldSetJsonContentType = (
  method: string,
  body: BodyInit | null | undefined,
  rawHeaders: HeadersInit | undefined
): boolean => {
  const upperMethod = method.toUpperCase()
  if (upperMethod === 'GET' || upperMethod === 'HEAD') return false
  if (body == null) return false

  if (typeof FormData !== 'undefined' && body instanceof FormData) return false
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false
  if (body instanceof ArrayBuffer) return false
  if (ArrayBuffer.isView(body)) return false
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return false
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return false

  if (hasHeader(rawHeaders, 'content-type')) return false

  if (isPlainObject(body)) return true

  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      return true
    }
  }

  return false
}

export const fetchWithAuth = async <T>(
  path: string,
  options: FetchWithAuthOptions = {}
): Promise<T> => {
  const { parseAs, ...restTemp } = options
  const { headers: rawHeaders, ...restOptions } = restTemp
  const extraHeaders = toHeaderObject(rawHeaders)

  const parseMode: ResponseParseMode = parseAs ?? 'json'

  const url = buildApiPath(path)

  const method = (restOptions.method ?? 'GET').toUpperCase()
  const body = restOptions.body ?? null

  const headers: Record<string, string> = {
    ...extraHeaders,
  }

  if (shouldSetJsonContentType(method, body, rawHeaders) && !hasHeader(extraHeaders, 'content-type')) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    ...restOptions,
    credentials: 'include',
    headers,
  })

  if (!response.ok) {
    const body = await response.text()
    const status = `${response.status} ${response.statusText || ''}`.trim()
    const snippet =
      body.length > 200 ? `${body.slice(0, 197)}...` : body

    throw new Error(
      snippet.length > 0
        ? `Request failed: ${status} – ${snippet}`
        : `Request failed: ${status}`
    )
  }

  if (parseMode === 'blob') {
    return (await response.blob()) as T
  }

  if (parseMode === 'none') {
    return undefined as T
  }

  const text = await response.text()

  if (parseMode === 'text') {
    return text as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid JSON: ${text}`)
  }
}

