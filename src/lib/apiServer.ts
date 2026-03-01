export const buildServerApiPath = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    throw new Error('buildServerApiPath only supports relative paths under /api/backend')
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

export const serverApiFetch = (path: string, init?: RequestInit) => {
  const url = buildServerApiPath(path)
  return fetch(url, {
    ...init,
    credentials: 'include',
    cache: init?.cache ?? 'no-store',
  })
}

