// src/backend/services/filledSheetService.ts
import { poolPromise, sql } from "../config/db";
import { insertAuditLog } from "../database/auditQueries";
import { notifyUsers } from "../utils/notifyUsers";
import type { SheetStatus, UnifiedSheet, UnifiedSubsheet } from "@/types/sheet";
import type { AuditContext } from "@/types/audit";
import { convertToUSC } from "@/utils/unitConversionTable";
import { getSheetTranslations } from "@/backend/services/translationService";
import { applySheetTranslations } from "@/utils/applySheetTranslations";

export const fetchAllFilled = async () => {
  const pool = await poolPromise;

  const result = await pool.query(`
    SELECT 
      s.SheetID AS sheetId,
      s.SheetName AS sheetName,
      s.SheetDesc AS sheetDesc,
      s.CategoryID AS categoryId,
      c.CategoryName AS categoryName,
      s.PreparedByID AS preparedById,
      u.FirstName + ' ' + u.LastName AS preparedByName,
      s.RevisionDate AS revisionDate, 
      s.Status AS status 
    FROM Sheets s
    LEFT JOIN Categories c ON s.CategoryID = c.CategoryID
    LEFT JOIN Users u ON s.PreparedByID = u.UserID
    WHERE s.IsTemplate = 0
    ORDER BY s.SheetID DESC
  `);

  return result.recordset;
};

