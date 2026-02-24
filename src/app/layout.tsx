// src/app/layout.tsx
import { Outfit } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'

import { SidebarProvider } from '@/context/SidebarContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { Toaster } from 'react-hot-toast'
import LayoutWithSidebar from '@/layout/LayoutWithSidebar'
import { ClientBootLogger } from '@/components/error/ClientBootLogger'

const outfit = Outfit({
  subsets: ['latin']
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get('theme')
  const initialTheme = themeCookie?.value === 'dark' ? 'dark' : 'light'

  return (
    <html lang='en' className={initialTheme === 'dark' ? 'dark' : ''}>
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ClientBootLogger />
        <ThemeProvider initialTheme={initialTheme}>
          <SidebarProvider>
            <LayoutWithSidebar>{children}</LayoutWithSidebar>
            <Toaster
              position='top-right'
              toastOptions={{
                className: 'z-[9999]'
              }}
            />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}