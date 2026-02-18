'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ScheduleColumnsEditor, { type ScheduleColumnItem } from './ScheduleColumnsEditor'
import ScheduleGrid, { type ColumnDef, type GridEntry } from './ScheduleGrid'

export type ScheduleDetail = {
  schedule: {
    scheduleId: number
    name: string
    scope: string | null
    facilityId: number | null
    spaceId: number | null
    systemId: number | null
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

  // Facility/Space/System state
  const [facilityId, setFacilityId] = useState<number | null>(null)
  const [facilityName, setFacilityName] = useState<string | null>(null)
  const [spaceId, setSpaceId] = useState<number | null>(null)
  const [spaceName, setSpaceName] = useState<string | null>(null)
  const [systemId, setSystemId] = useState<number | null>(null)
  const [systemName, setSystemName] = useState<string | null>(null)

  // Picker state
  const [facilityPickerOpen, setFacilityPickerOpen] = useState(false)
  const [spacePickerOpen, setSpacePickerOpen] = useState(false)
  const [systemPickerOpen, setSystemPickerOpen] = useState(false)
  const [facilitySearchQuery, setFacilitySearchQuery] = useState('')
  const [spaceSearchQuery, setSpaceSearchQuery] = useState('')
  const [systemSearchQuery, setSystemSearchQuery] = useState('')
  const [facilitySearchResults, setFacilitySearchResults] = useState<Array<{ facilityId: number; facilityName: string }>>([])
  const [spaceSearchResults, setSpaceSearchResults] = useState<Array<{ spaceId: number; spaceName: string }>>([])
  const [systemSearchResults, setSystemSearchResults] = useState<Array<{ systemId: number; systemName: string }>>([])
  const [facilitySearchLoading, setFacilitySearchLoading] = useState(false)
  const [spaceSearchLoading, setSpaceSearchLoading] = useState(false)
  const [systemSearchLoading, setSystemSearchLoading] = useState(false)
  const facilityDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const spaceDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const systemDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const metadataSaveInFlightRef = useRef(false)
  const pendingMetadataRef = useRef<{ facilityId: number | null; spaceId: number | null; systemId: number | null } | null>(null)
  const [metadataSaveError, setMetadataSaveError] = useState<string | null>(null)

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
      setFacilityId(initialDetail.schedule.facilityId)
      setSpaceId(initialDetail.schedule.spaceId)
      setSystemId(initialDetail.schedule.systemId)
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
        setFacilityId(d.schedule.facilityId)
        setSpaceId(d.schedule.spaceId)
        setSystemId(d.schedule.systemId)
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

  const fetchSheetOptions = useCallback(
    async (q: string, limit: number): Promise<{ items: Array<{ sheetId: number; sheetName: string; status: string; disciplineName?: string | null; subtypeName?: string | null }>; total: number }> => {
      const res = await fetch(
        `/api/backend/schedules/sheet-options?q=${encodeURIComponent(q)}&limit=${limit}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    },
    []
  )

  const fetchFacilityOptions = useCallback(
    async (q: string, limit: number): Promise<{ items: Array<{ facilityId: number; facilityName: string }>; total: number }> => {
      const res = await fetch(
        `/api/backend/schedules/facility-options?q=${encodeURIComponent(q)}&limit=${limit}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    },
    []
  )

  const fetchSpaceOptions = useCallback(
    async (facilityId: number, q: string, limit: number): Promise<{ items: Array<{ spaceId: number; spaceName: string }>; total: number }> => {
      const res = await fetch(
        `/api/backend/schedules/space-options?facilityId=${facilityId}&q=${encodeURIComponent(q)}&limit=${limit}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    },
    []
  )

  const fetchSystemOptions = useCallback(
    async (facilityId: number, q: string, limit: number): Promise<{ items: Array<{ systemId: number; systemName: string }>; total: number }> => {
      const res = await fetch(
        `/api/backend/schedules/system-options?facilityId=${facilityId}&q=${encodeURIComponent(q)}&limit=${limit}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    },
    []
  )

  // Facility search debounce
  useEffect(() => {
    if (facilityDebounceRef.current) {
      clearTimeout(facilityDebounceRef.current)
    }
    if (!facilityPickerOpen || facilitySearchQuery.length < 2) {
      setFacilitySearchResults([])
      return
    }
    facilityDebounceRef.current = setTimeout(async () => {
      setFacilitySearchLoading(true)
      try {
        const result = await fetchFacilityOptions(facilitySearchQuery, 20)
        setFacilitySearchResults(result.items)
      } catch {
        setFacilitySearchResults([])
      } finally {
        setFacilitySearchLoading(false)
      }
    }, 300)
    return () => {
      if (facilityDebounceRef.current) {
        clearTimeout(facilityDebounceRef.current)
      }
    }
  }, [facilityPickerOpen, facilitySearchQuery, fetchFacilityOptions])

  // Space search debounce
  useEffect(() => {
    if (spaceDebounceRef.current) {
      clearTimeout(spaceDebounceRef.current)
    }
    if (!spacePickerOpen || !facilityId || spaceSearchQuery.length < 2) {
      setSpaceSearchResults([])
      return
    }
    spaceDebounceRef.current = setTimeout(async () => {
      setSpaceSearchLoading(true)
      try {
        const result = await fetchSpaceOptions(facilityId, spaceSearchQuery, 20)
        setSpaceSearchResults(result.items)
      } catch {
        setSpaceSearchResults([])
      } finally {
        setSpaceSearchLoading(false)
      }
    }, 300)
    return () => {
      if (spaceDebounceRef.current) {
        clearTimeout(spaceDebounceRef.current)
      }
    }
  }, [spacePickerOpen, facilityId, spaceSearchQuery, fetchSpaceOptions])

  // System search debounce
  useEffect(() => {
    if (systemDebounceRef.current) {
      clearTimeout(systemDebounceRef.current)
    }
    if (!systemPickerOpen || !facilityId || systemSearchQuery.length < 2) {
      setSystemSearchResults([])
      return
    }
    systemDebounceRef.current = setTimeout(async () => {
      setSystemSearchLoading(true)
      try {
        const result = await fetchSystemOptions(facilityId, systemSearchQuery, 20)
        setSystemSearchResults(result.items)
      } catch {
        setSystemSearchResults([])
      } finally {
        setSystemSearchLoading(false)
      }
    }, 300)
    return () => {
      if (systemDebounceRef.current) {
        clearTimeout(systemDebounceRef.current)
      }
    }
  }, [systemPickerOpen, facilityId, systemSearchQuery, fetchSystemOptions])

  const runMetadataSaveQueue = useCallback(async () => {
    metadataSaveInFlightRef.current = true
    while (true) {
      const pending = pendingMetadataRef.current
      if (!pending) break
      pendingMetadataRef.current = null
      try {
        const res = await fetch(`/api/backend/schedules/${scheduleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            facilityId: pending.facilityId,
            spaceId: pending.spaceId,
            systemId: pending.systemId,
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Error ${res.status}`)
        }
        setMetadataSaveError(null)
        setDetail(prev =>
          prev
            ? {
                ...prev,
                schedule: {
                  ...prev.schedule,
                  facilityId: pending.facilityId,
                  spaceId: pending.spaceId,
                  systemId: pending.systemId,
                },
              }
            : null
        )
      } catch (err) {
        setMetadataSaveError(err instanceof Error ? err.message : 'Save failed')
        break
      }
    }
    metadataSaveInFlightRef.current = false
    if (pendingMetadataRef.current) runMetadataSaveQueue()
  }, [scheduleId])

  const enqueueMetadataSave = useCallback(
    (nextState: { facilityId: number | null; spaceId: number | null; systemId: number | null }) => {
      pendingMetadataRef.current = nextState
      if (!metadataSaveInFlightRef.current) void runMetadataSaveQueue()
    },
    [runMetadataSaveQueue]
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

      <div className="border p-4 rounded space-y-4">
        <h3 className="font-semibold">Facility / Space / System</h3>
        {metadataSaveError && (
          <p className="text-red-600 text-sm" role="alert">
            {metadataSaveError}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Facility</label>
            {!facilityPickerOpen ? (
              <div className="flex gap-2">
                {facilityName ? (
                  <>
                    <span className="px-2 py-1 bg-gray-100 rounded">{facilityName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFacilityPickerOpen(true)
                        setFacilitySearchQuery('')
                      }}
                      className="px-2 py-1 text-sm border rounded"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFacilityId(null)
                        setFacilityName(null)
                        setSpaceId(null)
                        setSpaceName(null)
                        setSystemId(null)
                        setSystemName(null)
                        if (detail) {
                          setDetail({
                            ...detail,
                            schedule: {
                              ...detail.schedule,
                              facilityId: null,
                              spaceId: null,
                              systemId: null,
                            },
                          })
                        }
                        enqueueMetadataSave({ facilityId: null, spaceId: null, systemId: null })
                      }}
                      className="px-2 py-1 text-sm border rounded"
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setFacilityPickerOpen(true)
                      setFacilitySearchQuery('')
                    }}
                    className="px-2 py-1 text-sm border rounded"
                  >
                    Select Facility
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={facilitySearchQuery}
                  onChange={e => setFacilitySearchQuery(e.target.value)}
                  placeholder="Search facilities..."
                  className="w-full px-2 py-1 border rounded"
                  autoFocus
                />
                {facilitySearchLoading && <p className="text-sm text-gray-500">Searching...</p>}
                {!facilitySearchLoading && facilitySearchResults.length > 0 && (
                  <ul className="border rounded max-h-40 overflow-y-auto">
                    {facilitySearchResults.map(item => (
                      <li
                        key={item.facilityId}
                        className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setFacilityId(item.facilityId)
                          setFacilityName(item.facilityName)
                          setFacilityPickerOpen(false)
                          setSpaceId(null)
                          setSpaceName(null)
                          setSystemId(null)
                          setSystemName(null)
                          enqueueMetadataSave({
                            facilityId: item.facilityId,
                            spaceId: null,
                            systemId: null,
                          })
                        }}
                      >
                        {item.facilityName}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFacilityPickerOpen(false)
                    setFacilitySearchQuery('')
                  }}
                  className="px-2 py-1 text-sm border rounded"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Space</label>
            {!spacePickerOpen ? (
              <div className="flex gap-2">
                {spaceName ? (
                  <>
                    <span className="px-2 py-1 bg-gray-100 rounded">{spaceName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSpacePickerOpen(true)
                        setSpaceSearchQuery('')
                      }}
                      disabled={!facilityId}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSpaceId(null)
                        setSpaceName(null)
                        enqueueMetadataSave({ facilityId, spaceId: null, systemId })
                      }}
                      className="px-2 py-1 text-sm border rounded"
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSpacePickerOpen(true)
                      setSpaceSearchQuery('')
                    }}
                    disabled={!facilityId}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Select Space
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={spaceSearchQuery}
                  onChange={e => setSpaceSearchQuery(e.target.value)}
                  placeholder="Search spaces..."
                  className="w-full px-2 py-1 border rounded"
                  disabled={!facilityId}
                  autoFocus
                />
                {spaceSearchLoading && <p className="text-sm text-gray-500">Searching...</p>}
                {!spaceSearchLoading && spaceSearchResults.length > 0 && (
                  <ul className="border rounded max-h-40 overflow-y-auto">
                    {spaceSearchResults.map(item => (
                      <li
                        key={item.spaceId}
                        className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setSpaceId(item.spaceId)
                          setSpaceName(item.spaceName)
                          setSpacePickerOpen(false)
                          enqueueMetadataSave({ facilityId, spaceId: item.spaceId, systemId })
                        }}
                      >
                        {item.spaceName}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSpacePickerOpen(false)
                    setSpaceSearchQuery('')
                  }}
                  className="px-2 py-1 text-sm border rounded"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">System</label>
            {!systemPickerOpen ? (
              <div className="flex gap-2">
                {systemName ? (
                  <>
                    <span className="px-2 py-1 bg-gray-100 rounded">{systemName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSystemPickerOpen(true)
                        setSystemSearchQuery('')
                      }}
                      disabled={!facilityId}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSystemId(null)
                        setSystemName(null)
                        enqueueMetadataSave({ facilityId, spaceId, systemId: null })
                      }}
                      className="px-2 py-1 text-sm border rounded"
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSystemPickerOpen(true)
                      setSystemSearchQuery('')
                    }}
                    disabled={!facilityId}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Select System
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={systemSearchQuery}
                  onChange={e => setSystemSearchQuery(e.target.value)}
                  placeholder="Search systems..."
                  className="w-full px-2 py-1 border rounded"
                  disabled={!facilityId}
                  autoFocus
                />
                {systemSearchLoading && <p className="text-sm text-gray-500">Searching...</p>}
                {!systemSearchLoading && systemSearchResults.length > 0 && (
                  <ul className="border rounded max-h-40 overflow-y-auto">
                    {systemSearchResults.map(item => (
                      <li
                        key={item.systemId}
                        className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setSystemId(item.systemId)
                          setSystemName(item.systemName)
                          setSystemPickerOpen(false)
                          enqueueMetadataSave({ facilityId, spaceId, systemId: item.systemId })
                        }}
                      >
                        {item.systemName}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSystemPickerOpen(false)
                    setSystemSearchQuery('')
                  }}
                  className="px-2 py-1 text-sm border rounded"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
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
        fetchSheetOptions={fetchSheetOptions}
        disabled={assetPickerOpen}
      />
    </div>
  )
}
