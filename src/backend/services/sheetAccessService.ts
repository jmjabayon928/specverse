// src/backend/services/sheetAccessService.ts
import { poolPromise, sql } from '../config/db'

/**
 * Returns true if the sheet exists and belongs to the given account (for value-set / sheet-gate).
 */
export async function sheetBelongsToAccount(sheetId: number, accountId: number): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('AccountID', sql.Int, accountId)
    .query<{ Ex: number }>(`
      SELECT 1 AS Ex FROM dbo.Sheets WHERE SheetID = @SheetID AND AccountID = @AccountID
    `)
  return (result.recordset?.length ?? 0) > 0
}
