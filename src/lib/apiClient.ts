export const buildApiPath = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    throw new Error('buildApiPath only supports relative paths under /api/backend')
  }

  let normalized = path

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  if (normalized === '/api/backend' || normalized.startsWith('/api/backend/')) {
    return normalized
  }

  return `/api/backend${normalized}`
}

export const apiFetch = (inputPath: string, init?: RequestInit) => {
  const url = buildApiPath(inputPath)
  return fetch(url, {
    ...init,
    credentials: 'include',
    cache: init?.cache ?? 'no-store',
  })
}

