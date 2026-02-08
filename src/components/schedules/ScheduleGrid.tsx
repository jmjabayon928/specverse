'use client'

import { useState, useCallback } from 'react'

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

type Props = {
  columns: ColumnDef[]
  entries: GridEntry[]
  onChangeEntries: (entries: GridEntry[]) => void
  onSaveEntries: (entries: GridEntry[]) => Promise<void>
  onOpenAssetPicker: (onSelect: (assetId: number, assetTag: string) => void) => void
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
  disabled,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
                  <td className="border px-2 py-1">
                    <input
                      type="text"
                      value={entry.sheetId ?? ''}
                      onChange={e => {
                        const v = e.target.value.trim()
                        updateEntry(entryIndex, { sheetId: v === '' ? null : Number(v) })
                      }}
                      className="w-20 border rounded px-1"
                      placeholder="—"
                      disabled={disabled}
                    />
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
