// src/backend/database/sheetRevisionQueries.ts
import { poolPromise, sql } from '../config/db'

export interface SheetRevisionRow {
  RevisionID: number
  SheetID: number
  RevisionNumber: number
  SnapshotJson: string
  CreatedBy: number
  CreatedAt: Date
  Comment: string | null
  Status: string | null
}

export interface CreateRevisionInput {
  sheetId: number
  snapshotJson: string
  createdBy: number
  status: string | null
  comment?: string | null
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
 * Uses MAX(RevisionNumber) + 1 with UPDLOCK/HOLDLOCK to prevent race conditions
 */
export async function getNextRevisionNumber(
  tx: sql.Transaction,
  sheetId: number
): Promise<number> {
  const result = await tx.request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ NextRevisionNumber: number }>(`
      SELECT ISNULL(MAX(RevisionNumber), 0) + 1 AS NextRevisionNumber
      FROM dbo.SheetRevisions WITH (UPDLOCK, HOLDLOCK)
      WHERE SheetID = @SheetID
    `)

  return result.recordset[0]?.NextRevisionNumber ?? 1
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
    .input('RevisionNumber', sql.Int, revisionNumber)
    .input('SnapshotJson', sql.NVarChar(sql.MAX), input.snapshotJson)
    .input('CreatedBy', sql.Int, input.createdBy)
    .input('Status', sql.NVarChar(50), input.status)
    .input('Comment', sql.NVarChar(1000), input.comment ?? null)
    .query<{ RevisionID: number }>(`
      INSERT INTO dbo.SheetRevisions (
        SheetID, RevisionNumber, SnapshotJson, CreatedBy, Status, Comment
      )
      OUTPUT INSERTED.RevisionID
      VALUES (
        @SheetID, @RevisionNumber, @SnapshotJson, @CreatedBy, @Status, @Comment
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
      RevisionNumber: number
      CreatedAt: Date
      CreatedBy: number
      CreatedByName: string | null
      Status: string | null
      Comment: string | null
    }>(`
      SELECT 
        r.RevisionID,
        r.RevisionNumber,
        r.CreatedAt,
        r.CreatedBy,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        r.Status,
        r.Comment
      FROM dbo.SheetRevisions r
      LEFT JOIN dbo.Users u ON r.CreatedBy = u.UserID
      WHERE r.SheetID = @SheetID
      ORDER BY r.RevisionNumber DESC
      OFFSET @Offset ROWS
      FETCH NEXT @PageSize ROWS ONLY
    `)

  const rows: RevisionListItem[] = rowsResult.recordset.map(row => ({
    revisionId: row.RevisionID,
    revisionNumber: row.RevisionNumber,
    createdAt: row.CreatedAt,
    createdBy: row.CreatedBy,
    createdByName: row.CreatedByName,
    status: row.Status,
    comment: row.Comment,
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
      RevisionNumber: number
      CreatedAt: Date
      CreatedBy: number
      CreatedByName: string | null
      Status: string | null
      Comment: string | null
      SnapshotJson: string
    }>(`
      SELECT 
        r.RevisionID,
        r.RevisionNumber,
        r.CreatedAt,
        r.CreatedBy,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        r.Status,
        r.Comment,
        r.SnapshotJson
      FROM dbo.SheetRevisions r
      LEFT JOIN dbo.Users u ON r.CreatedBy = u.UserID
      WHERE r.SheetID = @SheetID AND r.RevisionID = @RevisionID
    `)

  if (result.recordset.length === 0) {
    return null
  }

  const row = result.recordset[0]
  let snapshot: unknown
  try {
    snapshot = JSON.parse(row.SnapshotJson)
  } catch {
    throw new Error('Invalid snapshot JSON')
  }

  return {
    revisionId: row.RevisionID,
    revisionNumber: row.RevisionNumber,
    createdAt: row.CreatedAt,
    createdBy: row.CreatedBy,
    createdByName: row.CreatedByName,
    status: row.Status,
    comment: row.Comment,
    snapshot,
  }
}
