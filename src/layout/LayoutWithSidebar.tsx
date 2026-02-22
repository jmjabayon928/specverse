'use client'

import React, { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import { useSession } from '@/hooks/useSession'
import AppSidebar from '@/layout/AppSidebar'
import AppHeader from '@/layout/AppHeader'
import Backdrop from '@/layout/Backdrop'
import DevSecurityWarning from '@/components/security/DevSecurityWarning'
import { ReactErrorBoundary } from '@/components/error/ReactErrorBoundary'

export default function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()
  const { user, loading } = useSession()
  const pathname = usePathname()

  const isLoginPage = pathname === '/login'
  const isInviteAcceptPage = pathname.startsWith('/invite/accept')
  const shouldBypassLayout = isLoginPage || isInviteAcceptPage

  // ✅ compute memo BEFORE any return
  const mainContentMargin = useMemo(() => {
    if (isMobileOpen) return 'ml-0'
    if (isExpanded || isHovered) return 'lg:ml-[290px]'
    return 'lg:ml-[90px]'
  }, [isExpanded, isHovered, isMobileOpen])

  const route = pathname
  const userId = user?.userId ?? null
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev'

  // ✅ early returns AFTER all hooks
  if (shouldBypassLayout) return <>{children}</>
  if (loading) return <>{children}</>
  if (!user) return <>{children}</>

  return (
    <ReactErrorBoundary route={route} buildId={buildId} userId={userId}>
      <DevSecurityWarning />
      <div className="min-h-screen xl:flex">
        <AppSidebar />
        <Backdrop />
        <div className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}>
          <AppHeader />
          <div className="p-4 mx-auto max-w-screen-2xl md:p-6">{children}</div>
        </div>
      </div>
    </ReactErrorBoundary>
  )
}