// src/backend/database/valueSetQueries.ts
import type { Transaction } from 'mssql'
import { poolPromise, sql } from '../config/db'

export type ValueContextCode = 'Requirement' | 'Offered' | 'AsBuilt'

/**
 * Get ContextID for a context code. Codes: Requirement, Offered, AsBuilt.
 */
export async function getContextIdByCode(code: ValueContextCode): Promise<number | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('Code', sql.NVarChar(30), code)
    .query<{ ContextID: number }>(`
      SELECT ContextID FROM dbo.ValueContexts WHERE Code = @Code
    `)
  const row = result.recordset[0]
  return row?.ContextID ?? null
}

/**
 * Get ValueSetID for (sheetId, contextCode, partyId). Returns null if no set exists.
 */
export async function getValueSetId(
  sheetId: number,
  contextCode: ValueContextCode,
  partyId: number | null | undefined
): Promise<number | null> {
  const contextId = await getContextIdByCode(contextCode)
  if (contextId == null) return null

  const pool = await poolPromise
  const req = pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('ContextID', sql.Int, contextId)

  const result = await (partyId != null && partyId !== undefined
    ? req.input('PartyID', sql.Int, partyId).query<{ ValueSetID: number }>(`
        SELECT ValueSetID FROM dbo.InformationValueSets
        WHERE SheetID = @SheetID AND ContextID = @ContextID AND PartyID = @PartyID
      `)
    : req.query<{ ValueSetID: number }>(`
        SELECT ValueSetID FROM dbo.InformationValueSets
        WHERE SheetID = @SheetID AND ContextID = @ContextID AND PartyID IS NULL
      `))

  const row = result.recordset[0]
  return row?.ValueSetID ?? null
}

/**
 * Ensure exactly one Requirement ValueSet for the sheet (SheetID, Requirement, PartyID NULL).
 * Creates it if missing. Returns ValueSetID.
 */
export async function ensureRequirementValueSet(
  sheetId: number,
  userId: number | null | undefined
): Promise<number> {
  const existing = await getValueSetId(sheetId, 'Requirement', null)
  if (existing != null) return existing

  const contextId = await getContextIdByCode('Requirement')
  if (contextId == null) {
    throw new Error('ValueContexts.Requirement not found; run Phase 2 migration.')
  }

  const pool = await poolPromise
  const result = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('ContextID', sql.Int, contextId)
    .input('CreatedBy', sql.Int, userId ?? null)
    .query<{ ValueSetID: number }>(`
      INSERT INTO dbo.InformationValueSets (SheetID, ContextID, PartyID, Status, CreatedAt, CreatedBy)
      OUTPUT INSERTED.ValueSetID
      VALUES (@SheetID, @ContextID, NULL, 'Draft', GETDATE(), @CreatedBy)
    `)

  const row = result.recordset[0]
  if (row?.ValueSetID == null) {
    throw new Error('Failed to create Requirement ValueSet')
  }
  return row.ValueSetID
}

/**
 * Ensure exactly one Requirement ValueSet inside a transaction. Creates if missing. Returns ValueSetID.
 */
export async function ensureRequirementValueSetInTransaction(
  tx: Transaction,
  sheetId: number,
  userId: number | null | undefined,
  accountId: number
): Promise<number> {
  const contextIdResult = await tx.request().input('Code', sql.NVarChar(30), 'Requirement').query<{ ContextID: number }>(`
    SELECT ContextID FROM dbo.ValueContexts WHERE Code = @Code
  `)
  const contextId = contextIdResult.recordset[0]?.ContextID
  if (contextId == null) {
    throw new Error('ValueContexts.Requirement not found; run Phase 2 migration.')
  }

  const existingResult = await tx.request()
    .input('SheetID', sql.Int, sheetId)
    .input('ContextID', sql.Int, contextId)
    .query<{ ValueSetID: number }>(`
      SELECT ValueSetID FROM dbo.InformationValueSets
      WHERE SheetID = @SheetID AND ContextID = @ContextID AND PartyID IS NULL
    `)
  const existing = existingResult.recordset[0]?.ValueSetID
  if (existing != null) return existing

  const insertResult = await tx.request()
    .input('SheetID', sql.Int, sheetId)
    .input('ContextID', sql.Int, contextId)
    .input('CreatedBy', sql.Int, userId ?? null)
    .input('AccountID', sql.Int, accountId)
    .query<{ ValueSetID: number }>(`
      INSERT INTO dbo.InformationValueSets (SheetID, ContextID, PartyID, Status, CreatedAt, CreatedBy, AccountID)
      OUTPUT INSERTED.ValueSetID
      VALUES (@SheetID, @ContextID, NULL, 'Draft', GETDATE(), @CreatedBy, @AccountID)
    `)
  const row = insertResult.recordset[0]
  if (row?.ValueSetID == null) {
    throw new Error('Failed to create Requirement ValueSet')
  }
  return row.ValueSetID
}

