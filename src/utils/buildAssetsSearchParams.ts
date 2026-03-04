/**
 * Pure helper: build GET /api/backend/assets query string.
 * Trims/collapses spaces, drops empties, uppercases criticality, clamps take/skip, stable order.
 */
export type AssetsSearchParamsInput = {
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

function collapseSpaces(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

function normString(value: string | undefined): string | null {
  if (value == null) return null
  const t = collapseSpaces(value)
  return t === '' ? null : t
}

function clampTake(n: number | undefined): number {
  const v = n != null && Number.isFinite(n) ? Math.trunc(n) : 50
  if (v < 1) return 1
  if (v > 200) return 200
  return v
}

function clampSkip(n: number | undefined): number {
  const v = n != null && Number.isFinite(n) ? Math.trunc(n) : 0
  return v < 0 ? 0 : v
}

/** Normalized params (take/skip required). Same normalization as buildAssetsSearchParams. */
export type NormalizedAssetsSearchParams = AssetsSearchParamsInput & { take: number; skip: number }

function getFirst(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined
  return Array.isArray(value) ? value[0] : value
}

/**
 * Parse Next.js searchParams record into normalized params (same rules as buildAssetsSearchParams).
 */
export function parseAssetsSearchParamsFromRecord(
  record: Record<string, string | string[] | undefined>
): NormalizedAssetsSearchParams {
  const q = normString(getFirst(record.q))
  const location = normString(getFirst(record.location))
  const system = normString(getFirst(record.system))
  const service = normString(getFirst(record.service))
  const criticalityRaw = normString(getFirst(record.criticality))
  const criticality = criticalityRaw != null ? criticalityRaw.toUpperCase() : undefined
  const clientIdRaw = getFirst(record.clientId)
  const clientId = clientIdRaw != null && clientIdRaw !== '' ? Number(clientIdRaw) : undefined
  const projectIdRaw = getFirst(record.projectId)
  const projectId = projectIdRaw != null && projectIdRaw !== '' ? Number(projectIdRaw) : undefined
  const disciplineIdRaw = getFirst(record.disciplineId)
  const disciplineId = disciplineIdRaw != null && disciplineIdRaw !== '' ? Number(disciplineIdRaw) : undefined
  const subtypeIdRaw = getFirst(record.subtypeId)
  const subtypeId = subtypeIdRaw != null && subtypeIdRaw !== '' ? Number(subtypeIdRaw) : undefined
  const take = clampTake(record.take != null ? Number(getFirst(record.take)) : undefined)
  const skip = clampSkip(record.skip != null ? Number(getFirst(record.skip)) : undefined)
  return {
    q: q ?? undefined,
    criticality,
    location: location ?? undefined,
    system: system ?? undefined,
    service: service ?? undefined,
    clientId: Number.isFinite(clientId) ? clientId : undefined,
    projectId: Number.isFinite(projectId) ? projectId : undefined,
    disciplineId: Number.isFinite(disciplineId) ? disciplineId : undefined,
    subtypeId: Number.isFinite(subtypeId) ? subtypeId : undefined,
    take,
    skip,
  }
}

export function buildAssetsSearchParams(params: AssetsSearchParamsInput): string {
  const q = normString(params.q)
  const location = normString(params.location)
  const system = normString(params.system)
  const service = normString(params.service)
  const criticalityRaw = normString(params.criticality)
  const criticality = criticalityRaw != null ? criticalityRaw.toUpperCase() : null
  const take = clampTake(params.take)
  const skip = clampSkip(params.skip)

  const sp = new URLSearchParams()
  if (q != null) sp.set('q', q)
  if (params.clientId != null) sp.set('clientId', String(params.clientId))
  if (params.projectId != null) sp.set('projectId', String(params.projectId))
  if (params.disciplineId != null) sp.set('disciplineId', String(params.disciplineId))
  if (params.subtypeId != null) sp.set('subtypeId', String(params.subtypeId))
  if (location != null) sp.set('location', location)
  if (system != null) sp.set('system', system)
  if (service != null) sp.set('service', service)
  if (criticality != null) sp.set('criticality', criticality)
  sp.set('take', String(take))
  sp.set('skip', String(skip))

  return sp.toString().replace(/\+/g, '%20')
}
