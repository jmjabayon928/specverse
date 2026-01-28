// src/backend/database/informationQueries.ts
import { poolPromise, sql } from "../config/db";

/**
 * Get all information for a given SubID and SheetID.
 * Pulls the templates (labels, types) and their filled values.
 */
export async function getInformationBySubSheetId(subId: number, sheetId: number) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("SubID", sql.Int, subId)
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT 
        T.InfoTemplateID, T.Label, 
		T.InfoType, V.InfoValue, V.UOM
      FROM InformationTemplates T
      LEFT JOIN InformationValues V 
        ON T.InfoTemplateID = V.InfoTemplateID AND V.SheetID = @SheetID
      WHERE T.SubID = @SubID
      ORDER BY T.InfoTemplateID
    `);
  return result.recordset;
}


/**
 * Get translated template labels for a specific sheet and language
 */
export async function getTranslatedTemplateLabels(sheetId: number, languageCode: string) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("Lang", sql.VarChar(10), languageCode)
    .query(`
      SELECT t.InfoTemplateID, 
             COALESCE(tr.Label, t.Label) AS Label
      FROM InformationTemplates t
      INNER JOIN SubSheets s ON t.SubID = s.SubID
      LEFT JOIN InfoTemplateTranslations tr
        ON tr.InfoTemplateID = t.InfoTemplateID AND tr.LangCode = @Lang
      WHERE s.SheetID = @SheetID
    `);

  // ✅ THIS is where you put the block
  const templateMap: Record<string, string> = {}
  for (const row of result.recordset) {
    templateMap[row.InfoTemplateID] = row.Label
  }

  return templateMap;
}
