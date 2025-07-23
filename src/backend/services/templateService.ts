// src/backend/services/templateService.ts

import { poolPromise, sql } from "../config/db";
import { UnifiedSheet, UnifiedSubsheet, InfoField } from "@/types/sheet";
import { insertAuditLog } from "../database/auditQueries";
import { notifyUsers } from "../utils/notifyUsers";
import { getSheetTranslations } from "@/backend/services/translationService";
import { convertToUSC } from "@/utils/unitConversionTable";


type TemplateRow = {
  InfoTemplateID: number;
  Label: string;
  InfoType: string;
  UOM: string;
};

type OptionRow = {
  OptionValue: string;
};

export async function createTemplate(data: UnifiedSheet, userId: number): Promise<number> {
  const pool = await poolPromise;
  const tx = await pool.transaction();

  try {
    await tx.begin();

    const sheetResult = await tx.request()
      .input("SheetName", sql.VarChar(255), data.sheetName)
      .input("SheetDesc", sql.VarChar(255), data.sheetDesc)
      .input("SheetDesc2", sql.VarChar(255), data.sheetDesc2 ?? null)
      .input("ClientDocNum", sql.Int, data.clientDocNum)
      .input("ClientProjNum", sql.Int, data.clientProjectNum)
      .input("CompanyDocNum", sql.Int, data.companyDocNum)
      .input("CompanyProjNum", sql.Int, data.companyProjectNum)
      .input("AreaID", sql.Int, data.areaId)
      .input("PackageName", sql.VarChar(100), data.packageName)
      .input("RevisionNum", sql.Int, data.revisionNum)
      .input("RevisionDate", sql.Date, new Date())
      .input("PreparedByID", sql.Int, userId)
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
      .input("Driver", sql.VarChar(150), data.driver ?? null)
      .input("LocationDwg", sql.VarChar(255), data.locationDwg ?? null)
      .input("PID", sql.Int, data.pid)
      .input("InstallDwg", sql.VarChar(255), data.installDwg ?? null)
      .input("CodeStd", sql.VarChar(255), data.codeStd ?? null)
      .input("CategoryID", sql.Int, data.categoryId ?? null)
      .input("ClientID", sql.Int, data.clientId ?? null)
      .input("ProjectID", sql.Int, data.projectId ?? null)
      .input("Status", sql.VarChar(50), "Draft")
      .input("IsLatest", sql.Bit, 1)
      .input("IsTemplate", sql.Bit, data.isTemplate ? 1 : 0)
      .input("AutoCADImport", sql.Bit, 0)
      .query(`
        INSERT INTO Sheets (
          SheetName, SheetDesc, SheetDesc2, ClientDocNum, ClientProjNum, CompanyDocNum, 
          CompanyProjNum, AreaID, PackageName, RevisionNum, RevisionDate,
          PreparedByID, PreparedByDate, EquipmentName, EquipmentTagNum, ServiceName,
          RequiredQty, ItemLocation, ManuID, SuppID, InstallPackNum, EquipSize, ModelNum,
          Driver, LocationDwg, PID, InstallDwg, CodeStd, CategoryID, ClientID, ProjectID,
          Status, IsLatest, IsTemplate, AutoCADImport
        )
        OUTPUT INSERTED.SheetID
        VALUES (
          @SheetName, @SheetDesc, @SheetDesc2, @ClientDocNum, @ClientProjNum, @CompanyDocNum, 
          @CompanyProjNum, @AreaID, @PackageName, @RevisionNum, @RevisionDate,
          @PreparedByID, @PreparedByDate, @EquipmentName, @EquipmentTagNum, @ServiceName,
          @RequiredQty, @ItemLocation, @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNum,
          @Driver, @LocationDwg, @PID, @InstallDwg, @CodeStd, @CategoryID, @ClientID, @ProjectID,
          @Status, @IsLatest, @IsTemplate, @AutoCADImport
        )
      `);

    const sheetId = sheetResult.recordset[0].SheetID;

    for (const [i, subsheet] of data.subsheets.entries()) {
      const subResult = await tx.request()
        .input("SubName", sql.VarChar(150), subsheet.name)
        .input("SheetID", sql.Int, sheetId)
        .input("OrderIndex", sql.Int, i)
        .query(`
          INSERT INTO SubSheets (SubName, SheetID, OrderIndex)
          OUTPUT INSERTED.SubID
          VALUES (@SubName, @SheetID, @OrderIndex)
        `);

      const subId = subResult.recordset[0].SubID;

      for (const [j, field] of subsheet.fields.entries()) {
        const infoResult = await tx.request()
          .input("SubID", sql.Int, subId)
          .input("Label", sql.VarChar(150), field.label)
          .input("InfoType", sql.VarChar(30), field.infoType)
          .input("OrderIndex", sql.Int, j)
          .input("UOM", sql.VarChar(50), field.uom ?? null)
          .input("Required", sql.Bit, field.required ? 1 : 0)
          .query(`
            INSERT INTO InformationTemplates (SubID, Label, InfoType, OrderIndex, UOM, Required)
            OUTPUT INSERTED.InfoTemplateID
            VALUES (@SubID, @Label, @InfoType, @OrderIndex, @UOM, @Required)
          `);

        const infoTemplateId = infoResult.recordset[0].InfoTemplateID;

        if (field.options?.length) {
          for (const [k, optionValue] of field.options.entries()) {
            await tx.request()
              .input("InfoTemplateID", sql.Int, infoTemplateId)
              .input("OptionValue", sql.VarChar(100), optionValue)
              .input("SortOrder", sql.Int, k)
              .query(`
                INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
                VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
              `);
          }
        }
      }
    }

    await insertAuditLog({
      PerformedBy: userId,
      TableName: "Sheets",
      RecordID: sheetId,
      Action: "Create Template",
    });

    await tx.commit();

    await notifyUsers({
      sheetId,
      createdBy: userId,
      recipientRoleIds: [1, 2],
      category: data.isTemplate ? "Template" : "Datasheet",
      title: `New ${data.isTemplate ? "Template" : "Datasheet"} Created`,
      message: `${data.sheetName} has been created.`,
    });

    return sheetId;
  } catch (err) {
    await tx.rollback();
    console.error("❌ createTemplate error:", err);
    throw err;
  }
}

