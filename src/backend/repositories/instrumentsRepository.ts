// src/backend/repositories/instrumentsRepository.ts
import { poolPromise, sql } from '../config/db'

/**
 * Same rules as InstrumentTagNorm storage: trim, uppercase, collapse whitespace, remove spaces around '-' and '/'.
 */
function normalizeInstrumentSearchQ(q: string): string {
  let s = (q ?? '').trim()
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/\s*-\s*/g, '-').replace(/\s*\/\s*/g, '/')
  return s.toUpperCase()
}

export type InstrumentRow = {
  instrumentId: number
  accountId: number
  instrumentTag: string
  instrumentTagNorm: string | null
  instrumentType: string | null
  service: string | null
  system: string | null
  area: string | null
  location: string | null
  status: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: number | null
  updatedBy: number | null
}

export type InstrumentLinkedToSheetRow = {
  instrumentId: number
  instrumentTag: string
  instrumentTagNorm: string | null
  instrumentType: string | null
  linkRole: string | null
  loopTags: string[] // comma-separated or array from JSON
}

export type CreateInstrumentInput = {
  instrumentTag: string
  instrumentTagNorm: string
  instrumentType?: string | null
  service?: string | null
  system?: string | null
  area?: string | null
  location?: string | null
  status?: string | null
  notes?: string | null
  createdBy?: number | null
}

export type UpdateInstrumentInput = {
  instrumentTag?: string
  instrumentTagNorm?: string
  instrumentType?: string | null
  service?: string | null
  system?: string | null
  area?: string | null
  location?: string | null
  status?: string | null
  notes?: string | null
  updatedBy?: number | null
}

export async function listByAccount(
  accountId: number,
  searchQ?: string
): Promise<InstrumentRow[]> {
  const pool = await poolPromise
  const q = (searchQ ?? '').trim()
  if (q.length === 0) {
    const result = await pool
      .request()
      .input('AccountID', sql.Int, accountId)
      .query(`
        SELECT InstrumentID AS instrumentId, AccountID AS accountId, InstrumentTag AS instrumentTag,
               InstrumentTagNorm AS instrumentTagNorm, InstrumentType AS instrumentType,
               Service AS service, System AS [system], Area AS area, Location AS location,
               Status AS status, Notes AS notes, CreatedAt AS createdAt, UpdatedAt AS updatedAt,
               CreatedBy AS createdBy, UpdatedBy AS updatedBy
        FROM dbo.Instruments
        WHERE AccountID = @AccountID
        ORDER BY InstrumentTagNorm, InstrumentID
      `)
    return result.recordset as InstrumentRow[]
  }
  const escapeLike = (s: string) => s.replace(/%/g, '[%]').replace(/_/g, '[_]')
  const qNorm = normalizeInstrumentSearchQ(q)
  const normPattern = `%${escapeLike(qNorm)}%`
  const tagPattern = `%${escapeLike(q.trim())}%`
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('TagNorm', sql.NVarChar(255), normPattern)
    .input('Tag', sql.NVarChar(255), tagPattern)
    .query(`
      SELECT InstrumentID AS instrumentId, AccountID AS accountId, InstrumentTag AS instrumentTag,
             InstrumentTagNorm AS instrumentTagNorm, InstrumentType AS instrumentType,
             Service AS service, System AS [system], Area AS area, Location AS location,
             Status AS status, Notes AS notes, CreatedAt AS createdAt, UpdatedAt AS updatedAt,
             CreatedBy AS createdBy, UpdatedBy AS updatedBy
      FROM dbo.Instruments
      WHERE AccountID = @AccountID
        AND (InstrumentTagNorm LIKE @TagNorm OR InstrumentTag LIKE @Tag)
      ORDER BY InstrumentTagNorm, InstrumentID
    `)
  return result.recordset as InstrumentRow[]
}

export async function getById(accountId: number, instrumentId: number): Promise<InstrumentRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('InstrumentID', sql.Int, instrumentId)
    .query(`
      SELECT InstrumentID AS instrumentId, AccountID AS accountId, InstrumentTag AS instrumentTag,
             InstrumentTagNorm AS instrumentTagNorm, InstrumentType AS instrumentType,
             Service AS service, System AS [system], Area AS area, Location AS location,
             Status AS status, Notes AS notes, CreatedAt AS createdAt, UpdatedAt AS updatedAt,
             CreatedBy AS createdBy, UpdatedBy AS updatedBy
      FROM dbo.Instruments
      WHERE AccountID = @AccountID AND InstrumentID = @InstrumentID
    `)
  if (result.recordset.length === 0) return null
  return result.recordset[0] as InstrumentRow
}

