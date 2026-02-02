// src/backend/database/sheetRevisionQueries.ts
import { poolPromise, sql } from '../config/db'
import { unifiedSheetSchema } from '@/validation/sheetSchema'

export interface SheetRevisionRow {
  RevisionID: number
  SheetID: number
  RevisionNum: number
  SystemRevisionNum: number | null
  SystemRevisionAt: Date | null
  SnapshotJson: string | null
  CreatedByID: number | null
  CreatedByDate: Date | null
  Notes: string | null
  Status: string | null
}

export interface CreateRevisionInput {
  sheetId: number
  snapshotJson: string
  createdById: number
  createdByDate: Date
  status: string | null
  notes?: string | null
}

export interface RevisionListItem {
  revisionId: number
  revisionNumber: number
  createdAt: Date
  createdBy: number
  createdByName: string | null
  status: string | null
  comment: string | null
  /** System revision number (canonical); same as revisionNumber when dual-written. */
  systemRevisionNum: number
  /** System revision timestamp. */
  systemRevisionAt: Date
}

export interface RevisionDetails extends RevisionListItem {
  snapshot: unknown // UnifiedSheet (parsed from JSON)
}

/** Error message thrown when snapshotJson is not valid UnifiedSheet (4C guard). Used by controllers for friendly response. */
export const REVISION_SNAPSHOT_INVALID_MESSAGE =
  'Invalid revision snapshot: snapshotJson is not a UnifiedSheet'

/**
 * Get the next system revision number for a sheet (within transaction for safety).
 * Uses MAX(SystemRevisionNum) + 1 with COALESCE for nulls; same lock strategy as before.
 */
export async function getNextRevisionNumber(
  tx: sql.Transaction,
  sheetId: number
): Promise<number> {
  const result = await tx.request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ NextRevisionNum: number }>(`
      SELECT ISNULL(MAX(COALESCE(SystemRevisionNum, RevisionNum)), 0) + 1 AS NextRevisionNum
      FROM dbo.SheetRevisions WITH (UPDLOCK, HOLDLOCK)
      WHERE SheetID = @SheetID
    `)

  return result.recordset[0]?.NextRevisionNum ?? 1
}

/**
 * Create a new revision snapshot (must be called within a transaction).
 * Dual-writes SystemRevisionNum/SystemRevisionAt (canonical) and RevisionNum/RevisionDate (legacy).
 * Validates snapshotJson is a valid UnifiedSheet before inserting.
 */
export async function createRevision(
  tx: sql.Transaction,
  input: CreateRevisionInput
): Promise<number> {
  let parsed: unknown
  try {
    parsed = JSON.parse(input.snapshotJson)
  } catch {
    throw new Error(REVISION_SNAPSHOT_INVALID_MESSAGE)
  }
  const parseResult = unifiedSheetSchema.safeParse(parsed)
  if (!parseResult.success) {
    throw new Error(REVISION_SNAPSHOT_INVALID_MESSAGE)
  }

  const nextSystemNum = await getNextRevisionNumber(tx, input.sheetId)

  const insertResult = await tx.request()
    .input('SheetID', sql.Int, input.sheetId)
    .input('SystemRevisionNum', sql.Int, nextSystemNum)
    .input('SystemRevisionAt', sql.DateTime2(7), input.createdByDate)
    .input('RevisionNum', sql.Int, nextSystemNum)
    .input('RevisionDate', sql.Date, input.createdByDate)
    .input('SnapshotJson', sql.NVarChar(sql.MAX), input.snapshotJson)
    .input('CreatedByID', sql.Int, input.createdById)
    .input('CreatedByDate', sql.DateTime2(0), input.createdByDate)
    .input('Status', sql.NVarChar(50), input.status)
    .input('Notes', sql.NVarChar(1000), input.notes ?? null)
    .query<{ RevisionID: number }>(`
      INSERT INTO dbo.SheetRevisions (
        SheetID, SystemRevisionNum, SystemRevisionAt, RevisionNum, RevisionDate,
        SnapshotJson, CreatedByID, CreatedByDate, Status, Notes
      )
      OUTPUT INSERTED.RevisionID
      VALUES (
        @SheetID, @SystemRevisionNum, @SystemRevisionAt, @RevisionNum, CAST(@RevisionDate AS DATE),
        @SnapshotJson, @CreatedByID, @CreatedByDate, @Status, @Notes
      )
    `)

  return insertResult.recordset[0].RevisionID
}