export async function getTemplateDetailsById(
  templateId: number,
  lang: string = "eng",
  uom: "SI" | "USC" = "SI"
) {
  const pool = await poolPromise;

  // Fetch main sheet details
  const sheetResult = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query(`
      SELECT 
        s.SheetID,
        s.SheetName,
        s.SheetDesc,
        s.SheetDesc2,
        s.PackageName,
        s.RevisionNum,
        s.RevisionDate,
        s.PreparedByID,
        u1.FirstName + ' ' + u1.LastName AS preparedByName,
        s.PreparedByDate,
        s.VerifiedByID,
        u2.FirstName + ' ' + u2.LastName AS verifiedByName,
        s.VerifiedByDate,
        s.ApprovedByID,
        u3.FirstName + ' ' + u3.LastName AS approvedByName,
        s.ApprovedByDate,
        s.ClientDocNum,
        s.ClientProjNum,
        s.CompanyDocNum,
        s.CompanyProjNum,
        s.AreaID,
        a.AreaName,
        s.ClientID,
        c.ClientName, 
        c.ClientLogo,
        s.ProjectID,
        p.ProjName AS projectName,
        s.EquipmentName,
        s.EquipmentTagNum,
        s.ServiceName,
        s.EquipSize,
        s.RequiredQty,
        s.ItemLocation,
        s.ManuID,
        m.ManuName AS manuName,
        s.SuppID,
        sup.SuppName AS suppName,
        s.InstallPackNum,
        s.ModelNum,
        s.Driver,
        s.LocationDwg,
        s.PID,
        s.InstallDwg,
        s.CodeStd,
        s.CategoryID,
        cat.CategoryName,
        s.Status,
        s.IsTemplate,
        s.IsLatest,
        s.AutoCADImport,
        s.SourceFilePath,
        s.RejectComment,
        s.ModifiedByID,
        u4.FirstName + ' ' + u4.LastName AS modifiedByName,
        s.ModifiedByDate,
        s.RejectedByID,
        u5.FirstName + ' ' + u5.LastName AS rejectedByName,
        s.RejectedByDate AS rejectedByDate,
        s.TemplateID,
        s.ParentSheetID
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

  const datasheet: UnifiedSheet = {
    sheetId: row.SheetID,
    sheetName: row.SheetName,
    sheetDesc: row.SheetDesc,
    sheetDesc2: row.SheetDesc2,
    clientId: row.ClientID,
    clientName: row.ClientName,
    clientLogo: row.ClientLogo,
    clientDocNum: row.ClientDocNum,
    clientProjectNum: row.ClientProjNum,
    companyDocNum: row.CompanyDocNum,
    companyProjectNum: row.CompanyProjNum,
    areaId: row.AreaID,
    areaName: row.AreaName,
    packageName: row.PackageName,
    revisionNum: row.RevisionNum,
    revisionDate: row.RevisionDate?.toISOString().split("T")[0] ?? "",
    preparedById: row.PreparedByID,
    preparedByName: row.preparedByName,
    preparedByDate: row.PreparedByDate?.toISOString().split("T")[0] ?? "",
    verifiedById: row.VerifiedByID,
    verifiedByName: row.verifiedByName,
    verifiedDate: row.VerifiedByDate?.toISOString().split("T")[0] ?? "",
    approvedById: row.ApprovedByID,
    approvedByName: row.approvedByName,
    approvedDate: row.ApprovedByDate?.toISOString().split("T")[0] ?? "",
    isLatest: row.IsLatest,
    isTemplate: row.IsTemplate,
    autoCADImport: row.AutoCADImport,
    status: row.Status,
    rejectComment: row.RejectComment,
    rejectedById: row.RejectedByID,
    rejectedByName: row.rejectedByName,
    rejectedByDate: row.rejectedByDate?.toISOString().split("T")[0] ?? "",
    modifiedById: row.ModifiedByID,
    modifiedByName: row.modifiedByName,
    modifiedByDate: row.ModifiedByDate?.toISOString().split("T")[0] ?? "",
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
    equipSize: row.EquipSize,
    modelNum: row.ModelNum,
    driver: row.Driver,
    locationDwg: row.LocationDwg,
    categoryId: row.CategoryID,
    categoryName: row.CategoryName,
    projectId: row.ProjectID,
    projectName: row.projectName,
    pid: row.PID,
    installDwg: row.InstallDwg,
    codeStd: row.CodeStd,
    templateId: row.TemplateID,
    parentSheetId: row.ParentSheetID,
    sourceFilePath: row.SourceFilePath,
    subsheets: [],
  };

  // Fetch subsheets and info fields
  const subsheetResult = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query(`
      SELECT s.SubID, s.SubName, s.OrderIndex
      FROM SubSheets s
      WHERE s.SheetID = @SheetID
      ORDER BY s.OrderIndex
    `);

  const subsheets: UnifiedSubsheet[] = [];

  for (const sub of subsheetResult.recordset) {
    const templateResult = await pool.request()
      .input("SubID", sql.Int, sub.SubID)
      .query(`
        SELECT t.InfoTemplateID, t.Label, t.InfoType, t.UOM
        FROM InformationTemplates t
        WHERE t.SubID = @SubID
        ORDER BY t.OrderIndex
      `);

    const fields: InfoField[] = await Promise.all(
      templateResult.recordset.map(async (t: TemplateRow) => {
        const optionResult = await pool.request()
          .input("InfoTemplateID", sql.Int, t.InfoTemplateID)
          .query(`SELECT OptionValue FROM InformationTemplateOptions WHERE InfoTemplateID = @InfoTemplateID`);

        let displayUOM = t.UOM;
        if (uom === "USC" && t.UOM) {
          const result = convertToUSC("1", t.UOM);
          if (result) {
            displayUOM = result.unit;
          }
        }

        return {
          id: t.InfoTemplateID,
          label: t.Label,
          infoType: t.InfoType as "int" | "decimal" | "varchar",
          uom: displayUOM,
          sortOrder: 1,
          required: false,
          options: optionResult.recordset.map((r: OptionRow) => r.OptionValue),
        };
      })
    );

    subsheets.push({
      id: sub.SubID,
      name: sub.SubName,
      fields,
    });
  }

  datasheet.subsheets = subsheets;

  // Fetch translations (server-side)
  const translations = await getSheetTranslations(templateId, lang);

  return { datasheet, translations };
}

export async function updateTemplate(sheetId: number, data: UnifiedSheet, userId: number): Promise<number> {
  const pool = await poolPromise;
  const tx = await pool.transaction();

  try {
    await tx.begin();

    // 🔹 Determine new status
    const currentStatusResult = await tx.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`SELECT Status FROM Sheets WHERE SheetID = @SheetID`);

    const currentStatus = currentStatusResult.recordset[0]?.Status;
    const newStatus = currentStatus === "Rejected" ? "Modified Draft" : currentStatus;

    await tx.request()
      .input("SheetID", sql.Int, sheetId)
      .input("Status", sql.VarChar(50), newStatus)
      .input("ModifiedByID", sql.Int, userId)
      .input("ModifiedByDate", sql.DateTime, new Date())
      .input("SheetName", sql.VarChar(255), data.sheetName)
      .input("SheetDesc", sql.VarChar(255), data.sheetDesc)
      .input("SheetDesc2", sql.VarChar(255), data.sheetDesc2 ?? null)
      .input("ClientDocNum", sql.Int, data.clientDocNum)
      .input("ClientProjNum", sql.Int, data.clientProjectNum)
      .input("CompanyDocNum", sql.Int, data.companyDocNum)
      .input("CompanyProjNum", sql.Int, data.companyProjectNum)
      .input("AreaID", sql.Int, data.areaId)
      .input("PackageName", sql.VarChar(100), data.packageName)
      .input("RevisionNum", sql.Int, data.revisionNum)
      .input("RevisionDate", sql.Date, new Date(data.revisionDate))
      .input("PreparedByID", sql.Int, data.preparedById)
      .input("PreparedByDate", sql.DateTime, new Date(data.preparedByDate))
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
      .input("Driver", sql.VarChar(150), data.driver ?? null)
      .input("LocationDwg", sql.VarChar(255), data.locationDwg ?? null)
      .input("PID", sql.Int, data.pid)
      .input("InstallDwg", sql.VarChar(255), data.installDwg ?? null)
      .input("CodeStd", sql.VarChar(255), data.codeStd ?? null)
      .input("CategoryID", sql.Int, data.categoryId ?? null)
      .input("ClientID", sql.Int, data.clientId ?? null)
      .input("ProjectID", sql.Int, data.projectId ?? null)
      .input("AutoCADImport", sql.Bit, data.autoCADImport ? 1 : 0)
      .query(`
        UPDATE Sheets SET
          Status = @Status,
          ModifiedByID = @ModifiedByID,
          ModifiedByDate = @ModifiedByDate,
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
          PreparedByID = @PreparedByID,
          PreparedByDate = @PreparedByDate,
          EquipmentName = @EquipmentName,
          EquipmentTagNum = @EquipmentTagNum,
          ServiceName = @ServiceName,
          RequiredQty = @RequiredQty,
          ItemLocation = @ItemLocation,
          ManuID = @ManuID,
          SuppID = @SuppID,
          InstallPackNum = @InstallPackNum,
          EquipSize = @EquipSize,
          ModelNum = @ModelNum,
          Driver = @Driver,
          LocationDwg = @LocationDwg,
          PID = @PID,
          InstallDwg = @InstallDwg,
          CodeStd = @CodeStd,
          CategoryID = @CategoryID,
          ClientID = @ClientID,
          ProjectID = @ProjectID,
          AutoCADImport = @AutoCADImport
        WHERE SheetID = @SheetID
      `);

    // 🔹 Delete existing subsheet data
    await tx.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`
        DELETE ITO FROM InformationTemplateOptions ITO
        INNER JOIN InformationTemplates IT ON ITO.InfoTemplateID = IT.InfoTemplateID
        INNER JOIN SubSheets SS ON IT.SubID = SS.SubID
        WHERE SS.SheetID = @SheetID
      `);

    await tx.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`
        DELETE IT FROM InformationTemplates IT
        INNER JOIN SubSheets SS ON IT.SubID = SS.SubID
        WHERE SS.SheetID = @SheetID
      `);

    await tx.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`DELETE FROM SubSheets WHERE SheetID = @SheetID`);

    // 🔹 Insert new subsheets and fields
    for (const [i, subsheet] of data.subsheets.entries()) {
      if (!Array.isArray(subsheet.fields)) {
        console.warn("⚠️ Subsheet fields is not an array:", subsheet);
        continue;
      }

      const subResult = await tx.request()
        .input("SubName", sql.VarChar(150), subsheet.name)
        .input("SheetID", sql.Int, sheetId)
        .input("OrderIndex", sql.Int, i)
        .query(`
          INSERT INTO SubSheets (SubName, SheetID, OrderIndex)
          OUTPUT INSERTED.SubID
          VALUES (@SubName, @SheetID, @OrderIndex)
        `);

      const subId = subResult.recordset[0].SubID;

      for (const [j, field] of subsheet.fields.entries()) {
        if (!field.label || !field.infoType) {
          console.warn("⚠️ Skipping field due to missing label or infoType:", field);
          continue;
        }

        console.log("🔹 Inserting Field", field.label, "under Subsheet", subsheet.name);

        const infoResult = await tx.request()
          .input("SubID", sql.Int, subId)
          .input("Label", sql.VarChar(150), field.label)
          .input("InfoType", sql.VarChar(30), field.infoType)
          .input("OrderIndex", sql.Int, j)
          .input("UOM", sql.VarChar(50), field.uom ?? null)
          .input("Required", sql.Bit, field.required ? 1 : 0)
          .query(`
            INSERT INTO InformationTemplates (SubID, Label, InfoType, OrderIndex, UOM, Required)
            OUTPUT INSERTED.InfoTemplateID
            VALUES (@SubID, @Label, @InfoType, @OrderIndex, @UOM, @Required)
          `);

        const infoTemplateId = infoResult.recordset[0].InfoTemplateID;

        if (field.options?.length) {
          if (!Array.isArray(field.options)) {
            console.warn("⚠️ Field options is not an array:", field);
            continue;
          }

          for (const [k, optionValue] of field.options.entries()) {
            await tx.request()
              .input("InfoTemplateID", sql.Int, infoTemplateId)
              .input("OptionValue", sql.VarChar(100), optionValue)
              .input("SortOrder", sql.Int, k)
              .query(`
                INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
                VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
              `);
          }
        }
      }
    }

    await insertAuditLog({
      PerformedBy: userId,
      TableName: "Sheets",
      RecordID: sheetId,
      Action: "Edit Template",
    });

    await notifyUsers({
      sheetId: sheetId,
      createdBy: userId,
      recipientRoleIds: [1, 2],
      category: data.isTemplate ? "Template" : "Datasheet",
      title: `Template Updated`,
      message: `${data.sheetName} has been updated.`,
    });

    await tx.commit();
    return sheetId;
  } catch (err) {
    await tx.rollback();
    console.error("❌ updateTemplate error:", err);
    throw err;
  }
}

export async function verifyTemplate(
  sheetId: number,
  action: "verify" | "reject",
  rejectionComment: string | undefined,
  verifiedById: number
) {
  const pool = await poolPromise;
  const status = action === "verify" ? "Verified" : "Rejected";

  // 🔹 1. Get verifier's first name
  const userResult = await pool
    .request()
    .input("UserID", sql.Int, verifiedById)
    .query(`SELECT FirstName FROM Users WHERE UserID = @UserID`);

  const verifiedByName = userResult.recordset[0]?.FirstName || `User #${verifiedById}`;

  // 🔹 2. Build and execute update query for Sheets
  const request = pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("Status", sql.VarChar, status);

  if (action === "verify") {
    request
      .input("VerifiedByID", sql.Int, verifiedById)
      .input("VerifiedByDate", sql.DateTime, new Date());

    await request.query(`
      UPDATE Sheets
      SET 
        Status = @Status,
        VerifiedByID = @VerifiedByID,
        VerifiedByDate = @VerifiedByDate
      WHERE SheetID = @SheetID
    `);
  } else if (action === "reject") {
    request
      .input("RejectedByID", sql.Int, verifiedById)
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
    PerformedBy: verifiedById,
    TableName: "Sheets",
    RecordID: sheetId,
    Action: action === "verify" ? "Verify Template" : "Reject Template",
  });

  // 🔹 4. Notify Admins (RoleID 1)
  await notifyUsers({
    recipientRoleIds: [1], // Admins
    sheetId,
    title: `Template ${status}`,
    message: `Template #${sheetId} has been ${status.toLowerCase()} by ${verifiedByName}.`,
    category: "Template",
    createdBy: verifiedById,
  });

  // 🔹 5. Notify the Engineer (PreparedByID)
  const preparedByResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT PreparedByID FROM Sheets WHERE SheetID = @SheetID
    `);

  const preparedById = preparedByResult.recordset[0]?.PreparedByID;

  if (preparedById) {
    await notifyUsers({
      recipientUserIds: [preparedById],
      sheetId,
      title: `Your template was ${status.toLowerCase()}`,
      message: `Your template #${sheetId} has been ${status.toLowerCase()} by ${verifiedByName}.`,
      category: "Template",
      createdBy: verifiedById,
    });
  }
}

