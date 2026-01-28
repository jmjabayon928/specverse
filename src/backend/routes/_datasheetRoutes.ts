// src/backend/routes/datasheetRoutes.ts
import express from "express";
import { sql } from "../config/db";
import { exportSheetPDF, exportSheetExcel } from "../controllers/_datasheetController";
import { verifyToken } from "../middleware/authMiddleware";

const router = express.Router();

// Export for filled datasheets
router.get("/filled/:id/export/pdf", verifyToken, exportSheetPDF);
router.get("/filled/:id/export/excel", verifyToken, exportSheetExcel);

// Export for template datasheets
router.get("/templates/:id/export/pdf", verifyToken, exportSheetPDF);
router.get("/templates/:id/export/excel", verifyToken, exportSheetExcel);

// 🔠 Translations - used by both templates and filled sheets

// 1. Get translated subsheet names
router.get("/subsheets/:templateId/translated", verifyToken, async (req, res) => {
  const { templateId } = req.params;
  const lang = req.query.lang;

  try {
    const result = await sql.query(`
      SELECT st.SubID, st.SubName
      FROM SubsheetTranslations st
      INNER JOIN Subsheets s ON st.SubID = s.SubID
      WHERE s.SheetID = ${templateId} AND st.LangCode = '${lang}'
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching subsheet translations", err);
    res.status(500).json({ error: "Failed to fetch subsheet translations" });
  }
});

// 2. Get translated field labels
router.get("/templates/:templateId/translations", verifyToken, async (req, res) => {
  const { templateId } = req.params;
  const lang = req.query.lang;

  try {
    const result = await sql.query(`
      SELECT InfoTemplateID, Label
      FROM InfoTemplateTranslations
      WHERE LangCode = '${lang}' AND InfoTemplateID IN (
        SELECT InfoTemplateID FROM InformationTemplates
        WHERE SubID IN (SELECT SubID FROM Subsheets WHERE SheetID = ${templateId})
      )
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching field translations", err);
    res.status(500).json({ error: "Failed to fetch field label translations" });
  }
});

// 3. Get translated option values
router.get("/options/:templateId/translated", verifyToken, async (req, res) => {
  const { templateId } = req.params;
  const lang = req.query.lang;

  try {
    const result = await sql.query(`
      SELECT iot.OptionID, iot.InfoTemplateID, iot.OptionValue
      FROM InfoOptionTranslations iot
      INNER JOIN InformationTemplateOptions ito ON iot.OptionID = ito.OptionID
      WHERE iot.LangCode = '${lang}' AND ito.InfoTemplateID IN (
        SELECT InfoTemplateID FROM InformationTemplates
        WHERE SubID IN (SELECT SubID FROM Subsheets WHERE SheetID = ${templateId})
      )
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching option translations", err);
    res.status(500).json({ error: "Failed to fetch option translations" });
  }
});

export default router;
