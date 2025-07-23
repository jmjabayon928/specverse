// src/backend/database/templateWriteQueries.ts
import { poolPromise, sql } from "@/backend/config/db";
import type { DatasheetInput, EquipmentInput, SubsheetInput } from "@/validation/sheetSchema";

/**
 * Create a new template (insert into Sheets + SubSheets + Templates + Options)
 */
export async function insertTemplate(
  datasheet: DatasheetInput,
  equipment: EquipmentInput,
  subsheets: SubsheetInput[]
): Promise<number> {
  const pool = await poolPromise;
  const conn = await pool.connect();
  const transaction = new sql.Transaction(conn);

  try {
    await transaction.begin();

    // ✅ 1️⃣ Insert into Sheets table
    const sheetRes = await conn
      .request()
      .input("IsTemplate", sql.Bit, 1)
      .input("SheetName", sql.VarChar, datasheet.sheetName)
      .input("SheetDesc", sql.VarChar, datasheet.sheetDesc)
      .input("SheetDesc2", sql.VarChar, datasheet.sheetDesc2 ?? null)
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
      // ✅ Equipment fields
      .input("EquipmentName", sql.VarChar, equipment.equipmentName)
      .input("EquipmentTagNum", sql.VarChar, equipment.equipmentTagNum)
      .input("ServiceName", sql.VarChar, equipment.serviceName)
      .input("EquipSize", sql.Int, equipment.equipSize)
      .input("RequiredQty", sql.Int, equipment.requiredQty)
      .input("ItemLocation", sql.VarChar, equipment.itemLocation)
      .input("ManuID", sql.Int, equipment.manufacturerId)
      .input("SuppID", sql.Int, equipment.supplierId)
      .input("InstallPackNum", sql.VarChar, equipment.installPackNum)
      .input("ModelNum", sql.VarChar, equipment.modelNum)
      .input("Driver", sql.VarChar, equipment.driver ?? null)
      .input("LocationDWG", sql.VarChar, equipment.locationDWG ?? null)
      .input("PID", sql.Int, equipment.pid)
      .input("InstallDWG", sql.VarChar, equipment.installDWG ?? null)
      .input("CodeStd", sql.VarChar, equipment.codeStd ?? null)
      .input("CategoryID", sql.Int, equipment.categoryId)
      .input("ClientID", sql.Int, equipment.clientId)
      .input("ProjectID", sql.Int, equipment.projectId)
      .query(`
        INSERT INTO Sheets (
          IsTemplate, SheetName, SheetDesc, SheetDesc2,
          ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
          AreaID, PackageName, RevisionNum, RevisionDate,
          PreparedByID, PreparedByDate, VerifiedByID, VerifiedByDate, ApprovedByID, ApprovedByDate,
          EquipmentName, EquipmentTagNum, ServiceName, EquipSize, RequiredQty,
          ItemLocation, ManuID, SuppID, InstallPackNum, ModelNum, Driver,
          LocationDWG, PID, InstallDWG, CodeStd, CategoryID, ClientID, ProjectID
        )
        OUTPUT INSERTED.SheetID
        VALUES (
          @IsTemplate, @SheetName, @SheetDesc, @SheetDesc2,
          @ClientDocNum, @ClientProjNum, @CompanyDocNum, @CompanyProjNum,
          @AreaID, @PackageName, @RevisionNum, @RevisionDate,
          @PreparedByID, @PreparedByDate, @VerifiedByID, @VerifiedByDate, @ApprovedByID, @ApprovedByDate,
          @EquipmentName, @EquipmentTagNum, @ServiceName, @EquipSize, @RequiredQty,
          @ItemLocation, @ManuID, @SuppID, @InstallPackNum, @ModelNum, @Driver,
          @LocationDWG, @PID, @InstallDWG, @CodeStd, @CategoryID, @ClientID, @ProjectID
        )
      `);

    const newSheetId = sheetRes.recordset[0].SheetID;

    // ✅ 2️⃣ Insert SubSheets + Templates + Options
    for (const [subIdx, subsheet] of subsheets.entries()) {
      const subRes = await conn
        .request()
        .input("SheetID", sql.Int, newSheetId)
        .input("SubName", sql.VarChar, subsheet.name)
        .input("OrderIndex", sql.Int, subIdx + 1)
        .query(`
          INSERT INTO SubSheets (SheetID, SubName, OrderIndex)
          OUTPUT INSERTED.SubID
          VALUES (@SheetID, @SubName, @OrderIndex)
        `);

      const subId = subRes.recordset[0].SubID;

      for (const [tmplIdx, tmpl] of subsheet.templates.entries()) {
        const tmplRes = await conn
          .request()
          .input("SubID", sql.Int, subId)
          .input("Label", sql.VarChar, tmpl.name)
          .input("Type", sql.VarChar, tmpl.type)
          .input("UOM", sql.VarChar, tmpl.uom || null)
          .input("OrderIndex", sql.Int, tmplIdx + 1)
          .query(`
            INSERT INTO InformationTemplates (SubID, Label, InfoType, UOM, OrderIndex)
            OUTPUT INSERTED.InfoTemplateID
            VALUES (@SubID, @Label, @Type, @UOM, @OrderIndex)
          `);

        const tmplId = tmplRes.recordset[0].InfoTemplateID;

        if (tmpl.type === "varchar" && tmpl.options?.length) {
          for (const [optIdx, opt] of tmpl.options.entries()) {
            await conn
              .request()
              .input("InfoTemplateID", sql.Int, tmplId)
              .input("OptionValue", sql.VarChar, opt)
              .input("SortOrder", sql.Int, optIdx + 1)   // ✅ Use SortOrder
              .query(`
                INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
                VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
              `);
          }
        }
      }
    }

    await transaction.commit();
    return newSheetId;
  } catch (err) {
    console.error("❌ insertTemplate error:", err);
    await transaction.rollback();
    throw err;
  } finally {
    conn.release();
  }
}


