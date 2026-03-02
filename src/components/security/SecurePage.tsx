'use client'

import type React from 'react'
import { useEffect } from 'react'
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__SECURE_PAGE_PRESENT__ = true
    }
  }, [])

  if (loading) {
    return (
      <div aria-busy="true" className="py-8">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    )
  }

  if (user == null) {
    return (
      <div className="py-8">
        <div className="text-sm text-gray-700 dark:text-gray-300">Authentication required.</div>
      </div>
    )
  }

  if (requiredRole != null && requiredRole !== '') {
    const userRoleLower = user.role?.toLowerCase() ?? ''
    const requiredRoleLower = requiredRole.toLowerCase()
    if (userRoleLower !== requiredRoleLower) {
      return (
        <div className="py-8">
          <div className="text-sm text-gray-700 dark:text-gray-300">Unauthorized: role required.</div>
        </div>
      )
    }
  }

  if (requiredPermission != null && requiredPermission !== '') {
    const hasPermission = user.permissions.includes(requiredPermission)
    if (!hasPermission && user.role?.toLowerCase() !== 'admin') {
      return (
        <div className="py-8">
          <div className="text-sm text-gray-700 dark:text-gray-300">Unauthorized: insufficient permission.</div>
        </div>
      )
    }
  }

  return <>{children}</>
}
