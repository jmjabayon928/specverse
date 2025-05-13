import { poolPromise, sql } from "@/backend/config/db";
import { Datasheet, Equipment, Subsheet } from "@/types/datasheetTemplate";

export async function insertTemplate(
  datasheet: Datasheet,
  equipment: Equipment,
  subsheets: Subsheet[]
) {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // ✅ 1. Insert into Sheets
    const sheetRequest = new sql.Request(tx);
    const sheetResult = await sheetRequest
      .input("SheetNameEng", sql.VarChar, datasheet.sheetName)
      .input("SheetNameFr", sql.VarChar, datasheet.sheetName) // or placeholder
      .input("SheetDescEng", sql.VarChar, datasheet.sheetDesc)
      .input("SheetDescFr", sql.VarChar, datasheet.sheetDesc) // or placeholder
      .input("SheetDescEng2", sql.VarChar, datasheet.sheetDesc2 ?? "")
      .input("SheetDescFr2", sql.VarChar, datasheet.sheetDesc2 ?? "")      
      .input("ClientDocNum", sql.Int, datasheet.clientDoc || null)
      .input("ClientProjNum", sql.Int, datasheet.clientProject || null)
      .input("CompanyDocNum", sql.Int, datasheet.companyDoc || null)
      .input("CompanyProjNum", sql.Int, datasheet.companyProject || null)
      .input("AreaID", sql.Int, datasheet.areaId)
      .input("PackageName", sql.VarChar, datasheet.packageName)
      .input("RevisionNum", sql.Int, datasheet.revisionNum)
      .input("RevisionDate", sql.Date, datasheet.preparedDate)
      .input("PreparedByID", sql.Int, datasheet.preparedBy)
      .input("PreparedByDate", sql.DateTime, datasheet.preparedDate)
      .input("VerifiedByID", sql.Int, datasheet.verifiedBy || null)
      .input("VerifiedByDate", sql.DateTime, datasheet.verifiedDate || null)
      .input("ApprovedByID", sql.Int, datasheet.approvedBy || null)
      .input("ApprovedByDate", sql.DateTime, datasheet.approvedDate || null)
      .input("EquipmentName", sql.VarChar, equipment.equipmentName)
      .input("EquipmentTagNum", sql.VarChar, equipment.equipmentTagNum)
      .input("ServiceName", sql.VarChar, equipment.serviceName)
      .input("RequiredQty", sql.Int, equipment.requiredQty)
      .input("ItemLocation", sql.VarChar, equipment.itemLocation)
      .input("ManuID", sql.Int, equipment.manufacturerId)
      .input("SuppID", sql.Int, equipment.supplierId)
      .input("InstallPackNum", sql.VarChar, equipment.installPackNum)
      .input("EquipSize", sql.Int, equipment.equipSize)
      .input("ModelNumber", sql.VarChar, equipment.modelNum)
      .input("Driver", sql.VarChar, equipment.driver || null)
      .input("LocationDwg", sql.VarChar, equipment.locationDWG || null)
      .input("PID", sql.Int, equipment.pid)
      .input("InstallDwg", sql.VarChar, equipment.installDWG || null)
      .input("CodeStd", sql.VarChar, equipment.codeStd || null)
      .input("CategoryID", sql.Int, equipment.categoryId)
      .input("ClientID", sql.Int, equipment.clientId)
      .input("ProjID", sql.Int, equipment.projectId)
      .input("Status", sql.VarChar, "Template")
      .input("IsLatest", sql.Bit, 1)
      .query(`
        INSERT INTO Sheets (
          SheetNameEng, SheetNameFr, SheetDescEng, SheetDescFr, SheetDescEng2, SheetDescFr2,
          ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
          AreaID, PackageName, RevisionNum, RevisionDate,
          PreparedByID, PreparedByDate, VerifiedByID, VerifiedByDate,
          ApprovedByID, ApprovedByDate,
          EquipmentName, EquipmentTagNum, ServiceName, RequiredQty,
          ItemLocation, ManuID, SuppID, InstallPackNum, EquipSize, ModelNumber, Driver,
          LocationDwg, PID, InstallDwg, CodeStd, CategoryID, ClientID, ProjID,
          Status, IsLatest
        )
        OUTPUT INSERTED.SheetID
        VALUES (
          @SheetNameEng, @SheetNameFr, @SheetDescEng, @SheetDescFr, @SheetDescEng2, @SheetDescFr2,
          @ClientDocNum, @ClientProjNum, @CompanyDocNum, @CompanyProjNum,
          @AreaID, @PackageName, @RevisionNum, @RevisionDate,
          @PreparedByID, @PreparedByDate, @VerifiedByID, @VerifiedByDate,
          @ApprovedByID, @ApprovedByDate,
          @EquipmentName, @EquipmentTagNum, @ServiceName, @RequiredQty,
          @ItemLocation, @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNumber, @Driver,
          @LocationDwg, @PID, @InstallDwg, @CodeStd, @CategoryID, @ClientID, @ProjID,
          @Status, @IsLatest
        );
      `);

    const sheetId = sheetResult.recordset[0].SheetID;

    // ✅ 2. Insert SubSheets and Templates (each with new Request)
    for (let i = 0; i < subsheets.length; i++) {
      const subsheet = subsheets[i];
      const subRequest = new sql.Request(tx);

      const subResult = await subRequest
        .input("SheetID", sql.Int, sheetId)
        .input("SubNameEng", sql.VarChar, subsheet.name)
        .input("SubNameFr", sql.VarChar, null)
        .input("OrderIndex", sql.Int, i)
        .query(`
          INSERT INTO SubSheets (SheetID, SubNameEng, SubNameFr, OrderIndex)
          OUTPUT INSERTED.SubID
          VALUES (@SheetID, @SubNameEng, @SubNameFr, @OrderIndex);
        `);

      const subId = subResult.recordset[0].SubID;

      for (let j = 0; j < subsheet.templates.length; j++) {
        const template = subsheet.templates[j];
        const templateRequest = new sql.Request(tx);

        const templateResult = await templateRequest
          .input("SubID", sql.Int, subId)
          .input("LabelEng", sql.VarChar, template.name)
          .input("LabelFr", sql.VarChar, template.name)
          .input("InfoType", sql.VarChar, template.type)
          .input("UOM", sql.VarChar, template.uom)
          .input("OrderIndex", sql.Int, j)
          .query(`
            INSERT INTO InformationTemplates (SubID, LabelEng, LabelFr, InfoType, UOM, OrderIndex)
            OUTPUT INSERTED.InfoTemplateID
            VALUES (@SubID, @LabelEng, @LabelFr, @InfoType, @UOM, @OrderIndex);
          `);

        const templateId = templateResult.recordset[0].InfoTemplateID;

        if (template.options?.length) {
          for (const option of template.options) {
            const optionRequest = new sql.Request(tx);
            await optionRequest
              .input("InfoTemplateID", sql.Int, templateId)
              .input("OptionValue", sql.VarChar, option)
              .query(`
                INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue)
                VALUES (@InfoTemplateID, @OptionValue);
              `);
          }
        }
      }
    }

    await tx.commit();
    return sheetId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
