'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from '@/hooks/useSession'
import { PERMISSIONS } from '@/constants/permissions'
import SecurePage from '@/components/security/SecurePage'
import PageContextBanner from '@/components/demo/PageContextBanner'

type FacilityRow = {
  facilityId: number
  facilityName: string
  status: string | null
}

type FacilitiesResponse = {
  items: FacilityRow[]
  total: number
}

export default function FacilitiesPage() {
  const { loading: sessionLoading } = useSession()
  const [facilities, setFacilities] = useState<FacilityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [total, setTotal] = useState(0)

  const fetchFacilities = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim())
    }
    params.set('take', '50')
    params.set('skip', '0')

    try {
      const res = await fetch(`/api/backend/facilities?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) {
        const text = await res.text()
        setError(text || `Error ${res.status}`)
        setFacilities([])
        setTotal(0)
        setLoading(false)
        return
      }
      const data: FacilitiesResponse = await res.json()
      setFacilities(Array.isArray(data.items) ? data.items : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load facilities')
      setFacilities([])
      setTotal(0)
      setLoading(false)
    }
  }, [searchQuery])

  useEffect(() => {
    fetchFacilities()
  }, [fetchFacilities])

  if (sessionLoading) {
    return (
      <SecurePage requiredPermission={PERMISSIONS.DASHBOARD_VIEW}>
        <div className="p-6">Loading…</div>
      </SecurePage>
    )
  }

  return (
    <SecurePage requiredPermission={PERMISSIONS.DASHBOARD_VIEW}>
      <PageContextBanner module="facilities" />
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Facilities (Pilot)</h1>

        {loading ? (
          <div className="p-4">Loading facilities…</div>
        ) : error ? (
          <div className="p-4 text-red-600">Error: {error}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Search facilities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                {total} {total === 1 ? 'facility' : 'facilities'}
              </span>
            </div>

            {facilities.length === 0 ? (
              <div className="p-4 text-gray-500">No facilities found</div>
            ) : (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {facilities.map(facility => (
                      <tr key={facility.facilityId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/facilities/${facility.facilityId}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {facility.facilityName}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {facility.status ?? 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {facility.facilityId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </SecurePage>
  )
}
