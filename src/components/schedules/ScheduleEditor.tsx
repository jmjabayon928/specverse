'use client'

import { useState, useEffect, useCallback } from 'react'
import ScheduleColumnsEditor, { type ScheduleColumnItem } from './ScheduleColumnsEditor'
import ScheduleGrid, { type ColumnDef, type GridEntry } from './ScheduleGrid'

export type ScheduleDetail = {
  schedule: {
    scheduleId: number
    name: string
    scope: string | null
  }
  columns: Array<{
    scheduleColumnId: number
    columnKey: string
    columnLabel: string
    dataType: string
    isEditable: boolean
  }>
  entries: Array<{
    scheduleEntryId: number
    assetId: number
    sheetId: number | null
    rowDataJson: string | null
  }>
  values: Array<{
    scheduleEntryValueId: number
    scheduleEntryId: number
    scheduleColumnId: number
    valueString: string | null
    valueNumber: number | null
    valueBool: boolean | null
    valueDate: string | null
    valueJson: string | null
  }>
}

type Props = {
  scheduleId: number
  initialDetail: ScheduleDetail | null
  fetchDetail: (id: number) => Promise<ScheduleDetail | null>
}

function buildEntriesFromDetail(detail: ScheduleDetail): GridEntry[] {
  const valuesByEntryAndCol = new Map<string, string | number | boolean | null>()
  for (const v of detail.values) {
    const col = detail.columns.find(c => c.scheduleColumnId === v.scheduleColumnId)
    if (!col) continue
    const cell = v.valueString ?? v.valueNumber ?? v.valueBool ?? v.valueDate ?? v.valueJson ?? null
    valuesByEntryAndCol.set(`${v.scheduleEntryId}:${col.columnKey}`, cell)
  }
  return detail.entries.map(e => {
    const values: Record<string, string | number | boolean | null> = {}
    detail.columns.forEach(col => {
      const cell = valuesByEntryAndCol.get(`${e.scheduleEntryId}:${col.columnKey}`) ?? null
      values[col.columnKey] = cell
    })
    return {
      scheduleEntryId: e.scheduleEntryId,
      assetId: e.assetId,
      assetTag: undefined,
      sheetId: e.sheetId,
      values,
    }
  })
}

function valueToPayload(col: ColumnDef, value: string | number | boolean | null): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (value == null) return out
  if (col.dataType === 'number' && typeof value === 'number') {
    out.valueNumber = value
    return out
  }
  if (col.dataType === 'boolean' && typeof value === 'boolean') {
    out.valueBool = value
    return out
  }
  if (col.dataType === 'date' && typeof value === 'string') {
    out.valueDate = value
    return out
  }
  if (col.dataType === 'json' && typeof value === 'string') {
    out.valueJson = value
    return out
  }
  out.valueString = String(value)
  return out
}

