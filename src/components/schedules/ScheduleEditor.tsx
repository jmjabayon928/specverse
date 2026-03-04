'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ScheduleColumnsEditor, { type ScheduleColumnItem } from './ScheduleColumnsEditor'
import ScheduleGrid, { type ColumnDef, type GridEntry } from './ScheduleGrid'
import {
  buildAssetsQuery,
  getFromCache,
  getInFlight,
  setInFlight,
  clearInFlight,
  setInCache,
  isAssetListArray,
  normalizeScopeKey,
  type AssetListItem,
  type AssetSearchParams,
} from './assetsCache'

class AssetsAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssetsAuthError'
  }
}

async function fetchAssets(
  params: AssetSearchParams,
  signal: AbortSignal,
  scopeKey: string,
  allowCache: boolean
): Promise<AssetListItem[]> {
  const debug =
    typeof window !== 'undefined' && window.localStorage.getItem('SV_DEBUG_ASSETS') === '1'
  const key = buildAssetsQuery(params, scopeKey)
  if (signal.aborted) {
    if (debug) console.log(`[SV assets] cache=? inflight=? aborted=1 key="${key}"`)
    return []
  }

  if (allowCache) {
    const cached = getFromCache(key)
    if (cached != null) {
      if (debug) console.log(`[SV assets] cache=hit inflight=miss key="${key}"`)
      return cached
    }

    const inflight = getInFlight(key)
    if (inflight != null) {
      if (debug) console.log(`[SV assets] cache=miss inflight=hit key="${key}"`)
      try {
        const data = await inflight
        if (signal.aborted) return []
        return data
      } catch (err) {
        if (signal.aborted) return []
        if (err instanceof DOMException && err.name === 'AbortError') return []
        throw err
      }
    }
  } else if (debug) {
    console.log(`[SV assets] cache=disabled inflight=disabled key="${key}"`)
  }

  let status: number | null = null
  const startedAtMs = Date.now()

  const promise = (async (): Promise<AssetListItem[]> => {
    const res = await fetch(`/api/backend/assets?${key}`, { credentials: 'include', signal })
    status = res.status

    if (res.status === 401 || res.status === 403) {
      throw new AssetsAuthError(
        'Session expired or insufficient permissions. Please refresh or sign in again.'
      )
    }
    if (!res.ok) throw new Error(`Assets fetch failed: ${res.status}`)

    const raw = (await res.json()) as unknown
    if (!isAssetListArray(raw)) return []
    if (signal.aborted) return []

    if (allowCache) setInCache(key, raw)
    return raw
  })()

  if (allowCache) setInFlight(key, promise)
  try {
    const data = await promise
    if (debug) {
      const durationMs = Date.now() - startedAtMs
      console.log(
        `[SV assets] cache=miss inflight=miss status=${status ?? 'n/a'} durationMs=${durationMs} key="${key}"`
      )
    }
    if (signal.aborted) return []
    return data
  } catch (err) {
    if (debug) {
      const durationMs = Date.now() - startedAtMs
      const msg = err instanceof Error ? err.message : String(err)
      console.log(
        `[SV assets] cache=miss inflight=miss status=${status ?? 'n/a'} durationMs=${durationMs} error="${msg}" key="${key}"`
      )
    }
    if (signal.aborted) return []
    if (err instanceof DOMException && err.name === 'AbortError') return []
    throw err
  } finally {
    if (allowCache) clearInFlight(key)
  }
}