export async function updateDatasheetTemplate(
  sheetId: number,
  datasheet: DatasheetInput,
  equipment: EquipmentInput,
  subsheets: SubsheetInput[]
): Promise<boolean> {
  const pool = await poolPromise;
  const conn = await pool.connect();
  const transaction = new sql.Transaction(conn);

  try {
    await transaction.begin();

    // 1️⃣ Update Sheets (including equipment fields)
    await conn
      .request()
      .input("SheetID", sql.Int, sheetId)
      .input("SheetName", sql.VarChar, datasheet.sheetName)
      .input("SheetDesc", sql.VarChar, datasheet.sheetDesc)
      .input("SheetDesc2", sql.VarChar, datasheet.sheetDesc2 ?? null)
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
      // Equipment fields (inside Sheets table)
      .input("EquipmentName", sql.VarChar, equipment.equipmentName)
      .input("EquipmentTagNum", sql.VarChar, equipment.equipmentTagNum)
      .input("ServiceName", sql.VarChar, equipment.serviceName)
      .input("EquipSize", sql.Int, equipment.equipSize)
      .input("RequiredQty", sql.Int, equipment.requiredQty)
      .input("ItemLocation", sql.VarChar, equipment.itemLocation)
      .input("ManuID", sql.Int, equipment.manufacturerId)
      .input("SuppID", sql.Int, equipment.supplierId)
      .input("InstallPackNum", sql.VarChar, equipment.installPackNum)
      .input("ModelNum", sql.VarChar, equipment.modelNum)
      .input("Driver", sql.VarChar, equipment.driver ?? null)
      .input("LocationDWG", sql.VarChar, equipment.locationDWG ?? null)
      .input("PID", sql.Int, equipment.pid)
      .input("InstallDWG", sql.VarChar, equipment.installDWG ?? null)
      .input("CodeStd", sql.VarChar, equipment.codeStd ?? null)
      .input("CategoryID", sql.Int, equipment.categoryId)
      .input("ClientID", sql.Int, equipment.clientId)
      .input("ProjectID", sql.Int, equipment.projectId)
      .query(`
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
          ModelNum = @ModelNum,
          Driver = @Driver,
          LocationDWG = @LocationDWG,
          PID = @PID,
          InstallDWG = @InstallDWG,
          CodeStd = @CodeStd,
          CategoryID = @CategoryID,
          ClientID = @ClientID,
          ProjectID = @ProjectID
        WHERE SheetID = @SheetID
      `);

    // 2️⃣ Delete old SubSheets, Templates, and Options
    await conn.request().input("SheetID", sql.Int, sheetId).query(`
      DELETE o FROM InformationTemplateOptions o
      JOIN InformationTemplates t ON o.InfoTemplateID = t.InfoTemplateID
      JOIN SubSheets s ON t.SubID = s.SubID
      WHERE s.SheetID = @SheetID;

      DELETE t FROM InformationTemplates t
      JOIN SubSheets s ON t.SubID = s.SubID
      WHERE s.SheetID = @SheetID;

      DELETE FROM SubSheets WHERE SheetID = @SheetID;
    `);

    // 3️⃣ Re-insert SubSheets + Templates
    for (const [subIdx, subsheet] of subsheets.entries()) {
      const subRes = await conn
        .request()
        .input("SheetID", sql.Int, sheetId)
        .input("SubName", sql.VarChar, subsheet.name)
        .input("OrderIndex", sql.Int, subIdx + 1)
        .query(`
          INSERT INTO SubSheets (SheetID, SubName, OrderIndex)
          OUTPUT INSERTED.SubID
          VALUES (@SheetID, @SubName, @OrderIndex)
        `);

      const subId = subRes.recordset[0].SubID;

      for (const [tIdx, tmpl] of subsheet.templates.entries()) {
        const tmplRes = await conn
          .request()
          .input("SubID", sql.Int, subId)
          .input("Label", sql.VarChar, tmpl.name)
          .input("Type", sql.VarChar, tmpl.type)
          .input("UOM", sql.VarChar, tmpl.uom || null)
          .input("OrderIndex", sql.Int, tIdx + 1)
          .query(`
            INSERT INTO InformationTemplates (SubID, Label, InfoType, UOM, OrderIndex)
            OUTPUT INSERTED.InfoTemplateID
            VALUES (@SubID, @Label, @Type, @UOM, @OrderIndex)
          `);

        const tmplId = tmplRes.recordset[0].InfoTemplateID;

        if (tmpl.type === "varchar" && tmpl.options?.length) {
          for (const opt of tmpl.options) {
            await conn
              .request()
              .input("InfoTemplateID", sql.Int, tmplId)
              .input("OptionValue", sql.VarChar, opt)
              .query(`
                INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue)
                VALUES (@InfoTemplateID, @OptionValue)
              `);
          }
        }
      }
    }

    await transaction.commit();
    return true;
  } catch (err) {
    console.error("❌ updateDatasheetTemplate error:", err);
    await transaction.rollback();
    return false;
  } finally {
    conn.release();
  }
}

