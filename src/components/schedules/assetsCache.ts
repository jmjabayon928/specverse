'use client'

export type AssetSearchParams = {
  q?: string
  location?: string
  system?: string
  service?: string
  criticality?: string
  disciplineId?: number
  subtypeId?: number
  clientId?: number
  projectId?: number
  take: number
  skip: number
}

export type AssetListItem = {
  assetId: number
  assetTag: string
  assetName?: string | null
  [key: string]: unknown
}

const TTL_MS = 15000
const MAX = 25
const cache = new Map<string, { ts: number; data: AssetListItem[] }>()
const inFlight = new Map<string, Promise<AssetListItem[]>>()

function evictIfNeeded(): void {
  if (cache.size <= MAX) return
  const entries = Array.from(cache.entries()).sort((a, b) => {
    const ts = a[1].ts - b[1].ts
    if (ts !== 0) return ts
    return a[0].localeCompare(b[0])
  })
  const toRemove = entries.length - MAX
  for (let i = 0; i < toRemove; i++) {
    cache.delete(entries[i][0])
  }
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ')
}

function normalizeString(value: string | undefined): string | null {
  if (value == null) return null
  const trimmed = collapseSpaces(value.trim())
  if (trimmed === '') return null
  return trimmed
}

function normalizeCriticality(value: string | undefined): string | null {
  const normalized = normalizeString(value)
  if (normalized == null) return null
  return normalized.toUpperCase()
}

export function normalizeScopeKey(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  if (typeof value !== 'string') return 'unknown'
  const normalized = collapseSpaces(value.trim())
  if (normalized === '') return 'unknown'
  return normalized
}

function clampTake(value: number | undefined): number {
  const fallback = 50
  const raw = value ?? fallback
  const safe = Number.isFinite(raw) ? raw : fallback
  const int = Math.trunc(safe)
  if (int < 1) return 1
  if (int > 200) return 200
  return int
}

function clampSkip(value: number | undefined): number {
  const raw = value ?? 0
  const safe = Number.isFinite(raw) ? raw : 0
  const int = Math.trunc(safe)
  if (int < 0) return 0
  return int
}

export function buildAssetsQuery(params: AssetSearchParams, scopeKey?: string): string {
  const sp = new URLSearchParams()

  const scope = normalizeScopeKey(scopeKey)
  const q = normalizeString(params.q)
  const location = normalizeString(params.location)
  const system = normalizeString(params.system)
  const service = normalizeString(params.service)
  const criticality = normalizeCriticality(params.criticality)
  const take = clampTake(params.take)
  const skip = clampSkip(params.skip)

  // Stable key ordering (matches backend-style normalization)
  sp.append('scope', scope)
  if (q != null) sp.append('q', q)
  if (params.clientId != null) sp.append('clientId', String(params.clientId))
  if (params.projectId != null) sp.append('projectId', String(params.projectId))
  if (params.disciplineId != null) sp.append('disciplineId', String(params.disciplineId))
  if (params.subtypeId != null) sp.append('subtypeId', String(params.subtypeId))
  if (location != null) sp.append('location', location)
  if (system != null) sp.append('system', system)
  if (service != null) sp.append('service', service)
  if (criticality != null) sp.append('criticality', criticality)
  sp.append('take', String(take))
  sp.append('skip', String(skip))

  return sp.toString().replace(/\+/g, '%20')
}

export function getFromCache(key: string): AssetListItem[] | null {
  const now = Date.now()
  const entry = cache.get(key)
  if (entry == null || now - entry.ts >= TTL_MS) return null
  return entry.data
}

export function isAssetListArray(value: unknown): value is AssetListItem[] {
  if (!Array.isArray(value)) return false
  for (const item of value) {
    if (item == null || typeof item !== 'object') return false
    const rec = item as Record<string, unknown>
    if (typeof rec.assetId !== 'number') return false
    if (typeof rec.assetTag !== 'string') return false
  }
  return true
}

export function setInCache(key: string, data: AssetListItem[]): void {
  cache.set(key, { ts: Date.now(), data })
  evictIfNeeded()
}

export function getInFlight(key: string): Promise<AssetListItem[]> | null {
  return inFlight.get(key) ?? null
}

export function setInFlight(key: string, promise: Promise<AssetListItem[]>): void {
  inFlight.set(key, promise)
}

export function clearInFlight(key: string): void {
  inFlight.delete(key)
}

export function clearAssetsCacheForTesting(): void {
  cache.clear()
  inFlight.clear()
}