export default function ScheduleEditor({ scheduleId, initialDetail, fetchDetail }: Props) {
  const [detail, setDetail] = useState<ScheduleDetail | null>(initialDetail)
  const [loading, setLoading] = useState(!initialDetail)
  const [error, setError] = useState<string | null>(null)

  const [columns, setColumns] = useState<ScheduleColumnItem[]>([])
  const [entries, setEntries] = useState<GridEntry[]>([])
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)

  useEffect(() => {
    if (initialDetail) {
      setDetail(initialDetail)
      setColumns(
        initialDetail.columns.map(c => ({
          scheduleColumnId: c.scheduleColumnId,
          columnKey: c.columnKey,
          columnLabel: c.columnLabel,
          dataType: c.dataType,
          enumOptionsJson: null,
          displayOrder: initialDetail.columns.indexOf(c),
          isRequired: false,
          isEditable: c.isEditable,
        }))
      )
      setEntries(buildEntriesFromDetail(initialDetail))
      setLoading(false)
      return
    }
    let cancelled = false
    fetchDetail(scheduleId).then(d => {
      if (cancelled) return
      if (d) {
        setDetail(d)
        setColumns(
          d.columns.map((c, i) => ({
            scheduleColumnId: c.scheduleColumnId,
            columnKey: c.columnKey,
            columnLabel: c.columnLabel,
            dataType: c.dataType,
            enumOptionsJson: null,
            displayOrder: i,
            isRequired: false,
            isEditable: c.isEditable,
          }))
        )
        setEntries(buildEntriesFromDetail(d))
      } else {
        setError('Schedule not found')
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [scheduleId, initialDetail, fetchDetail])

  const columnDefs: ColumnDef[] = columns
    .filter((c): c is ScheduleColumnItem & { scheduleColumnId: number } => {
      const id = (c as ScheduleColumnItem & { scheduleColumnId?: number }).scheduleColumnId
      return typeof id === 'number' && id > 0
    })
    .map(c => ({
      scheduleColumnId: c.scheduleColumnId,
      columnKey: c.columnKey,
      columnLabel: c.columnLabel,
      dataType: c.dataType,
      isEditable: c.isEditable,
    }))

  const saveColumns = useCallback(
    async (cols: ScheduleColumnItem[]) => {
      const res = await fetch(`/api/backend/schedules/${scheduleId}/columns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          columns: cols.map(c => ({
            scheduleColumnId: c.scheduleColumnId,
            columnKey: c.columnKey,
            columnLabel: c.columnLabel,
            dataType: c.dataType,
            enumOptionsJson: c.enumOptionsJson ?? null,
            displayOrder: c.displayOrder,
            isRequired: c.isRequired,
            isEditable: c.isEditable,
          })),
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Error ${res.status}`)
      }
      const updated = await res.json()
      if (Array.isArray(updated)) {
        setColumns(
          updated.map((c: { scheduleColumnId: number; columnKey: string; columnLabel: string; dataType: string; isRequired: boolean; isEditable: boolean }, i: number) => ({
            scheduleColumnId: c.scheduleColumnId,
            columnKey: c.columnKey,
            columnLabel: c.columnLabel,
            dataType: c.dataType,
            displayOrder: i,
            isRequired: c.isRequired,
            isEditable: c.isEditable,
          }))
        )
      }
    },
    [scheduleId]
  )

  const saveEntries = useCallback(
    async (ents: GridEntry[]) => {
      const payload = {
        entries: ents.map(e => {
          const values = columnDefs.map(col => {
            const v = e.values[col.columnKey]
            return { columnKey: col.columnKey, ...valueToPayload(col, v ?? null) }
          })
          return {
            scheduleEntryId: e.scheduleEntryId,
            assetId: e.assetId,
            sheetId: e.sheetId,
            rowDataJson: null,
            values,
          }
        }),
      }
      const res = await fetch(`/api/backend/schedules/${scheduleId}/entries`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Error ${res.status}`)
      }
    },
    [scheduleId, columnDefs]
  )

  const openAssetPicker = useCallback((onSelect: (assetId: number, assetTag: string) => void) => {
    setAssetPickerOpen(true)
    const input = window.prompt('Search assets (q): enter text and we will fetch /assets?q=...')
    if (input == null) {
      setAssetPickerOpen(false)
      return
    }
    fetch(`/api/backend/assets?q=${encodeURIComponent(input)}`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((list: Array<{ assetId: number; assetTag: string; assetName?: string }>) => {
        setAssetPickerOpen(false)
        if (list.length === 0) return
        const first = list[0]
        onSelect(first.assetId, first.assetTag || String(first.assetId))
      })
      .catch(() => {
        setAssetPickerOpen(false)
      })
  }, [])

  if (loading) return <div className="p-4">Loading schedule…</div>
  if (error) return <div className="p-4 text-red-600">{error}</div>
  if (!detail) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{detail.schedule.name}</h2>
        {detail.schedule.scope && <p className="text-gray-600">{detail.schedule.scope}</p>}
      </div>

      <ScheduleColumnsEditor
        columns={columns}
        onChange={setColumns}
        onSave={saveColumns}
        disabled={assetPickerOpen}
      />

      <ScheduleGrid
        columns={columnDefs.filter(c => c.scheduleColumnId > 0)}
        entries={entries}
        onChangeEntries={setEntries}
        onSaveEntries={saveEntries}
        onOpenAssetPicker={openAssetPicker}
        disabled={assetPickerOpen}
      />
    </div>
  )
}
