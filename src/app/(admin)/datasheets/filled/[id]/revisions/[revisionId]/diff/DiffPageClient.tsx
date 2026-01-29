'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'
import { diffUnifiedSheets, type DiffKind, type DiffRow } from '@/domain/datasheets/revisionDiff'

type Props = Readonly<{
  sheetId: number
  revisionId: number
  compareToRevisionId: number
}>

type RevisionDetailsResponse = Readonly<{
  revisionId: number
  revisionNumber: number
  createdAt: string
  createdBy: number
  createdByName: string | null
  status: string | null
  comment: string | null
  snapshot: unknown
}>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUnifiedSheet(value: unknown): value is UnifiedSheet {
  if (!isPlainObject(value)) return false
  const subsheets = (value as { subsheets?: unknown }).subsheets
  return Array.isArray(subsheets)
}

function kindWeight(kind: DiffKind): number {
  if (kind === 'changed') return 0
  if (kind === 'added' || kind === 'removed') return 1
  return 2
}

export default function DiffPageClient({ sheetId, revisionId, compareToRevisionId }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(200)

  const [currentRev, setCurrentRev] = useState<RevisionDetailsResponse | null>(null)
  const [previousRev, setPreviousRev] = useState<RevisionDetailsResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        const [currentRes, previousRes] = await Promise.all([
          fetch(`/api/backend/filledsheets/${sheetId}/revisions/${revisionId}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }),
          fetch(`/api/backend/filledsheets/${sheetId}/revisions/${compareToRevisionId}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }),
        ])

        if (!currentRes.ok) throw new Error('Failed to fetch selected revision')
        if (!previousRes.ok) throw new Error('Failed to fetch compare-to revision')

        const currentData: RevisionDetailsResponse = await currentRes.json()
        const previousData: RevisionDetailsResponse = await previousRes.json()

        if (cancelled) return
        setCurrentRev(currentData)
        setPreviousRev(previousData)
      } catch (e: unknown) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load diff')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [sheetId, revisionId, compareToRevisionId])

  const diffRows: DiffRow[] = useMemo(() => {
    if (!currentRev || !previousRev) return []
    if (!isUnifiedSheet(currentRev.snapshot)) return []
    if (!isUnifiedSheet(previousRev.snapshot)) return []

    // Old = compareTo (previous), New = current
    return diffUnifiedSheets(previousRev.snapshot, currentRev.snapshot).rows
  }, [currentRev, previousRev])

  const rowsSortedFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()

    const filtered = diffRows.filter((r) => {
      if (!showUnchanged && r.kind === 'unchanged') return false
      if (!q) return true
      return r.label.toLowerCase().includes(q)
    })

    const sorted = [...filtered].sort((a, b) => {
      const w = kindWeight(a.kind) - kindWeight(b.kind)
      if (w !== 0) return w

      const sub = a.subsheetName.localeCompare(b.subsheetName)
      if (sub !== 0) return sub

      return a.label.localeCompare(b.label)
    })

    return sorted
  }, [diffRows, showUnchanged, query])

  useEffect(() => {
    setVisibleCount(rowsSortedFiltered.length > 200 ? 200 : rowsSortedFiltered.length)
  }, [rowsSortedFiltered.length])

  const visibleRows = rowsSortedFiltered.slice(0, visibleCount)

  const header = useMemo(() => {
    if (!currentRev || !previousRev) return null
    return {
      title: `Revision ${currentRev.revisionNumber} vs Revision ${previousRev.revisionNumber}`,
      current: {
        createdAt: new Date(currentRev.createdAt).toLocaleString(),
        createdBy: currentRev.createdByName ?? `User #${currentRev.createdBy}`,
      },
      previous: {
        createdAt: new Date(previousRev.createdAt).toLocaleString(),
        createdBy: previousRev.createdByName ?? `User #${previousRev.createdBy}`,
      },
    }
  }, [currentRev, previousRev])

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Diff</h1>
          {header && <p className="text-sm text-gray-600 mt-1">{header.title}</p>}
        </div>
        <Link
          href={`/datasheets/filled/${sheetId}/revisions`}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Back to Revisions
        </Link>
      </div>

      {loading && <p className="text-gray-500">Loading diff...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <>
          {currentRev && previousRev && header && (
            <div className="bg-white rounded shadow p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-semibold text-gray-800">New (selected)</div>
                  <div className="text-gray-600">Date: {header.current.createdAt}</div>
                  <div className="text-gray-600">Author: {header.current.createdBy}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-800">Old (compare-to)</div>
                  <div className="text-gray-600">Date: {header.previous.createdAt}</div>
                  <div className="text-gray-600">Author: {header.previous.createdBy}</div>
                </div>
              </div>
            </div>
          )}

          {currentRev && previousRev && (!isUnifiedSheet(currentRev.snapshot) || !isUnifiedSheet(previousRev.snapshot)) && (
            <div className="bg-white rounded shadow p-6">
              <p className="text-red-600">One of the revision snapshots is not a valid UnifiedSheet.</p>
            </div>
          )}

          {currentRev && previousRev && isUnifiedSheet(currentRev.snapshot) && isUnifiedSheet(previousRev.snapshot) && (
            <>
              <div className="bg-white rounded shadow p-4 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={showUnchanged}
                      onChange={(e) => setShowUnchanged(e.target.checked)}
                    />
                    Show unchanged
                  </label>
                  <div className="text-sm text-gray-600">
                    Showing {Math.min(visibleCount, rowsSortedFiltered.length)} of {rowsSortedFiltered.length}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by field label..."
                    className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <div className="bg-white rounded shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subsheet
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Field
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Old value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        New value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kind
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          No rows to display
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((r) => (
                        <tr key={r.key} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{r.subsheetName}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{r.label}</td>
                          <td className="px-6 py-4 text-sm text-gray-700 font-mono">{r.oldValue || '—'}</td>
                          <td className="px-6 py-4 text-sm text-gray-700 font-mono">{r.newValue || '—'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{r.kind}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {rowsSortedFiltered.length > visibleCount && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setVisibleCount((c) => Math.min(rowsSortedFiltered.length, c + 200))}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

