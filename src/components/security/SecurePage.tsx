'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'

interface SecurePageProps {
  requiredPermission?: string
  requiredRole?: string
  children: React.ReactNode
}

export default function SecurePage({
  requiredPermission,
  requiredRole,
  children,
}: SecurePageProps) {
  const [mounted, setMounted] = useState(false)
  const { user, loading } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__SECURE_PAGE_PRESENT__ = true
    }
  }, [])

  useEffect(() => {
    if (loading) return
    // Server-side requireAuth() handles auth redirects - do not redirect here
    if (user == null) {
      return
    }

    if (requiredRole != null && requiredRole !== '') {
      const userRoleLower = user.role?.toLowerCase() ?? ''
      const requiredRoleLower = requiredRole.toLowerCase()
      if (userRoleLower !== requiredRoleLower) {
        router.replace('/unauthorized')
      }
      return
    }

    if (requiredPermission != null && requiredPermission !== '') {
      const hasPermission = user.permissions.includes(requiredPermission)
      if (!hasPermission && user.role?.toLowerCase() !== 'admin') {
        router.replace('/unauthorized')
      }
    }
  }, [user, loading, requiredPermission, requiredRole, router, pathname])

  // During SSR/hydration, return consistent placeholder to prevent hydration mismatch
  if (!mounted) return <div suppressHydrationWarning />
  
  if (loading) return null
  if (user == null) return null

  return <div suppressHydrationWarning>{children}</div>
}
