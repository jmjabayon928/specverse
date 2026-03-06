'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { ChecklistRunSummary } from '@/domain/checklists/checklistTypes'

type Props = {
  assetId: number
}

interface ChecklistRunsResponse {
  items: ChecklistRunSummary[]
  total: number
  page: number
  pageSize: number
}

const FALLBACK = '—'

/**
 * Formats a timestamp string for display.
 * - null/empty -> "—"
 * - ISO-8601 date strings (e.g., "2026-03-05T12:34:56.000Z") -> parsed and formatted
 * - Other values -> original string
 */
function formatTimestamp(value: string | null): string {
  if (value == null || value.trim() === '') return FALLBACK

  // Only parse ISO-8601-like date strings (e.g., "2026-03-05T12:34:56.000Z")
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    try {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return new Intl.DateTimeFormat().format(date)
      }
    } catch {
      // Fall through to string return
    }
  }

  return value
}

export default function AssetChecklistsPanel({ assetId }: Props) {
  const [runs, setRuns] = useState<ChecklistRunSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadChecklists = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('pageSize', '10')

      const res = await fetch(`/api/backend/assets/${assetId}/checklists?${params.toString()}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Failed to load checklists (${res.status}): ${errorText}`)
      }

      const data = (await res.json()) as ChecklistRunsResponse
      setRuns(data.items)
      setTotal(data.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load checklists'
      setError(message)
      setRuns([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    loadChecklists()
  }, [loadChecklists])

  if (loading) {
    return (
      <div className="border rounded p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Checklists</h2>
        <p className="text-sm text-gray-600">Loading checklists...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Checklists</h2>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="border rounded p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Checklists</h2>
        <p className="text-sm text-gray-600">No checklist runs yet.</p>
      </div>
    )
  }

  return (
    <div className="border rounded p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Checklists</h2>
      <div className="space-y-3">
        {runs.map(run => (
          <div key={run.checklistRunId} className="border-b border-gray-100 pb-3 last:border-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Link
                  href={`/assets/${assetId}/checklists/${run.checklistRunId}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {run.runName || '(unnamed run)'}
                </Link>
                <div className="text-xs text-gray-500 mt-1">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                    {run.status}
                  </span>
                  {' | '}
                  {run.completedEntries} / {run.totalEntries} completed ({run.completionPercentage}%)
                </div>
                {run.createdAt && (
                  <div className="text-xs text-gray-500 mt-1">{formatTimestamp(run.createdAt)}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {total > runs.length && (
        <div className="mt-4 text-xs text-gray-500">
          Showing {runs.length} of {total} checklist runs
        </div>
      )}
    </div>
  )
}
