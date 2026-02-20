import type { ReactNode } from 'react'
import { requireAuth } from '@/utils/sessionUtils.server'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAuth()
  return <>{children}</>
}
