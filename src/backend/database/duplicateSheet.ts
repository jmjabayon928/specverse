// src/backend/database/datasheetDuplicate.ts
import { poolPromise, sql } from "@/backend/config/db";

export async function duplicateSheet(templateId: number, isTemplate = false): Promise<number> {
  const pool = await poolPromise;

  // 🟢 Get the existing sheet
  const result = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query(`SELECT * FROM Sheets WHERE SheetID = @SheetID`);

  const template = result.recordset[0];
  if (!template) throw new Error("Template not found");

  // 🟢 Insert new Sheet
  const insertResult = await pool.request()
    .input("SheetName", sql.NVarChar, `${template.SheetName}_Copy`)
    .input("SheetNameFr", sql.NVarChar, template.SheetNameFr)
    .input("SheetDesc", sql.NVarChar, template.SheetDesc)
    .input("SheetDescFr", sql.NVarChar, template.SheetDescFr)
    .input("SheetDesc2", sql.NVarChar, template.SheetDesc2)
    .input("SheetDescFr2", sql.NVarChar, template.SheetDescFr2)
    .input("ClientDocNum", sql.Int, template.ClientDocNum)
    .input("ClientProjNum", sql.Int, template.ClientProjNum)
    .input("CompanyDocNum", sql.Int, template.CompanyDocNum)
    .input("CompanyProjNum", sql.Int, template.CompanyProjNum)
    .input("AreaID", sql.Int, template.AreaID)
    .input("PackageName", sql.NVarChar, template.PackageName)
    .input("RevisionNum", sql.Int, 1)
    .input("RevisionDate", sql.DateTime, new Date())
    .input("PreparedByID", sql.Int, template.PreparedByID)
    .input("PreparedByDate", sql.DateTime, template.PreparedByDate)
    .input("VerifiedByID", sql.Int, template.VerifiedByID)
    .input("VerifiedByDate", sql.DateTime, template.VerifiedByDate)
    .input("ApprovedByID", sql.Int, template.ApprovedByID)
    .input("ApprovedByDate", sql.DateTime, template.ApprovedByDate)
    .input("EquipmentName", sql.NVarChar, template.EquipmentName)
    .input("EquipmentTagNum", sql.NVarChar, template.EquipmentTagNum)
    .input("ServiceName", sql.NVarChar, template.ServiceName)
    .input("RequiredQty", sql.Int, template.RequiredQty)
    .input("ItemLocation", sql.NVarChar, template.ItemLocation)
    .input("ManuID", sql.Int, template.ManuID)
    .input("SuppID", sql.Int, template.SuppID)
    .input("InstallPackNum", sql.NVarChar, template.InstallPackNum)
    .input("EquipSize", sql.Decimal(18, 4), template.EquipSize)
    .input("ModelNum", sql.NVarChar, template.ModelNum)
    .input("Driver", sql.NVarChar, template.Driver)
    .input("LocationDwg", sql.NVarChar, template.LocationDwg)
    .input("PID", sql.Int, template.PID)
    .input("InstallDwg", sql.NVarChar, template.InstallDwg)
    .input("CodeStd", sql.NVarChar, template.CodeStd)
    .input("CategoryID", sql.Int, template.CategoryID)
    .input("ClientID", sql.Int, template.ClientID)
    .input("ProjectID", sql.Int, template.ProjectID)
    .input("DisciplineID", sql.Int, template.DisciplineID ?? null)
    .input("DatasheetSubtypeID", sql.Int, template.DatasheetSubtypeID ?? null)
    .input("ParentSheetID", sql.Int, isTemplate ? null : template.SheetID)
    .input("Status", sql.NVarChar, isTemplate ? "Template" : "Draft")
    .input("IsLatest", sql.Bit, 1)
    .input("IsTemplate", sql.Bit, isTemplate ? 1 : 0)
    .query(`
      INSERT INTO Sheets (
        SheetName, SheetNameFr, SheetDesc, SheetDescFr, SheetDesc2, SheetDescFr2,
        ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum, AreaID, PackageName,
        RevisionNum, RevisionDate, PreparedByID, PreparedByDate, VerifiedByID, VerifiedByDate,
        ApprovedByID, ApprovedByDate, EquipmentName, EquipmentTagNum, ServiceName, RequiredQty,
        ItemLocation, ManuID, SuppID, InstallPackNum, EquipSize, ModelNum, Driver,
        LocationDwg, PID, InstallDwg, CodeStd, CategoryID, ClientID, ProjectID,
        DisciplineID, DatasheetSubtypeID, ParentSheetID, Status, IsLatest, IsTemplate
      )
      OUTPUT INSERTED.SheetID
      VALUES (
        @SheetName, @SheetNameFr, @SheetDesc, @SheetDescFr, @SheetDesc2, @SheetDescFr2,
        @ClientDocNum, @ClientProjNum, @CompanyDocNum, @CompanyProjNum, @AreaID, @PackageName,
        @RevisionNum, @RevisionDate, @PreparedByID, @PreparedByDate, @VerifiedByID, @VerifiedByDate,
        @ApprovedByID, @ApprovedByDate, @EquipmentName, @EquipmentTagNum, @ServiceName, @RequiredQty,
        @ItemLocation, @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNum, @Driver,
        @LocationDwg, @PID, @InstallDwg, @CodeStd, @CategoryID, @ClientID, @ProjectID,
        @DisciplineID, @DatasheetSubtypeID, @ParentSheetID, @Status, @IsLatest, @IsTemplate
      )
    `);

  const newSheetId = insertResult.recordset[0].SheetID;

  // 🟢 Copy SubSheets + InformationTemplates
  const subsheets = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query(`SELECT * FROM SubSheets WHERE SheetID = @SheetID ORDER BY OrderIndex`);

  for (const subsheet of subsheets.recordset) {
    const subInsert = await pool.request()
      .input("SheetID", sql.Int, newSheetId)
      .input("SubName", sql.NVarChar, subsheet.SubName)
      .input("SubNameFr", sql.NVarChar, subsheet.SubNameFr)
      .input("OrderIndex", sql.Int, subsheet.OrderIndex)
      .query(`
        INSERT INTO SubSheets (SheetID, SubName, SubNameFr, OrderIndex)
        OUTPUT INSERTED.SubID
        VALUES (@SheetID, @SubName, @SubNameFr, @OrderIndex)
      `);

    const newSubId = subInsert.recordset[0].SubID;

    // Copy InformationTemplates
    const templates = await pool.request()
      .input("SubID", sql.Int, subsheet.SubID)
      .query(`SELECT * FROM InformationTemplates WHERE SubID = @SubID ORDER BY OrderIndex`);

    for (const template of templates.recordset) {
      const templateInsert = await pool.request()
        .input("SubID", sql.Int, newSubId)
        .input("Label", sql.NVarChar, template.Label)
        .input("LabelFr", sql.NVarChar, template.LabelFr)
        .input("InfoType", sql.NVarChar, template.InfoType)
        .input("UOM", sql.NVarChar, template.UOM)
        .input("OrderIndex", sql.Int, template.OrderIndex)
        .query(`
          INSERT INTO InformationTemplates (SubID, Label, LabelFr, InfoType, UOM, OrderIndex)
          OUTPUT INSERTED.InfoTemplateID
          VALUES (@SubID, @Label, @LabelFr, @InfoType, @UOM, @OrderIndex)
        `);

      const newTemplateId = templateInsert.recordset[0].InfoTemplateID;

      // Copy Options
      const options = await pool.request()
        .input("InfoTemplateID", sql.Int, template.InfoTemplateID)
        .query(`SELECT * FROM InformationTemplateOptions WHERE InfoTemplateID = @InfoTemplateID`);

      for (const option of options.recordset) {
        await pool.request()
          .input("InfoTemplateID", sql.Int, newTemplateId)
          .input("OptionValue", sql.NVarChar, option.OptionValue)
          .query(`INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue) VALUES (@InfoTemplateID, @OptionValue)`);
      }
    }
  }

  return newSheetId;
}
