'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export type ColumnDef = {
  scheduleColumnId: number
  columnKey: string
  columnLabel: string
  dataType: string
  isEditable: boolean
}

export type GridEntry = {
  scheduleEntryId?: number
  assetId: number
  assetTag?: string
  sheetId: number | null
  values: Record<string, string | number | boolean | null>
}

export type SheetOption = {
  sheetId: number
  sheetName: string
  status: string
  disciplineName?: string | null
  subtypeName?: string | null
}

const SHEET_OPTIONS_DEBOUNCE_MS = 300
const SHEET_OPTIONS_LIMIT = 20

type Props = {
  columns: ColumnDef[]
  entries: GridEntry[]
  onChangeEntries: (entries: GridEntry[]) => void
  onSaveEntries: (entries: GridEntry[]) => Promise<void>
  onOpenAssetPicker: (onSelect: (assetId: number, assetTag: string) => void) => void
  fetchSheetOptions: (q: string, limit: number) => Promise<{ items: SheetOption[]; total: number }>
  disabled?: boolean
}

function getCellValue(v: string | number | boolean | null): string {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

function parseCellValue(dataType: string, raw: string): string | number | boolean | null {
  const s = raw.trim()
  if (s === '') return null
  if (dataType === 'number') {
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  if (dataType === 'boolean') {
    const lower = s.toLowerCase()
    if (lower === 'true' || lower === '1') return true
    if (lower === 'false' || lower === '0') return false
    return null
  }
  if (dataType === 'date' || dataType === 'json') return s
  return s
}

export default function ScheduleGrid({
  columns,
  entries,
  onChangeEntries,
  onSaveEntries,
  onOpenAssetPicker,
  fetchSheetOptions,
  disabled,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpenForIndex, setPickerOpenForIndex] = useState<number | null>(null)
  const [manualModeForIndex, setManualModeForIndex] = useState<Set<number>>(new Set())
  const [sheetLabelByIndex, setSheetLabelByIndex] = useState<Record<number, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SheetOption[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addRow = useCallback(() => {
    onOpenAssetPicker((assetId: number, assetTag: string) => {
      const newEntry: GridEntry = {
        assetId,
        assetTag,
        sheetId: null,
        values: {},
      }
      columns.forEach(col => {
        newEntry.values[col.columnKey] = null
      })
      onChangeEntries([...entries, newEntry])
    })
  }, [entries, columns, onChangeEntries, onOpenAssetPicker])

  const updateEntry = (index: number, patch: Partial<GridEntry>) => {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e))
    onChangeEntries(next)
  }

  const updateCell = (entryIndex: number, columnKey: string, raw: string) => {
    const col = columns.find(c => c.columnKey === columnKey)
    if (!col) return
    const value = parseCellValue(col.dataType, raw)
    const next = entries.map((e, i) => {
      if (i !== entryIndex) return e
      return { ...e, values: { ...e.values, [columnKey]: value } }
    })
    onChangeEntries(next)
  }

  const removeRow = (index: number) => {
    onChangeEntries(entries.filter((_, i) => i !== index))
    setPickerOpenForIndex(prev => {
      if (prev === null) return null
      if (prev === index) return null
      return prev > index ? prev - 1 : prev
    })
    setManualModeForIndex(prev => {
      const next = new Set<number>()
      prev.forEach(i => {
        if (i < index) next.add(i)
        if (i > index) next.add(i - 1)
      })
      return next
    })
    setSheetLabelByIndex(prev => {
      const next: Record<number, string> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k)
        if (i < index) next[i] = v
        if (i > index) next[i - 1] = v
      })
      return next
    })
  }

  const runSheetSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchResults([])
        return
      }
      setSearchLoading(true)
      try {
        const data = await fetchSheetOptions(q.trim(), SHEET_OPTIONS_LIMIT)
        setSearchResults(data.items ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    },
    [fetchSheetOptions]
  )

  useEffect(() => {
    if (pickerOpenForIndex === null) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSheetSearch(searchQuery)
      debounceRef.current = null
    }, SHEET_OPTIONS_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, pickerOpenForIndex, runSheetSearch])

  const openPicker = (entryIndex: number) => {
    setPickerOpenForIndex(entryIndex)
    setSearchQuery('')
    setSearchResults([])
  }

  const closePicker = () => {
    setPickerOpenForIndex(null)
    setSearchQuery('')
    setSearchResults([])
  }

  const selectSheetOption = (entryIndex: number, option: SheetOption) => {
    updateEntry(entryIndex, { sheetId: option.sheetId })
    setSheetLabelByIndex(prev => ({ ...prev, [entryIndex]: option.sheetName }))
    closePicker()
  }

  const toggleManualMode = (entryIndex: number) => {
    setManualModeForIndex(prev => {
      const next = new Set(prev)
      if (next.has(entryIndex)) next.delete(entryIndex)
      else next.add(entryIndex)
      return next
    })
    if (pickerOpenForIndex === entryIndex) closePicker()
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      await onSaveEntries(entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Entries (asset-first)</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addRow}
            disabled={disabled}
            className="rounded border px-2 py-1 text-sm"
          >
            Add row (asset picker)
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || saving}
            className="rounded bg-blue-600 text-white px-2 py-1 text-sm"
          >
            {saving ? 'Saving…' : 'Save entries'}
          </button>
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">Asset</th>
              <th className="border px-2 py-1 text-left">Sheet ID</th>
              {columns.map(col => (
                <th key={col.scheduleColumnId} className="border px-2 py-1 text-left">
                  {col.columnLabel}
                </th>
              ))}
              <th className="border px-2 py-1 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3} className="border px-2 py-2 text-gray-500">
                  No entries. Add a row to link assets.
                </td>
              </tr>
            ) : (
              entries.map((entry, entryIndex) => (
                <tr key={entry.scheduleEntryId ?? `new-${entryIndex}-${entry.assetId}`}>
                  <td className="border px-2 py-1">
                    {entry.assetTag ?? `Asset ${entry.assetId}`}
                  </td>
                  <td className="border px-2 py-1 align-top">
                    {pickerOpenForIndex === entryIndex ? (
                      <div className="relative min-w-[200px]">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search datasheets…"
                          className="w-full border rounded px-1 py-0.5 text-sm"
                          disabled={disabled}
                          autoFocus
                          aria-label="Search datasheets to link"
                        />
                        {searchLoading && <span className="text-xs text-gray-500 ml-1">Searching…</span>}
                        {searchResults.length > 0 && (
                          <ul
                            className="absolute z-10 mt-1 w-full max-h-48 overflow-auto border rounded bg-white shadow list-none p-0 text-sm"
                            role="listbox"
                          >
                            {searchResults.map(item => (
                              <li
                                key={item.sheetId}
                                role="option"
                                aria-selected={entry.sheetId === item.sheetId}
                                className="px-2 py-1 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-0"
                                onClick={() => selectSheetOption(entryIndex, item)}
                              >
                                <span className="font-medium">{item.sheetName}</span>
                                <span className="text-gray-500 ml-1">
                                  #{item.sheetId}
                                  {item.status ? ` · ${item.status}` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex gap-1 mt-1">
                          <button
                            type="button"
                            onClick={closePicker}
                            className="text-xs text-gray-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : manualModeForIndex.has(entryIndex) ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={entry.sheetId ?? ''}
                          onChange={e => {
                            const v = e.target.value.trim()
                            updateEntry(entryIndex, { sheetId: v === '' ? null : Number(v) })
                          }}
                          className="w-20 border rounded px-1"
                          placeholder="Sheet ID"
                          disabled={disabled}
                          aria-label="Sheet ID (manual entry)"
                        />
                        <button
                          type="button"
                          onClick={() => toggleManualMode(entryIndex)}
                          className="text-xs text-left text-gray-600 hover:underline"
                        >
                          Use picker
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {entry.sheetId != null ? (
                          <span className="text-sm">
                            {sheetLabelByIndex[entryIndex] ?? `#${entry.sheetId}`}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openPicker(entryIndex)}
                          disabled={disabled}
                          className="rounded border px-1.5 py-0.5 text-xs"
                        >
                          {entry.sheetId != null ? 'Change' : 'Link datasheet'}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleManualMode(entryIndex)}
                          disabled={disabled}
                          className="text-xs text-gray-600 hover:underline"
                        >
                          Manual entry
                        </button>
                      </div>
                    )}
                  </td>
                  {columns.map(col => (
                    <td key={col.scheduleColumnId} className="border px-2 py-1">
                      {col.isEditable && !disabled ? (
                        <input
                          type="text"
                          value={getCellValue(entry.values[col.columnKey])}
                          onChange={e => updateCell(entryIndex, col.columnKey, e.target.value)}
                          className="w-full border rounded px-1"
                        />
                      ) : (
                        <span>{getCellValue(entry.values[col.columnKey]) || '—'}</span>
                      )}
                    </td>
                  ))}
                  <td className="border px-2 py-1">
                    <button
                      type="button"
                      onClick={() => removeRow(entryIndex)}
                      disabled={disabled}
                      className="text-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
