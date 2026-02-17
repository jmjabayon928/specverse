'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type RatingsBlockSummary = {
  ratingsBlockId: number
  sheetId: number
  blockType: string
  ratingsBlockTemplateId?: number | null
  lockedAt: string | null
  lockedBy: number | null
  updatedAt: string
}

type RatingsBlockRow = {
  ratingsBlockId: number
  sheetId: number
  blockType: string
  ratingsBlockTemplateId?: number | null
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
  templateFieldId?: number | null
}

type EntryInput = { key: string; value: string; uom: string }

type RatingsTemplateRow = {
  id: number
  blockType: string
  standardCode: string
  description?: string | null
}

type TemplateFieldRow = {
  templateFieldId: number
  fieldKey: string
  label: string | null
  dataType: string
  uom: string | null
  isRequired: boolean
  orderIndex: number
  enumValues?: string[]
}

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
  const [expandedTemplateDetail, setExpandedTemplateDetail] = useState<{
    template: RatingsTemplateRow
    fields: TemplateFieldRow[]
  } | null>(null)
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
    setExpandedTemplateDetail(null)
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
        const templateId = data.block.ratingsBlockTemplateId
        if (templateId != null) {
          const tRes = await fetch(`/api/backend/ratings/templates/${templateId}`, { credentials: 'include' })
          if (tRes.ok && isMountedRef.current) {
            const tData = (await tRes.json()) as { template: RatingsTemplateRow; fields: TemplateFieldRow[] }
            setExpandedTemplateDetail({ template: tData.template, fields: tData.fields })
          }
        }
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
      setExpandedTemplateDetail(null)
      setExpandError(null)
      setEditingId(null)
    } else {
      setExpandedId(id)
      setEditingId(null)
      loadBlockDetail(id)
    }
  }

  const handleCreate = async (
    blockType: string,
    notes: string,
    entries: EntryInput[],
    templateId?: number,
    initialValues?: Record<string, string | null>
  ) => {
    const bt = blockType.trim()
    if (!bt) {
      toast.error('Block type is required')
      return
    }
    if (templateId == null) {
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
    }
    if (submitGuardRef.current || isSubmitting) return
    submitGuardRef.current = true
    setIsSubmitting(true)
    try {
      const body =
        templateId != null && initialValues != null
          ? { sheetId, blockType: bt, notes: notes.trim() || undefined, templateId, initialValues }
          : {
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
          sheetId={sheetId}
          onSave={(bt, notes, entries, templateId, initialValues) => handleCreate(bt, notes, entries ?? [], templateId, initialValues)}
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
                        {expandedBlock.ratingsBlockTemplateId != null && !expandedTemplateDetail ? (
                          <p className="text-xs text-gray-500">Loading template…</p>
                        ) : expandedBlock.ratingsBlockTemplateId != null && expandedTemplateDetail ? (
                          editingId === b.ratingsBlockId ? (
                            <TemplatedBlockEditor
                              block={expandedBlock}
                              template={expandedTemplateDetail.template}
                              fields={expandedTemplateDetail.fields}
                              entries={expandedEntries}
                              onSave={(bt, notes, entries) => handleUpdate(b.ratingsBlockId, bt, notes, entries)}
                              onCancel={() => setEditingId(null)}
                              disabled={isSubmitting}
                              readOnly={isLocked}
                            />
                          ) : (
                            <TemplatedBlockReadOnlyView
                              block={expandedBlock}
                              fields={expandedTemplateDetail.fields}
                              entries={expandedEntries}
                            />
                          )
                        ) : editingId === b.ratingsBlockId ? (
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

function SchemaDrivenField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: TemplateFieldRow
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const label = field.label ?? field.fieldKey
  const id = `field-${field.fieldKey}`
  const isNumeric = field.dataType === 'int' || field.dataType === 'decimal'
  const hasEnum = field.enumValues != null && field.enumValues.length > 0
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-gray-700">
        {label}
        {field.isRequired && <span className="text-red-600 ml-0.5">*</span>}
        {field.uom && <span className="text-gray-500 ml-1">({field.uom})</span>}
      </label>
      {hasEnum ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="block w-full border rounded px-2 py-1 text-sm mt-1"
        >
          <option value="">—</option>
          {field.enumValues!.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="text"
          inputMode={isNumeric ? 'decimal' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="block w-full border rounded px-2 py-1 text-sm mt-1"
        />
      )}
    </div>
  )
}

function CreateBlockForm({
  sheetId,
  onSave,
  onCancel,
  disabled,
}: {
  sheetId: number
  onSave: (blockType: string, notes: string, entries?: EntryInput[], templateId?: number, initialValues?: Record<string, string | null>) => void
  onCancel: () => void
  disabled: boolean
}) {
  const [templates, setTemplates] = useState<RatingsTemplateRow[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [templateDetail, setTemplateDetail] = useState<{ template: RatingsTemplateRow; fields: TemplateFieldRow[] } | null>(null)
  const [templateDetailLoading, setTemplateDetailLoading] = useState(false)
  const [blockType, setBlockType] = useState('Nameplate')
  const [notes, setNotes] = useState('')
  const [entries, setEntries] = useState<EntryInput[]>([{ key: '', value: '', uom: '' }])
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    setTemplatesLoading(true)
    fetch('/api/backend/ratings/templates', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RatingsTemplateRow[]) => {
        if (!cancelled) setTemplates(Array.isArray(data) ? data : [])
      })
      .finally(() => { if (!cancelled) setTemplatesLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (selectedTemplateId == null) {
      setTemplateDetail(null)
      setTemplateValues({})
      return
    }
    let cancelled = false
    setTemplateDetailLoading(true)
    fetch(`/api/backend/ratings/templates/${selectedTemplateId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { template: RatingsTemplateRow; fields: TemplateFieldRow[] } | null) => {
        if (!cancelled && data?.template && data?.fields) {
          setTemplateDetail({ template: data.template, fields: data.fields })
          setBlockType(data.template.blockType)
          setTemplateValues({})
        } else if (!cancelled) setTemplateDetail(null)
      })
      .finally(() => { if (!cancelled) setTemplateDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedTemplateId])

  const updateTemplateValue = (key: string, value: string) => {
    setTemplateValues((prev) => ({ ...prev, [key]: value }))
  }

  const addRow = () => {
    if (entries.length < MAX_ENTRIES) setEntries((e) => [...e, { key: '', value: '', uom: '' }])
  }
  const removeRow = (i: number) => {
    if (entries.length > 1) setEntries((e) => e.filter((_, idx) => idx !== i))
  }
  const updateEntry = (i: number, field: keyof EntryInput, val: string) => {
    setEntries((e) => e.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)))
  }

  const handleSave = () => {
    if (selectedTemplateId != null && templateDetail) {
      const initialValues: Record<string, string | null> = {}
      for (const f of templateDetail.fields) {
        const v = templateValues[f.fieldKey] ?? ''
        initialValues[f.fieldKey] = v.trim() || null
      }
      onSave(blockType, notes, undefined, selectedTemplateId, initialValues)
    } else {
      onSave(blockType, notes, entries)
    }
  }

  const sortedFields = templateDetail ? [...templateDetail.fields].sort((a, b) => a.orderIndex - b.orderIndex) : []

  return (
    <div className="border rounded p-3 bg-gray-50 space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-700">Template</label>
        <select
          value={selectedTemplateId ?? ''}
          onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : null)}
          disabled={templatesLoading || disabled}
          className="block w-full border rounded px-2 py-1 text-sm mt-1"
        >
          <option value="">Freeform (no template)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.blockType} ({t.standardCode})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700">Block type</label>
        <input
          type="text"
          value={blockType}
          onChange={(e) => setBlockType(e.target.value)}
          disabled={templateDetail != null}
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
      {templateDetailLoading && <p className="text-xs text-gray-500">Loading fields…</p>}
      {templateDetail && !templateDetailLoading && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-700">Fields</div>
          {sortedFields.map((f) => (
            <SchemaDrivenField
              key={f.fieldKey}
              field={f}
              value={templateValues[f.fieldKey] ?? ''}
              onChange={(v) => updateTemplateValue(f.fieldKey, v)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
      {!templateDetail && !templateDetailLoading && (
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
                  <button type="button" onClick={() => removeRow(i)} className="text-red-600 text-xs">Remove</button>
                )}
              </div>
            ))}
          </div>
          {entries.length < MAX_ENTRIES && (
            <button type="button" onClick={addRow} className="mt-1 text-xs text-blue-600 hover:underline">Add row</button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={disabled || templateDetailLoading} className="px-3 py-1 text-sm rounded border bg-blue-50 hover:bg-blue-100 disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1 text-sm rounded border">Cancel</button>
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

function TemplatedBlockEditor({
  block,
  template,
  fields,
  entries,
  onSave,
  onCancel,
  disabled,
  readOnly,
}: {
  block: RatingsBlockRow
  template: RatingsTemplateRow
  fields: TemplateFieldRow[]
  entries: RatingsEntryRow[]
  onSave: (blockType: string, notes: string, entries: EntryInput[]) => void
  onCancel: () => void
  disabled: boolean
  readOnly: boolean
}) {
  const [notes, setNotes] = useState(block.notes ?? '')
  const [valuesByKey, setValuesByKey] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const e of entries) out[e.key] = e.value ?? ''
    for (const f of fields) if (!(f.fieldKey in out)) out[f.fieldKey] = ''
    return out
  })
  const sortedFields = [...fields].sort((a, b) => a.orderIndex - b.orderIndex)

  const updateValue = (key: string, value: string) => {
    setValuesByKey((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    const entryInputs: EntryInput[] = sortedFields.map((f) => ({
      key: f.fieldKey,
      value: valuesByKey[f.fieldKey] ?? '',
      uom: f.uom ?? '',
    }))
    onSave(template.blockType, notes, entryInputs)
  }

  return (
    <div className="border rounded p-3 bg-gray-50 space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-700">Block type</label>
        <p className="text-sm mt-1">{template.blockType}</p>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={readOnly}
          className="block w-full border rounded px-2 py-1 text-sm mt-1"
          rows={2}
        />
      </div>
      <div className="space-y-2">
        {sortedFields.map((f) => (
          <SchemaDrivenField
            key={f.fieldKey}
            field={f}
            value={valuesByKey[f.fieldKey] ?? ''}
            onChange={(v) => updateValue(f.fieldKey, v)}
            disabled={readOnly || disabled}
          />
        ))}
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={disabled} className="px-3 py-1 text-sm rounded border bg-blue-50 hover:bg-blue-100 disabled:opacity-50">
            Save
          </button>
          <button type="button" onClick={onCancel} className="px-3 py-1 text-sm rounded border">Cancel</button>
        </div>
      )}
    </div>
  )
}

function TemplatedBlockReadOnlyView({
  block,
  fields,
  entries,
}: {
  block: RatingsBlockRow
  fields: TemplateFieldRow[]
  entries: RatingsEntryRow[]
}) {
  const valueByKey = new Map(entries.map((e) => [e.key, e.value ?? '']))
  const sortedFields = [...fields].sort((a, b) => a.orderIndex - b.orderIndex)
  return (
    <div className="border rounded p-3 bg-gray-50 space-y-2">
      <div><span className="text-xs font-medium text-gray-700">Block type</span><p className="text-sm mt-1">{block.blockType}</p></div>
      {block.notes && <div><span className="text-xs font-medium text-gray-700">Notes</span><p className="text-sm mt-1">{block.notes}</p></div>}
      <div className="space-y-1">
        {sortedFields.map((f) => (
          <div key={f.fieldKey}>
            <span className="text-xs font-medium text-gray-700">{f.label ?? f.fieldKey}{f.isRequired && ' *'}{f.uom ? ` (${f.uom})` : ''}</span>
            <p className="text-sm mt-0.5">{valueByKey.get(f.fieldKey) ?? '—'}</p>
          </div>
        ))}
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