/**
 * Create a ValueSet for (sheetId, contextCode, partyId?). Returns ValueSetID.
 */
export async function createValueSet(
  sheetId: number,
  contextCode: ValueContextCode,
  partyId: number | null | undefined,
  userId: number | null | undefined
): Promise<number> {
  const contextId = await getContextIdByCode(contextCode)
  if (contextId == null) {
    throw new Error(`ValueContexts.${contextCode} not found; run Phase 2 migration.`)
  }

  const pool = await poolPromise
  const result = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('ContextID', sql.Int, contextId)
    .input('PartyID', sql.Int, partyId ?? null)
    .input('CreatedBy', sql.Int, userId ?? null)
    .query<{ ValueSetID: number }>(`
      INSERT INTO dbo.InformationValueSets (SheetID, ContextID, PartyID, Status, CreatedAt, CreatedBy)
      OUTPUT INSERTED.ValueSetID
      VALUES (@SheetID, @ContextID, @PartyID, 'Draft', GETDATE(), @CreatedBy)
    `)

  const row = result.recordset[0]
  if (row?.ValueSetID == null) {
    throw new Error('Failed to create ValueSet')
  }
  return row.ValueSetID
}

export type ValueSetRow = {
  ValueSetID: number
  SheetID: number
  ContextID: number
  Code: string
  PartyID: number | null
  Status: string
}

/**
 * List ValueSets for a sheet.
 */
export async function listValueSets(sheetId: number): Promise<ValueSetRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<ValueSetRow>(`
      SELECT ivs.ValueSetID, ivs.SheetID, ivs.ContextID, vc.Code, ivs.PartyID, ivs.Status
      FROM dbo.InformationValueSets ivs
      JOIN dbo.ValueContexts vc ON vc.ContextID = ivs.ContextID
      WHERE ivs.SheetID = @SheetID
      ORDER BY vc.SortOrder, ivs.ValueSetID
    `)
  return result.recordset
}

/**
 * Get Status of a ValueSet. Returns null if not found.
 */
export async function getValueSetStatus(
  valueSetId: number
): Promise<'Draft' | 'Locked' | 'Verified' | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('ValueSetID', sql.Int, valueSetId)
    .query<{ Status: string }>(`
      SELECT Status FROM dbo.InformationValueSets WHERE ValueSetID = @ValueSetID
    `)
  const row = result.recordset[0]
  const status = row?.Status
  if (status === 'Draft' || status === 'Locked' || status === 'Verified') return status
  return null
}

export type ValueSetDetailRow = {
  ValueSetID: number
  SheetID: number
  ContextID: number
  Code: string
  PartyID: number | null
  Status: string
}

/**
 * Get ValueSet row by ID. Returns null if not found.
 */
export async function getValueSetRow(valueSetId: number): Promise<ValueSetDetailRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('ValueSetID', sql.Int, valueSetId)
    .query<ValueSetDetailRow>(`
      SELECT ivs.ValueSetID, ivs.SheetID, ivs.ContextID, vc.Code, ivs.PartyID, ivs.Status
      FROM dbo.InformationValueSets ivs
      JOIN dbo.ValueContexts vc ON vc.ContextID = ivs.ContextID
      WHERE ivs.ValueSetID = @ValueSetID
    `)
  const row = result.recordset[0]
  return row ?? null
}