export async function createFilledSheet(
  data: UnifiedSheet & { fieldValues: Record<string, string> },
  context: AuditContext
): Promise<{ sheetId: number }> {
  const pool = await poolPromise;
  const tx = await pool.transaction();

  try {
    await tx.begin();

    // 🔹 Fetch template InfoTemplates to get Required and UOM
    const templateFieldsResult = await tx.request()
      .input("TemplateID", sql.Int, data.templateId)
      .query(`
        SELECT t.InfoTemplateID, t.Required, t.UOM, t.OrderIndex, s.SubName
        FROM InformationTemplates t
        JOIN Subsheets s ON t.SubID = s.SubID
        WHERE s.SheetID = @TemplateID
      `);

    const templateFieldMap: Record<string, Record<number, { required: boolean, uom: string | null }>> = {};
    for (const row of templateFieldsResult.recordset) {
      const subName = row.SubName;
      const orderIndex = row.OrderIndex;
      if (!templateFieldMap[subName]) templateFieldMap[subName] = {};
      templateFieldMap[subName][orderIndex] = {
        required: !!row.Required,
        uom: row.UOM,
      };
    }

    // 🔹 Insert into Sheets table
    const sheetResult = await tx.request()
      .input("SheetName", sql.VarChar(255), data.sheetName)
      .input("SheetDesc", sql.VarChar(255), data.sheetDesc)
      .input("SheetDesc2", sql.VarChar(255), data.sheetDesc2)
      .input("ClientDocNum", sql.Int, data.clientDocNum)
      .input("ClientProjNum", sql.Int, data.clientProjectNum)
      .input("CompanyDocNum", sql.Int, data.companyDocNum)
      .input("CompanyProjNum", sql.Int, data.companyProjectNum)
      .input("AreaID", sql.Int, data.areaId)
      .input("PackageName", sql.VarChar(100), data.packageName)
      .input("RevisionNum", sql.Int, data.revisionNum)
      .input("RevisionDate", sql.Date, new Date())
      .input("PreparedByID", sql.Int, context.userId)
      .input("PreparedByDate", sql.DateTime, new Date())
      .input("EquipmentName", sql.VarChar(150), data.equipmentName)
      .input("EquipmentTagNum", sql.VarChar(150), data.equipmentTagNum)
      .input("ServiceName", sql.VarChar(150), data.serviceName)
      .input("RequiredQty", sql.Int, data.requiredQty)
      .input("ItemLocation", sql.VarChar(255), data.itemLocation)
      .input("ManuID", sql.Int, data.manuId)
      .input("SuppID", sql.Int, data.suppId)
      .input("InstallPackNum", sql.VarChar(100), data.installPackNum)
      .input("EquipSize", sql.Int, data.equipSize)
      .input("ModelNum", sql.VarChar(50), data.modelNum)
      .input("Driver", sql.VarChar(150), data.driver)
      .input("LocationDwg", sql.VarChar(255), data.locationDwg)
      .input("PID", sql.Int, data.pid)
      .input("InstallDwg", sql.VarChar(255), data.installDwg)
      .input("CodeStd", sql.VarChar(255), data.codeStd)
      .input("CategoryID", sql.Int, data.categoryId)
      .input("ClientID", sql.Int, data.clientId)
      .input("ProjectID", sql.Int, data.projectId)
      .input("Status", sql.VarChar(50), "Draft")
      .input("IsLatest", sql.Bit, 1)
      .input("IsTemplate", sql.Bit, 0)
      .input("AutoCADImport", sql.Bit, 0)
      .input("TemplateID", sql.Int, data.templateId)
      .query(`
        INSERT INTO Sheets (
          SheetName, SheetDesc, SheetDesc2, ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
          AreaID, PackageName, RevisionNum, RevisionDate, PreparedByID, PreparedByDate,
          EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
          ManuID, SuppID, InstallPackNum, EquipSize, ModelNum, Driver, LocationDwg, PID, InstallDwg, CodeStd,
          CategoryID, ClientID, ProjectID, Status, IsLatest, IsTemplate, AutoCADImport, TemplateID
        )
        OUTPUT INSERTED.SheetID
        VALUES (
          @SheetName, @SheetDesc, @SheetDesc2, @ClientDocNum, @ClientProjNum, @CompanyDocNum, @CompanyProjNum,
          @AreaID, @PackageName, @RevisionNum, @RevisionDate, @PreparedByID, @PreparedByDate,
          @EquipmentName, @EquipmentTagNum, @ServiceName, @RequiredQty, @ItemLocation,
          @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNum, @Driver, @LocationDwg, @PID, @InstallDwg, @CodeStd,
          @CategoryID, @ClientID, @ProjectID, @Status, @IsLatest, @IsTemplate, @AutoCADImport, @TemplateID
        )
      `);

    const sheetId = sheetResult.recordset[0].SheetID;

    for (let i = 0; i < data.subsheets.length; i++) {
      const subsheet = data.subsheets[i];

      const templateSubId = subsheet.id ?? null;
      const subRes = await tx.request()
        .input("SubName", sql.VarChar(150), subsheet.name)
        .input("SheetID", sql.Int, sheetId)
        .input("OrderIndex", sql.Int, i)
        .input("TemplateSubID", sql.Int, templateSubId)
        .query(`
          INSERT INTO SubSheets (SubName, SheetID, OrderIndex, TemplateSubID)
          OUTPUT INSERTED.SubID
          VALUES (@SubName, @SheetID, @OrderIndex, @TemplateSubID)
        `);

      const newSubId = subRes.recordset[0].SubID;

      for (let j = 0; j < subsheet.fields.length; j++) {
        const field = subsheet.fields[j];

        const templateFieldId = field.id ?? null;

        const fieldTemplate = templateFieldMap[subsheet.name]?.[field.sortOrder ?? j];
        const requiredFromTemplate = fieldTemplate?.required ?? false;
        const uomFromTemplate = fieldTemplate?.uom ?? field.uom ?? "";

        const infoRes = await tx.request()
          .input("SubID", sql.Int, newSubId)
          .input("Label", sql.VarChar(150), field.label)
          .input("InfoType", sql.VarChar(30), field.infoType)
          .input("OrderIndex", sql.Int, field.sortOrder || j)
          .input("UOM", sql.VarChar(50), uomFromTemplate)
          .input("Required", sql.Bit, requiredFromTemplate ? 1 : 0)
          .input("TemplateInfoTemplateID", sql.Int, templateFieldId)
          .query(`
            INSERT INTO InformationTemplates (SubID, Label, InfoType, OrderIndex, UOM, Required, TemplateInfoTemplateID)
            OUTPUT INSERTED.InfoTemplateID
            VALUES (@SubID, @Label, @InfoType, @OrderIndex, @UOM, @Required, @TemplateInfoTemplateID)
          `);

        const newInfoId = infoRes.recordset[0].InfoTemplateID;

        if (field.options?.length) {
          for (let k = 0; k < field.options.length; k++) {
            await tx.request()
              .input("InfoTemplateID", sql.Int, newInfoId)
              .input("OptionValue", sql.VarChar(100), field.options[k])
              .input("SortOrder", sql.Int, k)
              .query(`
                INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
                VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
              `);
          }
        }

        const originalId = field.id;
        const value = originalId ? data.fieldValues[originalId] : null;

        if (
          originalId &&
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          await tx.request()
            .input("InfoTemplateID", sql.Int, newInfoId)
            .input("SheetID", sql.Int, sheetId)
            .input("InfoValue", sql.VarChar(sql.MAX), value)
            .query(`
              INSERT INTO InformationValues (InfoTemplateID, SheetID, InfoValue)
              VALUES (@InfoTemplateID, @SheetID, @InfoValue)
            `);
        }
      }
    }

    if (context?.userId) {
      await insertAuditLog({
        PerformedBy: context.userId,
        TableName: "Sheets",
        RecordID: sheetId,
        Action: "Create Filled Sheet",
        Route: context.route ?? null,
        Method: context.method ?? null,
        StatusCode: 201,
        Changes: JSON.stringify(data),
      });
    }

    await notifyUsers({
      recipientRoleIds: [1, 2],
      sheetId,
      title: "New Filled Sheet Created",
      message: `Filled sheet #${sheetId} has been created by User #${context.userId}.`,
      category: "Datasheet",
      createdBy: context.userId,
    });

    await tx.commit();
    return { sheetId };
  } catch (err) {
    await tx.rollback();
    console.error("❌ createFilledSheet error:", err);
    throw err;
  }
}


