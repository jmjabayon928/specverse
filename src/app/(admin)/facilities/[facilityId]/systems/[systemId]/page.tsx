'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from '@/hooks/useSession'
import { PERMISSIONS } from '@/constants/permissions'
import SecurePage from '@/components/security/SecurePage'
import PageContextBanner from '@/components/demo/PageContextBanner'

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

type SystemAssetRow = {
  assetId: number
  assetTag: string
  assetName: string | null
  location: string | null
  status: string
}

type AssetsResponse = {
  items: SystemAssetRow[]
  total: number
}

type Props = {
  params: Promise<{ facilityId: string; systemId: string }>
}

export default function SystemPage({ params }: Props) {
  const { loading: sessionLoading } = useSession()
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [systemId, setSystemId] = useState<string | null>(null)
  const [system, setSystem] = useState<SystemDetail | null>(null)
  const [facility, setFacility] = useState<FacilityRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<SystemAssetRow[]>([])
  const [assetTotal, setAssetTotal] = useState(0)
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsError, setAssetsError] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => {
      setFacilityId(p.facilityId)
      setSystemId(p.systemId)
    })
  }, [params])

  const fetchSystem = useCallback(async () => {
    if (facilityId == null || systemId == null) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/backend/facilities/${facilityId}/systems/${systemId}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) {
        const text = await res.text()
        setError(text || `Error ${res.status}`)
        setLoading(false)
        return
      }
      const data: SystemDetail = await res.json()
      setSystem(data)

      // Fetch facility name for breadcrumb
      const facilityRes = await fetch(`/api/backend/facilities/${facilityId}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (facilityRes.ok) {
        const facilityData: FacilityRow = await facilityRes.json()
        setFacility(facilityData)
      }
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system')
      setLoading(false)
    }
  }, [facilityId, systemId])

  useEffect(() => {
    fetchSystem()
  }, [fetchSystem])

  const fetchAssets = useCallback(async () => {
    if (facilityId == null || systemId == null) return
    setAssetsLoading(true)
    setAssetsError(null)
    try {
      const res = await fetch(
        `/api/backend/facilities/${facilityId}/systems/${systemId}/assets?take=5&skip=0`,
        {
          credentials: 'include',
          cache: 'no-store',
        }
      )
      if (!res.ok) {
        setAssetsError('Unable to load asset preview.')
        setAssetsLoading(false)
        return
      }
      const data: AssetsResponse = await res.json()
      setAssets(data.items)
      setAssetTotal(data.total)
      setAssetsLoading(false)
    } catch {
      setAssetsError('Unable to load asset preview.')
      setAssetsLoading(false)
    }
  }, [facilityId, systemId])

  useEffect(() => {
    if (system != null) {
      fetchAssets()
    }
  }, [system, fetchAssets])

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
          <div className="p-4">Loading system details…</div>
        ) : error || system == null ? (
          <div className="p-4 text-red-600">Error: {error || 'System not found'}</div>
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
                <span className="text-gray-900">{system.systemName}</span>
              </div>
              <h1 className="text-2xl font-bold">{system.systemName}</h1>
              <div className="text-sm text-gray-600 mt-1">
                System ID: {system.systemId} | Facility ID: {system.facilityId} | Status: {system.status ?? 'N/A'}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Details</h2>
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-600">
                  Additional system details and related content will be available here in future updates.
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold mb-3">Related Content</h3>
                
                {/* Assets Preview */}
                <div className="mb-6 p-4 border border-gray-200 rounded-md bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Assets</h4>
                      {assetsLoading ? (
                        <div className="text-sm text-gray-500 mt-1">Loading assets...</div>
                      ) : assetsError ? (
                        <div className="text-sm text-gray-500 mt-1">{assetsError}</div>
                      ) : (
                        <div className="text-sm text-gray-600 mt-1">
                          {assetTotal} {assetTotal === 1 ? 'asset' : 'assets'}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/facilities/${facilityId}/systems/${systemId}/assets`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View all assets →
                    </Link>
                  </div>
                  
                  {assetsLoading ? (
                    <div className="text-sm text-gray-500 py-2">Loading...</div>
                  ) : assetsError ? (
                    <div className="text-sm text-gray-500 py-2">{assetsError}</div>
                  ) : assets.length === 0 ? (
                    <div className="text-sm text-gray-500 py-2">No assets found</div>
                  ) : (
                    <div className="border-t border-gray-100 pt-3">
                      <div className="space-y-2">
                        {assets.map(asset => (
                          <div
                            key={asset.assetId}
                            className="flex items-center justify-between py-2 border-b border-gray-50 last:border-b-0"
                          >
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/assets/${asset.assetId}`}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                {asset.assetTag}
                              </Link>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {asset.assetName && (
                                  <span className="mr-2">{asset.assetName}</span>
                                )}
                                {asset.location && (
                                  <span className="mr-2">• {asset.location}</span>
                                )}
                                <span>• {asset.status}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Other Related Content Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                    <div className="font-medium text-gray-700">Checklists</div>
                    <div className="text-sm text-gray-500 mt-1">Coming soon</div>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                    <div className="font-medium text-gray-700">Schedules</div>
                    <div className="text-sm text-gray-500 mt-1">Coming soon</div>
                  </div>
                  <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                    <div className="font-medium text-gray-700">Activity</div>
                    <div className="text-sm text-gray-500 mt-1">Coming soon</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SecurePage>
  )
}
