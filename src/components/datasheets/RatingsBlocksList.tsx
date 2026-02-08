'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type RatingsBlockSummary = {
  ratingsBlockId: number
  sheetId: number
  blockType: string
  lockedAt: string | null
  lockedBy: number | null
  updatedAt: string
}

type RatingsBlockRow = {
  ratingsBlockId: number
  sheetId: number
  blockType: string
  sourceValueSetId: number | null
  lockedAt: string | null
  lockedBy: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

type RatingsEntryRow = {
  entryId: number
  ratingsBlockId: number
  key: string
  value: string | null
  uom: string | null
  orderIndex: number
}

type EntryInput = { key: string; value: string; uom: string }

type SheetStatus = 'Draft' | 'Rejected' | 'Modified Draft' | 'Verified' | 'Approved'

interface RatingsBlocksListProps {
  sheetId: number
  sheetStatus?: SheetStatus
  isRevision?: boolean
}

const MAX_ENTRIES = 200

function errorForStatus(status: number, body: { error?: string; message?: string }): string {
  if (status === 401) return 'Please sign in…'
  if (status === 403) return 'Unauthorized…'
  return body?.error ?? body?.message ?? 'Unable to load ratings.'
}

function safeFormatDate(input: string | null | undefined): string {
  if (!input) return '-'
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10)
}