export async function getFilledSheetTemplateId(sheetId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`SELECT TemplateID FROM Sheets WHERE SheetID = @SheetID`);
  return result.recordset[0];
}

export async function getFilledSheetDetailsById(
  sheetId: number,
  lang: string = "eng",
  uom: "SI" | "USC" = "SI"
) {
  const pool = await poolPromise;

  const sheetResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT 
        s.*, 
        s.RevisionNum, 
        u1.FirstName + ' ' + u1.LastName AS preparedByName,
        u2.FirstName + ' ' + u2.LastName AS verifiedByName,
        u3.FirstName + ' ' + u3.LastName AS approvedByName,
        u4.FirstName + ' ' + u4.LastName AS modifiedByName,
        u5.FirstName + ' ' + u5.LastName AS rejectedByName,
        a.AreaName,
        m.ManuName AS manuName,
        sup.SuppName AS suppName,
        cat.CategoryName,
        c.ClientName,
        c.ClientLogo,
        p.ProjName AS projectName
      FROM Sheets s
      LEFT JOIN Users u1 ON s.PreparedByID = u1.UserID
      LEFT JOIN Users u2 ON s.VerifiedByID = u2.UserID
      LEFT JOIN Users u3 ON s.ApprovedByID = u3.UserID
      LEFT JOIN Users u4 ON s.ModifiedByID = u4.UserID
      LEFT JOIN Users u5 ON s.RejectedByID = u5.UserID
      LEFT JOIN Areas a ON s.AreaID = a.AreaID
      LEFT JOIN Manufacturers m ON s.ManuID = m.ManuID
      LEFT JOIN Suppliers sup ON s.SuppID = sup.SuppID
      LEFT JOIN Categories cat ON s.CategoryID = cat.CategoryID
      LEFT JOIN Clients c ON s.ClientID = c.ClientID
      LEFT JOIN Projects p ON s.ProjectID = p.ProjectID
      WHERE s.SheetID = @SheetID
    `);

  const row = sheetResult.recordset[0];
  if (!row) return null;

  const datasheet: UnifiedSheet = buildUnifiedSheetFromRow(row);

  const templatesResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("TemplateID", sql.Int, row.TemplateID)
    .query(`
      SELECT 
        sub.SubID,
        sub.SubName,
        t.InfoTemplateID,
        t.Label,
        t.InfoType,
        t.UOM,
        t.Required,
        t.OrderIndex AS SortOrder,
        iv.InfoValue AS Value,
        ts.SubID AS TemplateSubID,
        t.TemplateInfoTemplateID AS TemplateInfoTemplateID
      FROM Subsheets sub
      INNER JOIN InformationTemplates t ON sub.SubID = t.SubID
      LEFT JOIN InformationValues iv ON t.InfoTemplateID = iv.InfoTemplateID AND iv.SheetID = @SheetID
      LEFT JOIN Subsheets ts ON ts.SheetID = @TemplateID AND ts.SubName = sub.SubName
      LEFT JOIN InformationTemplates tt ON tt.SubID = ts.SubID AND tt.OrderIndex = t.OrderIndex
      WHERE sub.SheetID = @SheetID
      ORDER BY sub.OrderIndex, t.OrderIndex;
    `);

  const optionsResult = await pool.request().query(`
    SELECT InfoTemplateID, OptionValue
    FROM InformationTemplateOptions
    ORDER BY InfoTemplateID, SortOrder;
  `);

  const optionMap: Record<number, Record<string, string>> = {};
  for (const row of optionsResult.recordset) {
    if (!optionMap[row.InfoTemplateID]) optionMap[row.InfoTemplateID] = {};
    const count = Object.keys(optionMap[row.InfoTemplateID]).length;
    optionMap[row.InfoTemplateID][String(count)] = row.OptionValue;
  }

  const rows = templatesResult.recordset;
  const subsheetsMap = new Map<number, UnifiedSubsheet>();

  for (const row of rows) {
    const originalSubId = row.TemplateSubID ?? row.SubID;
    const originalFieldId = row.TemplateInfoTemplateID ?? row.InfoTemplateID;

    if (!subsheetsMap.has(originalSubId)) {
      subsheetsMap.set(originalSubId, {
        id: row.SubID,
        originalId: row.TemplateSubID,
        name: row.SubName,
        fields: [],
      });
    }

    // Perform unit conversion if needed
    let value = row.Value ?? undefined;
    let displayUom = row.UOM ?? undefined;
    if (uom === "USC" && row.UOM && value !== undefined) {
      const result = convertToUSC(value, row.UOM);
      if (result) {
        value = result.value;
        displayUom = result.unit;
      }
    }

    const field = {
      id: row.InfoTemplateID,
      templateInfoTemplateID: row.TemplateInfoTemplateID,
      originalId: originalFieldId,
      label: row.Label,
      infoType: row.InfoType,
      uom: displayUom,
      sortOrder: row.SortOrder,
      required: Boolean(row.Required),
      options: Object.values(optionMap[row.InfoTemplateID] ?? {}),
      value,
    };

    subsheetsMap.get(originalSubId)!.fields.push(field);
  }

  datasheet.subsheets = Array.from(subsheetsMap.values());

  if (lang !== "eng") {
    const translations = await getSheetTranslations(row.TemplateID, lang);
    const translatedSheet = applySheetTranslations(datasheet, translations);
    return { datasheet: translatedSheet, translations };
  }

  return { datasheet, translations: null };
}

interface RawSheetRow {
  SheetID: number;
  SheetName: string;
  SheetDesc: string;
  SheetDesc2: string;
  ClientID: number;
  ClientName: string;
  ClientLogo: string;
  ClientProjNum: string;
  ClientDocNum: string;
  CompanyDocNum: string;
  CompanyProjNum: string;
  AreaID: number;
  AreaName: string;
  PackageName: string;
  RevisionNum: number;
  RevisionDate: Date | null;
  PreparedByID: number;
  preparedByName: string;
  PreparedByDate: Date | null;
  VerifiedByID: number | null;
  verifiedByName: string | null;
  VerifiedByDate: Date | null;
  ApprovedByID: number | null;
  approvedByName: string | null;
  ApprovedByDate: Date | null;
  RejectedByID: number | null;
  rejectedByName: string | null;
  RejectedByDate: Date | null;
  ModifiedByID: number | null;
  modifiedByName: string | null;
  ModifiedByDate: Date | null;
  IsTemplate: boolean;
  IsLatest: boolean;
  Status: string;
  RejectComment: string | null;
  ItemLocation: string;
  RequiredQty: number;
  EquipmentName: string;
  EquipmentTagNum: string;
  ServiceName: string;
  ManuID: number;
  manuName: string;
  SuppID: number;
  suppName: string;
  InstallPackNum: string;
  EquipSize: string;
  ModelNum: string;
  Driver: string;
  LocationDwg: string;
  PID: string;
  InstallDwg: string;
  CodeStd: string;
  CategoryID: number;
  CategoryName: string;
  ProjectID: number;
  projectName: string;
  TemplateID: number;
  ParentSheetID: number;
}


function buildUnifiedSheetFromRow(row: RawSheetRow): UnifiedSheet {
  return {
    sheetId: row.SheetID,
    sheetName: row.SheetName,
    sheetDesc: row.SheetDesc,
    sheetDesc2: row.SheetDesc2,
    clientId: row.ClientID,
    clientName: row.ClientName,
    clientLogo: row.ClientLogo,
    clientProjectNum: Number(row.ClientProjNum),
    clientDocNum: Number(row.ClientDocNum),
    companyDocNum: Number(row.CompanyDocNum),
    companyProjectNum: Number(row.CompanyProjNum),
    areaId: row.AreaID,
    areaName: row.AreaName,
    packageName: row.PackageName,
    revisionNum: Array.isArray(row.RevisionNum) ? row.RevisionNum[0] : row.RevisionNum,
    revisionDate: row.RevisionDate?.toISOString().split("T")[0] ?? "",
    preparedById: row.PreparedByID,
    preparedByName: row.preparedByName,
    preparedByDate: row.PreparedByDate?.toISOString().split("T")[0] ?? "",
    verifiedById: row.VerifiedByID,
    verifiedByName: row.verifiedByName ?? undefined,
    verifiedDate: row.VerifiedByDate?.toISOString().split("T")[0] ?? "",
    approvedById: row.ApprovedByID,
    approvedByName: row.approvedByName ?? undefined,
    approvedDate: row.ApprovedByDate?.toISOString().split("T")[0] ?? "",
    rejectedById: row.RejectedByID ?? undefined,
    rejectedByName: row.rejectedByName ?? undefined,
    rejectedByDate: row.RejectedByDate?.toISOString().split("T")[0] ?? "",
    modifiedById: row.ModifiedByID ?? undefined,
    modifiedByName: row.modifiedByName ?? undefined,
    modifiedByDate: row.ModifiedByDate?.toISOString().split("T")[0] ?? "",
    isTemplate: row.IsTemplate,
    isLatest: row.IsLatest,
    status: (["Draft", "Rejected", "Modified Draft", "Verified", "Approved"].includes(row.Status) ? (row.Status as SheetStatus) : "Draft"),
    rejectComment: row.RejectComment ?? undefined,
    itemLocation: row.ItemLocation,
    requiredQty: row.RequiredQty,
    equipmentName: row.EquipmentName,
    equipmentTagNum: row.EquipmentTagNum,
    serviceName: row.ServiceName,
    manuId: row.ManuID,
    manuName: row.manuName,
    suppId: row.SuppID,
    suppName: row.suppName,
    installPackNum: row.InstallPackNum,
    equipSize: Number(row.EquipSize), 
    modelNum: row.ModelNum,
    driver: row.Driver,
    locationDwg: row.LocationDwg,
    pid: Number(row.PID), 
    installDwg: row.InstallDwg,
    codeStd: row.CodeStd,
    categoryId: row.CategoryID,
    categoryName: row.CategoryName,
    projectId: row.ProjectID,
    projectName: row.projectName,
    templateId: row.TemplateID,
    parentSheetId: row.ParentSheetID,
    sourceFilePath: null,
    subsheets: [],
  };
}

export const updateFilledSheet = async (
  sheetId: number,
  input: UnifiedSheet,
  updatedBy: number
): Promise<{ sheetId: number }> => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const request = transaction.request();

    request.input("SheetID", sheetId);
    request.input("SheetName", input.sheetName);
    request.input("SheetDesc", input.sheetDesc);
    request.input("SheetDesc2", input.sheetDesc2);
    request.input("ClientDocNum", input.clientDocNum);
    request.input("ClientProjNum", input.clientProjectNum);
    request.input("CompanyDocNum", input.companyDocNum);
    request.input("CompanyProjNum", input.companyProjectNum);
    request.input("AreaID", input.areaId);
    request.input("PackageName", input.packageName);
    request.input("RevisionNum", input.revisionNum);
    request.input("RevisionDate", input.revisionDate);
    request.input("ItemLocation", input.itemLocation);
    request.input("RequiredQty", input.requiredQty);
    request.input("EquipmentName", input.equipmentName);
    request.input("EquipmentTagNum", input.equipmentTagNum);
    request.input("ServiceName", input.serviceName);
    request.input("ManuID", input.manuId);
    request.input("SuppID", input.suppId);
    request.input("InstallPackNum", input.installPackNum);
    request.input("EquipSize", input.equipSize);
    request.input("ModelNum", input.modelNum);
    request.input("Driver", input.driver);
    request.input("LocationDWG", input.locationDwg);
    request.input("PID", input.pid);
    request.input("InstallDWG", input.installDwg);
    request.input("CodeStd", input.codeStd);
    request.input("CategoryID", input.categoryId);
    request.input("ClientID", input.clientId);
    request.input("ProjectID", input.projectId);
    request.input("ModifiedByID", updatedBy);

    await request.query(`
      UPDATE Sheets SET
        SheetName = @SheetName,
        SheetDesc = @SheetDesc,
        SheetDesc2 = @SheetDesc2,
        ClientDocNum = @ClientDocNum,
        ClientProjNum = @ClientProjNum,
        CompanyDocNum = @CompanyDocNum,
        CompanyProjNum = @CompanyProjNum,
        AreaID = @AreaID,
        PackageName = @PackageName,
        RevisionNum = @RevisionNum,
        RevisionDate = @RevisionDate,
        ItemLocation = @ItemLocation,
        RequiredQty = @RequiredQty,
        EquipmentName = @EquipmentName,
        EquipmentTagNum = @EquipmentTagNum,
        ServiceName = @ServiceName,
        ManuID = @ManuID,
        SuppID = @SuppID,
        InstallPackNum = @InstallPackNum,
        EquipSize = @EquipSize,
        ModelNum = @ModelNum,
        Driver = @Driver,
        LocationDWG = @LocationDWG,
        PID = @PID,
        InstallDWG = @InstallDWG,
        CodeStd = @CodeStd,
        CategoryID = @CategoryID,
        ClientID = @ClientID,
        ProjectID = @ProjectID,
        ModifiedByID = @ModifiedByID,
        ModifiedByDate = GETDATE(),
        Status = 'Modified Draft'
      WHERE SheetID = @SheetID
    `);

    const oldValuesResult = await transaction.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`
        SELECT IV.InfoTemplateID, IV.InfoValue, IT.Label, IT.UOM
        FROM InformationValues IV
        JOIN InformationTemplates IT ON IV.InfoTemplateID = IT.InfoTemplateID
        WHERE SheetID = @SheetID
      `);

    const oldValuesMap = new Map<number, { value: string; label: string; uom: string | null }>();
    for (const row of oldValuesResult.recordset) {
      oldValuesMap.set(row.InfoTemplateID, {
        value: row.InfoValue,
        label: row.Label,
        uom: row.UOM,
      });
    }

    await transaction.request().query(`
      DELETE FROM InformationValues WHERE SheetID = ${sheetId}
    `);

    const insertedTemplateIds = new Set<number>();

    for (const subsheet of input.subsheets) {
      for (const field of subsheet.fields) {
        const templateId = field.id;
        if (!templateId || insertedTemplateIds.has(templateId)) continue;

        insertedTemplateIds.add(templateId);
        const newValue = field.value ?? "";

        await transaction.request()
          .input("InfoTemplateID", sql.Int, templateId)
          .input("SheetID", sql.Int, sheetId)
          .input("InfoValue", sql.VarChar(sql.MAX), newValue)
          .query(`
            INSERT INTO InformationValues (InfoTemplateID, SheetID, InfoValue)
            VALUES (@InfoTemplateID, @SheetID, @InfoValue)
          `);

        const previous = oldValuesMap.get(templateId);
        if (previous && previous.value !== newValue) {
          await transaction.request()
            .input("SheetID", sql.Int, sheetId)
            .input("ChangedBy", sql.Int, updatedBy)
            .input("InfoTemplateID", sql.Int, templateId)
            .input("OldValue", sql.VarChar(sql.MAX), previous.value)
            .input("NewValue", sql.VarChar(sql.MAX), newValue)
            .input("UOM", sql.VarChar(100), previous.uom)
            .query(`
              INSERT INTO ChangeLogs (
                SheetID, ChangedBy, InfoTemplateID,
                OldValue, NewValue, UOM, ChangeDate
              ) VALUES (
                @SheetID, @ChangedBy, @InfoTemplateID,
                @OldValue, @NewValue, @UOM, GETDATE()
              )
            `);
        }
      }
    }

    await insertAuditLog({
      PerformedBy: updatedBy,
      TableName: "Sheets",
      RecordID: sheetId,
      Action: "Update Filled Sheet",
    });

    await notifyUsers({
      recipientRoleIds: [1, 2],
      sheetId,
      title: "Filled Datasheet Updated",
      message: `Sheet #${sheetId} has been updated.`,
      category: "Datasheet",
      createdBy: updatedBy,
    });

    await transaction.commit();
    return { sheetId };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

