'use client'

import React, { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import { useSession } from '@/hooks/useSession'
import AppSidebar from '@/layout/AppSidebar'
import AppHeader from '@/layout/AppHeader'
import Backdrop from '@/layout/Backdrop'
import DevSecurityWarning from '@/components/security/DevSecurityWarning'

export default function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
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

  if (shouldBypassLayout) return <>{children}</>

  const shouldShowShell = true
  const shouldShowProtectedContent = loading === false && user != null

  if (!shouldShowShell) return <>{children}</>

  return (
    <>
      <DevSecurityWarning />
      <div className="min-h-screen xl:flex">
        <AppSidebar />
        <Backdrop />
        <div className={`flex-1 ${mainContentMargin}`}>
          <AppHeader />
          <div className="p-4 mx-auto max-w-screen-2xl md:p-6">
            {shouldShowProtectedContent ? (
              children
            ) : (
              <div aria-busy="true" className="py-8">
                <div className="text-sm text-gray-500">Loading…</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}