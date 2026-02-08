'use client'

import { useSession } from '@/hooks/useSession'
import { PERMISSIONS } from '@/constants/permissions'
import SecurePage from '@/components/security/SecurePage'
import SchedulesList from '@/components/schedules/SchedulesList'

export default function SchedulesPage() {
  const { loading } = useSession()

  if (loading) {
    return (
      <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
        <div className="p-6">Loading…</div>
      </SecurePage>
    )
  }

  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Equipment Schedules</h1>
        <SchedulesList />
      </div>
    </SecurePage>
  )
}
