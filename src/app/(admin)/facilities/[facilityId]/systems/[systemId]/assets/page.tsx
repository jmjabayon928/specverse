'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSession } from '@/hooks/useSession'
import { PERMISSIONS } from '@/constants/permissions'
import SecurePage from '@/components/security/SecurePage'
import PageContextBanner from '@/components/demo/PageContextBanner'

type SystemAssetRow = {
  assetId: number
  assetTag: string
  assetName: string | null
  location: string | null
  status: string
}

type SystemDetail = {
  systemId: number
  systemName: string
  facilityId: number
  status: string | null
}

type FacilityRow = {
  facilityId: number
  facilityName: string
  status: string | null
}

type AssetsResponse = {
  items: SystemAssetRow[]
  total: number
}

type Props = {
  params: Promise<{ facilityId: string; systemId: string }>
}

export default function SystemAssetsPage({ params }: Props) {
  const { loading: sessionLoading } = useSession()
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [systemId, setSystemId] = useState<string | null>(null)
  const [facility, setFacility] = useState<FacilityRow | null>(null)
  const [system, setSystem] = useState<SystemDetail | null>(null)
  const [assets, setAssets] = useState<SystemAssetRow[]>([])
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    params.then(p => {
      setFacilityId(p.facilityId)
      setSystemId(p.systemId)
    })
  }, [params])

  const fetchData = useCallback(async () => {
    if (facilityId == null || systemId == null) return

    // Abort previous fetch if still in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this fetch
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setError(null)
    try {
      // Fetch facility
      const facilityRes = await fetch(`/api/backend/facilities/${facilityId}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: abortController.signal,
      })
      if (!facilityRes.ok) {
        if (abortController.signal.aborted) return
        setError(`Failed to load facility: ${facilityRes.status}`)
        setLoading(false)
        return
      }
      const facilityData: FacilityRow = await facilityRes.json()
      if (abortController.signal.aborted) return
      setFacility(facilityData)

      // Fetch system
      const systemRes = await fetch(`/api/backend/facilities/${facilityId}/systems/${systemId}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: abortController.signal,
      })
      if (!systemRes.ok) {
        if (abortController.signal.aborted) return
        setError(`Failed to load system: ${systemRes.status}`)
        setLoading(false)
        return
      }
      const systemData: SystemDetail = await systemRes.json()
      if (abortController.signal.aborted) return
      setSystem(systemData)

      // Fetch assets
      const params = new URLSearchParams()
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim())
      }
      params.set('take', '50')
      params.set('skip', '0')

      const assetsRes = await fetch(
        `/api/backend/facilities/${facilityId}/systems/${systemId}/assets?${params.toString()}`,
        {
          credentials: 'include',
          cache: 'no-store',
          signal: abortController.signal,
        }
      )
      if (abortController.signal.aborted) return
      if (!assetsRes.ok) {
        const text = await assetsRes.text()
        setError(text || `Error ${assetsRes.status}`)
        setLoading(false)
        return
      }
      const assetsData: AssetsResponse = await assetsRes.json()
      setAssets(assetsData.items)
      setTotal(assetsData.total)
      setLoading(false)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Fetch was aborted, ignore error
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to load data')
      setLoading(false)
    }
  }, [facilityId, systemId, searchQuery])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (sessionLoading || facilityId == null || systemId == null) {
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
          <div className="p-4">Loading assets…</div>
        ) : error ? (
          <div className="p-4 text-red-600">Error: {error}</div>
        ) : (
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/facilities" className="text-blue-600 hover:text-blue-800">
                  Facilities
                </Link>
                <span>/</span>
                <Link
                  href={`/facilities/${facilityId}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {facility?.facilityName ?? `Facility ${facilityId}`}
                </Link>
                <span>/</span>
                <Link
                  href={`/facilities/${facilityId}/systems/${systemId}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {system?.systemName ?? `System ${systemId}`}
                </Link>
                <span>/</span>
                <span className="text-gray-900">Assets</span>
              </div>
              <h1 className="text-2xl font-bold">Assets</h1>
              <div className="text-sm text-gray-600 mt-1">
                System: {system?.systemName ?? `System ${systemId}`}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 items-center">
                <input
                  type="text"
                  placeholder="Search assets by tag or name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  {total} {total === 1 ? 'asset' : 'assets'}
                </span>
              </div>

              {assets.length === 0 ? (
                <div className="p-4 text-gray-500">No assets found</div>
              ) : (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tag
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {assets.map(asset => (
                        <tr key={asset.assetId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              href={`/assets/${asset.assetId}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {asset.assetTag}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {asset.assetName ?? '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {asset.location ?? '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {asset.status}
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
