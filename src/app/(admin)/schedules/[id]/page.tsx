'use client'

import { useParams } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { PERMISSIONS } from '@/constants/permissions'
import SecurePage from '@/components/security/SecurePage'
import ScheduleEditor, { type ScheduleDetail } from '@/components/schedules/ScheduleEditor'
import Link from 'next/link'

export default function ScheduleDetailPage() {
  const params = useParams()
  const { loading } = useSession()
  const id = typeof params?.id === 'string' ? params.id : null
  const scheduleId = id != null ? Number.parseInt(id, 10) : NaN

  const fetchDetail = async (sid: number): Promise<ScheduleDetail | null> => {
    const res = await fetch(`/api/backend/schedules/${sid}`, { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return data as ScheduleDetail
  }

  if (loading) {
    return (
      <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
        <div className="p-6">Loading…</div>
      </SecurePage>
    )
  }

  if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
    return (
      <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
        <div className="p-6 text-red-600">Invalid schedule ID</div>
      </SecurePage>
    )
  }

  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/schedules" className="text-blue-600 underline">
            ← Schedules
          </Link>
        </div>
        <ScheduleEditor
          scheduleId={scheduleId}
          initialDetail={null}
          fetchDetail={fetchDetail}
        />
      </div>
    </SecurePage>
  )
}
