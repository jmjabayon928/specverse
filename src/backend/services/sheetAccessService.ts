// src/backend/services/sheetAccessService.ts
import { poolPromise, sql } from '../config/db'

function shouldLogInstrumentsDebug(): boolean {
  return process.env.DEBUG_INSTRUMENTS === '1'
}

/**
 * Returns true if the sheet exists and belongs to the given account (for value-set / sheet-gate).
 */
export async function sheetBelongsToAccount(sheetId: number, accountId: number): Promise<boolean> {
  const startMs = Date.now()
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('AccountID', sql.Int, accountId)
    .query<{ Ex: number }>(`
      SELECT 1 AS Ex FROM dbo.Sheets WHERE SheetID = @SheetID AND AccountID = @AccountID
    `)
  const elapsedMs = Date.now() - startMs
  const rowCount = result.recordset?.length ?? 0
  if (shouldLogInstrumentsDebug()) {
    console.log(`[sheetBelongsToAccount] sheetId=${sheetId} accountId=${accountId} ms=${elapsedMs} rows=${rowCount}`)
  }
  return rowCount > 0
}
