// src/backend/repositories/facilitiesRepository.ts
import { poolPromise, sql } from '../config/db'

/** Escape LIKE special chars so @Like can be used with ESCAPE '\\'. */
function escapeLike(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
}

export type FacilityRow = {
  facilityId: number
  facilityName: string
  status: string | null
}

export type SystemRow = {
  systemId: number
  systemName: string
  status: string | null
}

export type FacilitiesListFilters = {
  q?: string
  status?: string
  take: number
  skip: number
}

export type SystemsListFilters = {
  q?: string
  take: number
  skip: number
}

export async function listFacilities(
  accountId: number,
  filters: FacilitiesListFilters
): Promise<{ items: FacilityRow[]; total: number }> {
  const pool = await poolPromise
  let query = `
    SELECT FacilityID AS facilityId, FacilityName AS facilityName, Status AS status
    FROM dbo.Facilities
    WHERE AccountID = @AccountID
  `
  let countQuery = `
    SELECT COUNT(*) AS total
    FROM dbo.Facilities
    WHERE AccountID = @AccountID
  `
  const request = pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('Skip', sql.Int, filters.skip)
    .input('Take', sql.Int, filters.take)

  const countRequest = pool.request().input('AccountID', sql.Int, accountId)

  // Default to Active-only if status filter not provided
  const statusFilter = filters.status != null && filters.status.trim() !== ''
    ? filters.status.trim()
    : 'Active'

  query += ' AND Status = @Status'
  countQuery += ' AND Status = @Status'
  request.input('Status', sql.NVarChar(50), statusFilter)
  countRequest.input('Status', sql.NVarChar(50), statusFilter)

  if (filters.q != null && filters.q.trim() !== '') {
    const escaped = escapeLike(filters.q.trim())
    const likePattern = `%${escaped}%`
    query += ' AND FacilityName LIKE @Like ESCAPE \'\\\''
    countQuery += ' AND FacilityName LIKE @Like ESCAPE \'\\\''
    request.input('Like', sql.NVarChar(400), likePattern)
    countRequest.input('Like', sql.NVarChar(400), likePattern)
  }

  // Get total count
  const countResult = await countRequest.query<{ total: number }>(countQuery)
  const total = countResult.recordset?.[0]?.total ?? 0

  query += ' ORDER BY FacilityName ASC, FacilityID ASC'
  query += ' OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY'

  const result = await request.query<FacilityRow>(query)
  return {
    items: result.recordset ?? [],
    total
  }
}

export async function getFacilityById(
  accountId: number,
  facilityId: number
): Promise<FacilityRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('FacilityID', sql.Int, facilityId)
    .query<FacilityRow>(`
      SELECT TOP 1 FacilityID AS facilityId, FacilityName AS facilityName, Status AS status
      FROM dbo.Facilities
      WHERE FacilityID = @FacilityID AND AccountID = @AccountID
    `)
  return result.recordset?.[0] ?? null
}

export async function listSystems(
  accountId: number,
  facilityId: number,
  filters: SystemsListFilters
): Promise<{ items: SystemRow[]; total: number }> {
  const pool = await poolPromise
  let query = `
    SELECT SystemID AS systemId, SystemName AS systemName, Status AS status
    FROM dbo.FacilitySystems
    WHERE AccountID = @AccountID AND FacilityID = @FacilityID
  `
  let countQuery = `
    SELECT COUNT(*) AS total
    FROM dbo.FacilitySystems
    WHERE AccountID = @AccountID AND FacilityID = @FacilityID
  `
  const request = pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('FacilityID', sql.Int, facilityId)
    .input('Skip', sql.Int, filters.skip)
    .input('Take', sql.Int, filters.take)

  const countRequest = pool.request()
    .input('AccountID', sql.Int, accountId)
    .input('FacilityID', sql.Int, facilityId)

  if (filters.q != null && filters.q.trim() !== '') {
    const escaped = escapeLike(filters.q.trim())
    const likePattern = `%${escaped}%`
    query += ' AND SystemName LIKE @Like ESCAPE \'\\\''
    countQuery += ' AND SystemName LIKE @Like ESCAPE \'\\\''
    request.input('Like', sql.NVarChar(400), likePattern)
    countRequest.input('Like', sql.NVarChar(400), likePattern)
  }

  // Get total count
  const countResult = await countRequest.query<{ total: number }>(countQuery)
  const total = countResult.recordset?.[0]?.total ?? 0

  query += ' ORDER BY SystemName ASC, SystemID ASC'
  query += ' OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY'

  const result = await request.query<SystemRow>(query)
  return {
    items: result.recordset ?? [],
    total
  }
}

export async function getSystemById(
  accountId: number,
  facilityId: number,
  systemId: number
): Promise<SystemRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('FacilityID', sql.Int, facilityId)
    .input('SystemID', sql.Int, systemId)
    .query<SystemRow>(`
      SELECT TOP 1 SystemID AS systemId, SystemName AS systemName, Status AS status
      FROM dbo.FacilitySystems
      WHERE SystemID = @SystemID AND FacilityID = @FacilityID AND AccountID = @AccountID
    `)
  return result.recordset?.[0] ?? null
}

export async function facilityBelongsToAccount(
  facilityId: number,
  accountId: number
): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('FacilityID', sql.Int, facilityId)
    .input('AccountID', sql.Int, accountId)
    .query<{ Ex: number }>(`
      SELECT 1 AS Ex FROM dbo.Facilities WHERE FacilityID = @FacilityID AND AccountID = @AccountID
    `)
  return (result.recordset?.length ?? 0) > 0
}

export async function systemBelongsToAccountAndFacility(
  systemId: number,
  accountId: number,
  facilityId: number
): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('SystemID', sql.Int, systemId)
    .input('AccountID', sql.Int, accountId)
    .input('FacilityID', sql.Int, facilityId)
    .query<{ Ex: number }>(`
      SELECT 1 AS Ex FROM dbo.FacilitySystems
      WHERE SystemID = @SystemID AND AccountID = @AccountID AND FacilityID = @FacilityID
    `)
  return (result.recordset?.length ?? 0) > 0
}
