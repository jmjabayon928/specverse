// src/backend/database/changeLogQueries.ts
import { poolPromise, sql } from "../config/db"

export async function getChangeLogsForSheet(
  sheetId: number,
  limit: number
): Promise<unknown[]> {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input("SheetID", sql.Int, sheetId)
    .input("Limit", sql.Int, limit)
    .query(`
      SELECT TOP (@Limit)
        cl.*,
        u.UserID AS ChangedByUserID,
        u.FirstName + ' ' + u.LastName AS ChangedByName,
        it.InfoTemplateID AS TemplateID,
        it.Label AS FieldLabel,
        CONVERT(varchar, cl.ChangeDate, 126) AS ChangeDateISO
      FROM ChangeLogs cl
        LEFT JOIN Users u ON u.UserID = cl.ChangedBy
        LEFT JOIN InformationTemplates it ON it.InfoTemplateID = cl.InfoTemplateID
      WHERE cl.SheetID = @SheetID
      ORDER BY cl.ChangeDate DESC
    `)

  return result.recordset as unknown[]
}

