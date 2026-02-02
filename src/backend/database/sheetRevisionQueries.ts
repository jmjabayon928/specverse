// src/backend/database/sheetRevisionQueries.ts
import { poolPromise, sql } from '../config/db'

export interface SheetRevisionRow {
  RevisionID: number
  SheetID: number
  RevisionNum: number
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
}

export interface RevisionDetails extends RevisionListItem {
  snapshot: unknown // UnifiedSheet (parsed from JSON)
}

/**
 * Get the next revision number for a sheet (within transaction for safety)
 * Uses MAX(RevisionNum) + 1 with UPDLOCK/HOLDLOCK to prevent race conditions
 */
export async function getNextRevisionNumber(
  tx: sql.Transaction,
  sheetId: number
): Promise<number> {
  const result = await tx.request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ NextRevisionNum: number }>(`
      SELECT ISNULL(MAX(RevisionNum), 0) + 1 AS NextRevisionNum
      FROM dbo.SheetRevisions WITH (UPDLOCK, HOLDLOCK)
      WHERE SheetID = @SheetID
    `)

  return result.recordset[0]?.NextRevisionNum ?? 1
}

/**
 * Create a new revision snapshot (must be called within a transaction)
 */
export async function createRevision(
  tx: sql.Transaction,
  input: CreateRevisionInput
): Promise<number> {
  const revisionNumber = await getNextRevisionNumber(tx, input.sheetId)

  const result = await tx.request()
    .input('SheetID', sql.Int, input.sheetId)
    .input('RevisionNum', sql.Int, revisionNumber)
    .input('SnapshotJson', sql.NVarChar(sql.MAX), input.snapshotJson)
    .input('CreatedByID', sql.Int, input.createdById)
    .input('CreatedByDate', sql.DateTime2(0), input.createdByDate)
    .input('Status', sql.NVarChar(50), input.status)
    .input('Notes', sql.NVarChar(1000), input.notes ?? null)
    .query<{ RevisionID: number }>(`
      INSERT INTO dbo.SheetRevisions (
        SheetID, RevisionNum, SnapshotJson, CreatedByID, CreatedByDate, Status, Notes
      )
      OUTPUT INSERTED.RevisionID
      VALUES (
        @SheetID, @RevisionNum, @SnapshotJson, @CreatedByID, @CreatedByDate, @Status, @Notes
      )
    `)

  return result.recordset[0].RevisionID
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

  // Get paginated rows
  const rowsResult = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .input('Offset', sql.Int, offset)
    .input('PageSize', sql.Int, maxPageSize)
    .query<{
      RevisionID: number
      RevisionNum: number
      CreatedByDate: Date | null
      CreatedByID: number | null
      CreatedByName: string | null
      Status: string | null
      Notes: string | null
    }>(`
      SELECT 
        r.RevisionID,
        r.RevisionNum,
        r.CreatedByDate,
        r.CreatedByID,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        r.Status,
        r.Notes
      FROM dbo.SheetRevisions r
      LEFT JOIN dbo.Users u ON r.CreatedByID = u.UserID
      WHERE r.SheetID = @SheetID
      ORDER BY r.RevisionNum DESC
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
  }
}
