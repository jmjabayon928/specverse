'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  ChecklistRunDTO,
  ChecklistRunEntryDTO,
  ChecklistRunEntryResult,
  ChecklistRunPagination,
} from '@/domain/checklists/checklistTypes'

type Props = {
  runId: number
  assetId: number
}

const RESULT_OPTIONS: { value: ChecklistRunEntryResult; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'NA', label: 'N/A' },
]

export default function ChecklistRunDetail({ runId }: Props) {
  const [run, setRun] = useState<ChecklistRunDTO | null>(null)
  const [pagination, setPagination] = useState<ChecklistRunPagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingEntryId, setSavingEntryId] = useState<number | null>(null)
  const [entryErrors, setEntryErrors] = useState<Map<number, string>>(new Map())
  const [rowVersions, setRowVersions] = useState<Map<number, string>>(new Map())

  const loadRun = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/backend/checklists/runs/${runId}?page=1&pageSize=200&evidence=full`, {
        credentials: 'include',
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Failed to load checklist run (${res.status}): ${errorText}`)
      }

      const data = (await res.json()) as ChecklistRunDTO & { pagination: ChecklistRunPagination }
      setRun(data)
      setPagination(data.pagination)

      // Store row versions for optimistic concurrency
      const versions = new Map<number, string>()
      data.entries.forEach(entry => {
        if (entry.rowVersionBase64) {
          versions.set(entry.runEntryId, entry.rowVersionBase64)
        }
      })
      setRowVersions(versions)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load checklist run'
      setError(message)
      setRun(null)
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    loadRun()
  }, [loadRun])

  const handleEntryChange = useCallback(
    (entryId: number, field: keyof ChecklistRunEntryDTO, value: unknown) => {
      if (!run) return

      setRun({
        ...run,
        entries: run.entries.map(entry =>
          entry.runEntryId === entryId ? { ...entry, [field]: value } : entry,
        ),
      })
    },
    [run],
  )

  const handleSaveEntry = useCallback(
    async (entry: ChecklistRunEntryDTO) => {
      if (!run) return

      setSavingEntryId(entry.runEntryId)
      setEntryErrors(prev => {
        const next = new Map(prev)
        next.delete(entry.runEntryId)
        return next
      })

      try {
        const rowVersion = rowVersions.get(entry.runEntryId)
        if (!rowVersion) {
          throw new Error('Missing row version. Please refresh the page.')
        }

        const payload: Record<string, unknown> = {
          expectedRowVersionBase64: rowVersion,
        }

        if (entry.result !== undefined && entry.result !== null) {
          payload.result = entry.result
        }
        if (entry.notes !== undefined) {
          payload.notes = entry.notes
        }
        if (entry.measuredValue !== undefined) {
          payload.measuredValue = entry.measuredValue
        }
        if (entry.uom !== undefined) {
          payload.uom = entry.uom
        }

        const res = await fetch(`/api/backend/checklists/run-entries/${entry.runEntryId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        })

        if (res.status === 409) {
          // Conflict - refresh and retry
          await loadRun()
          setEntryErrors(prev => {
            const next = new Map(prev)
            next.set(
              entry.runEntryId,
              'Entry was modified by another user. Please review and try again.',
            )
            return next
          })
          return
        }

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Failed to save entry (${res.status}): ${errorText}`)
        }

        // Reload to get updated row version and status
        await loadRun()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save entry'
        setEntryErrors(prev => {
          const next = new Map(prev)
          next.set(entry.runEntryId, message)
          return next
        })
      } finally {
        setSavingEntryId(null)
      }
    },
    [run, rowVersions, loadRun],
  )

  const handleEvidenceUpload = useCallback(
    async (entryId: number, file: File) => {
      if (!run) return

      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch(`/api/backend/checklists/run-entries/${entryId}/evidence`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Failed to upload evidence (${res.status}): ${errorText}`)
        }

        // Reload to get updated evidence list
        await loadRun()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to upload evidence'
        alert(message)
      }
    },
    [run, loadRun],
  )

  if (loading) {
    return (
      <div className="border rounded p-4">
        <p className="text-sm text-gray-600">Loading checklist run...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="border rounded p-4">
        <p className="text-sm text-gray-600">Checklist run not found.</p>
      </div>
    )
  }

  const isReadOnly = run.status === 'COMPLETED' || run.status === 'CANCELLED'

  return (
    <div className="space-y-4">
      {/* Run Header */}
      <div className="border rounded p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{run.runName}</h2>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
              <span>
                Status:{' '}
                <span className="inline-block px-2 py-1 rounded bg-gray-100 text-gray-700 font-medium">
                  {run.status}
                </span>
              </span>
              <span>
                Completion: {run.completedEntries} / {run.totalEntries} ({run.completionPercentage}%)
              </span>
            </div>
            {run.notes && (
              <div className="mt-2 text-sm text-gray-600">
                <strong>Notes:</strong> {run.notes}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${run.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-4">
        {run.entries.map(entry => {
          const isSaving = savingEntryId === entry.runEntryId
          const entryError = entryErrors.get(entry.runEntryId)

          return (
            <div key={entry.runEntryId} className="border rounded p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">
                    Entry #{entry.sortOrder ?? entry.runEntryId}
                  </div>
                  {entryError && (
                    <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      {entryError}
                    </div>
                  )}
                </div>

                {/* Result */}
                <div>
                  <label htmlFor={`result-${entry.runEntryId}`} className="block text-xs font-medium text-gray-700 mb-1">
                    Result
                  </label>
                  <select
                    id={`result-${entry.runEntryId}`}
                    value={entry.result ?? 'PENDING'}
                    onChange={e =>
                      handleEntryChange(entry.runEntryId, 'result', e.target.value as ChecklistRunEntryResult)
                    }
                    disabled={isReadOnly || isSaving}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100"
                  >
                    {RESULT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor={`notes-${entry.runEntryId}`} className="block text-xs font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    id={`notes-${entry.runEntryId}`}
                    value={entry.notes ?? ''}
                    onChange={e => handleEntryChange(entry.runEntryId, 'notes', e.target.value)}
                    disabled={isReadOnly || isSaving}
                    rows={2}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100"
                  />
                </div>

                {/* Measured Value & UOM */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`measuredValue-${entry.runEntryId}`} className="block text-xs font-medium text-gray-700 mb-1">
                      Measured Value
                    </label>
                    <input
                      id={`measuredValue-${entry.runEntryId}`}
                      type="text"
                      value={entry.measuredValue ?? ''}
                      onChange={e =>
                        handleEntryChange(entry.runEntryId, 'measuredValue', e.target.value)
                      }
                      disabled={isReadOnly || isSaving}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label htmlFor={`uom-${entry.runEntryId}`} className="block text-xs font-medium text-gray-700 mb-1">
                      UOM
                    </label>
                    <input
                      id={`uom-${entry.runEntryId}`}
                      type="text"
                      value={entry.uom ?? ''}
                      onChange={e => handleEntryChange(entry.runEntryId, 'uom', e.target.value)}
                      disabled={isReadOnly || isSaving}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Evidence */}
                <div>
                  <label htmlFor={`evidence-${entry.runEntryId}`} className="block text-xs font-medium text-gray-700 mb-1">
                    Evidence
                  </label>
                  {entry.evidenceAttachments.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {entry.evidenceAttachments.map(att => (
                        <div key={att.attachmentId} className="text-xs text-gray-600">
                          {att.originalName} ({Math.round(att.fileSizeBytes / 1024)} KB)
                        </div>
                      ))}
                    </div>
                  )}
                  {!isReadOnly && (
                    <input
                      id={`evidence-${entry.runEntryId}`}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleEvidenceUpload(entry.runEntryId, file)
                        }
                      }}
                      disabled={isSaving}
                      className="text-xs"
                    />
                  )}
                </div>

                {/* Save Button */}
                {!isReadOnly && (
                  <div>
                    <button
                      onClick={() => handleSaveEntry(entry)}
                      disabled={isSaving}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : 'Save Entry'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination Info */}
      {pagination && pagination.totalEntries > pagination.pageSize && (
        <div className="text-xs text-gray-500 text-center">
          Showing {run.entries.length} of {pagination.totalEntries} entries
        </div>
      )}
    </div>
  )
}
