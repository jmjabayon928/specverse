// src/backend/controllers/datasheetController.ts
import { Request, Response } from "express";
import { poolPromise, sql } from "../config/db";
import { getFilledSheetDetailsById } from "../services/filledSheetService";
import { getTemplateDetailsById } from "../services/templateService";
import { generateDatasheetPDF, generateDatasheetExcel } from "../services/_exportService";
import { asSingleString, parseIntParam } from "../utils/requestParam";

// 🟢 Helper to load the right datasheet
async function getSheetData(sheetId: number, lang: string, uom: "SI" | "USC") {
  const pool = await poolPromise;
  const sheetResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`SELECT IsTemplate FROM Sheets WHERE SheetID = @SheetID`);

  const sheet = sheetResult.recordset[0];
  if (!sheet) throw new Error("Sheet not found");

  if (sheet.IsTemplate) {
    return await getTemplateDetailsById(sheetId, lang, uom);
  } else {
    return await getFilledSheetDetailsById(sheetId, lang, uom);
  }
}

// ✅ Export to PDF
export async function exportSheetPDF(req: Request, res: Response): Promise<void> {
  try {
    const sheetId = parseIntParam(req.params.id);
    if (sheetId === undefined) {
      res.status(400).json({ error: "Invalid sheet id" });
      return;
    }

    const langRaw = asSingleString(req.query.lang as string | string[] | undefined);
    const lang = (langRaw ?? "eng").trim() || "eng";

    const uomRaw = asSingleString(req.query.uom as string | string[] | undefined);
    const uom: "SI" | "USC" = uomRaw === "USC" ? "USC" : "SI";

    const result = await getSheetData(sheetId, lang, uom);
    if (!result) {
      res.status(404).json({ error: "Sheet not found" });
      return;
    }

    const pdfBuffer = await generateDatasheetPDF(sheetId, uom, lang);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Sheet-${sheetId}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ PDF Export Error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
}

// ✅ Export to Excel
export async function exportSheetExcel(req: Request, res: Response): Promise<void> {
  try {
    const sheetId = parseIntParam(req.params.id);
    if (sheetId === undefined) {
      res.status(400).json({ error: "Invalid sheet id" });
      return;
    }

    const langRaw = asSingleString(req.query.lang as string | string[] | undefined);
    const lang = (langRaw ?? "eng").trim() || "eng";

    const uomRaw = asSingleString(req.query.uom as string | string[] | undefined);
    const uom: "SI" | "USC" = uomRaw === "USC" ? "USC" : "SI";

    const result = await getSheetData(sheetId, lang, uom);
    if (!result) {
      res.status(404).json({ error: "Sheet not found" });
      return;
    }

    const excelBuffer = await generateDatasheetExcel(sheetId, uom, lang);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Sheet-${sheetId}.xlsx"`);
    res.send(excelBuffer);
  } catch (err) {
    console.error("❌ Excel Export Error:", err);
    res.status(500).json({ error: "Failed to generate Excel" });
  }
}
