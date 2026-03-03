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

export type AssetDetail = {
  assetId: number
  assetTag: string
  assetName: string | null
  location: string | null
  system: string | null
  service: string | null
  criticality: string | null
  disciplineId: number | null
  subtypeId: number | null
  clientId: number | null
  projectId: number | null
}

export type AssetCustomFieldValue = {
  customFieldId: number
  fieldKey: string
  displayLabel: string
  dataType: string
  sortOrder: number
  valueString: string | null
  valueNumber: number | null
  valueBool: boolean | null
  valueDate: Date | null
  valueJson: string | null
}

export async function getAssetCustomFields(
  accountId: number,
  assetId: number
): Promise<AssetCustomFieldValue[]> {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('AssetID', sql.Int, assetId)
    .query<AssetCustomFieldValue>(`
      SELECT
        d.CustomFieldID AS customFieldId,
        d.FieldKey AS fieldKey,
        d.DisplayLabel AS displayLabel,
        d.DataType AS dataType,
        d.SortOrder AS sortOrder,
        v.ValueString AS valueString,
        v.ValueNumber AS valueNumber,
        v.ValueBool AS valueBool,
        v.ValueDate AS valueDate,
        v.ValueJson AS valueJson
      FROM dbo.CustomFieldDefinitions d
      LEFT JOIN dbo.CustomFieldValues v
        ON v.AccountID = d.AccountID
        AND v.EntityType = 'asset'
        AND v.EntityID = @AssetID
        AND v.CustomFieldID = d.CustomFieldID
      WHERE d.AccountID = @AccountID
        AND d.EntityType = 'asset'
      ORDER BY d.SortOrder
    `)

  return result.recordset ?? []
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

export async function getAssetById(
  accountId: number,
  assetId: number
): Promise<AssetDetail | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('AssetID', sql.Int, assetId)
    .query<AssetDetail>(`
      SELECT TOP 1
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
        AND a.AssetID = @AssetID
    `)

  return result.recordset?.[0] ?? null
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

export interface UpsertAssetInput {
  accountId: number
  assetTag: string
  assetTagNorm: string
  assetName?: string | null
  location?: string | null
  system?: string | null
  service?: string | null
  criticality?: string | null
  disciplineId?: number | null
  subtypeId?: number | null
  clientId?: number | null
  projectId?: number | null
}

export interface UpsertAssetResult {
  assetId: number
  action: 'created' | 'updated'
}

export async function upsertAsset(
  input: UpsertAssetInput,
  transaction?: sql.Transaction
): Promise<UpsertAssetResult> {
  const request = transaction ? transaction.request() : (await poolPromise).request()
  
  // Check if exists using AssetTagNorm (idempotency constraint)
  const existing = await request
    .input('AccountID', sql.Int, input.accountId)
    .input('AssetTagNorm', sql.NVarChar(255), input.assetTagNorm)
    .query<{ AssetID: number }>(`
      SELECT AssetID FROM dbo.Assets WITH (UPDLOCK, HOLDLOCK)
      WHERE AccountID = @AccountID AND AssetTagNorm = @AssetTagNorm
    `)

  if (existing.recordset.length > 0) {
    // Update existing
    const assetId = existing.recordset[0].AssetID
    const updateRequest = transaction ? transaction.request() : (await poolPromise).request()
    await updateRequest
      .input('AssetID', sql.Int, assetId)
      .input('AssetTag', sql.NVarChar(255), input.assetTag)
      .input('AssetName', sql.NVarChar(255), input.assetName ?? null)
      .input('Location', sql.NVarChar(255), input.location ?? null)
      .input('System', sql.NVarChar(255), input.system ?? null)
      .input('Service', sql.NVarChar(255), input.service ?? null)
      .input('Criticality', sql.NVarChar(50), input.criticality ?? null)
      .input('DisciplineID', sql.Int, input.disciplineId ?? null)
      .input('SubtypeID', sql.Int, input.subtypeId ?? null)
      .input('ClientID', sql.Int, input.clientId ?? null)
      .input('ProjectID', sql.Int, input.projectId ?? null)
      .query(`
        UPDATE dbo.Assets
        SET AssetTag = @AssetTag,
            AssetName = @AssetName,
            Location = @Location,
            System = @System,
            Service = @Service,
            Criticality = @Criticality,
            DisciplineID = @DisciplineID,
            SubtypeID = @SubtypeID,
            ClientID = @ClientID,
            ProjectID = @ProjectID
        WHERE AssetID = @AssetID
      `)
    return { assetId, action: 'updated' }
  } else {
    // Insert new
    const insertRequest = transaction ? transaction.request() : (await poolPromise).request()
    const result = await insertRequest
      .input('AccountID', sql.Int, input.accountId)
      .input('AssetTag', sql.NVarChar(255), input.assetTag)
      .input('AssetTagNorm', sql.NVarChar(255), input.assetTagNorm)
      .input('AssetName', sql.NVarChar(255), input.assetName ?? null)
      .input('Location', sql.NVarChar(255), input.location ?? null)
      .input('System', sql.NVarChar(255), input.system ?? null)
      .input('Service', sql.NVarChar(255), input.service ?? null)
      .input('Criticality', sql.NVarChar(50), input.criticality ?? null)
      .input('DisciplineID', sql.Int, input.disciplineId ?? null)
      .input('SubtypeID', sql.Int, input.subtypeId ?? null)
      .input('ClientID', sql.Int, input.clientId ?? null)
      .input('ProjectID', sql.Int, input.projectId ?? null)
      .query<{ AssetID: number }>(`
        INSERT INTO dbo.Assets (AccountID, AssetTag, AssetTagNorm, AssetName, Location, System, Service, Criticality, DisciplineID, SubtypeID, ClientID, ProjectID)
        OUTPUT INSERTED.AssetID
        VALUES (@AccountID, @AssetTag, @AssetTagNorm, @AssetName, @Location, @System, @Service, @Criticality, @DisciplineID, @SubtypeID, @ClientID, @ProjectID)
      `)
    const assetId = result.recordset[0].AssetID
    return { assetId, action: 'created' }
  }
}

export async function getAssetsByTagNorms(
  accountId: number,
  tagNorms: string[]
): Promise<Map<string, number>> {
  if (tagNorms.length === 0) return new Map()
  const pool = await poolPromise
  // Build IN clause safely (limit to 1000 items for safety)
  const limitedNorms = tagNorms.slice(0, 1000)
  const placeholders = limitedNorms.map((_, i) => `@TagNorm${i}`).join(',')
  const request = pool.request().input('AccountID', sql.Int, accountId)
  limitedNorms.forEach((norm, i) => {
    request.input(`TagNorm${i}`, sql.NVarChar(255), norm)
  })
  const result = await request.query<{ AssetTagNorm: string; AssetID: number }>(`
    SELECT AssetTagNorm, AssetID
    FROM dbo.Assets
    WHERE AccountID = @AccountID
      AND AssetTagNorm IN (${placeholders})
  `)
  const map = new Map<string, number>()
  for (const row of result.recordset) {
    map.set(row.AssetTagNorm, row.AssetID)
  }
  return map
}
