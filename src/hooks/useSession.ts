import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { UserSession } from '@/domain/auth/sessionTypes'

type UseSessionResult = {
  user: UserSession | null
  loading: boolean
  refetchSession: () => Promise<void>
}

export function useSession(): UseSessionResult {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const refetchIdRef = useRef(0)

  const fetchSessionInternal = useCallback(async (ignoreStale: boolean): Promise<void> => {
    const id = ignoreStale ? ++refetchIdRef.current : 0
    try {
      const res = await fetch('/api/backend/auth/session', {
        credentials: 'include',
      })

      if (ignoreStale && id !== refetchIdRef.current) return

      // 304 = session unchanged
      if (res.status === 304) {
        if (!ignoreStale || id === refetchIdRef.current) setLoading(false)
        return
      }

      if (!res.ok) {
        if (!ignoreStale || id === refetchIdRef.current) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      const data: UserSession = await res.json()
      if (ignoreStale && id !== refetchIdRef.current) return

      if (!Array.isArray(data.permissions)) {
        data.permissions = []
      }
      setUser(data)
    } catch {
      if (!ignoreStale || id === refetchIdRef.current) {
        setUser(null)
        setLoading(false)
      }
    } finally {
      if (!ignoreStale || id === refetchIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const refetchSession = useCallback(async () => {
    setLoading(true)
    await fetchSessionInternal(true)
  }, [fetchSessionInternal])

  useEffect(() => {
    const isLoginPage = pathname === '/login'
    if (isLoginPage) {
      setLoading(false)
      return
    }

    setLoading(true)
    void fetchSessionInternal(false)
  }, [pathname, fetchSessionInternal])

  return { user, loading, refetchSession }
}
