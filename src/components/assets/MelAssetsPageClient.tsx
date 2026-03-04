'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { buildAssetsSearchParams, parseAssetsSearchParamsFromRecord } from '@/utils/buildAssetsSearchParams'
import type { MelAssetListItem, MelAssetsSearchParams } from './melTypes'
import MelAssetsFilters from './MelAssetsFilters'
import MelAssetsTable from './MelAssetsTable'

const DEBOUNCE_MS = 300
const URL_REPLACE_DEBOUNCE_MS = 200
const AUTH_MESSAGE = 'Session expired or insufficient permissions. Please refresh or sign in again.'

const DEBUG_KEY = 'SV_DEBUG_MEL_ASSETS'

function isDebug(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(DEBUG_KEY) === '1'
}

function debugLog(event: string, data: Record<string, unknown>): void {
  if (!isDebug()) return
  const parts = [event, JSON.stringify(data)]
  console.info(`[MEL] ${parts.join(' ')}`)
}

type InitialParams = {
  q?: string
  criticality?: string
  location?: string
  system?: string
  service?: string
  clientId?: number
  projectId?: number
  disciplineId?: number
  subtypeId?: number
  take?: number
  skip?: number
}

type Props = {
  initialParams?: InitialParams
  initialQueryString?: string
}

function toSearchParams(init: InitialParams = {}): MelAssetsSearchParams {
  const take = init.take != null && init.take >= 1 && init.take <= 200 ? init.take : 50
  const skip = init.skip != null && init.skip >= 0 ? Math.trunc(init.skip) : 0
  return {
    q: init.q,
    criticality: init.criticality,
    location: init.location,
    system: init.system,
    service: init.service,
    clientId: init.clientId,
    projectId: init.projectId,
    disciplineId: init.disciplineId,
    subtypeId: init.subtypeId,
    take,
    skip,
  }
}

function searchParamsToRecord(
  searchParams: ReturnType<typeof useSearchParams>
): Record<string, string | string[] | undefined> {
  const record: Record<string, string | string[] | undefined> = {}
  searchParams.forEach((value, key) => {
    const existing = record[key]
    if (existing === undefined) record[key] = value
    else if (Array.isArray(existing)) existing.push(value)
    else record[key] = [existing, value]
  })
  return record
}