export type ScheduleDetail = {
  schedule: {
    scheduleId: number
    name: string
    scope: string | null
    facilityId: number | null
    spaceId: number | null
    systemId: number | null
    accountId?: number | null
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
  const [assetPickerQuery, setAssetPickerQuery] = useState('')
  const [assetPickerLocation, setAssetPickerLocation] = useState('')
  const [assetPickerSystem, setAssetPickerSystem] = useState('')
  const [assetPickerService, setAssetPickerService] = useState('')
  const [assetPickerCriticality, setAssetPickerCriticality] = useState<string>('')
  const [assetPickerSkip, setAssetPickerSkip] = useState(0)
  const [assetPickerTake] = useState(50)
  const [assetPickerResults, setAssetPickerResults] = useState<AssetListItem[]>([])
  const [assetPickerLoading, setAssetPickerLoading] = useState(false)
  const [assetPickerError, setAssetPickerError] = useState<string | null>(null)
  const assetPickerAbortRef = useRef<AbortController | null>(null)
  const assetPickerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const assetPickerOnSelectRef = useRef<((assetId: number, assetTag: string) => void) | null>(null)
  const assetPickerJustOpenedRef = useRef(false)
  const assetPickerRunImmediatelyRef = useRef(false)
  const assetPickerDebounceMsRef = useRef(250)
  const [activeAccountScopeKey, setActiveAccountScopeKey] = useState('unknown')
  const [activeAccountAllowCache, setActiveAccountAllowCache] = useState(false)
  const activeAccountFetchRef = useRef<Promise<void> | null>(null)

  // Facility/Space/System state
  const [facilityId, setFacilityId] = useState<number | null>(null)
  const [facilityName, setFacilityName] = useState<string | null>(null)
  const [spaceId, setSpaceId] = useState<number | null>(null)
  const [spaceName, setSpaceName] = useState<string | null>(null)
  const [systemId, setSystemId] = useState<number | null>(null)
  const [systemName, setSystemName] = useState<string | null>(null)

  const ensureActiveAccountScopeKey = useCallback(() => {
    if (activeAccountFetchRef.current) return
    activeAccountFetchRef.current = (async () => {
      try {
        const res = await fetch('/api/backend/sessions/active-account', {
          credentials: 'include',
        })
        if (!res.ok) {
          setActiveAccountScopeKey('unknown')
          setActiveAccountAllowCache(false)
          return
        }
        const raw = (await res.json()) as unknown
        if (raw == null || typeof raw !== 'object') {
          setActiveAccountScopeKey('unknown')
          setActiveAccountAllowCache(false)
          return
        }
        const rec = raw as Record<string, unknown>
        const normalized = normalizeScopeKey(rec.accountId)
        if (normalized === 'unknown') {
          setActiveAccountScopeKey('unknown')
          setActiveAccountAllowCache(false)
          return
        }
        setActiveAccountScopeKey(normalized)
        setActiveAccountAllowCache(true)
      } catch {
        setActiveAccountScopeKey('unknown')
        setActiveAccountAllowCache(false)
      }
    })().finally(() => {
      activeAccountFetchRef.current = null
    })
  }, [])

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
    assetPickerOnSelectRef.current = onSelect
    setAssetPickerQuery('')
    setAssetPickerLocation('')
    setAssetPickerSystem('')
    setAssetPickerService('')
    setAssetPickerCriticality('')
    setAssetPickerSkip(0)
    setAssetPickerResults([])
    setAssetPickerError(null)
    if (detail?.schedule.accountId == null) ensureActiveAccountScopeKey()
    assetPickerJustOpenedRef.current = true
    setAssetPickerOpen(true)
  }, [detail?.schedule.accountId, ensureActiveAccountScopeKey])

  useEffect(() => {
    if (!assetPickerOpen) return
    const run = () => {
      if (assetPickerAbortRef.current) {
        assetPickerAbortRef.current.abort()
      }
      assetPickerAbortRef.current = new AbortController()
      const signal = assetPickerAbortRef.current.signal
      setAssetPickerLoading(true)
      setAssetPickerError(null)
      const params: AssetSearchParams = {
        take: assetPickerTake,
        skip: assetPickerSkip,
      }
      const qTrim = assetPickerQuery.trim()
      if (qTrim !== '') params.q = qTrim
      const locTrim = assetPickerLocation.trim()
      if (locTrim !== '') params.location = locTrim
      const sysTrim = assetPickerSystem.trim()
      if (sysTrim !== '') params.system = sysTrim
      const svcTrim = assetPickerService.trim()
      if (svcTrim !== '') params.service = svcTrim
      const critTrim = assetPickerCriticality.trim()
      if (critTrim !== '') params.criticality = critTrim
      const scheduleAccountId = detail?.schedule.accountId
      const scopeKey =
        scheduleAccountId != null ? normalizeScopeKey(scheduleAccountId) : activeAccountScopeKey
      const allowCache = scheduleAccountId != null ? true : activeAccountAllowCache
      fetchAssets(params, signal, scopeKey, allowCache)
        .then(data => {
          if (signal.aborted) return
          setAssetPickerResults(data)
        })
        .catch(err => {
          if (signal.aborted) return
          if (err?.name === 'AbortError') return
          setAssetPickerError(err instanceof Error ? err.message : 'Failed to load assets')
          setAssetPickerResults([])
        })
        .finally(() => {
          if (!signal.aborted) setAssetPickerLoading(false)
        })
    }
    if (assetPickerJustOpenedRef.current) {
      assetPickerJustOpenedRef.current = false
      run()
      return
    }
    if (assetPickerRunImmediatelyRef.current) {
      assetPickerRunImmediatelyRef.current = false
      run()
      return
    }
    if (assetPickerDebounceRef.current) clearTimeout(assetPickerDebounceRef.current)
    const delay = assetPickerDebounceMsRef.current
    assetPickerDebounceRef.current = setTimeout(run, delay)
    return () => {
      if (assetPickerDebounceRef.current) {
        clearTimeout(assetPickerDebounceRef.current)
        assetPickerDebounceRef.current = null
      }
    }
  }, [
    assetPickerOpen,
    assetPickerQuery,
    assetPickerLocation,
    assetPickerSystem,
    assetPickerService,
    assetPickerCriticality,
    assetPickerSkip,
    assetPickerTake,
    detail?.schedule.accountId,
    activeAccountScopeKey,
    activeAccountAllowCache,
  ])

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

      {assetPickerOpen && (
        <div className="border p-4 rounded space-y-3">
          <h3 className="font-semibold">Select asset</h3>
          <div className="space-y-2">
            <label htmlFor="asset-picker-q" className="block text-sm font-medium">
              Search
            </label>
            <input
              id="asset-picker-q"
              type="text"
              value={assetPickerQuery}
              onChange={e => {
                assetPickerDebounceMsRef.current = 250
                setAssetPickerQuery(e.target.value)
                setAssetPickerSkip(0)
              }}
              placeholder="Search by tag or name..."
              className="w-full px-2 py-1 border rounded"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <label htmlFor="asset-picker-location" className="block text-sm font-medium">
                Location
              </label>
              <input
                id="asset-picker-location"
                type="text"
                value={assetPickerLocation}
                onChange={e => {
                  assetPickerDebounceMsRef.current = 150
                  setAssetPickerLocation(e.target.value)
                  setAssetPickerSkip(0)
                }}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label htmlFor="asset-picker-system" className="block text-sm font-medium">
                System
              </label>
              <input
                id="asset-picker-system"
                type="text"
                value={assetPickerSystem}
                onChange={e => {
                  assetPickerDebounceMsRef.current = 150
                  setAssetPickerSystem(e.target.value)
                  setAssetPickerSkip(0)
                }}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label htmlFor="asset-picker-service" className="block text-sm font-medium">
                Service
              </label>
              <input
                id="asset-picker-service"
                type="text"
                value={assetPickerService}
                onChange={e => {
                  assetPickerDebounceMsRef.current = 150
                  setAssetPickerService(e.target.value)
                  setAssetPickerSkip(0)
                }}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label htmlFor="asset-picker-criticality" className="block text-sm font-medium">
                Criticality
              </label>
              <select
                id="asset-picker-criticality"
                value={assetPickerCriticality}
                onChange={e => {
                  assetPickerDebounceMsRef.current = 150
                  setAssetPickerCriticality(e.target.value)
                  setAssetPickerSkip(0)
                }}
                className="w-full px-2 py-1 border rounded text-sm"
              >
                <option value="">Any</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={assetPickerSkip === 0}
              onClick={() => {
                assetPickerRunImmediatelyRef.current = true
                setAssetPickerSkip(s => Math.max(0, s - assetPickerTake))
              }}
              className="px-2 py-1 text-sm border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                assetPickerRunImmediatelyRef.current = true
                setAssetPickerSkip(s => s + assetPickerTake)
              }}
              className="px-2 py-1 text-sm border rounded"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => {
                setAssetPickerOpen(false)
                assetPickerOnSelectRef.current = null
              }}
              className="px-2 py-1 text-sm border rounded"
            >
              Cancel
            </button>
          </div>
          {assetPickerLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {assetPickerError != null && (
            <p className="text-sm text-red-600" role="alert">
              {assetPickerError}
            </p>
          )}
          {!assetPickerLoading && assetPickerResults.length === 0 && (
            <p className="text-sm text-gray-500">No results</p>
          )}
          {!assetPickerLoading && assetPickerResults.length > 0 && (
            <ul className="border rounded max-h-48 overflow-y-auto">
              {assetPickerResults.map(item => (
                <li
                  key={item.assetId}
                  className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={() => {
                    const onSelect = assetPickerOnSelectRef.current
                    setAssetPickerOpen(false)
                    assetPickerOnSelectRef.current = null
                    if (onSelect) onSelect(item.assetId, item.assetTag ?? String(item.assetId))
                  }}
                >
                  {item.assetTag}
                  {item.assetName != null && item.assetName !== '' ? ` – ${item.assetName}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
