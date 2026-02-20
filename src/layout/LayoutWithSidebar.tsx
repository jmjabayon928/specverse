// src/layout/LayoutWithSidebar.tsx
'use client'

import React, { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import AppSidebar from '@/layout/AppSidebar'
import AppHeader from '@/layout/AppHeader'
import Backdrop from '@/layout/Backdrop'
import { useSidebar } from '@/context/SidebarContext'
import { useSession } from '@/hooks/useSession'
import DevSecurityWarning from '@/components/security/DevSecurityWarning'

export default function LayoutWithSidebar({
  children,
}: {
  children: React.ReactNode
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()
  const { user, loading } = useSession()
  const pathname = usePathname()

  const isLoginPage = pathname === '/login'
  const isInviteAcceptPage = pathname.startsWith('/invite/accept')

  const shouldBypassLayout = isLoginPage || isInviteAcceptPage

  const mainContentMargin = useMemo(() => {
    if (isMobileOpen) return 'ml-0'
    if (isExpanded || isHovered) return 'lg:ml-[290px]'
    return 'lg:ml-[90px]'
  }, [isExpanded, isHovered, isMobileOpen])

  // Server-side requireAuth() handles auth redirects - do not redirect here

  // Keep login/invite pages render exactly as-is (no sidebar/header)
  if (shouldBypassLayout) {
    return <>{children}</>
  }

  // While we’re resolving auth, render children to avoid hydration mismatch,
  // but DO NOT mount the sidebar layout until we know auth state.
  if (loading) {
    return <>{children}</>
  }

  // If user is missing, let the effect redirect. Avoid rendering the full app shell.
  if (!user) {
    return <>{children}</>
  }

  return (
    <>
      <DevSecurityWarning />
      <div className="min-h-screen xl:flex">
        <AppSidebar />
        <Backdrop />
        <div
          className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
        >
          <AppHeader />
          <div className="p-4 mx-auto max-w-screen-2xl md:p-6">{children}</div>
        </div>
      </div>
    </>
  )
}