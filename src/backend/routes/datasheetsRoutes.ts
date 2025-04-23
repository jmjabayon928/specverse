import { Router } from "express";
import { v4 as uuidv4 } from "uuid"; 
import { poolPromise, sql } from "../config/db";
import { generateDatasheetPDF, generateDatasheetExcel } from "../services/exportService";
import { getDatasheetById, getTranslatedSheetNameAndDescription } from "../database/datasheetQueries";
import { duplicateSheet } from "../database/duplicateSheet";

const router = Router();

// ✅ Get all datasheets
router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT s.SheetID, s.ClientDocNum, s.CompanyDocNum, a.AreaName, s.RevisionDate, s.ClientID, 
             c.ClientName, c.ClientLogo, s.SheetNameEng, s.SheetDescEng, m.ManuName, su.SuppName
      FROM Sheets s
      INNER JOIN Projects p ON s.ProjID = p.ProjID
      INNER JOIN Clients c ON p.ClientID = c.ClientID
      INNER JOIN Areas a ON s.AreaID = a.AreaID
      INNER JOIN Manufacturers m ON s.ManuID = m.ManuID
      INNER JOIN Suppliers su ON s.SuppID = su.SuppID
    `);
    if (result.recordset.length === 0) return res.status(404).json({ error: "No datasheets found" });
    res.json(result.recordset);
  } catch (error) {
    console.error("⛔ Get all datasheets error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Get subsheets for a datasheet
router.get("/:id/subsheets", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, id)
      .query("SELECT SubID, SubNameEng, SubNameFr FROM SubSheets WHERE SheetID = @SheetID");
    if (result.recordset.length === 0) return res.status(404).json({ error: "No subsheets found" });
    res.json(result.recordset);
  } catch (error) {
    console.error("⛔ Get subsheets error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Get information by SubID and SheetID
router.get("/subsheets/:subId/sheet/:sheetId/info", async (req, res) => {
  console.log("🧪 Subsheet info fetch:", req.params);
  const subId = parseInt(req.params.subId);
  const sheetId = parseInt(req.params.sheetId);
  if (isNaN(subId) || isNaN(sheetId)) return res.status(400).json({ error: "Invalid IDs" });

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SubID", sql.Int, subId)
      .input("SheetID", sql.Int, sheetId)
      .query(`
        SELECT T.InfoTemplateID, T.LabelEng, T.LabelFr, T.InfoType,
               ISNULL(V.InfoValue, '') AS InfoValue,
               ISNULL(V.UOM, '') AS UOM
        FROM InformationTemplates T
        LEFT JOIN InformationValues V ON T.InfoTemplateID = V.InfoTemplateID AND V.SheetID = @SheetID
        WHERE T.SubID = @SubID
        ORDER BY T.InfoTemplateID
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error("⛔ Info fetch error:", error);
    res.status(500).json({ error: "Failed to fetch subsheet info" });
  }
});