export async function verifyFilledSheet(
  sheetId: number,
  action: "verify" | "reject",
  rejectionComment: string | undefined,
  verifierId: number
) {
  const pool = await poolPromise;
  const status = action === "verify" ? "Verified" : "Rejected";

  // 🔹 1. Get verifier's first name
  const userResult = await pool
    .request()
    .input("UserID", sql.Int, verifierId)
    .query(`SELECT FirstName FROM Users WHERE UserID = @UserID`);

  const verifierName = userResult.recordset[0]?.FirstName || `User #${verifierId}`;

  // 🔹 2. Build and execute update query for Sheets
  const request = pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("Status", sql.VarChar, status);

  if (action === "verify") {
    request
      .input("VerifiedByID", sql.Int, verifierId)
      .input("VerifiedByDate", sql.DateTime, new Date());

    await request.query(`
      UPDATE Sheets
      SET 
        Status = @Status,
        VerifiedByID = @VerifiedByID,
        VerifiedByDate = @VerifiedByDate
      WHERE SheetID = @SheetID
    `);
  } else {
    request
      .input("RejectedByID", sql.Int, verifierId)
      .input("RejectedByDate", sql.DateTime, new Date())
      .input("RejectComment", sql.NVarChar, rejectionComment || null);

    await request.query(`
      UPDATE Sheets
      SET 
        Status = @Status,
        RejectedByID = @RejectedByID,
        RejectedByDate = @RejectedByDate,
        RejectComment = @RejectComment
      WHERE SheetID = @SheetID
    `);
  }

  // 🔹 3. Audit log
  await insertAuditLog({
    PerformedBy: verifierId,
    TableName: "Sheets",
    RecordID: sheetId,
    Action: action === "verify" ? "Verify Filled Sheet" : "Reject Filled Sheet",
  });

  // 🔹 4. Notify Admins
  await notifyUsers({
    recipientRoleIds: [1], // Admins
    sheetId,
    title: `Filled Sheet ${status}`,
    message: `Filled sheet #${sheetId} has been ${status.toLowerCase()} by ${verifierName}.`,
    category: "Datasheet",
    createdBy: verifierId,
  });

  // 🔹 5. Notify the engineer (PreparedByID)
  const engineerResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`SELECT PreparedByID FROM Sheets WHERE SheetID = @SheetID`);

  const preparedById = engineerResult.recordset[0]?.PreparedByID;

  if (preparedById) {
    await notifyUsers({
      recipientUserIds: [preparedById],
      sheetId,
      title: `Your filled sheet was ${status.toLowerCase()}`,
      message: `Your filled sheet #${sheetId} has been ${status.toLowerCase()} by ${verifierName}.`,
      category: "Datasheet",
      createdBy: verifierId,
    });
  }
}

