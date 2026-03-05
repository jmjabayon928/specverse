// src/backend/repositories/systemAssetsRepository.ts
import { poolPromise, sql } from '../config/db'
import { normalizeTag } from '../utils/normalizeTag'

/** Escape %, _, [ and \ for SQL LIKE with ESCAPE '\\'. */
function escapeLike(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
}

export type SystemAssetsListFilters = {
  q?: string
  status?: string
  take: number
  skip: number
}

export type SystemAssetRow = {
  assetId: number
  assetTag: string
  assetName: string | null
  location: string | null
  status: string
}

/**
 * Get SystemName for a given systemId, validating it belongs to facility and account.
 * Returns null if system not found or doesn't belong.
 */
export async function getSystemNameForSystem(
  accountId: number,
  facilityId: number,
  systemId: number
): Promise<string | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('FacilityID', sql.Int, facilityId)
    .input('SystemID', sql.Int, systemId)
    .query<{ SystemName: string }>(`
      SELECT TOP 1 SystemName
      FROM dbo.FacilitySystems
      WHERE SystemID = @SystemID AND FacilityID = @FacilityID AND AccountID = @AccountID
    `)
  return result.recordset?.[0]?.SystemName ?? null
}

/**
 * List assets for a given system name (string match).
 * Returns paginated list with total count.
 */
export async function listAssetsForSystemName(
  accountId: number,
  systemName: string,
  filters: SystemAssetsListFilters
): Promise<{ items: SystemAssetRow[]; total: number }> {
  const pool = await poolPromise
  let query = `
    SELECT
      a.AssetID AS assetId,
      a.AssetTag AS assetTag,
      a.AssetName AS assetName,
      a.Location AS location,
      a.Status AS status,
      COUNT(*) OVER() AS total
    FROM dbo.Assets a
    WHERE a.AccountID = @AccountID
      AND a.System IS NOT NULL
      AND LTRIM(RTRIM(UPPER(a.System))) = LTRIM(RTRIM(UPPER(@SystemName)))
  `
  const request = pool.request()
    .input('AccountID', sql.Int, accountId)
    .input('SystemName', sql.NVarChar(400), systemName)

  // Default to Active status if status filter is not provided
  const statusFilter = filters.status != null && filters.status.trim() !== '' 
    ? filters.status.trim() 
    : 'Active'
  query += ' AND a.Status = @Status'
  request.input('Status', sql.VarChar(20), statusFilter)

  if (filters.q != null && filters.q.trim() !== '') {
    const qTrim = filters.q.trim()
    const qNormPrefix = escapeLike(normalizeTag(qTrim)) + '%'
    const qContains = '%' + escapeLike(qTrim) + '%'
    query += ` AND (a.AssetTagNorm LIKE @QNormPrefix ESCAPE '\\' OR a.AssetTag LIKE @QNormPrefix ESCAPE '\\' OR a.AssetName LIKE @QContains ESCAPE '\\')`
    request.input('QNormPrefix', sql.NVarChar(255), qNormPrefix)
    request.input('QContains', sql.NVarChar(255), qContains)
  }

  request.input('Skip', sql.Int, filters.skip)
  request.input('Take', sql.Int, filters.take)
  query += `
    ORDER BY a.AssetTag ASC, a.AssetID ASC
    OFFSET @Skip ROWS
    FETCH NEXT @Take ROWS ONLY
    OPTION (OPTIMIZE FOR UNKNOWN)
  `

  const result = await request.query<SystemAssetRow & { total: number }>(query)
  const rows = result.recordset ?? []
  const total = rows.length > 0 ? rows[0].total : 0
  const items: SystemAssetRow[] = rows.map(r => ({
    assetId: r.assetId,
    assetTag: r.assetTag,
    assetName: r.assetName,
    location: r.location,
    status: r.status,
  }))

  return { items, total }
}
