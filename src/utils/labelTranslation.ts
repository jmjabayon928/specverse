import { poolPromise, sql } from "../backend/config/db";

export async function getUILabelTranslations(lang: string): Promise<Record<string, string>> {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("LanguageCode", sql.VarChar(10), lang)
    .query(`SELECT LabelKey, TranslatedText FROM UILabelTranslations WHERE LanguageCode = @LanguageCode`);

  const map: Record<string, string> = {};
  result.recordset.forEach(row => {
    map[row.LabelKey] = row.TranslatedText;
  });

  return map;
}
