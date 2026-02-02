'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'
import type { SheetTranslations } from '@/domain/i18n/translationTypes'
import { diffUnifiedSheets, type DiffRow } from '@/domain/datasheets/revisionDiff'
import FilledSheetViewer from '@/app/(admin)/datasheets/filled/FilledSheetViewer'
import RevisionChangesTable from './RevisionChangesTable'
import RevisionRawJson from './RevisionRawJson'

export type RevisionDetails = Readonly<{
  revisionId: number
  revisionNumber: number
  createdAt: string
  createdBy: number
  createdByName: string | null
  status: string | null
  comment: string | null
  snapshot: unknown
}>

type TabId = 'changes' | 'snapshot' | 'raw'

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

type Props = Readonly<{
  selectedRevision: RevisionDetails
  sheetId: number
  previousRevisionId: number | null
  onClose: () => void
  onRestore: () => void
  canEdit: boolean
  language: string
  unitSystem: 'SI' | 'USC'
  translations: SheetTranslations | null
}>

export default function RevisionDetailsTabs({
  selectedRevision,
  sheetId,
  previousRevisionId,
  onClose,
  onRestore,
  canEdit,
  language,
  unitSystem,
  translations,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('changes')
  const [showUnchanged, setShowUnchanged] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    try {
      return sessionStorage.getItem('revision-details-show-unchanged') === 'true'
    } catch {
      return false
    }
  })
  const [previousRev, setPreviousRev] = useState<RevisionDetailsResponse | null>(null)
  const [previousLoading, setPreviousLoading] = useState(false)
  const [previousError, setPreviousError] = useState<string | null>(null)

  useEffect(() => {
    if (previousRevisionId == null) {
      setPreviousRev(null)
      setPreviousError(null)
      return
    }

    let cancelled = false
    setPreviousLoading(true)
    setPreviousError(null)

    fetch(`/api/backend/filledsheets/${sheetId}/revisions/${previousRevisionId}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch previous revision')
        return res.json() as Promise<RevisionDetailsResponse>
      })
      .then((data) => {
        if (!cancelled) setPreviousRev(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setPreviousError(e instanceof Error ? e.message : 'Failed to load previous revision')
      })
      .finally(() => {
        if (!cancelled) setPreviousLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sheetId, previousRevisionId])

  const diffRows: DiffRow[] = useMemo(() => {
    if (previousRev == null) return []
    if (!isUnifiedSheet(selectedRevision.snapshot)) return []
    if (!isUnifiedSheet(previousRev.snapshot)) return []

    return diffUnifiedSheets(previousRev.snapshot, selectedRevision.snapshot).rows
  }, [selectedRevision.snapshot, previousRev])

  const changesContent = useMemo(() => {
    if (previousRevisionId == null) {
      return (
        <p className="text-sm text-gray-600">
          No previous revision to compare. This is the first revision, or the previous revision is not on this page.
        </p>
      )
    }

    if (previousLoading) {
      return <p className="text-sm text-gray-500">Loading changes…</p>
    }

    if (previousError) {
      return (
        <p className="text-sm text-red-600">
          Unable to load the previous revision for comparison.
        </p>
      )
    }

    if (!isUnifiedSheet(selectedRevision.snapshot) || previousRev == null || !isUnifiedSheet(previousRev.snapshot)) {
      return (
        <p className="text-sm text-gray-600">
          One of the revision snapshots is not in a comparable format. Use Raw JSON to inspect.
        </p>
      )
    }

    const handleShowUnchangedChange = (value: boolean) => {
      setShowUnchanged(value)
      try {
        sessionStorage.setItem('revision-details-show-unchanged', String(value))
      } catch {
        // ignore
      }
    }

    return (
      <RevisionChangesTable
        rows={diffRows}
        showUnchanged={showUnchanged}
        onShowUnchangedChange={handleShowUnchangedChange}
      />
    )
  }, [
    previousRevisionId,
    previousLoading,
    previousError,
    selectedRevision.snapshot,
    previousRev,
    diffRows,
    showUnchanged,
  ])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'changes', label: 'Changes' },
    { id: 'snapshot', label: 'Snapshot' },
    { id: 'raw', label: 'Raw JSON' },
  ]

  const renderTabContent = useCallback(() => {
    if (activeTab === 'changes') return changesContent
    if (activeTab === 'snapshot') {
      if (!isUnifiedSheet(selectedRevision.snapshot)) {
        return (
          <p className="text-sm text-gray-600">
            Snapshot is not in a structured format. Use the Raw JSON tab to inspect.
          </p>
        )
      }
      return (
        <FilledSheetViewer
          sheet={selectedRevision.snapshot}
          translations={translations}
          language={language}
          unitSystem={unitSystem}
          viewerMode="revision"
        />
      )
    }
    return <RevisionRawJson snapshot={selectedRevision.snapshot} />
  }, [activeTab, changesContent, selectedRevision, language, unitSystem, translations])

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          Revision #{selectedRevision.revisionNumber} Details
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-4" aria-label="Revision detail tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[200px]">{renderTabContent()}</div>

      <div className="mt-6 flex gap-4">
        {canEdit && (
          <button
            type="button"
            onClick={onRestore}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Restore This Revision
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    </>
  )
}
