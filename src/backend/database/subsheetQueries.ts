import { poolPromise, sql } from "../config/db";

/**
 * Get all SubSheets for a given SheetID
 */
export async function getSubSheetsBySheetId(sheetId: number) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT SubID, SubName 
      FROM SubSheets
      WHERE SheetID = @SheetID
      ORDER BY SubID
    `);

  return result.recordset;
}

export async function getTranslatedSubSheets(sheetId: number, languageCode: string) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("Lang", sql.VarChar(10), languageCode)
    .query(`
      SELECT s.SubID, 
             COALESCE(t.SubName, s.SubName) AS SubName
      FROM SubSheets s
      LEFT JOIN SubsheetTranslations t ON t.SubID = s.SubID AND t.LangCode = @Lang
      WHERE s.SheetID = @SheetID
      ORDER BY s.SubID
    `);
  return result.recordset;
}