export async function create(accountId: number, input: CreateInstrumentInput): Promise<InstrumentRow> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('InstrumentTag', sql.NVarChar(255), input.instrumentTag)
    .input('InstrumentTagNorm', sql.NVarChar(255), input.instrumentTagNorm || null)
    .input('InstrumentType', sql.NVarChar(100), input.instrumentType ?? null)
    .input('Service', sql.NVarChar(255), input.service ?? null)
    .input('System', sql.NVarChar(255), input.system ?? null)
    .input('Area', sql.NVarChar(255), input.area ?? null)
    .input('Location', sql.NVarChar(255), input.location ?? null)
    .input('Status', sql.NVarChar(50), input.status ?? null)
    .input('Notes', sql.NVarChar(sql.MAX), input.notes ?? null)
    .input('CreatedBy', sql.Int, input.createdBy ?? null)
    .query(`
      INSERT INTO dbo.Instruments (AccountID, InstrumentTag, InstrumentTagNorm, InstrumentType, Service, System, Area, Location, Status, Notes, CreatedBy, UpdatedBy)
      OUTPUT INSERTED.InstrumentID AS instrumentId, INSERTED.AccountID AS accountId, INSERTED.InstrumentTag AS instrumentTag,
             INSERTED.InstrumentTagNorm AS instrumentTagNorm, INSERTED.InstrumentType AS instrumentType,
             INSERTED.Service AS service, INSERTED.System AS [system], INSERTED.Area AS area, INSERTED.Location AS location,
             INSERTED.Status AS status, INSERTED.Notes AS notes, INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt,
             INSERTED.CreatedBy AS createdBy, INSERTED.UpdatedBy AS updatedBy
      VALUES (@AccountID, @InstrumentTag, @InstrumentTagNorm, @InstrumentType, @Service, @System, @Area, @Location, @Status, @Notes, @CreatedBy, @CreatedBy)
    `)
  return result.recordset[0] as InstrumentRow
}

export async function update(
  accountId: number,
  instrumentId: number,
  input: UpdateInstrumentInput
): Promise<InstrumentRow | null> {
  const pool = await poolPromise
  const existing = await getById(accountId, instrumentId)
  if (!existing) return null

  const instrumentTag = input.instrumentTag ?? existing.instrumentTag
  const instrumentTagNorm = input.instrumentTagNorm ?? existing.instrumentTagNorm
  const instrumentType = input.instrumentType !== undefined ? input.instrumentType : existing.instrumentType
  const service = input.service !== undefined ? input.service : existing.service
  const system = input.system !== undefined ? input.system : existing.system
  const area = input.area !== undefined ? input.area : existing.area
  const location = input.location !== undefined ? input.location : existing.location
  const status = input.status !== undefined ? input.status : existing.status
  const notes = input.notes !== undefined ? input.notes : existing.notes

  await pool
    .request()
    .input('InstrumentID', sql.Int, instrumentId)
    .input('AccountID', sql.Int, accountId)
    .input('InstrumentTag', sql.NVarChar(255), instrumentTag)
    .input('InstrumentTagNorm', sql.NVarChar(255), instrumentTagNorm)
    .input('InstrumentType', sql.NVarChar(100), instrumentType)
    .input('Service', sql.NVarChar(255), service)
    .input('System', sql.NVarChar(255), system)
    .input('Area', sql.NVarChar(255), area)
    .input('Location', sql.NVarChar(255), location)
    .input('Status', sql.NVarChar(50), status)
    .input('Notes', sql.NVarChar(sql.MAX), notes)
    .input('UpdatedBy', sql.Int, input.updatedBy ?? null)
    .query(`
      UPDATE dbo.Instruments
      SET InstrumentTag = @InstrumentTag, InstrumentTagNorm = @InstrumentTagNorm,
          InstrumentType = @InstrumentType, Service = @Service, System = @System,
          Area = @Area, Location = @Location, Status = @Status, Notes = @Notes,
          UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
      WHERE InstrumentID = @InstrumentID AND AccountID = @AccountID
    `)
  return getById(accountId, instrumentId)
}

