// src/app/(admin)/datasheets/filled/[id]/revisions/RevisionsListClient.tsx
'use client'

import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { UserSession } from '@/domain/auth/sessionTypes'
import type { SheetTranslations } from '@/domain/i18n/translationTypes'
import { diffUnifiedSheets } from '@/domain/datasheets/revisionDiff'
import { unifiedSheetSchema } from '@/validation/sheetSchema'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'
import RevisionDetailsTabs from './RevisionDetailsTabs'

interface RevisionListItem {
  revisionId: number
  revisionNumber: number
  createdAt: string
  createdBy: number
  createdByName: string | null
  status: string | null
  comment: string | null
}

interface RevisionsResponse {
  page: number
  pageSize: number
  total: number
  rows: RevisionListItem[]
}

interface RevisionDetails {
  revisionId: number
  revisionNumber: number
  createdAt: string
  createdBy: number
  createdByName: string | null
  status: string | null
  comment: string | null
  snapshot: unknown
}

type Props = Readonly<{
  sheetId: number
  user: UserSession
  defaultLanguage: string
  defaultUnitSystem: 'SI' | 'USC'
  initialTranslations: SheetTranslations | null
}>

export default function RevisionsListClient({
  sheetId,
  user,
  defaultLanguage,
  defaultUnitSystem,
  initialTranslations,
}: Props) {
  const router = useRouter()
  const [revisions, setRevisions] = useState<RevisionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [selectedRevision, setSelectedRevision] = useState<RevisionDetails | null>(null)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [restoreComment, setRestoreComment] = useState('')
  const [restoring, setRestoring] = useState(false)
  /** Per-revision changed-field count (client-side diff vs previous). Rev #1 has no previous. */
  const [changedCountByRevisionId, setChangedCountByRevisionId] = useState<Record<number, number | null>>({})
  const changedCountGenerationRef = useRef(0)

  const fetchRevisions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(
        `/api/backend/filledsheets/${sheetId}/revisions?page=${page}&pageSize=${pageSize}`,
        {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      )

      if (!res.ok) {
        throw new Error('Failed to fetch revisions')
      }

      const data: RevisionsResponse = await res.json()
      setRevisions(data.rows)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load revisions')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, sheetId])

  useEffect(() => {
    fetchRevisions()
  }, [fetchRevisions])

  const revisionIdByNumber = useMemo(() => {
    return new Map<number, number>(revisions.map(r => [r.revisionNumber, r.revisionId]))
  }, [revisions])

  useEffect(() => {
    const revsToCompute = revisions.filter(r => r.revisionNumber >= 2)
    if (revsToCompute.length === 0) return

    const generation = changedCountGenerationRef.current + 1
    changedCountGenerationRef.current = generation
    setChangedCountByRevisionId({})

    const computeOne = async (rev: RevisionListItem) => {
      const prevRevId = revisionIdByNumber.get(rev.revisionNumber - 1)
      if (prevRevId == null) return

      const [currentRes, previousRes] = await Promise.all([
        fetch(`/api/backend/filledsheets/${sheetId}/revisions/${rev.revisionId}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
        fetch(`/api/backend/filledsheets/${sheetId}/revisions/${prevRevId}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
      ])
      if (generation !== changedCountGenerationRef.current) return
      if (!currentRes.ok || !previousRes.ok) return

      const [currentData, previousData] = await Promise.all([
        currentRes.json() as Promise<RevisionDetails>,
        previousRes.json() as Promise<RevisionDetails>,
      ])
      if (generation !== changedCountGenerationRef.current) return

      const prevParsed = unifiedSheetSchema.safeParse(previousData.snapshot)
      const currParsed = unifiedSheetSchema.safeParse(currentData.snapshot)
      if (!prevParsed.success || !currParsed.success) {
        setChangedCountByRevisionId(prev => ({ ...prev, [rev.revisionId]: null }))
        return
      }
      const prevSheet = prevParsed.data as UnifiedSheet
      const currSheet = currParsed.data as UnifiedSheet
      const diff = diffUnifiedSheets(prevSheet, currSheet)
      const count = diff.rows.filter(row => row.kind !== 'unchanged').length
      setChangedCountByRevisionId(prev => ({ ...prev, [rev.revisionId]: count }))
    }

    revsToCompute.forEach(computeOne)
  }, [revisions, revisionIdByNumber, sheetId])

  const handleViewDetails = async (revisionId: number) => {
    try {
      const res = await fetch(
        `/api/backend/filledsheets/${sheetId}/revisions/${revisionId}`,
        {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      )

      if (!res.ok) {
        throw new Error('Failed to fetch revision details')
      }

      const data: RevisionDetails = await res.json()
      setSelectedRevision(data)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load revision details')
    }
  }

  const handleRestore = async () => {
    if (!selectedRevision) return

    try {
      setRestoring(true)
      const res = await fetch(
        `/api/backend/filledsheets/${sheetId}/revisions/${selectedRevision.revisionId}/restore`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ comment: restoreComment || undefined }),
        }
      )

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Restore failed' }))
        throw new Error(errorData.error || 'Failed to restore revision')
      }

      const result = await res.json()
      alert(result.message || 'Revision restored successfully')
      setShowRestoreModal(false)
      setSelectedRevision(null)
      setRestoreComment('')
      router.push(`/datasheets/filled/${sheetId}?success=restored`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restore revision')
    } finally {
      setRestoring(false)
    }
  }

  const canEdit = Array.isArray(user.permissions) && user.permissions.includes('DATASHEET_EDIT')

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Revision History</h1>
        <Link
          href={`/datasheets/filled/${sheetId}`}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Back to Sheet
        </Link>
      </div>

      {loading && <p className="text-gray-500">Loading revisions...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <>
          <div className="bg-white rounded shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revision #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fields changed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {revisions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No revisions found
                    </td>
                  </tr>
                ) : (
                  revisions.map((rev) => (
                    <tr key={rev.revisionId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {rev.revisionNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(rev.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rev.createdByName || `User #${rev.createdBy}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rev.status || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {rev.comment || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rev.revisionNumber === 1
                          ? '—'
                          : changedCountByRevisionId[rev.revisionId] !== undefined && changedCountByRevisionId[rev.revisionId] !== null
                            ? `${changedCountByRevisionId[rev.revisionId]} changed`
                            : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {revisionIdByNumber.has(rev.revisionNumber - 1) && (
                          <button
                            onClick={() => {
                              const compareTo = revisionIdByNumber.get(rev.revisionNumber - 1)
                              if (!compareTo) return
                              router.push(
                                `/datasheets/filled/${sheetId}/revisions/${rev.revisionId}/diff?compareTo=${compareTo}`
                              )
                            }}
                            className="text-purple-600 hover:text-purple-900 mr-4"
                          >
                            Diff vs previous
                          </button>
                        )}
                        <button
                          onClick={() => handleViewDetails(rev.revisionId)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          View
                        </button>
                        {canEdit && (
                          <button
                            onClick={async () => {
                              await handleViewDetails(rev.revisionId)
                              setShowRestoreModal(true)
                            }}
                            className="text-green-600 hover:text-green-900"
                          >
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {Math.ceil(total / pageSize)} ({total} total)
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / pageSize)}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Revision Details Modal */}
      {selectedRevision && !showRestoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
            <RevisionDetailsTabs
              selectedRevision={selectedRevision}
              sheetId={sheetId}
              previousRevisionId={revisionIdByNumber.get(selectedRevision.revisionNumber - 1) ?? null}
              onClose={() => setSelectedRevision(null)}
              onRestore={() => setShowRestoreModal(true)}
              canEdit={canEdit}
              language={defaultLanguage}
              unitSystem={defaultUnitSystem}
              translations={initialTranslations}
            />
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedRevision && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4">Restore Revision #{selectedRevision.revisionNumber}?</h2>
            <p className="mb-4 text-gray-600">
              This will create a new revision with the data from revision #{selectedRevision.revisionNumber}.
              The current sheet will be updated to match this revision.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Optional Comment:
              </label>
              <textarea
                value={restoreComment}
                onChange={(e) => setRestoreComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Add a comment for this restore action..."
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {restoring ? 'Restoring...' : 'Confirm Restore'}
              </button>
              <button
                onClick={() => {
                  setShowRestoreModal(false)
                  setRestoreComment('')
                }}
                disabled={restoring}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
