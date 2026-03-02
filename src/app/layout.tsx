// src/app/layout.tsx
import { Outfit } from 'next/font/google'
import { cookies, headers } from 'next/headers'
import './globals.css'

import { SidebarProvider } from '@/context/SidebarContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { Toaster } from 'react-hot-toast'
import LayoutWithSidebar from '@/layout/LayoutWithSidebar'
import { ClientBootLogger } from '@/components/error/ClientBootLogger'

const outfit = Outfit({
  subsets: ['latin']
})

async function checkSession(): Promise<{ authenticated: boolean }> {
  const cookieStore = await cookies()
  const sid = cookieStore.get('sid')?.value
  if (!sid) {
    return { authenticated: false }
  }

  try {
    const hdrs = await headers()
    const cookieHeader = hdrs.get('cookie') ?? ''
    const proto = hdrs.get('x-forwarded-proto') ?? 'http'
    const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
    const sessionUrl = `${proto}://${host}/api/backend/auth/session`

    const res = await fetch(sessionUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })

    if (res.status === 200) {
      return { authenticated: true }
    }
    return { authenticated: false }
  } catch {
    return { authenticated: false }
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get('theme')
  const initialTheme = themeCookie?.value === 'dark' ? 'dark' : 'light'

  const { authenticated } = await checkSession()

  return (
    <html lang='en' className={initialTheme === 'dark' ? 'dark' : ''}>
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ClientBootLogger />
        <ThemeProvider initialTheme={initialTheme}>
          {authenticated ? (
            <SidebarProvider>
              <LayoutWithSidebar>{children}</LayoutWithSidebar>
              <Toaster
                position='top-right'
                toastOptions={{
                  className: 'z-[9999]'
                }}
              />
            </SidebarProvider>
          ) : (
            <>
              {children}
              <Toaster
                position='top-right'
                toastOptions={{
                  className: 'z-[9999]'
                }}
              />
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  )
}