export default function MelAssetsPageClient({ initialParams, initialQueryString }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [params, setParams] = useState<MelAssetsSearchParams>(() => toSearchParams(initialParams))
  const [qInput, setQInput] = useState(initialParams?.q ?? '')
  const [debouncedQ, setDebouncedQ] = useState(initialParams?.q ?? '')
  const [rows, setRows] = useState<MelAssetListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const replaceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWrittenQueryRef = useRef<string | null>(null)
  const lastAppliedQueryRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)

  const urlRecord = useMemo(
    () => searchParamsToRecord(searchParams),
    [searchParams]
  )
  const urlNormalized = useMemo(
    () => buildAssetsSearchParams(parseAssetsSearchParamsFromRecord(urlRecord)),
    [urlRecord]
  )

  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true
    lastWrittenQueryRef.current = initialQueryString ?? null
    if (initialQueryString != null) {
      debugLog('init', { initialQueryString })
    }
  }, [initialQueryString])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(qInput)
      debounceRef.current = null
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [qInput])

  const fetchParams = useMemo(
    () => ({ ...params, q: debouncedQ }),
    [params, debouncedQ]
  )

  const queryString = useMemo(() => buildAssetsSearchParams(fetchParams), [fetchParams])

  const fetchAssets = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    const startMs = Date.now()
    setLoading(true)
    setError(null)
    setAuthError(false)
    const url = `/api/backend/assets?${queryString}`
    debugLog('fetch start', { queryString: queryString })
    fetch(url, { credentials: 'include', signal })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          setAuthError(true)
          setRows([])
          return { status: res.status, data: [] as MelAssetListItem[] }
        }
        if (!res.ok) {
          setError(`Request failed: ${res.status}`)
          setRows([])
          return { status: res.status, data: [] as MelAssetListItem[] }
        }
        return res.json().then((data: MelAssetListItem[]) => ({ status: res.status, data }))
      })
      .then(result => {
        if (signal.aborted) return
        setRows(Array.isArray(result.data) ? result.data : [])
        const durationMs = Date.now() - startMs
        debugLog('fetch end', {
          queryString,
          durationMs,
          status: result.status,
          cacheHit: false,
        })
      })
      .catch(err => {
        if (err?.name === 'AbortError') {
          debugLog('fetch abort', { queryString })
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load assets')
        setRows([])
        debugLog('fetch error', { queryString, message: err instanceof Error ? err.message : String(err) })
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false)
      })
  }, [queryString])

  useEffect(() => {
    if (lastAppliedQueryRef.current === null) {
      lastAppliedQueryRef.current = urlNormalized
      return
    }
    if (urlNormalized === lastWrittenQueryRef.current) return
    if (urlNormalized === lastAppliedQueryRef.current) return
    lastAppliedQueryRef.current = urlNormalized
    const parsed = parseAssetsSearchParamsFromRecord(urlRecord)
    const next = toSearchParams(parsed)
    setParams(next)
    const q = parsed.q ?? ''
    setQInput(q)
    setDebouncedQ(q)
    debugLog('url->state sync', { sourceUrl: urlNormalized, appliedQuery: urlNormalized })
  }, [urlNormalized, urlRecord])

  useEffect(() => {
    if (queryString === urlNormalized) return
    if (queryString === lastWrittenQueryRef.current) return
    if (replaceTimeoutRef.current) clearTimeout(replaceTimeoutRef.current)
    replaceTimeoutRef.current = setTimeout(() => {
      replaceTimeoutRef.current = null
      const prev = lastWrittenQueryRef.current
      lastWrittenQueryRef.current = queryString
      const search = queryString ? `?${queryString}` : ''
      startTransition(() => {
        router.replace(`${pathname}${search}`)
      })
      debugLog('state->url write', { oldQuery: prev ?? '', newQuery: queryString })
    }, URL_REPLACE_DEBOUNCE_MS)
    return () => {
      if (replaceTimeoutRef.current) clearTimeout(replaceTimeoutRef.current)
    }
  }, [queryString, urlNormalized, pathname, router])

  useEffect(() => {
    fetchAssets()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [fetchAssets])

  const handleParamsChange = useCallback((next: MelAssetsSearchParams) => {
    setParams(next)
  }, [])

  const handleSearchChange = useCallback((q: string) => {
    setQInput(q)
    setParams(prev => ({ ...prev, skip: 0 }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setQInput('')
    setDebouncedQ('')
    setParams(prev => ({
      ...prev,
      q: undefined,
      criticality: undefined,
      location: undefined,
      system: undefined,
      service: undefined,
      clientId: undefined,
      projectId: undefined,
      disciplineId: undefined,
      subtypeId: undefined,
      skip: 0,
    }))
  }, [])

  const onPrev = useCallback(() => {
    setParams(prev => ({ ...prev, skip: Math.max(0, prev.skip - prev.take) }))
  }, [])

  const onNext = useCallback(() => {
    setParams(prev => ({ ...prev, skip: prev.skip + prev.take }))
  }, [])

  const canPrev = params.skip > 0
  const displayParams = useMemo(() => ({ ...params, q: debouncedQ }), [params, debouncedQ])

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">MEL Assets</h1>
      <MelAssetsFilters
        params={displayParams}
        onParamsChange={handleParamsChange}
        onSearchChange={handleSearchChange}
        onClearFilters={handleClearFilters}
        debouncedQ={qInput}
      />
      {authError && (
        <p className="text-red-600 mb-2" role="alert">
          {AUTH_MESSAGE}
        </p>
      )}
      {error && !authError && (
        <div className="mb-2 flex items-center gap-2">
          <p className="text-red-600" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={() => fetchAssets()}
            className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >
            Retry
          </button>
        </div>
      )}
      {loading && <p className="text-gray-600 mb-2">Loading…</p>}
      {!loading && !authError && rows.length === 0 && (
        <p className="text-gray-600 mb-2">No assets match these filters.</p>
      )}
      {!loading && rows.length > 0 && <MelAssetsTable rows={rows} />}
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-3 py-1 border border-gray-300 rounded text-sm"
        >
          Next
        </button>
      </div>
    </div>
  )
}
