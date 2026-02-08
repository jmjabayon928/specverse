// src/backend/repositories/assetsRepository.ts
import { poolPromise, sql } from '../config/db'
import type { AssetListItem } from '@/domain/schedules/scheduleTypes'

export type AssetsListFilters = {
  clientId?: number
  projectId?: number
  disciplineId?: number
  subtypeId?: number
  q?: string
}

export async function listAssets(
  accountId: number,
  filters: AssetsListFilters
): Promise<AssetListItem[]> {
  const pool = await poolPromise
  let query = `
    SELECT
      a.AssetID AS assetId,
      a.AssetTag AS assetTag,
      a.AssetName AS assetName,
      a.Location AS location,
      a.System AS system,
      a.Service AS service,
      a.Criticality AS criticality,
      a.DisciplineID AS disciplineId,
      a.SubtypeID AS subtypeId,
      a.ClientID AS clientId,
      a.ProjectID AS projectId
    FROM dbo.Assets a
    WHERE a.AccountID = @AccountID
  `
  const request = pool.request().input('AccountID', sql.Int, accountId)

  if (filters.clientId != null) {
    query += ' AND a.ClientID = @ClientID'
    request.input('ClientID', sql.Int, filters.clientId)
  }
  if (filters.projectId != null) {
    query += ' AND a.ProjectID = @ProjectID'
    request.input('ProjectID', sql.Int, filters.projectId)
  }
  if (filters.disciplineId != null) {
    query += ' AND a.DisciplineID = @DisciplineID'
    request.input('DisciplineID', sql.Int, filters.disciplineId)
  }
  if (filters.subtypeId != null) {
    query += ' AND a.SubtypeID = @SubtypeID'
    request.input('SubtypeID', sql.Int, filters.subtypeId)
  }
  if (filters.q != null && filters.q.trim() !== '') {
    query += ' AND (a.AssetTag LIKE @Q OR a.AssetTagNorm LIKE @QNorm OR a.AssetName LIKE @Q)'
    const q = `%${filters.q.trim()}%`
    request.input('Q', sql.NVarChar(255), q)
    request.input('QNorm', sql.NVarChar(255), q)
  }

  query += ' ORDER BY a.AssetTag'

  const result = await request.query(query)
  return (result.recordset ?? []) as AssetListItem[]
}

export async function assetBelongsToAccount(
  assetId: number,
  accountId: number
): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AssetID', sql.Int, assetId)
    .input('AccountID', sql.Int, accountId)
    .query<{ Ex: number }>(
      'SELECT 1 AS Ex FROM dbo.Assets WHERE AssetID = @AssetID AND AccountID = @AccountID'
    )
  return (result.recordset?.length ?? 0) > 0
}
