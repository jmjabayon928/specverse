'use client'

import { useState } from 'react'

export type ScheduleColumnItem = {
  scheduleColumnId?: number
  columnKey: string
  columnLabel: string
  dataType: string
  enumOptionsJson?: string | null
  displayOrder: number
  isRequired: boolean
  isEditable: boolean
}

type Props = {
  columns: ScheduleColumnItem[]
  onChange: (columns: ScheduleColumnItem[]) => void
  onSave: (columns: ScheduleColumnItem[]) => Promise<void>
  disabled?: boolean
}

const DATA_TYPES = ['string', 'number', 'boolean', 'date', 'json']

export default function ScheduleColumnsEditor({ columns, onChange, onSave, disabled }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const move = (index: number, dir: -1 | 1) => {
    const next = [...columns]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    next.forEach((c, i) => {
      c.displayOrder = i
    })
    onChange(next)
  }

  const update = (index: number, patch: Partial<ScheduleColumnItem>) => {
    const next = columns.map((c, i) => (i === index ? { ...c, ...patch } : c))
    onChange(next)
  }

  const add = () => {
    const next = [
      ...columns,
      {
        columnKey: `col_${Date.now()}`,
        columnLabel: 'New column',
        dataType: 'string',
        displayOrder: columns.length,
        isRequired: false,
        isEditable: true,
      },
    ]
    onChange(next)
  }

  const remove = (index: number) => {
    const next = columns.filter((_, i) => i !== index).map((c, i) => ({ ...c, displayOrder: i }))
    onChange(next)
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      await onSave(columns)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Columns</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={add}
            disabled={disabled}
            className="rounded border px-2 py-1 text-sm"
          >
            Add column
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || saving}
            className="rounded bg-blue-600 text-white px-2 py-1 text-sm"
          >
            {saving ? 'Saving…' : 'Save columns'}
          </button>
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <table className="min-w-full border-collapse border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 w-12">Order</th>
            <th className="border px-2 py-1 text-left">Key</th>
            <th className="border px-2 py-1 text-left">Label</th>
            <th className="border px-2 py-1 text-left">Type</th>
            <th className="border px-2 py-1">Required</th>
            <th className="border px-2 py-1">Editable</th>
            <th className="border px-2 py-1 w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c, i) => (
            <tr key={c.scheduleColumnId ?? c.columnKey + i}>
              <td className="border px-2 py-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="mr-1">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === columns.length - 1}>
                  ↓
                </button>
              </td>
              <td className="border px-2 py-1">
                <input
                  type="text"
                  value={c.columnKey}
                  onChange={e => update(i, { columnKey: e.target.value })}
                  className="w-full border rounded px-1"
                  disabled={disabled}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  type="text"
                  value={c.columnLabel}
                  onChange={e => update(i, { columnLabel: e.target.value })}
                  className="w-full border rounded px-1"
                  disabled={disabled}
                />
              </td>
              <td className="border px-2 py-1">
                <select
                  value={c.dataType}
                  onChange={e => update(i, { dataType: e.target.value })}
                  className="border rounded px-1"
                  disabled={disabled}
                >
                  {DATA_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border px-2 py-1 text-center">
                <input
                  type="checkbox"
                  checked={c.isRequired}
                  onChange={e => update(i, { isRequired: e.target.checked })}
                  disabled={disabled}
                />
              </td>
              <td className="border px-2 py-1 text-center">
                <input
                  type="checkbox"
                  checked={c.isEditable}
                  onChange={e => update(i, { isEditable: e.target.checked })}
                  disabled={disabled}
                />
              </td>
              <td className="border px-2 py-1">
                <button type="button" onClick={() => remove(i)} disabled={disabled} className="text-red-600 text-sm">
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
