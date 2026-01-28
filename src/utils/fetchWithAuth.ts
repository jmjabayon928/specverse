// src/utils/fetchWithAuth.ts

export type ResponseParseMode = 'json' | 'text' | 'blob' | 'none'

export type FetchWithAuthOptions = RequestInit & {
  parseAs?: ResponseParseMode
}

export const fetchWithAuth = async <T>(
  url: string,
  options: FetchWithAuthOptions = {}
): Promise<T> => {
  const token = localStorage.getItem('token')

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

  // Extract parseAs, keep other options intact
  const { parseAs, ...restTemp } = options
  const { headers: rawHeaders, ...restOptions } = restTemp
  const extraHeaders = toHeaderObject(rawHeaders)

  const parseMode: ResponseParseMode = parseAs ?? 'json'

  const response = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
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
