import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { UserSession } from '@/domain/auth/sessionTypes'

type UseSessionResult = {
  user: UserSession | null
  loading: boolean
}

export function useSession(): UseSessionResult {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)

  const pathname = usePathname()

  useEffect(() => {
    const isLoginPage = pathname === '/login'
    if (isLoginPage) {
      setLoading(false)
      return
    }

    setLoading(true)
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/backend/auth/session', {
          credentials: 'include',
        })

        // 304 = session unchanged
        if (res.status === 304) {
          return
        }

        if (!res.ok) {
          // Invalid session or expired
          setUser(null)
          return
        }

        const data: UserSession = await res.json()
        setUser(data)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    void fetchSession()
  }, [pathname])

  return { user, loading }
}