// ✅ Generate PDF for a datasheet
router.get("/:id/export/pdf", async (req, res) => {
  try {
    const sheetId = req.params.id;
    const uom = (req.query.uom as "SI" | "USC") || "SI";
    const lang = (req.query.lang as string) || "eng";

    console.log("🧪 Incoming SheetID param:", req.params.id);
    console.log("📄 PDF export triggered:", { sheetId, uom, lang });

    const pdfBuffer = await generateDatasheetPDF(sheetId, uom, lang);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="datasheet-${sheetId}-${uom}-${lang}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Error generating PDF:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});


router.get("/:id/export/excel", async (req, res) => {
  const sheetId = req.params.id;
  const uom = (req.query.uom as string)?.toUpperCase() === "USC" ? "USC" : "SI";
  const lang = (req.query.lang as string) || "eng";
  console.log("🧪 Incoming SheetID param:", req.params.id);

  try {
    const buffer = await generateDatasheetExcel(sheetId, uom, lang);

    const filename = `datasheet-${sheetId}-${uom.toLowerCase()}-${lang}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("❌ Error generating Excel:", error);
    res.status(500).json({ message: "Failed to generate Excel file" });
  }
});

// ✅ Update InformationValues with transaction
// In datasheetsRoutes.ts
router.put("/update-info", async (req, res) => {
  const { sheetId, infoUpdates } = req.body;

  if (!sheetId || typeof infoUpdates !== "object") {
    return res.status(400).json({ error: "Missing or invalid payload" });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Fetch current values to detect changes
    const existingResult = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`SELECT InfoTemplateID, InfoValue, UOM FROM InformationValues WHERE SheetID = @SheetID`);

    const currentMap = new Map<number, { InfoValue: string; UOM: string }>();
    existingResult.recordset.forEach(row => {
      currentMap.set(row.InfoTemplateID, { InfoValue: row.InfoValue, UOM: row.UOM });
    });

    for (const [templateIdStr, { InfoValue, UOM }] of Object.entries(infoUpdates)) {
      const templateId = Number(templateIdStr);
      const newValue = InfoValue?.trim() ?? "";
      const newUOM = UOM?.trim() ?? "";

      const current = currentMap.get(templateId);

      console.log("📥 Validating", { templateId, newValue, newUOM, current });

      // ✅ Backend validation
      if (!newValue) {
        return res.status(400).json({ error: `Value is required for InfoTemplateID: ${templateId}` });
      }
      if (newUOM && isNaN(Number(newValue))) {
        return res.status(400).json({ error: `Value must be numeric for measured entry (InfoTemplateID: ${templateId})` });
      }

      if (!current) continue;

      const hasChanged = current.InfoValue?.trim() !== newValue || current.UOM?.trim() !== newUOM;
      if (!hasChanged) continue;

      // Update value
      await transaction.request()
        .input("SheetID", sql.Int, sheetId)
        .input("InfoTemplateID", sql.Int, templateId)
        .input("InfoValue", sql.NVarChar(255), newValue)
        .input("UOM", sql.NVarChar(50), newUOM)
        .query(`UPDATE InformationValues SET InfoValue = @InfoValue, UOM = @UOM WHERE SheetID = @SheetID AND InfoTemplateID = @InfoTemplateID`);

      // Log changes
      await transaction.request()
        .input("SheetID", sql.Int, sheetId)
        .input("InfoTemplateID", sql.Int, templateId)
        .input("OldValue", sql.NVarChar(255), current.InfoValue)
        .input("NewValue", sql.NVarChar(255), newValue)
        .input("UOM", sql.NVarChar(50), current.UOM) // ✅ Only one UOM
        .input("ChangedBy", sql.NVarChar(100), "system-user")
        .query(`INSERT INTO InformationChangeLogs (SheetID, InfoTemplateID, OldValue, NewValue, UOM, ChangedAt, ChangedBy) VALUES (@SheetID, @InfoTemplateID, @OldValue, @NewValue, @UOM, GETDATE(), @ChangedBy)`);
    }

    await transaction.commit();
    res.status(200).json({ message: "Validated and updated successfully." });

  } catch (err) {
    console.error("❌ Backend validation or update failed:", err);
    res.status(500).json({ error: "Failed to update due to server error." });
  }
});

// ✅ Get translated subsheet names
router.get("/:sheetId/subsheets/translated", async (req, res) => {
  const sheetId = parseInt(req.params.sheetId, 10);
  const lang = req.query.lang as string;

  if (isNaN(sheetId) || !lang) return res.status(400).json({ error: "Invalid parameters" });

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .input("LanguageCode", sql.VarChar(10), lang)
      .query(`
        SELECT t.SubID, t.SubName
        FROM SubsheetTranslations t
        INNER JOIN SubSheets s ON s.SubID = t.SubID
        WHERE s.SheetID = @SheetID AND t.LanguageCode = @LanguageCode
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Translated SubSheets Error:", err);
    res.status(500).json({ error: "Failed to fetch translated subsheets" });
  }
});

// ✅ Get translated template labels
router.get("/templates/:sheetId/translations", async (req, res) => {
  const sheetId = parseInt(req.params.sheetId, 10);
  const lang = req.query.lang as string;

  if (isNaN(sheetId) || !lang) return res.status(400).json({ error: "Invalid parameters" });

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .input("LanguageCode", sql.VarChar(10), lang)
      .query(`
        SELECT T.InfoTemplateID, TT.Label
        FROM InformationTemplates T
        INNER JOIN SubSheets S ON T.SubID = S.SubID
        INNER JOIN InformationTemplateTranslations TT ON T.InfoTemplateID = TT.InfoTemplateID
        WHERE S.SheetID = @SheetID AND TT.LanguageCode = @LanguageCode
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("⛔ Template translation error:", err);
    res.status(500).json({ error: "Failed to fetch template translations" });
  }
});

// ✅ Place this near the bottom of datasheetsRoutes.ts
router.get("/:id/change-logs", async (req, res) => {
  const sheetId = parseInt(req.params.id);
  if (isNaN(sheetId)) return res.status(400).json({ error: "Invalid SheetID" });
  console.log("🧪 Incoming SheetID param:", req.params.id);

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("SheetID", sql.Int, sheetId)
      .query(`
        SELECT l.*, t.LabelEng
        FROM InformationChangeLogs l
        JOIN InformationTemplates t ON l.InfoTemplateID = t.InfoTemplateID
        WHERE l.SheetID = @SheetID
        ORDER BY l.ChangedAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Failed to fetch change logs:", err);
    res.status(500).json({ error: "Failed to fetch change logs" });
  }
});

router.get("/parents", async (req, res) => {
  console.log("📡 /api/datasheets/parents route hit");
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT * FROM Sheets WHERE ParentSheetID IS NULL ORDER BY SheetID DESC
    `);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("❌ Failed to fetch parent datasheets:", err);
    res.status(500).json({ error: "Failed to fetch parent datasheets" });
  }
});

router.get("/:parentId/revisions", async (req, res) => {
  const parentId = parseInt(req.params.parentId);
  if (isNaN(parentId)) {
    return res.status(400).json({ error: "Invalid parent ID" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ParentSheetID", sql.Int, parentId)
      .query(`
        SELECT * FROM Sheets 
        WHERE ParentSheetID = @ParentSheetID 
        ORDER BY RevisionNum DESC
      `);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("❌ Failed to fetch revisions:", err);
    res.status(500).json({ error: "Failed to fetch revisions" });
  }
});

router.get("/:id/revisions", async (req, res) => {
  const parentId = parseInt(req.params.id);
  if (isNaN(parentId)) {
    return res.status(400).json({ error: "Invalid SheetID" });
  }
  console.log("🧪 Incoming SheetID param:", req.params.id);

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ParentSheetID", sql.Int, parentId)
      .query(`
        SELECT SheetID, SheetNameEng, Status, RevisionNum, IsLatest, ParentSheetID
        FROM Sheets
        WHERE ParentSheetID = @ParentSheetID
        ORDER BY RevisionNum DESC
      `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("⛔ Failed to fetch revisions:", err);
    res.status(500).json({ error: "Failed to load revisions" });
  }
});

router.get("/filter", async (req, res) => {
  const { status } = req.query;

  const validStatuses = ["Draft", "Verified", "Approved"];
  if (status && !validStatuses.includes(status as string)) {
    return res.status(400).json({ error: "Invalid status filter" });
  }

  try {
    const pool = await poolPromise;
    const query = status
      ? `SELECT * FROM Sheets WHERE Status = @Status ORDER BY SheetID DESC`
      : `SELECT * FROM Sheets ORDER BY SheetID DESC`;

    const request = pool.request();
    if (status) request.input("Status", sql.VarChar(20), status);

    const result = await request.query(query);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("❌ Failed to filter datasheets:", err);
    res.status(500).json({ error: "Failed to filter datasheets" });
  }
});

router.post("/:id/duplicate", async (req, res) => {
  const sheetId = parseInt(req.params.id);
  console.log("🧪 Incoming SheetID param:", req.params.id);
  try {
    const newSheetId = await duplicateSheet(sheetId); // 👈 Your helper logic
    res.status(200).json({ newSheetId });
  } catch (err) {
    console.error("❌ Duplication failed:", err);
    res.status(500).json({ error: "Failed to duplicate datasheet" });
  }
});

// ✅ Get a datasheet by ID
router.get("/detail/:id", async (req, res) => {
  const { id } = req.params;
  const sheetId = parseInt(id);
  const lang = (req.query.lang as string || 'eng').toLowerCase(); // 🏳️ Accept `?lang=`

  console.log("🧪 Route hit with ID:", id);

  if (isNaN(sheetId)) {
    console.warn("⚠️ Invalid SheetID detected:", id);
    return res.status(400).json({ error: "Invalid SheetID" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, id)
      .query(`
        SELECT s.SheetID, s.SheetNameEng, s.SheetNameFr, s.SheetDescEng, s.SheetDescFr,
               s.SheetDescEng2, s.SheetDescFr2, s.ClientDocNum, p.ClientProjNum,
               s.CompanyDocNum, p.ProjNum AS CompanyProjNum, a.AreaName, s.PackageName,
               s.RevisionNum, s.RevisionDate, 
               pe.FirstName + ' ' + pe.LastName AS PreparedBy, s.PreparedByDate,
               ve.FirstName + ' ' + ve.LastName AS VerifiedBy, s.VerifiedByDate,
               ae.FirstName + ' ' + ae.LastName AS ApprovedBy, s.ApprovedByDate,
               s.EquipmentName, s.EquipmentTagNum, s.ServiceName, s.RequiredQty,
               s.ItemLocation, m.ManuName, su.SuppName, s.InstallPackNum,
               s.EquipSize, s.ModelNumber, s.Driver, s.LocationDwg, s.PID,
               s.InstallDwg, s.CodeStd, c.ClientName, c.ClientLogo, s.Status
        FROM Sheets s
        LEFT JOIN Clients c ON s.ClientID = c.ClientID
        LEFT JOIN Projects p ON s.ProjID = p.ProjID
        LEFT JOIN Areas a ON s.AreaID = a.AreaID
        LEFT JOIN Employees pe ON s.PreparedByID = pe.EmployeeID
        LEFT JOIN Employees ve ON s.VerifiedByID = ve.EmployeeID
        LEFT JOIN Employees ae ON s.ApprovedByID = ae.EmployeeID
        LEFT JOIN Manufacturers m ON s.ManuID = m.ManuID
        LEFT JOIN Suppliers su ON s.SuppID = su.SuppID
        WHERE s.SheetID = @SheetID
      `);

    if (result.recordset.length === 0) return res.status(404).json({ error: "Datasheet not found" });

    const sheet = result.recordset[0];

    // 🔄 Optional translation from your SheetTranslations table
    const translation = await getTranslatedSheetNameAndDescription(sheetId, lang);
    console.log("🧠 Selected lang:", lang);
    console.log("📄 Translation result:", translation);

    // 🧠 Fallback logic for SheetName and SheetDesc
    const response = {
      ...sheet,
      SheetName: translation?.TranslatedName || (lang === 'fr' ? sheet.SheetNameFr : lang === 'eng' ? sheet.SheetNameEng : ''),
      SheetDesc: translation?.TranslatedDescription || (lang === 'fr' ? sheet.SheetDescFr : lang === 'eng' ? sheet.SheetDescEng : ''),
    };

    res.json(response);
  } catch (error) {
    console.error("⛔ Get datasheet by ID error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