export async function listLinkedToSheet(
  accountId: number,
  sheetId: number
): Promise<InstrumentLinkedToSheetRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT i.InstrumentID AS instrumentId, i.InstrumentTag AS instrumentTag, i.InstrumentTagNorm AS instrumentTagNorm,
             i.InstrumentType AS instrumentType, idl.LinkRole AS linkRole
      FROM dbo.InstrumentDatasheetLinks idl
      INNER JOIN dbo.Instruments i ON i.InstrumentID = idl.InstrumentID AND i.AccountID = idl.AccountID
      INNER JOIN dbo.Sheets s ON s.SheetID = idl.SheetID AND s.AccountID = idl.AccountID
      WHERE idl.AccountID = @AccountID AND idl.SheetID = @SheetID
      ORDER BY i.InstrumentTagNorm, i.InstrumentID
    `)
  const rows = result.recordset as (InstrumentLinkedToSheetRow & { loopTags?: string })[]
  const instrumentIds = [...new Set(rows.map((r) => r.instrumentId))]
  const loopTagsByInstrument = await getLoopTagsForInstrumentsBatch(accountId, instrumentIds)
  return rows.map((r) => ({
    instrumentId: r.instrumentId,
    instrumentTag: r.instrumentTag,
    instrumentTagNorm: r.instrumentTagNorm,
    instrumentType: r.instrumentType,
    linkRole: r.linkRole,
    loopTags: loopTagsByInstrument.get(r.instrumentId) ?? [],
  }))
}

async function getLoopTagsForInstrumentsBatch(
  accountId: number,
  instrumentIds: number[]
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>()
  if (instrumentIds.length === 0) return map
  const pool = await poolPromise
  const idsParam = instrumentIds.join(',')
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('InstrumentIds', sql.NVarChar(2000), idsParam)
    .query(`
      SELECT ilm.InstrumentID AS instrumentId, il.LoopTag AS loopTag
      FROM dbo.InstrumentLoopMembers ilm
      INNER JOIN dbo.InstrumentLoops il ON il.LoopID = ilm.LoopID
      WHERE ilm.AccountID = @AccountID AND il.AccountID = @AccountID
        AND ilm.InstrumentID IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@InstrumentIds, ',') WHERE value <> '')
      ORDER BY ilm.InstrumentID, il.LoopTag
    `)
  const records = (result.recordset ?? []) as { instrumentId: number; loopTag: string }[]
  for (const row of records) {
    const list = map.get(row.instrumentId) ?? []
    list.push(row.loopTag)
    map.set(row.instrumentId, list)
  }
  return map
}

export async function linkToSheet(
  accountId: number,
  instrumentId: number,
  sheetId: number,
  linkRole: string | null,
  createdBy: number | null
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('InstrumentID', sql.Int, instrumentId)
    .input('SheetID', sql.Int, sheetId)
    .input('LinkRole', sql.NVarChar(100), linkRole)
    .input('CreatedBy', sql.Int, createdBy)
    .query(`
      INSERT INTO dbo.InstrumentDatasheetLinks (AccountID, InstrumentID, SheetID, LinkRole, CreatedBy)
      VALUES (@AccountID, @InstrumentID, @SheetID, @LinkRole, @CreatedBy)
    `)
}

export async function unlinkFromSheet(
  accountId: number,
  instrumentId: number,
  sheetId: number,
  linkRole?: string | null
): Promise<boolean> {
  const pool = await poolPromise
  if (linkRole != null && linkRole !== '') {
    const result = await pool
      .request()
      .input('AccountID', sql.Int, accountId)
      .input('InstrumentID', sql.Int, instrumentId)
      .input('SheetID', sql.Int, sheetId)
      .input('LinkRole', sql.NVarChar(100), linkRole)
      .query(`
        DELETE FROM dbo.InstrumentDatasheetLinks
        WHERE AccountID = @AccountID AND InstrumentID = @InstrumentID AND SheetID = @SheetID AND LinkRole = @LinkRole
      `)
    const n = Array.isArray(result.rowsAffected) ? result.rowsAffected.reduce((a, b) => a + b, 0) : 0
    return n > 0
  }
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('InstrumentID', sql.Int, instrumentId)
    .input('SheetID', sql.Int, sheetId)
    .query(`
      DELETE FROM dbo.InstrumentDatasheetLinks
      WHERE AccountID = @AccountID AND InstrumentID = @InstrumentID AND SheetID = @SheetID
    `)
  const n = Array.isArray(result.rowsAffected) ? result.rowsAffected.reduce((a, b) => a + b, 0) : 0
  return n > 0
}

export async function linkExists(
  accountId: number,
  instrumentId: number,
  sheetId: number
): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('InstrumentID', sql.Int, instrumentId)
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT 1 AS Ex FROM dbo.InstrumentDatasheetLinks
      WHERE AccountID = @AccountID AND InstrumentID = @InstrumentID AND SheetID = @SheetID
    `)
  return (result.recordset?.length ?? 0) > 0
}