export type RequirementValueRow = { InfoTemplateID: number; InfoValue: string; UOM: string | null }

/**
 * Effective requirement values for the sheet (for prefill): same preferred view as filled-sheet GET.
 * Prefer Requirement ValueSet rows; fallback to legacy (ValueSetID IS NULL, SheetID) per InfoTemplateID.
 */
export async function getRequirementValueRows(sheetId: number): Promise<RequirementValueRow[]> {
  const reqValueSetId = await getValueSetId(sheetId, 'Requirement', null)
  if (reqValueSetId == null) return []

  const pool = await poolPromise
  const result = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('ReqValueSetID', sql.Int, reqValueSetId)
    .query<RequirementValueRow>(`
      SELECT InfoTemplateID, InfoValue, UOM
      FROM (
        SELECT iv.InfoTemplateID, iv.InfoValue, iv.UOM,
          ROW_NUMBER() OVER (PARTITION BY iv.InfoTemplateID ORDER BY CASE WHEN iv.ValueSetID = @ReqValueSetID THEN 0 ELSE 1 END) AS rn
        FROM dbo.InformationValues iv
        WHERE iv.SheetID = @SheetID AND (iv.ValueSetID = @ReqValueSetID OR iv.ValueSetID IS NULL)
      ) t
      WHERE rn = 1
    `)
  return result.recordset
}

/**
 * Create Offered ValueSet for (sheetId, partyId), prefilling from Requirement. Idempotent.
 */
export async function createOfferedValueSet(
  sheetId: number,
  partyId: number,
  userId: number | null | undefined
): Promise<number> {
  const offeredContextId = await getContextIdByCode('Offered')
  if (offeredContextId == null) {
    throw new Error('ValueContexts.Offered not found; run Phase 2 migration.')
  }

  const reqValueSetId = await ensureRequirementValueSet(sheetId, userId)
  const pool = await poolPromise

  let offeredValueSetId = await getValueSetId(sheetId, 'Offered', partyId)
  if (offeredValueSetId == null) {
    const insertVsResult = await pool
      .request()
      .input('SheetID', sql.Int, sheetId)
      .input('ContextID', sql.Int, offeredContextId)
      .input('PartyID', sql.Int, partyId)
      .input('CreatedBy', sql.Int, userId ?? null)
      .query<{ ValueSetID: number }>(`
        INSERT INTO dbo.InformationValueSets (SheetID, ContextID, PartyID, Status, CreatedAt, CreatedBy)
        OUTPUT INSERTED.ValueSetID
        VALUES (@SheetID, @ContextID, @PartyID, 'Draft', GETDATE(), @CreatedBy)
      `)
    offeredValueSetId = insertVsResult.recordset[0]?.ValueSetID
    if (offeredValueSetId == null) {
      throw new Error('Failed to create Offered ValueSet')
    }
  }

  await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('ReqValueSetID', sql.Int, reqValueSetId)
    .input('ValueSetID', sql.Int, offeredValueSetId)
    .query(`
      INSERT INTO dbo.InformationValues (InfoTemplateID, SheetID, InfoValue, ValueSetID, UOM)
      SELECT eff.InfoTemplateID, @SheetID, eff.InfoValue, @ValueSetID, COALESCE(eff.UOM, N'')
      FROM (
        SELECT iv.InfoTemplateID, iv.InfoValue, iv.UOM,
          ROW_NUMBER() OVER (PARTITION BY iv.InfoTemplateID ORDER BY CASE WHEN iv.ValueSetID = @ReqValueSetID THEN 0 ELSE 1 END) AS rn
        FROM dbo.InformationValues iv
        WHERE iv.SheetID = @SheetID AND (iv.ValueSetID = @ReqValueSetID OR iv.ValueSetID IS NULL)
      ) eff
      WHERE eff.rn = 1
        AND NOT EXISTS (SELECT 1 FROM dbo.InformationValues iv2 WHERE iv2.ValueSetID = @ValueSetID AND iv2.InfoTemplateID = eff.InfoTemplateID)
    `)

  return offeredValueSetId
}

