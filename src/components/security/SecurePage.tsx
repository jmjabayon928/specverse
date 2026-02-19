'use client'

import type React from 'react'
import { useEffect } from 'react'
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
  const { user, loading } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__SECURE_PAGE_PRESENT__ = true
    }
  }, [])

  useEffect(() => {
    if (loading) return

    if (user == null) {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : ''
      router.replace(`/login${next}`)
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

  if (loading) return null
  if (user == null) return null

  return <>{children}</>
}