/**
 * List revisions for a sheet with pagination
 */
export async function listRevisionsPaged(
  sheetId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ total: number; rows: RevisionListItem[] }> {
  const pool = await poolPromise
  const offset = (page - 1) * pageSize
  const maxPageSize = Math.min(pageSize, 100)

  // Get total count
  const countResult = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ Total: number }>(`
      SELECT COUNT(*) AS Total
      FROM dbo.SheetRevisions
      WHERE SheetID = @SheetID
    `)

  const total = countResult.recordset[0]?.Total ?? 0

  // Get paginated rows (order by system revision, fallback to legacy for nulls)
  const rowsResult = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .input('Offset', sql.Int, offset)
    .input('PageSize', sql.Int, maxPageSize)
    .query<{
      RevisionID: number
      RevisionNum: number
      SystemRevisionNum: number | null
      SystemRevisionAt: Date | null
      CreatedByDate: Date | null
      CreatedByID: number | null
      CreatedByName: string | null
      Status: string | null
      Notes: string | null
    }>(`
      SELECT 
        r.RevisionID,
        r.RevisionNum,
        r.SystemRevisionNum,
        r.SystemRevisionAt,
        r.CreatedByDate,
        r.CreatedByID,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        r.Status,
        r.Notes
      FROM dbo.SheetRevisions r
      LEFT JOIN dbo.Users u ON r.CreatedByID = u.UserID
      WHERE r.SheetID = @SheetID
      ORDER BY COALESCE(r.SystemRevisionNum, r.RevisionNum) DESC
      OFFSET @Offset ROWS
      FETCH NEXT @PageSize ROWS ONLY
    `)

  const rows: RevisionListItem[] = rowsResult.recordset.map(row => ({
    revisionId: row.RevisionID,
    revisionNumber: row.RevisionNum,
    createdAt: row.CreatedByDate ?? new Date(0),
    createdBy: row.CreatedByID ?? 0,
    createdByName: row.CreatedByName,
    status: row.Status,
    comment: row.Notes,
    systemRevisionNum: row.SystemRevisionNum ?? row.RevisionNum,
    systemRevisionAt: row.SystemRevisionAt ?? row.CreatedByDate ?? new Date(0),
  }))

  return { total, rows }
}

/**
 * Get a specific revision by ID (ensures it belongs to the sheet)
 */
export async function getRevisionById(
  sheetId: number,
  revisionId: number
): Promise<RevisionDetails | null> {
  const pool = await poolPromise

  const result = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .input('RevisionID', sql.Int, revisionId)
    .query<{
      RevisionID: number
      RevisionNum: number
      SystemRevisionNum: number | null
      SystemRevisionAt: Date | null
      CreatedByDate: Date | null
      CreatedByID: number | null
      CreatedByName: string | null
      Status: string | null
      Notes: string | null
      SnapshotJson: string | null
    }>(`
      SELECT 
        r.RevisionID,
        r.RevisionNum,
        r.SystemRevisionNum,
        r.SystemRevisionAt,
        r.CreatedByDate,
        r.CreatedByID,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        r.Status,
        r.Notes,
        r.SnapshotJson
      FROM dbo.SheetRevisions r
      LEFT JOIN dbo.Users u ON r.CreatedByID = u.UserID
      WHERE r.SheetID = @SheetID AND r.RevisionID = @RevisionID
    `)

  if (result.recordset.length === 0) {
    return null
  }

  const row = result.recordset[0]
  let snapshot: unknown
  const jsonStr = row.SnapshotJson
  if (jsonStr != null && jsonStr !== '') {
    try {
      snapshot = JSON.parse(jsonStr)
    } catch {
      throw new Error('Invalid snapshot JSON')
    }
  } else {
    snapshot = null
  }

  return {
    revisionId: row.RevisionID,
    revisionNumber: row.RevisionNum,
    createdAt: row.CreatedByDate ?? new Date(0),
    createdBy: row.CreatedByID ?? 0,
    createdByName: row.CreatedByName,
    status: row.Status,
    comment: row.Notes,
    snapshot,
    systemRevisionNum: row.SystemRevisionNum ?? row.RevisionNum,
    systemRevisionAt: row.SystemRevisionAt ?? row.CreatedByDate ?? new Date(0),
  }
}
