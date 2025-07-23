// src/backend/services/translationService.ts

import { poolPromise, sql } from "@/backend/config/db";
import type { SheetTranslations } from "@/types/translation";

export async function getSheetTranslations(sheetId: number, lang: string): Promise<SheetTranslations> {
  const pool = await poolPromise;

  // Step 1: Detect if sheet is filled (IsTemplate = 0) and extract TemplateID
  const templateIdRes = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT TemplateID, IsTemplate
      FROM Sheets
      WHERE SheetID = @SheetID
    `);

  const isTemplate = templateIdRes.recordset[0]?.IsTemplate;
  const templateId = templateIdRes.recordset[0]?.TemplateID;
  const baseSheetId = isTemplate ? sheetId : templateId ?? sheetId;

  // Step 2: Sheet-level translations (always use actual sheetId)
  const sheetRes = await pool.request()
    .input("SheetID", sql.Int, baseSheetId) // ✅ use baseSheetId
    .input("LangCode", sql.VarChar(10), lang)
    .query(`
      SELECT SheetName, SheetDesc, SheetDesc2, EquipmentName, ServiceName
      FROM SheetTranslations
      WHERE SheetID = @SheetID AND LangCode = @LangCode
    `);

  const row = sheetRes.recordset[0] || {};
  const sheet = {
    sheetName: row.SheetName,
    sheetDesc: row.SheetDesc,
    sheetDesc2: row.SheetDesc2,
    equipmentName: row.EquipmentName,
    serviceName: row.ServiceName,
  };

  // Step 3: Subsheet Translations (use baseSheetId to get TemplateSubID)
  const subsheetRes = await pool.request()
    .input("TemplateID", sql.Int, baseSheetId)
    .input("LangCode", sql.VarChar(10), lang)
    .query(`
      SELECT st.SubID, st.SubName
      FROM SubsheetTranslations st
      INNER JOIN Subsheets s ON st.SubID = s.SubID
      WHERE s.SheetID = @TemplateID AND st.LangCode = @LangCode
    `);

  const subsheets: Record<string, string> = {};
  for (const row of subsheetRes.recordset) {
    subsheets[row.SubID.toString()] = row.SubName;
  }

  // Step 4: InfoTemplate Label Translations (use baseSheetId to get TemplateInfoTemplateID)
  const labelRes = await pool.request()
    .input("TemplateID", sql.Int, baseSheetId)
    .input("LangCode", sql.VarChar(10), lang)
    .query(`
      SELECT itt.InfoTemplateID, itt.Label
      FROM InfoTemplateTranslations itt
      INNER JOIN InformationTemplates t ON itt.InfoTemplateID = t.InfoTemplateID
      INNER JOIN Subsheets s ON t.SubID = s.SubID
      WHERE s.SheetID = @TemplateID AND itt.LangCode = @LangCode
    `);

  const labels: Record<string, string> = {};
  for (const row of labelRes.recordset) {
    labels[row.InfoTemplateID.toString()] = row.Label;
  }

  // Step 5: InfoOption Translations (use baseSheetId and group per TemplateInfoTemplateID)
  const optionRes = await pool.request()
    .input("TemplateID", sql.Int, baseSheetId)
    .input("LangCode", sql.VarChar(10), lang)
    .query(`
      SELECT it.InfoTemplateID, iot.OptionValue
      FROM InfoOptionTranslations iot
      INNER JOIN InformationTemplateOptions o ON iot.OptionID = o.OptionID
      INNER JOIN InformationTemplates it ON o.InfoTemplateID = it.InfoTemplateID
      INNER JOIN Subsheets s ON it.SubID = s.SubID
      WHERE s.SheetID = @TemplateID AND iot.LangCode = @LangCode
      ORDER BY it.InfoTemplateID, o.SortOrder
    `);

  // 🔁 Normalize option structure to: Record<InfoTemplateID, Record<index, OptionValue>>
  const options: Record<string, string[]> = {};
  for (const row of optionRes.recordset) {
    const key = String(row.InfoTemplateID);
    if (!options[key]) options[key] = [];
    options[key].push(row.OptionValue);
  }

  console.log("🔤 Translations returned:");
  console.log("sheet:", sheet);
  console.log("subsheets:", subsheets);
  console.log("labels:", labels);
  console.log("options:", options);

  console.log("🌐 getSheetTranslations → sheetId:", sheetId, "| baseSheetId:", baseSheetId);

  return { sheet, subsheets, labels, options };
}