/**
 * Create AsBuilt ValueSet for sheetId, prefilling from Requirement. Idempotent.
 * PartyID is always NULL for AsBuilt.
 */
export async function createAsBuiltValueSet(
  sheetId: number,
  userId: number | null | undefined
): Promise<number> {
  const asBuiltContextId = await getContextIdByCode('AsBuilt')
  if (asBuiltContextId == null) {
    throw new Error('ValueContexts.AsBuilt not found; run Phase 2 migration.')
  }

  const reqValueSetId = await ensureRequirementValueSet(sheetId, userId)
  const pool = await poolPromise

  let asBuiltValueSetId = await getValueSetId(sheetId, 'AsBuilt', null)
  if (asBuiltValueSetId == null) {
    const insertVsResult = await pool
      .request()
      .input('SheetID', sql.Int, sheetId)
      .input('ContextID', sql.Int, asBuiltContextId)
      .input('CreatedBy', sql.Int, userId ?? null)
      .query<{ ValueSetID: number }>(`
        INSERT INTO dbo.InformationValueSets (SheetID, ContextID, PartyID, Status, CreatedAt, CreatedBy)
        OUTPUT INSERTED.ValueSetID
        VALUES (@SheetID, @ContextID, NULL, 'Draft', GETDATE(), @CreatedBy)
      `)
    asBuiltValueSetId = insertVsResult.recordset[0]?.ValueSetID
    if (asBuiltValueSetId == null) {
      throw new Error('Failed to create AsBuilt ValueSet')
    }
  }

  await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('ReqValueSetID', sql.Int, reqValueSetId)
    .input('ValueSetID', sql.Int, asBuiltValueSetId)
    .query(`
      INSERT INTO dbo.InformationValues (InfoTemplateID, SheetID, InfoValue, ValueSetID, UOM)
      SELECT eff.InfoTemplateID, @SheetID, eff.InfoValue, @ValueSetID, COALESCE(eff.UOM, N'')
      FROM (
        SELECT iv.InfoTemplateID, iv.InfoValue, iv.UOM,
          ROW_NUMBER() OVER (PARTITION BY iv.InfoTemplateID ORDER BY CASE WHEN iv.ValueSetID = @ReqValueSetID THEN 0 ELSE 1 END) AS rn
        FROM dbo.InformationValues iv
        WHERE iv.SheetID = @SheetID AND (iv.ValueSetID = @ReqValueSetID OR iv.ValueSetID IS NULL)
      ) eff
      WHERE eff.rn = 1
        AND NOT EXISTS (SELECT 1 FROM dbo.InformationValues iv2 WHERE iv2.ValueSetID = @ValueSetID AND iv2.InfoTemplateID = eff.InfoTemplateID)
    `)

  return asBuiltValueSetId
}

export type VarianceStatus = 'DeviatesAccepted' | 'DeviatesRejected'

/**
 * Get variance status for (valueSetId, infoTemplateId). Returns null if no row.
 */
export async function getVariance(
  valueSetId: number,
  infoTemplateId: number
): Promise<{ VarianceStatus: VarianceStatus } | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('ValueSetID', sql.Int, valueSetId)
    .input('InfoTemplateID', sql.Int, infoTemplateId)
    .query<{ VarianceStatus: string }>(`
      SELECT VarianceStatus FROM dbo.ValueSetFieldVariances
      WHERE ValueSetID = @ValueSetID AND InfoTemplateID = @InfoTemplateID
    `)
  const row = result.recordset[0]
  if (row?.VarianceStatus === 'DeviatesAccepted' || row?.VarianceStatus === 'DeviatesRejected') {
    return { VarianceStatus: row.VarianceStatus as VarianceStatus }
  }
  return null
}

/**
 * Upsert variance row: set VarianceStatus, ReviewedBy, ReviewedAt.
 */