export async function approveTemplate(sheetId: number, approvedById: number): Promise<number> {
  const pool = await poolPromise;

  // 🔹 Update the sheet
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
      WHERE SheetID = @SheetID
    `);

  // 🔍 Check if any rows were updated
  if (updateResult.rowsAffected[0] === 0) {
    console.warn(`⚠️ No sheet found or updated for SheetID: ${sheetId}`);
    throw new Error("Sheet not found or already updated.");
  }

  // ✅ Insert audit log
  await insertAuditLog({
    PerformedBy: approvedById,
    TableName: "Sheets",
    RecordID: sheetId,
    Action: "Approve Template",
  });

  // 🔍 Fetch who created the sheet
  const creatorResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query("SELECT PreparedByID FROM Sheets WHERE SheetID = @SheetID");

  const preparedById = creatorResult.recordset[0]?.PreparedByID;

  if (!preparedById) {
    console.warn(`⚠️ No PreparedByID found for SheetID: ${sheetId}`);
  } else {
    try {
      await notifyUsers({
        recipientUserIds: [preparedById],
        sheetId,
        createdBy: approvedById,
        category: "Template",
        title: "Template Approved",
        message: `Your template #${sheetId} has been approved.`,
      });
    } catch (err) {
      console.error("❌ Failed to send notification:", err);
    }
  }

  return sheetId;
}