'use client'

import { useState, useEffect, useCallback } from 'react'

type Props = {
  assetId: number
}

interface ActivityLogRow {
  logId: number
  action: string | null
  performedByUserId: number
  performedAt: string | null
  route: string | null
  method: string | null
  statusCode: number | null
  changes: string | null
}

interface ActivityResponse {
  rows: ActivityLogRow[]
  nextCursor: { performedAt: string; logId: number } | null
}

export default function AssetActivityPanel({ assetId }: Props) {
  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<{ performedAt: string; logId: number } | null>(null)

  const loadActivity = useCallback(
    async (cursor?: { performedAt: string; logId: number }) => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set('limit', '50')
        if (cursor) {
          params.set('cursorPerformedAt', cursor.performedAt)
          params.set('cursorLogId', String(cursor.logId))
        }

        const res = await fetch(`/api/backend/assets/${assetId}/activity?${params.toString()}`, {
          credentials: 'include',
        })

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Failed to load activity (${res.status}): ${errorText}`)
        }

        const data = (await res.json()) as ActivityResponse

        if (cursor) {
          // Append for load more
          setRows(prev => [...prev, ...data.rows])
        } else {
          // Replace for initial load
          setRows(data.rows)
        }

        setNextCursor(data.nextCursor)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load activity'
        setError(message)
        setRows([])
      } finally {
        setLoading(false)
      }
    },
    [assetId]
  )

  useEffect(() => {
    loadActivity()
  }, [loadActivity])

  const handleLoadMore = () => {
    if (nextCursor) {
      loadActivity(nextCursor)
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="border rounded p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Activity</h2>
        <p className="text-sm text-gray-600">Loading activity...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Activity</h2>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="border rounded p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Activity</h2>
        <p className="text-sm text-gray-600">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="border rounded p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Activity</h2>
      <div className="space-y-3">
        {rows.map(row => (
          <div key={row.logId} className="border-b border-gray-100 pb-3 last:border-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {row.action || '(no action)'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {row.method && row.route && (
                    <span>
                      {row.method} {row.route}
                      {row.statusCode && <span className="ml-1">({row.statusCode})</span>}
                    </span>
                  )}
                </div>
                {row.performedAt && (
                  <div className="text-xs text-gray-500 mt-1">{row.performedAt}</div>
                )}
              </div>
              <div className="text-xs text-gray-500">User #{row.performedByUserId}</div>
            </div>
          </div>
        ))}
      </div>
      {nextCursor && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