export async function upsertVariance(
  valueSetId: number,
  infoTemplateId: number,
  status: VarianceStatus,
  userId: number | null
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('ValueSetID', sql.Int, valueSetId)
    .input('InfoTemplateID', sql.Int, infoTemplateId)
    .input('VarianceStatus', sql.VarChar(30), status)
    .input('ReviewedBy', sql.Int, userId)
    .query(`
      MERGE dbo.ValueSetFieldVariances AS t
      USING (SELECT @ValueSetID AS ValueSetID, @InfoTemplateID AS InfoTemplateID) AS s
      ON t.ValueSetID = s.ValueSetID AND t.InfoTemplateID = s.InfoTemplateID
      WHEN MATCHED THEN
        UPDATE SET VarianceStatus = @VarianceStatus, ReviewedBy = @ReviewedBy, ReviewedAt = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (ValueSetID, InfoTemplateID, VarianceStatus, ReviewedBy, ReviewedAt)
        VALUES (@ValueSetID, @InfoTemplateID, @VarianceStatus, @ReviewedBy, GETDATE());
    `)
}

/**
 * Delete variance row (unreview).
 */
export async function deleteVariance(valueSetId: number, infoTemplateId: number): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('ValueSetID', sql.Int, valueSetId)
    .input('InfoTemplateID', sql.Int, infoTemplateId)
    .query(`
      DELETE FROM dbo.ValueSetFieldVariances
      WHERE ValueSetID = @ValueSetID AND InfoTemplateID = @InfoTemplateID
    `)
}

/**
 * Update ValueSet status. Caller must enforce transition rules.
 */
export async function updateValueSetStatus(
  valueSetId: number,
  status: 'Locked' | 'Verified'
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('ValueSetID', sql.Int, valueSetId)
    .input('Status', sql.VarChar(30), status)
    .query(`
      UPDATE dbo.InformationValueSets SET Status = @Status, UpdatedAt = GETDATE() WHERE ValueSetID = @ValueSetID
    `)
}

/**
 * Compare: sheet structure (subsheets + fields with InfoTemplateID). No values.
 */
export type CompareFieldRow = {
  SubID: number
  SubName: string
  InfoTemplateID: number
  Label: string
  OrderIndex: number
}

export async function getCompareStructure(sheetId: number): Promise<CompareFieldRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<CompareFieldRow>(`
      SELECT s.SubID, s.SubName, t.InfoTemplateID, t.Label, t.OrderIndex
      FROM dbo.SubSheets s
      INNER JOIN dbo.InformationTemplates t ON t.SubID = s.SubID
      WHERE s.SheetID = @SheetID
      ORDER BY s.OrderIndex, t.OrderIndex
    `)
  return result.recordset
}

/**
 * Values for a single ValueSet (InfoTemplateID -> { value, uom }).
 */
export async function getValueSetValues(
  valueSetId: number
): Promise<Map<number, { value: string; uom: string | null }>> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('ValueSetID', sql.Int, valueSetId)
    .query<{ InfoTemplateID: number; InfoValue: string; UOM: string | null }>(`
      SELECT InfoTemplateID, InfoValue, UOM FROM dbo.InformationValues WHERE ValueSetID = @ValueSetID
    `)
  const map = new Map<number, { value: string; uom: string | null }>()
  for (const row of result.recordset) {
    map.set(row.InfoTemplateID, { value: row.InfoValue ?? '', uom: row.UOM ?? null })
  }
  return map
}

/**
 * All variance statuses for a ValueSet (InfoTemplateID -> VarianceStatus).
 */
export async function getVariancesForValueSet(
  valueSetId: number
): Promise<Map<number, VarianceStatus>> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('ValueSetID', sql.Int, valueSetId)
    .query<{ InfoTemplateID: number; VarianceStatus: string }>(`
      SELECT InfoTemplateID, VarianceStatus FROM dbo.ValueSetFieldVariances WHERE ValueSetID = @ValueSetID
    `)
  const map = new Map<number, VarianceStatus>()
  for (const row of result.recordset) {
    if (row.VarianceStatus === 'DeviatesAccepted' || row.VarianceStatus === 'DeviatesRejected') {
      map.set(row.InfoTemplateID, row.VarianceStatus as VarianceStatus)
    }
  }
  return map
}
