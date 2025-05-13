// src/backend/database/templateViewQueries.ts
import { poolPromise, sql } from "@/backend/config/db";

interface TemplateRow {
    InfoTemplateID: number;
    LabelEng: string;
    InfoType: string;
    UOM: string;
}

interface OptionRow {
    OptionValue: string;
}

export async function getTemplateDetailsById(templateId: number) {
  const pool = await poolPromise;

  // 🟢 1. Get Datasheet + Equipment + Sheet Name + Client Info
  const sheetResult = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query(`
      SELECT 
        s.SheetID,
        s.SheetNameEng AS SheetName,
        s.SheetDescEng AS SheetDesc,
        s.SheetDescEng2 AS SheetDesc2,
        s.PackageName,
        s.RevisionNum,
        s.RevisionDate,
        s.PreparedByID,
        s.PreparedByDate,
        s.VerifiedByID,
        s.VerifiedByDate,
        s.ApprovedByID,
        s.ApprovedByDate,
        s.ClientDocNum,
        s.ClientProjNum,
        s.CompanyDocNum,
        s.CompanyProjNum,
        s.AreaID,
        s.EquipmentName,
        s.EquipmentTagNum,
        s.ServiceName,
        s.EquipSize,
        s.RequiredQty,
        s.ItemLocation,
        s.ManuID,
        s.SuppID,
        s.InstallPackNum,
        s.ModelNumber,
        s.Driver,
        s.LocationDwg,
        s.PID,
        s.InstallDwg,
        s.CodeStd,
        s.CategoryID,
        s.ClientID,
        s.ProjID,
        c.ClientName,
        c.ClientLogo
      FROM Sheets s
      LEFT JOIN Clients c ON s.ClientID = c.ClientID
      WHERE s.SheetID = @SheetID
    `);

  const row = sheetResult.recordset[0];
  if (!row) return null;

  const datasheet = {
    sheetName: row.SheetName,
    SheetNameEng: row.SheetName, 
    sheetDesc: row.SheetDesc,
    sheetDesc2: row.SheetDesc2,
    clientName: row.ClientName,
    clientLogo: row.ClientLogo ?? "default-logo.png",
    clientDoc: row.ClientDocNum,
    clientProject: row.ClientProjNum,
    companyDoc: row.CompanyDocNum,
    companyProject: row.CompanyProjNum,
    areaId: row.AreaID,
    packageName: row.PackageName,
    revisionNum: row.RevisionNum,
    revisionDate: row.RevisionDate ? row.RevisionDate.toISOString().split("T")[0] : null,
    preparedBy: row.PreparedByID,
    preparedDate: row.PreparedByDate ? row.PreparedByDate.toISOString().split("T")[0] : null,
    verifiedBy: row.VerifiedByID,
    verifiedDate: row.VerifiedByDate ? row.VerifiedByDate.toISOString().split("T")[0] : null,
    approvedBy: row.ApprovedByID,
    approvedDate: row.ApprovedByDate ? row.ApprovedByDate.toISOString().split("T")[0] : null,
  };

  const equipment = {
    equipmentName: row.EquipmentName,
    equipmentTagNum: row.EquipmentTagNum,
    serviceName: row.ServiceName,
    equipSize: row.EquipSize,
    requiredQty: row.RequiredQty,
    itemLocation: row.ItemLocation,
    manufacturerId: row.ManuID,
    supplierId: row.SuppID,
    installPackNum: row.InstallPackNum,
    modelNum: row.ModelNumber,
    driver: row.Driver,
    locationDWG: row.LocationDwg,
    pid: row.PID,
    installDWG: row.InstallDwg,
    codeStd: row.CodeStd,
    categoryId: row.CategoryID,
    clientId: row.ClientID,
    projectId: row.ProjID,
  };

  // 🟢 2. Get SubSheets
  const subsheetResult = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query(`
      SELECT s.SubID, s.SubNameEng, s.OrderIndex
      FROM SubSheets s
      WHERE s.SheetID = @SheetID
      ORDER BY s.OrderIndex
    `);

  const subsheets = [];

  for (const sub of subsheetResult.recordset) {
    const templateResult = await pool.request()
      .input("SubID", sql.Int, sub.SubID)
      .query(`
        SELECT t.InfoTemplateID, t.LabelEng, t.InfoType, t.UOM
        FROM InformationTemplates t
        WHERE t.SubID = @SubID
        ORDER BY t.OrderIndex
      `);

    const templates = await Promise.all(
      templateResult.recordset.map(async (t: TemplateRow) => {
          const optionResult = await pool.request()
              .input("InfoTemplateID", sql.Int, t.InfoTemplateID)
              .query(`
                  SELECT OptionValue FROM InformationTemplateOptions WHERE InfoTemplateID = @InfoTemplateID
              `);

          return {
              id: t.InfoTemplateID,
              name: t.LabelEng,
              type: t.InfoType,
              uom: t.UOM,
              options: optionResult.recordset.map((r: OptionRow) => r.OptionValue),
          };
      })
    );

    subsheets.push({
      id: sub.SubID,
      name: sub.SubNameEng,
      templates,
    });
  }

  return { datasheet, equipment, subsheets };
}
