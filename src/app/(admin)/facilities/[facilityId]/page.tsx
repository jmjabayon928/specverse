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

type SystemRow = {
  systemId: number
  systemName: string
  status: string | null
}

type SystemsResponse = {
  items: SystemRow[]
  total: number
}

type Props = {
  params: Promise<{ facilityId: string }>
}

export default function FacilityPage({ params }: Props) {
  const { loading: sessionLoading } = useSession()
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [facility, setFacility] = useState<FacilityRow | null>(null)
  const [systems, setSystems] = useState<SystemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    params.then(p => setFacilityId(p.facilityId))
  }, [params])

  const fetchFacility = useCallback(async () => {
    if (facilityId == null) return
    try {
      const res = await fetch(`/api/backend/facilities/${facilityId}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) {
        const text = await res.text()
        setError(text || `Error ${res.status}`)
        setLoading(false)
        return
      }
      const data: FacilityRow = await res.json()
      setFacility(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load facility')
      setLoading(false)
    }
  }, [facilityId])

  const fetchSystems = useCallback(async () => {
    if (facilityId == null) return
    const params = new URLSearchParams()
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim())
    }
    params.set('take', '50')
    params.set('skip', '0')

    try {
      const res = await fetch(`/api/backend/facilities/${facilityId}/systems?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) {
        const text = await res.text()
        setError(text || `Error ${res.status}`)
        setSystems([])
        setTotal(0)
        return
      }
      const data: SystemsResponse = await res.json()
      setSystems(Array.isArray(data.items) ? data.items : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load systems')
      setSystems([])
      setTotal(0)
    }
  }, [facilityId, searchQuery])

  useEffect(() => {
    if (facilityId == null) return
    setLoading(true)
    setError(null)
    Promise.all([fetchFacility(), fetchSystems()]).finally(() => {
      setLoading(false)
    })
  }, [facilityId, fetchFacility, fetchSystems])

  if (sessionLoading || facilityId == null) {
    return (
      <SecurePage requiredPermission={PERMISSIONS.DASHBOARD_VIEW}>
        <div className="p-6">Loading…</div>
      </SecurePage>
    )
  }

  return (
    <SecurePage requiredPermission={PERMISSIONS.DASHBOARD_VIEW}>
      <PageContextBanner module="facilities" />
      <div className="p-6">
        {loading ? (
          <div className="p-4">Loading facility details…</div>
        ) : error || facility == null ? (
          <div className="p-4 text-red-600">Error: {error || 'Facility not found'}</div>
        ) : (
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/facilities" className="text-blue-600 hover:text-blue-800">
                  Facilities
                </Link>
                <span>/</span>
                <span className="text-gray-900">{facility.facilityName}</span>
              </div>
              <h1 className="text-2xl font-bold">{facility.facilityName}</h1>
              <div className="text-sm text-gray-600 mt-1">
                Facility ID: {facility.facilityId} | Status: {facility.status ?? 'N/A'}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Systems</h2>
              <div className="flex gap-4 items-center">
                <input
                  type="text"
                  placeholder="Search systems..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  {total} {total === 1 ? 'system' : 'systems'}
                </span>
              </div>

              {systems.length === 0 ? (
                <div className="p-4 text-gray-500">No systems found</div>
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
                      {systems.map(system => (
                        <tr key={system.systemId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              href={`/facilities/${facilityId}/systems/${system.systemId}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {system.systemName}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {system.status ?? 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {system.systemId}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SecurePage>
  )
}