export default function RatingsBlocksList(props: Readonly<RatingsBlocksListProps>) {
  const { sheetId, sheetStatus, isRevision = false } = props

  const [blocks, setBlocks] = useState<RatingsBlockSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedBlock, setExpandedBlock] = useState<RatingsBlockRow | null>(null)
  const [expandedEntries, setExpandedEntries] = useState<RatingsEntryRow[]>([])
  const [expandLoading, setExpandLoading] = useState(false)
  const [expandError, setExpandError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isMountedRef = useRef(true)
  const submitGuardRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadBlocks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/backend/datasheets/${sheetId}/ratings`, { credentials: 'include' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
        if (isMountedRef.current) setError(errorForStatus(res.status, body))
        return
      }
      const data = (await res.json()) as RatingsBlockSummary[]
      if (isMountedRef.current) setBlocks(Array.isArray(data) ? data : [])
    } catch {
      if (isMountedRef.current) setError('Unable to load ratings.')
    } finally {
      if (isMountedRef.current) setIsLoading(false)
    }
  }, [sheetId])

  useEffect(() => {
    loadBlocks()
  }, [loadBlocks])

  const loadBlockDetail = useCallback(async (id: number) => {
    setExpandLoading(true)
    setExpandError(null)
    try {
      const res = await fetch(`/api/backend/ratings/${id}`, { credentials: 'include' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
        if (isMountedRef.current) setExpandError(body?.error ?? body?.message ?? 'Failed to load block')
        return
      }
      const data = (await res.json()) as { block: RatingsBlockRow; entries: RatingsEntryRow[] }
      if (isMountedRef.current) {
        setExpandedBlock(data.block)
        setExpandedEntries(Array.isArray(data.entries) ? data.entries : [])
      }
    } catch {
      if (isMountedRef.current) setExpandError('Failed to load block')
    } finally {
      if (isMountedRef.current) setExpandLoading(false)
    }
  }, [])

  const toggleView = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedBlock(null)
      setExpandedEntries([])
      setExpandError(null)
      setEditingId(null)
    } else {
      setExpandedId(id)
      setEditingId(null)
      loadBlockDetail(id)
    }
  }

  const handleCreate = async (blockType: string, notes: string, entries: EntryInput[]) => {
    const bt = blockType.trim()
    if (!bt) {
      toast.error('Block type is required')
      return
    }
    if (entries.length > MAX_ENTRIES) {
      toast.error(`Maximum ${MAX_ENTRIES} entries allowed`)
      return
    }
    for (const e of entries) {
      if (!e.key.trim()) {
        toast.error('Entry key is required')
        return
      }
    }
    if (submitGuardRef.current || isSubmitting) return
    submitGuardRef.current = true
    setIsSubmitting(true)
    try {
      const body = {
        sheetId,
        blockType: bt,
        notes: notes.trim() || undefined,
        entries: entries.map((e, i) => ({
          key: e.key.trim(),
          value: e.value.trim() || null,
          uom: e.uom.trim() || null,
          orderIndex: i,
        })),
      }
      const res = await fetch('/api/backend/ratings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const errBody = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        toast.error(errBody?.error ?? errBody?.message ?? `Create failed (${res.status})`)
        return
      }
      toast.success('Block created')
      setShowCreateForm(false)
      await loadBlocks()
    } finally {
      submitGuardRef.current = false
      if (isMountedRef.current) setIsSubmitting(false)
    }
  }

  const handleUpdate = async (id: number, blockType: string, notes: string, entries: EntryInput[]) => {
    const bt = blockType.trim()
    if (!bt) {
      toast.error('Block type is required')
      return
    }
    if (entries.length > MAX_ENTRIES) {
      toast.error(`Maximum ${MAX_ENTRIES} entries allowed`)
      return
    }
    for (const e of entries) {
      if (!e.key.trim()) {
        toast.error('Entry key is required')
        return
      }
    }
    if (submitGuardRef.current || isSubmitting) return
    submitGuardRef.current = true
    setIsSubmitting(true)
    try {
      const body = {
        blockType: bt,
        notes: notes.trim() || undefined,
        entries: entries.map((e, i) => ({
          key: e.key.trim(),
          value: e.value.trim() || null,
          uom: e.uom.trim() || null,
          orderIndex: i,
        })),
      }
      const res = await fetch(`/api/backend/ratings/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const errBody = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        if (res.status === 409) toast.error(errBody?.error ?? errBody?.message ?? 'Block is locked')
        else toast.error(errBody?.error ?? errBody?.message ?? `Update failed (${res.status})`)
        return
      }
      toast.success('Block updated')
      setEditingId(null)
      await loadBlocks()
      if (expandedId === id) await loadBlockDetail(id)
    } finally {
      submitGuardRef.current = false
      if (isMountedRef.current) setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (submitGuardRef.current || isSubmitting) return
    submitGuardRef.current = true
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/backend/ratings/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const errBody = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        if (res.status === 409) toast.error(errBody?.error ?? errBody?.message ?? 'Block is locked')
        else toast.error(errBody?.error ?? errBody?.message ?? `Delete failed (${res.status})`)
        return
      }
      toast.success('Block deleted')
      if (expandedId === id) setExpandedId(null)
      setExpandedBlock(null)
      setExpandedEntries([])
      await loadBlocks()
    } finally {
      submitGuardRef.current = false
      if (isMountedRef.current) setIsSubmitting(false)
    }
  }

  const handleLock = async (id: number) => {
    if (submitGuardRef.current || isSubmitting) return
    submitGuardRef.current = true
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/backend/ratings/${id}/lock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const errBody = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        if (res.status === 409) toast.error(errBody?.error ?? errBody?.message ?? 'Ratings can only be locked for approved datasheets.')
        else toast.error(errBody?.error ?? errBody?.message ?? `Lock failed (${res.status})`)
        return
      }
      toast.success('Block locked')
      await loadBlocks()
      if (expandedId === id) await loadBlockDetail(id)
    } finally {
      submitGuardRef.current = false
      if (isMountedRef.current) setIsSubmitting(false)
    }
  }

  const handleUnlock = async (id: number) => {
    if (submitGuardRef.current || isSubmitting) return
    submitGuardRef.current = true
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/backend/ratings/${id}/unlock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const errBody = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        if (res.status === 403) toast.error('Admin required to unlock.')
        else toast.error(errBody?.error ?? errBody?.message ?? `Unlock failed (${res.status})`)
        return
      }
      toast.success('Block unlocked')
      await loadBlocks()
      if (expandedId === id) await loadBlockDetail(id)
    } finally {
      submitGuardRef.current = false
      if (isMountedRef.current) setIsSubmitting(false)
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading ratings blocks…</p>

  return (
    <div className="space-y-2">
      {!isRevision && (
        <div className="flex items-center gap-2">
          {!showCreateForm && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-sm rounded border hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Block
            </button>
          )}
        </div>
      )}

      {showCreateForm && (
        <CreateBlockForm
          onSave={(bt, notes, entries) => handleCreate(bt, notes, entries)}
          onCancel={() => setShowCreateForm(false)}
          disabled={isSubmitting}
        />
      )}

      {error && <p className="text-sm text-red-600" aria-live="polite">{error}</p>}

      {blocks.length === 0 && !error && <p className="text-sm text-gray-500">No ratings blocks yet.</p>}

      {blocks.length > 0 && (
        <div className="space-y-4">
          {blocks.map((b) => {
            const isLocked = b.lockedAt != null
            const isExpanded = expandedId === b.ratingsBlockId
            const showLock = !isLocked && sheetStatus === 'Approved' && !isRevision
            const showUnlock = isLocked && !isRevision
            const showEditDelete = !isLocked && !isRevision

            return (
              <div key={b.ratingsBlockId} className="border rounded p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {b.blockType} (RB-{b.ratingsBlockId})
                    </span>
                    {b.updatedAt && (
                      <span className="text-xs text-gray-500">{safeFormatDate(b.updatedAt)}</span>
                    )}
                    {isLocked && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">Locked</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleView(b.ratingsBlockId)}
                      className="px-2 py-1 text-xs rounded border hover:shadow"
                    >
                      View {isExpanded ? '▲' : '▼'}
                    </button>
                    {showLock && (
                      <button
                        type="button"
                        onClick={() => handleLock(b.ratingsBlockId)}
                        disabled={isSubmitting}
                        className="px-2 py-1 text-xs rounded border hover:shadow disabled:opacity-50"
                      >
                        Lock
                      </button>
                    )}
                    {showUnlock && (
                      <button
                        type="button"
                        onClick={() => handleUnlock(b.ratingsBlockId)}
                        disabled={isSubmitting}
                        className="px-2 py-1 text-xs rounded border hover:shadow disabled:opacity-50"
                      >
                        Unlock
                      </button>
                    )}
                    {showEditDelete && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingId(editingId === b.ratingsBlockId ? null : b.ratingsBlockId)}
                          disabled={isSubmitting}
                          className="px-2 py-1 text-xs rounded border hover:shadow disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(b.ratingsBlockId)}
                          disabled={isSubmitting}
                          className="px-2 py-1 text-xs rounded border border-red-300 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {expandLoading && <p className="text-xs text-gray-500">Loading…</p>}
                    {expandError && <p className="text-xs text-red-600" aria-live="polite">{expandError}</p>}
                    {!expandLoading && !expandError && expandedBlock && expandedId === b.ratingsBlockId && (
                      <>
                        {editingId === b.ratingsBlockId ? (
                          <EditBlockForm
                            block={expandedBlock}
                            entries={expandedEntries}
                            onSave={(bt, notes, entries) => handleUpdate(b.ratingsBlockId, bt, notes, entries)}
                            onCancel={() => setEditingId(null)}
                            disabled={isSubmitting}
                          />
                        ) : (
                          <EntriesTable entries={expandedEntries} />
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CreateBlockForm({
  onSave,
  onCancel,
  disabled,
}: {
  onSave: (blockType: string, notes: string, entries: EntryInput[]) => void
  onCancel: () => void
  disabled: boolean
}) {
  const [blockType, setBlockType] = useState('Nameplate')
  const [notes, setNotes] = useState('')
  const [entries, setEntries] = useState<EntryInput[]>([{ key: '', value: '', uom: '' }])

  const addRow = () => {
    if (entries.length < MAX_ENTRIES) setEntries((e) => [...e, { key: '', value: '', uom: '' }])
  }
  const removeRow = (i: number) => {
    if (entries.length > 1) setEntries((e) => e.filter((_, idx) => idx !== i))
  }
  const updateEntry = (i: number, field: keyof EntryInput, val: string) => {
    setEntries((e) => e.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)))
  }

  return (
    <div className="border rounded p-3 bg-gray-50 space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-700">Block type</label>
        <input
          type="text"
          value={blockType}
          onChange={(e) => setBlockType(e.target.value)}
          className="block w-full border rounded px-2 py-1 text-sm mt-1"
          placeholder="e.g. Nameplate"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="block w-full border rounded px-2 py-1 text-sm mt-1"
          rows={2}
        />
      </div>
      <div>
        <div className="text-xs font-medium text-gray-700 mb-1">Entries</div>
        <div className="space-y-1">
          {entries.map((e, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={e.key}
                onChange={(ev) => updateEntry(i, 'key', ev.target.value)}
                placeholder="Key"
                className="flex-1 border rounded px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={e.value}
                onChange={(ev) => updateEntry(i, 'value', ev.target.value)}
                placeholder="Value"
                className="flex-1 border rounded px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={e.uom}
                onChange={(ev) => updateEntry(i, 'uom', ev.target.value)}
                placeholder="UOM"
                className="w-20 border rounded px-2 py-1 text-xs"
              />
              {entries.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="text-red-600 text-xs">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {entries.length < MAX_ENTRIES && (
          <button type="button" onClick={addRow} className="mt-1 text-xs text-blue-600 hover:underline">
            Add row
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(blockType, notes, entries)}
          disabled={disabled}
          className="px-3 py-1 text-sm rounded border bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1 text-sm rounded border">
          Cancel
        </button>
      </div>
    </div>
  )
}

function EditBlockForm({
  block,
  entries,
  onSave,
  onCancel,
  disabled,
}: {
  block: RatingsBlockRow
  entries: RatingsEntryRow[]
  onSave: (blockType: string, notes: string, entries: EntryInput[]) => void
  onCancel: () => void
  disabled: boolean
}) {
  const [blockType, setBlockType] = useState(block.blockType)
  const [notes, setNotes] = useState(block.notes ?? '')
  const [entryInputs, setEntryInputs] = useState<EntryInput[]>(
    entries.length > 0
      ? entries.map((e) => ({ key: e.key, value: e.value ?? '', uom: e.uom ?? '' }))
      : [{ key: '', value: '', uom: '' }]
  )

  const addRow = () => {
    if (entryInputs.length < MAX_ENTRIES) setEntryInputs((e) => [...e, { key: '', value: '', uom: '' }])
  }
  const removeRow = (i: number) => {
    if (entryInputs.length > 1) setEntryInputs((e) => e.filter((_, idx) => idx !== i))
  }
  const updateEntry = (i: number, field: keyof EntryInput, val: string) => {
    setEntryInputs((e) => e.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)))
  }

  return (
    <div className="border rounded p-3 bg-gray-50 space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-700">Block type</label>
        <input
          type="text"
          value={blockType}
          onChange={(e) => setBlockType(e.target.value)}
          className="block w-full border rounded px-2 py-1 text-sm mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="block w-full border rounded px-2 py-1 text-sm mt-1"
          rows={2}
        />
      </div>
      <div>
        <div className="text-xs font-medium text-gray-700 mb-1">Entries</div>
        <div className="space-y-1">
          {entryInputs.map((e, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={e.key}
                onChange={(ev) => updateEntry(i, 'key', ev.target.value)}
                placeholder="Key"
                className="flex-1 border rounded px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={e.value}
                onChange={(ev) => updateEntry(i, 'value', ev.target.value)}
                placeholder="Value"
                className="flex-1 border rounded px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={e.uom}
                onChange={(ev) => updateEntry(i, 'uom', ev.target.value)}
                placeholder="UOM"
                className="w-20 border rounded px-2 py-1 text-xs"
              />
              {entryInputs.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="text-red-600 text-xs">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {entryInputs.length < MAX_ENTRIES && (
          <button type="button" onClick={addRow} className="mt-1 text-xs text-blue-600 hover:underline">
            Add row
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(blockType, notes, entryInputs)}
          disabled={disabled}
          className="px-3 py-1 text-sm rounded border bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1 text-sm rounded border">
          Cancel
        </button>
      </div>
    </div>
  )
}

function EntriesTable({ entries }: { entries: RatingsEntryRow[] }) {
  if (entries.length === 0) return <p className="text-xs text-gray-500">No entries</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 text-left">Key</th>
            <th className="border px-2 py-1 text-left">Value</th>
            <th className="border px-2 py-1 text-left">UOM</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.entryId} className="border-b">
              <td className="border px-2 py-1">{e.key}</td>
              <td className="border px-2 py-1">{e.value ?? '-'}</td>
              <td className="border px-2 py-1">{e.uom ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
