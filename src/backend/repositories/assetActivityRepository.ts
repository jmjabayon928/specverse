// src/backend/repositories/assetActivityRepository.ts
import { poolPromise, sql } from '../config/db'

export interface AssetActivityLogRow {
  logId: number
  action: string | null
  performedByUserId: number
  performedAt: string | null
  route: string | null
  method: string | null
  statusCode: number | null
  changes: string | null
}

export interface AssetActivityCursor {
  performedAt: string
  logId: number
}

export async function getAssetActivityRows(
  accountId: number,
  assetId: number,
  limit: number,
  cursor?: AssetActivityCursor
): Promise<AssetActivityLogRow[]> {
  const pool = await poolPromise
  const request = pool.request()

  request.input('AccountID', sql.Int, accountId)
  request.input('AssetID', sql.Int, assetId)
  request.input('Limit', sql.Int, limit)

  // Keyset pagination: cursor is optional
  if (cursor) {
    request.input('CursorPerformedAt', sql.DateTime2, new Date(cursor.performedAt))
    request.input('CursorLogID', sql.Int, cursor.logId)
  } else {
    request.input('CursorPerformedAt', sql.DateTime2, null)
    request.input('CursorLogID', sql.Int, null)
  }

  const result = await request.query<{
    LogID: number
    Action: string | null
    PerformedBy: number
    PerformedAt: Date | null
    Route: string | null
    Method: string | null
    StatusCode: number | null
    Changes: string | null
  }>(`
    SELECT TOP (@Limit)
      a.LogID,
      a.Action,
      a.PerformedBy,
      a.PerformedAt,
      a.Route,
      a.Method,
      a.StatusCode,
      a.Changes
    FROM dbo.AuditLogs a
    INNER JOIN dbo.Assets ast ON ast.AssetID = a.RecordID AND a.TableName = 'Assets'
    WHERE
      ast.AccountID = @AccountID
      AND ast.AssetID = @AssetID
      AND (
        @CursorPerformedAt IS NULL
        OR a.PerformedAt < @CursorPerformedAt
        OR (a.PerformedAt = @CursorPerformedAt AND a.LogID < @CursorLogID)
      )
    ORDER BY a.PerformedAt DESC, a.LogID DESC
  `)

  return result.recordset.map(row => ({
    logId: row.LogID,
    action: row.Action,
    performedByUserId: row.PerformedBy,
    performedAt: row.PerformedAt ? row.PerformedAt.toISOString() : null,
    route: row.Route,
    method: row.Method,
    statusCode: row.StatusCode,
    changes: row.Changes,
  }))
}
