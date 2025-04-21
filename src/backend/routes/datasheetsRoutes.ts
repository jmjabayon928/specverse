import { Router } from "express";
import { poolPromise, sql } from "../config/db";
import { generateDatasheetPDF, generateDatasheetExcel } from "../services/exportService";
import { getDatasheetById } from "../database/datasheetQueries";

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

// ✅ Get a datasheet by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, id)
      .query(`
        SELECT s.SheetNameEng, s.SheetNameFr, s.SheetDescEng, s.SheetDescFr,
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
    res.json(result.recordset[0]);
  } catch (error) {
    console.error("⛔ Get datasheet by ID error:", error);
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
router.put("/update-info", async (req, res) => {
  const { sheetId, infoUpdates } = req.body;
  if (!sheetId || !infoUpdates || typeof infoUpdates !== "object") {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);
    for (const templateId of Object.keys(infoUpdates)) {
      const update = infoUpdates[templateId];
      const value = update.InfoValue ?? null;
      const uom = update.UOM ?? null;

      await request
        .input("InfoTemplateID", sql.Int, parseInt(templateId))
        .input("SheetID", sql.Int, sheetId)
        .input("InfoValue", sql.NVarChar(255), value)
        .input("UOM", sql.NVarChar(50), uom)
        .query(`
          UPDATE InformationValues
          SET InfoValue = @InfoValue,
              UOM = @UOM
          WHERE SheetID = @SheetID AND InfoTemplateID = @InfoTemplateID
        `);
    }

    await transaction.commit();
    res.status(200).json({ message: "Information updated successfully" });
  } catch (err) {
    console.error("❌ Update Info Failed:", err);
    res.status(500).json({ error: "Failed to update information" });
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

export default router;
