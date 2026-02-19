'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
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
  const router = useRouter()

  const isLoginPage = pathname === '/login'
  const isInviteAcceptPage = pathname.startsWith('/invite/accept')
  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
    ? 'lg:ml-[290px]'
    : 'lg:ml-[90px]'

  // Redirect to login if user is missing
  useEffect(() => {
    const delayRedirect = async () => {
      await new Promise((res) => setTimeout(res, 150)) // wait 150ms
      if (!loading && !user && !isLoginPage && !isInviteAcceptPage) {
        router.push('/login')
      }
    }

    delayRedirect()
  }, [loading, user, isLoginPage, isInviteAcceptPage, router])

  // Show raw children for login page, invite accept page, or loading state
  // This matches the SSR/first-hydration render and avoids tree mismatch.
  if (isLoginPage || isInviteAcceptPage || loading) {
    return <>{children}</>
  }

  // IMPORTANT:
  // Do NOT return null when user is missing. Let the effect redirect instead.
  // Returning null here can cause hydration/reconciliation issues in production.
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