export async function approveFilledSheet(sheetId: number, approvedById: number): Promise<number> {
  const pool = await poolPromise;

  // 🔹 Update the filled sheet
  const updateResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("ApprovedByID", sql.Int, approvedById)
    .input("ApprovedByDate", sql.DateTime, new Date())
    .input("Status", sql.VarChar(50), "Approved")
    .query(`
      UPDATE Sheets
      SET Status = @Status,
          ApprovedByID = @ApprovedByID,
          ApprovedByDate = @ApprovedByDate
      WHERE SheetID = @SheetID AND IsTemplate = 0
    `);

  // 🔍 Check if update affected any row
  if (updateResult.rowsAffected[0] === 0) {
    console.warn(`⚠️ No filled sheet found or updated for SheetID: ${sheetId}`);
    throw new Error("Filled sheet not found or already approved.");
  }

  // ✅ Insert audit log
  await insertAuditLog({
    PerformedBy: approvedById,
    TableName: "Sheets",
    RecordID: sheetId,
    Action: "Approve Filled Sheet",
  });

  // 🔍 Fetch engineer (creator)
  const creatorResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query("SELECT PreparedByID FROM Sheets WHERE SheetID = @SheetID");

  const preparedById = creatorResult.recordset[0]?.PreparedByID;

  if (!preparedById) {
    console.warn(`⚠️ No PreparedByID found for Filled SheetID: ${sheetId}`);
  } else {
    try {
      await notifyUsers({
        recipientUserIds: [preparedById],
        sheetId,
        createdBy: approvedById,
        category: "Datasheet",
        title: "Filled Sheet Approved",
        message: `Your filled sheet #${sheetId} has been approved.`,
      });
    } catch (err) {
      console.error("❌ Failed to send approval notification:", err);
    }
  }

  return sheetId;
}

export const fetchReferenceOptions = async () => {
  const pool = await poolPromise;

  const [categories, users] = await Promise.all([
    pool.query(`SELECT CategoryID, CategoryName FROM Categories ORDER BY CategoryName`),
    pool.query(`SELECT UserID, FirstName, LastName FROM Users ORDER BY FirstName, LastName`)
  ]);

  return {
    categories: categories.recordset,
    users: users.recordset
  };
};