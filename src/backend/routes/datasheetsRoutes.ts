// src/backend/routes/datasheetRoutes.ts
import express, { Request, Response } from 'express';
import { poolPromise, sql } from "../config/db";
import { generateDatasheetPDF, generateDatasheetExcel } from "../services/exportService";
import { duplicateSheet } from "../database/duplicateSheet";
import { insertTemplate, updateDatasheetTemplate } from "../database/templateWriteQueries";
import { getParentDatasheets } from "../controllers/datasheetController";
import type { DatasheetInput, EquipmentInput, SubsheetInput } from "@/validation/datasheetTemplateSchema";
import { getTemplateDetailsById } from "@/backend/database/templateViewQueries";

const router = express.Router();

// ✅ Create Filled Datasheet from Template
router.post("/templates/:templateId/create-filled", async (req: Request, res: Response) => {
  const templateId = Number(req.params.templateId);

  if (!templateId || isNaN(templateId)) {
    return res.status(400).json({ success: false, error: "Invalid template ID" });
  }

  try {
    const newSheetId = await duplicateSheet(templateId, false);  // your function
    return res.status(200).json({ success: true, sheetId: newSheetId });
  } catch (err) {
    console.error("❌ Failed to create filled datasheet:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// ✅ Translated templates
router.get("/templates/:sheetId/translations", async (req: Request, res: Response): Promise<void> => {
  const sheetId = parseInt(req.params.sheetId);
  const lang = req.query.lang as string;
  if (!Number.isInteger(sheetId) || !lang) {
    res.status(400).json({ error: "Invalid parameters." });
    return;
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .input("LanguageCode", sql.VarChar(10), lang)
      .query(`SELECT T.InfoTemplateID, TT.Label FROM InformationTemplates T INNER JOIN SubSheets S ON T.SubID = S.SubID INNER JOIN InformationTemplateTranslations TT ON T.InfoTemplateID = TT.InfoTemplateID WHERE S.SheetID = @SheetID AND TT.LanguageCode = @LanguageCode`);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Template translation error:", err);
    res.status(500).json({ error: "Failed to fetch translations." });
  }
});

// ✅ GET /api/backend/datasheets/templates/reference-options
router.get("/templates/reference-options", async (req, res) => {
    try {
        const pool = await poolPromise;

        const [areas, users, manufacturers, suppliers, categories, clients, projects] = await Promise.all([
            pool.query(`SELECT AreaID AS id, AreaName AS name FROM Areas ORDER BY AreaName`),
            pool.query(`SELECT EmployeeID AS id, FirstName + ' ' + LastName AS name FROM Employees ORDER BY FirstName, LastName`),
            pool.query(`SELECT ManuID AS id, ManuName AS name FROM Manufacturers ORDER BY ManuName`),
            pool.query(`SELECT SuppID AS id, SuppName AS name FROM Suppliers ORDER BY SuppName`),
            pool.query(`SELECT CategoryID AS id, CategoryNameEng AS name FROM Categories ORDER BY CategoryNameEng`),
            pool.query(`SELECT ClientID AS id, ClientName AS name FROM Clients ORDER BY ClientName`),
            pool.query(`SELECT ProjID AS id, ProjName AS name FROM Projects ORDER BY ProjName`)
        ]);

        res.json({
            areas: areas.recordset,
            users: users.recordset,
            manufacturers: manufacturers.recordset,
            suppliers: suppliers.recordset,
            categories: categories.recordset,
            clients: clients.recordset,
            projects: projects.recordset
        });

    } catch (err) {
        console.error("❌ Failed to load reference options:", err);
        res.status(500).json({ error: "Failed to load reference options" });
    }
});

// ✅ Create a New Template
router.post("/templates/create", async (req, res) => {
  const { datasheet, equipment, subsheets } = req.body;

  try {
    const newSheetId = await insertTemplate(datasheet, equipment, subsheets);
    res.status(201).json({ success: true, sheetId: newSheetId });
  } catch (err) {
    console.error("Failed to create template:", err);
    res.status(500).json({ success: false, message: "Insert failed" });
  }
});

// ✅ Get all parent datasheets
router.get("/parents", getParentDatasheets);

// ✅ Filter
router.get("/filter", async (req: Request, res: Response): Promise<void> => {
  const { status } = req.query;

  const validStatuses = ["Draft", "Verified", "Approved"];
  if (status && !validStatuses.includes(status as string)) {
    res.status(400).json({ error: "Invalid status filter" });
    return;
  }

  try {
    const pool = await poolPromise;
    const request = pool.request();

    let query = `SELECT * FROM Sheets`;
    if (status) {
      query += ` WHERE Status = @Status`;
      request.input("Status", sql.VarChar(20), status);
    }
    query += ` ORDER BY SheetID DESC`;

    const result = await request.query(query);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("❌ Failed to filter datasheets:", err);
    res.status(500).json({ error: "Failed to filter datasheets" });
  }
});

// ✅ Get all filled datasheets
router.get("/", async (req: Request, res: Response): Promise<void> => {
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
      WHERE s.IsTemplate = 0
    `);

    // ✅ Always return array (even if empty)
    res.json(result.recordset);
  } catch (err) {
    console.error("⛔ Error fetching datasheets:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// ✅ Get subsheets by SheetID
router.get("/:id/subsheets", async (req: Request, res: Response): Promise<void> => {
  const sheetId = parseInt(req.params.id);
  if (!Number.isInteger(sheetId)) {
    res.status(400).json({ error: "Invalid SheetID." });
    return;
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .query("SELECT SubID, SubNameEng, SubNameFr FROM SubSheets WHERE SheetID = @SheetID ORDER BY OrderIndex");
    if (!result.recordset.length) 
      res.status(404).json({ error: "No subsheets found." });
      res.json(result.recordset);
      return;
  } catch (err) {
    console.error("⛔ Error fetching subsheets:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// ✅ Get info by SubID + SheetID
router.get("/subsheets/:subId/sheet/:sheetId/info", async (req: Request, res: Response): Promise<void> => {
    const subId = parseInt(req.params.subId);
    const sheetId = parseInt(req.params.sheetId);
    if (!Number.isInteger(subId) || !Number.isInteger(sheetId)) {
        res.status(400).json({ error: "Invalid IDs." });
        return;
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("SubID", sql.Int, subId)
            .input("SheetID", sql.Int, sheetId)
            .query(`
                SELECT 
                    T.InfoTemplateID,
                    T.LabelEng,
                    T.LabelFr,
                    T.InfoType,
                    T.UOM AS TemplateUOM,       -- ✅ new: original UOM from template
                    ISNULL(V.InfoValue, '') AS InfoValue,
                    ISNULL(V.UOM, '') AS UOM
                FROM InformationTemplates T
                LEFT JOIN InformationValues V 
                    ON T.InfoTemplateID = V.InfoTemplateID 
                    AND V.SheetID = @SheetID
                WHERE T.SubID = @SubID
                ORDER BY T.OrderIndex
            `);

        // ✅ Now loop and check for options for every template
        for (const template of result.recordset) {
            const optionsResult = await pool.request()
                .input("InfoTemplateID", sql.Int, template.InfoTemplateID)
                .query(`
                    SELECT OptionValue 
                    FROM InformationTemplateOptions 
                    WHERE InfoTemplateID = @InfoTemplateID 
                    ORDER BY SortOrder
                `);

            template.Options = optionsResult.recordset.map((row: { OptionValue: string }) => row.OptionValue);
        }

        res.json(result.recordset);
    } catch (err) {
        console.error("⛔ Error fetching info:", err);
        res.status(500).json({ error: "Server error." });
    }
});

// ✅ Translated subsheets
router.get("/:sheetId/subsheets/translated", async (req: Request, res: Response): Promise<void> => {
  const sheetId = parseInt(req.params.sheetId);
  const lang = req.query.lang as string;
  if (!Number.isInteger(sheetId) || !lang) {
    res.status(400).json({ error: "Invalid parameters." });
    return;
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .input("LanguageCode", sql.VarChar(10), lang)
      .query(`SELECT t.SubID, t.SubName FROM SubsheetTranslations t INNER JOIN SubSheets s ON s.SubID = t.SubID WHERE s.SheetID = @SheetID AND t.LanguageCode = @LanguageCode`);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Subsheet translation error:", err);
    res.status(500).json({ error: "Failed to fetch subsheets." });
  }
});

// ✅ Export PDF
router.get("/:id/export/pdf", async (req, res) => {
  try {
    const sheetId = req.params.id;
    const uom = (req.query.uom as "SI" | "USC") ?? "SI";
    const lang = (req.query.lang as string) ?? "eng";

    const pdfBuffer = await generateDatasheetPDF(sheetId, uom, lang);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="datasheet-${sheetId}-${uom}-${lang}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Error exporting PDF:", err);
    res.status(500).json({ error: "Failed to export PDF." });
  }
});

// ✅ Export Excel
router.get("/:id/export/excel", async (req, res) => {
  try {
    const sheetId = req.params.id;
    const uom = (req.query.uom as string)?.toUpperCase() === "USC" ? "USC" : "SI";
    const lang = (req.query.lang as string) ?? "eng";

    const buffer = await generateDatasheetExcel(sheetId, uom, lang);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="datasheet-${sheetId}-${uom.toLowerCase()}-${lang}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error("❌ Error exporting Excel:", err);
    res.status(500).json({ error: "Failed to export Excel." });
  }
});

// ✅ Update InformationValues with transaction
router.put("/update-info", async (req, res) => {
    const { sheetId, infoUpdates } = req.body;

    console.log("👉 /update-info called");
    console.log("👉 Request body:", req.body);

    if (!sheetId || typeof sheetId !== "number" || !infoUpdates || typeof infoUpdates !== "object") {
        return res.status(400).json({ error: "Invalid input. sheetId and infoUpdates are required." });
    }

    try {
      const pool = await poolPromise;
      const infoUpdates = req.body.infoUpdates as Record<number, { InfoValue: string; UOM: string }>;

      // ✅ Loop through each info update
      for (const [templateIdStr, valueObj] of Object.entries(infoUpdates) as [string, { InfoValue: string; UOM: string }][]) {
        const infoTemplateId = parseInt(templateIdStr);
        const infoValue = valueObj.InfoValue;
        const uom = valueObj.UOM ?? "";

        if (!infoTemplateId || !valueObj?.InfoValue) {
          console.warn(`⚠️ Skipping invalid InfoTemplateID: ${templateIdStr}`);
          continue;
        }

        // ✅ Log current update attempt
        console.log(`👉 Processing InfoTemplateID: ${infoTemplateId}, Value: ${infoValue}, UOM: ${uom}`);

        // ✅ OPTIONAL safeguard: confirm that InfoTemplateID belongs to this SheetID
        // (good to prevent malicious tampering)
        const checkResult = await pool.request()
            .input("SheetID", sql.Int, sheetId)
            .input("InfoTemplateID", sql.Int, infoTemplateId)
            .query(`
                SELECT 1
                FROM InformationTemplates t
                INNER JOIN SubSheets s ON t.SubID = s.SubID
                WHERE s.SheetID = @SheetID AND t.InfoTemplateID = @InfoTemplateID
            `);

        if (checkResult.recordset.length === 0) {
            console.warn(`❌ Skipping InfoTemplateID ${infoTemplateId} → not linked to SheetID ${sheetId}`);
            continue;
        }

        // ✅ Upsert (Insert if not exists, else Update)
        await pool.request()
            .input("SheetID", sql.Int, sheetId)
            .input("InfoTemplateID", sql.Int, infoTemplateId)
            .input("InfoValue", sql.NVarChar(sql.MAX), infoValue)
            .input("UOM", sql.NVarChar(50), uom)
            .query(`
                IF EXISTS (
                    SELECT 1 FROM InformationValues 
                    WHERE SheetID = @SheetID AND InfoTemplateID = @InfoTemplateID
                )
                BEGIN
                    UPDATE InformationValues
                    SET InfoValue = @InfoValue, UOM = @UOM
                    WHERE SheetID = @SheetID AND InfoTemplateID = @InfoTemplateID
                END
                ELSE
                BEGIN
                    INSERT INTO InformationValues (SheetID, InfoTemplateID, InfoValue, UOM)
                    VALUES (@SheetID, @InfoTemplateID, @InfoValue, @UOM)
                END
            `);

        console.log(`✅ InfoTemplateID ${infoTemplateId} saved.`);
      }

      console.log("✅ All values processed successfully.");
      res.status(200).json({ message: "Information values updated successfully." });

    } catch (err) {
        console.error("❌ Error in /update-info:", err);
        res.status(500).json({ error: "Server error while updating information values." });
    }
});

// PUT /datasheets/:sheetId
router.put("/:sheetId", async (req: Request, res: Response): Promise<void> => {
  const sheetId = parseInt(req.params.sheetId, 10);
  if (isNaN(sheetId)) {
    res.status(400).json({ error: "Invalid sheet ID." });
    return;
  }

  const { datasheet, equipment, subsheets } = req.body;

  // Basic validation
  if (!datasheet || !equipment || !Array.isArray(subsheets)) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }

  try {
    const success = await updateDatasheetTemplate(
      sheetId,
      datasheet as DatasheetInput,
      equipment as EquipmentInput,
      subsheets as SubsheetInput[]
    );

    if (success) {
      res.json({ message: "Datasheet updated successfully." });
    } else {
      res.status(500).json({ error: "Failed to update datasheet." });
    }
  } catch (err) {
    console.error("❌ Route error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ✅ Change logs
router.get("/:id/change-logs", async (req: Request, res: Response): Promise<void> => {
  const sheetId = parseInt(req.params.id);
  if (!Number.isInteger(sheetId)) {
    res.status(400).json({ error: "Invalid SheetID." });
    return;
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`SELECT l.*, t.LabelEng FROM InformationChangeLogs l JOIN InformationTemplates t ON l.InfoTemplateID = t.InfoTemplateID WHERE l.SheetID = @SheetID ORDER BY l.ChangedAt DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Change log error:", err);
    res.status(500).json({ error: "Failed to fetch change logs." });
  }
});

// ✅ Get a filled datasheet full details (datasheet + equipment)
router.get("/detail/:id", async (req: Request, res: Response): Promise<void> => {
  const sheetId = parseInt(req.params.id);
  if (!Number.isInteger(sheetId)) {
    res.status(400).json({ error: "Invalid SheetID" });
    return;
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`
          SELECT 
            c.ClientLogo, s.SheetNameEng AS SheetName, s.SheetDescEng AS SheetDesc, 
            s.SheetDescEng2 AS SheetDesc2, s.ClientDocNum, p.ClientProjNum, 
            s.CompanyDocNum, p.ProjNum AS CompanyProjNum, a.AreaName, 
            s.PackageName, s.RevisionNum, s.RevisionDate, 
            pe.FirstName + ' ' + pe.LastName AS PreparedBy, s.PreparedByDate, 
            ve.FirstName + ' ' + ve.LastName AS VerifiedBy, s.VerifiedByDate, 
            ae.FirstName + ' ' + ae.LastName AS ApprovedBy, s.ApprovedByDate, 
            s.EquipmentName, s.EquipmentTagNum, s.ServiceName, c.ClientName, 
            p.ProjName AS ProjectName, cat.CategoryNameEng AS CategoryName, m.ManuName, su.SuppName, 
            s.RequiredQty, s.EquipSize, s.InstallPackNum, s.ModelNumber, s.PID, s.CodeStd, 
            s.ItemLocation, s.LocationDwg, s.InstallDwg, s.Driver
          FROM Sheets s
            LEFT JOIN Categories cat ON s.CategoryID = cat.CategoryID
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

    if (result.recordset.length === 0) {
      res.status(404).json({ error: "Datasheet not found" });
    } else {
      res.json(result.recordset[0]);
    }
  } catch (err) {
    console.error("❌ Error fetching datasheet full details:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Get all revisions of a datasheet
router.get("/:id/revisions", async (req: Request, res: Response): Promise<void> => {
  const parentId = parseInt(req.params.id);
  if (isNaN(parentId)) {
    res.status(400).json({ error: "Invalid SheetID" });
    return;
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

// ✅ Duplicate a datasheet
router.post("/:id/duplicate", async (req: Request, res: Response): Promise<void> => {
  const sheetId = parseInt(req.params.id, 10);
  if (isNaN(sheetId)) {
    res.status(400).json({ error: "Invalid SheetID" });
    return;
  }

  try {
    const newSheetId = await duplicateSheet(sheetId);
    res.status(200).json({ newSheetId });
  } catch (err) {
    console.error("❌ Duplication failed:", err);
    res.status(500).json({ error: "Failed to duplicate datasheet" });
  }
});

// ✅ Get a datasheet detail (filled or template)
router.get("/templates/:id/detail", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid Template ID" });
    return;
  }

  try {
    const template = await getTemplateDetailsById(id);

    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    // ✅ Prevents unwanted caching
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // ✅ This structure perfectly matches frontend expectations:
    // { datasheet, equipment, subsheets }
    res.json(template);
  } catch (error) {
    console.error("❌ Get template by ID error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Update a Template
router.post("/:id/update", async (req: Request, res: Response): Promise<void> => {
  const sheetId = parseInt(req.params.id, 10);
  const { datasheet, equipment, subsheets } = req.body;

  if (isNaN(sheetId)) {
    res.status(400).json({ error: "Invalid SheetID" });
    return;
  }

  if (!datasheet || !equipment || !Array.isArray(subsheets)) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const pool = await poolPromise;
  const conn = await pool.connect();
  const transaction = new sql.Transaction(conn);
  await transaction.begin();

  try {
    // ✅ 1️⃣ Update Sheets table
    await transaction.request()
      .input("SheetID", sql.Int, sheetId)
      .input("SheetNameEng", sql.VarChar, datasheet.sheetName)
      .input("SheetDescEng", sql.VarChar, datasheet.sheetDesc)
      .input("SheetDescEng2", sql.VarChar, datasheet.sheetDesc2 ?? null)
      .input("ClientDocNum", sql.Int, datasheet.clientDoc ?? null)
      .input("ClientProjNum", sql.Int, datasheet.clientProject ?? null)
      .input("CompanyDocNum", sql.Int, datasheet.companyDoc ?? null)
      .input("CompanyProjNum", sql.Int, datasheet.companyProject ?? null)
      .input("AreaID", sql.Int, datasheet.areaId)
      .input("PackageName", sql.VarChar, datasheet.packageName)
      .input("RevisionNum", sql.Int, datasheet.revisionNum)
      .input("RevisionDate", sql.Date, datasheet.revisionDate ?? null)
      .input("PreparedByID", sql.Int, datasheet.preparedBy)
      .input("PreparedByDate", sql.Date, datasheet.preparedDate)
      .input("VerifiedByID", sql.Int, datasheet.verifiedBy ?? null)
      .input("VerifiedByDate", sql.Date, datasheet.verifiedDate ?? null)
      .input("ApprovedByID", sql.Int, datasheet.approvedBy ?? null)
      .input("ApprovedByDate", sql.Date, datasheet.approvedDate ?? null)
      .input("EquipmentName", sql.VarChar, equipment.equipmentName)
      .input("EquipmentTagNum", sql.VarChar, equipment.equipmentTagNum)
      .input("ServiceName", sql.VarChar, equipment.serviceName)
      .input("RequiredQty", sql.Int, equipment.requiredQty)
      .input("EquipSize", sql.Int, equipment.equipSize)
      .input("ItemLocation", sql.VarChar, equipment.itemLocation)
      .input("ManuID", sql.Int, equipment.manufacturerId)
      .input("SuppID", sql.Int, equipment.supplierId)
      .input("InstallPackNum", sql.VarChar, equipment.installPackNum)
      .input("ModelNumber", sql.VarChar, equipment.modelNum)
      .input("Driver", sql.VarChar, equipment.driver ?? null)
      .input("LocationDWG", sql.VarChar, equipment.locationDWG ?? null)
      .input("PID", sql.Int, equipment.pid)
      .input("InstallDWG", sql.VarChar, equipment.installDWG ?? null)
      .input("CodeStd", sql.VarChar, equipment.codeStd ?? null)
      .input("CategoryID", sql.Int, equipment.categoryId)
      .input("ClientID", sql.Int, equipment.clientId)
      .input("ProjID", sql.Int, equipment.projectId)
      .query(`
        UPDATE Sheets SET
          SheetNameEng = @SheetNameEng,
          SheetDescEng = @SheetDescEng,
          SheetDescEng2 = @SheetDescEng2,
          ClientDocNum = @ClientDocNum,
          ClientProjNum = @ClientProjNum,
          CompanyDocNum = @CompanyDocNum,
          CompanyProjNum = @CompanyProjNum,
          AreaID = @AreaID,
          PackageName = @PackageName,
          RevisionNum = @RevisionNum,
          RevisionDate = @RevisionDate,
          PreparedByID = @PreparedByID,
          PreparedByDate = @PreparedByDate,
          VerifiedByID = @VerifiedByID,
          VerifiedByDate = @VerifiedByDate,
          ApprovedByID = @ApprovedByID,
          ApprovedByDate = @ApprovedByDate,
          EquipmentName = @EquipmentName,
          EquipmentTagNum = @EquipmentTagNum,
          ServiceName = @ServiceName,
          RequiredQty = @RequiredQty,
          EquipSize = @EquipSize,
          ItemLocation = @ItemLocation,
          ManuID = @ManuID,
          SuppID = @SuppID,
          InstallPackNum = @InstallPackNum,
          ModelNumber = @ModelNumber,
          Driver = @Driver,
          LocationDWG = @LocationDWG,
          PID = @PID,
          InstallDWG = @InstallDWG,
          CodeStd = @CodeStd,
          CategoryID = @CategoryID,
          ClientID = @ClientID,
          ProjID = @ProjID
        WHERE SheetID = @SheetID
      `);

    // ✅ 2️⃣ Delete old data
    await transaction.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`
        DELETE o FROM InformationTemplateOptions o
        JOIN InformationTemplates t ON o.InfoTemplateID = t.InfoTemplateID
        JOIN SubSheets s ON t.SubID = s.SubID
        WHERE s.SheetID = @SheetID;

        DELETE t FROM InformationTemplates t
        JOIN SubSheets s ON t.SubID = s.SubID
        WHERE s.SheetID = @SheetID;

        DELETE FROM SubSheets WHERE SheetID = @SheetID;
      `);

    // ✅ 3️⃣ Re-insert SubSheets + Templates + Options
    for (const [subIdx, subsheet] of subsheets.entries()) {
      const subResult = await transaction.request()
        .input("SheetID", sql.Int, sheetId)
        .input("SubNameEng", sql.VarChar, subsheet.name)
        .input("OrderIndex", sql.Int, subIdx + 1)
        .query(`
          INSERT INTO SubSheets (SheetID, SubNameEng, OrderIndex)
          OUTPUT INSERTED.SubID
          VALUES (@SheetID, @SubNameEng, @OrderIndex)
        `);
      const subId = subResult.recordset[0].SubID;

      for (const [tIdx, template] of subsheet.templates.entries()) {
        const templateResult = await transaction.request()
          .input("SubID", sql.Int, subId)
          .input("Label", sql.VarChar, template.name)
          .input("Type", sql.VarChar, template.type)
          .input("UOM", sql.VarChar, template.uom ?? null)
          .input("OrderIndex", sql.Int, tIdx + 1)
          .query(`
            INSERT INTO InformationTemplates (SubID, LabelEng, InfoType, UOM, OrderIndex)
            OUTPUT INSERTED.InfoTemplateID
            VALUES (@SubID, @Label, @Type, @UOM, @OrderIndex)
          `);
        const templateId = templateResult.recordset[0].InfoTemplateID;

        // ✅ insert template options
        if (template.options?.length) {
          for (const [optIdx, opt] of template.options.entries()) {
            await transaction.request()
              .input("InfoTemplateID", sql.Int, templateId)
              .input("OptionValue", sql.VarChar, opt)
              .input("SortOrder", sql.Int, optIdx + 1)
              .query(`
                INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
                VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
              `);
          }
        }
      }
    }

    await transaction.commit();
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Template update error:", err);
    await transaction.rollback();
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
