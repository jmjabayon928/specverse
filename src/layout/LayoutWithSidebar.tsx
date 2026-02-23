'use client'

import React, { useMemo, useState, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/context/SidebarContext'
import { useSession } from '@/hooks/useSession'
import AppSidebar from '@/layout/AppSidebar'
import AppHeader from '@/layout/AppHeader'
import Backdrop from '@/layout/Backdrop'
import DevSecurityWarning from '@/components/security/DevSecurityWarning'
import { ReactErrorBoundary } from '@/components/error/ReactErrorBoundary'

export default function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [transitionsEnabled, setTransitionsEnabled] = useState(false)
  const [layoutLocked, setLayoutLocked] = useState(true)
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()
  const { user } = useSession()
  const pathname = usePathname()

  useLayoutEffect(() => {
    setMounted(true)
    // Enable transitions after initial paint to prevent twitching
    requestAnimationFrame(() => {
      setTransitionsEnabled(true)
      // Unlock layout after transitions are enabled
      requestAnimationFrame(() => {
        setLayoutLocked(false)
      })
    })
  }, [])

  const isLoginPage = pathname === '/login'
  const isInviteAcceptPage = pathname.startsWith('/invite/accept')
  const shouldBypassLayout = isLoginPage || isInviteAcceptPage

  // ✅ compute memo BEFORE any return
  const mainContentMargin = useMemo(() => {
    // Lock layout during hydration to prevent twitching
    if (layoutLocked) {
      // During hydration, use stable default (desktop expanded)
      return 'lg:ml-[290px]'
    }
    if (isMobileOpen) return 'ml-0'
    if (isExpanded || isHovered) return 'lg:ml-[290px]'
    return 'lg:ml-[90px]'
  }, [layoutLocked, isExpanded, isHovered, isMobileOpen])

  const route = pathname
  const userId = user?.userId ?? null
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev'

  // ✅ early returns AFTER all hooks
  if (shouldBypassLayout) return <>{children}</>
  
  // Always render full structure to prevent layout shift, but hide until mounted
  // Remove conditional return - always render structure for zero twitch

  return (
    <ReactErrorBoundary route={route} buildId={buildId} userId={userId}>
      <DevSecurityWarning />
      <div 
        className={`
          min-h-screen xl:flex
          ${mounted ? 'opacity-100 visible' : 'opacity-0 invisible'}
        `} 
        suppressHydrationWarning
      >
        <AppSidebar />
        <Backdrop />
        <div 
          className={`
            flex-1
            ${transitionsEnabled ? 'transition-all duration-300 ease-in-out' : ''}
            ${mainContentMargin}
          `}
        >
          <AppHeader />
          <div className="p-4 mx-auto max-w-screen-2xl md:p-6">{children}</div>
        </div>
      </div>
    </ReactErrorBoundary>
  )
}