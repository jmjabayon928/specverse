// src/backend/database/duplicateSheet.ts
import { poolPromise, sql } from "../config/db";

export async function duplicateSheet(originalSheetId: number): Promise<number> {
  const pool = await poolPromise;

  // 1. Fetch the original sheet
  const originalResult = await pool.request()
    .input("SheetID", sql.Int, originalSheetId)
    .query("SELECT * FROM Sheets WHERE SheetID = @SheetID");

  const original = originalResult.recordset[0];
  if (!original) throw new Error("Original sheet not found");

  await pool.request()
  .input("SheetID", sql.Int, original.SheetID)
  .query("UPDATE Sheets SET IsLatest = 0 WHERE SheetID = @SheetID");

  // 2. Insert a new sheet with incremented revision and status Draft
  const newRevision = (original.RevisionNum ?? 0) + 1;
  const parentId = original.ParentSheetID || original.SheetID;

  console.log("🧪 Duplication original sheet:", original);
  console.log("🧪 Duplication values:", {
    ClientDocNum: original.ClientDocNum,
    typeof: typeof original.ClientDocNum
  });
  const insertResult = await pool.request()
    .input("ParentSheetID", sql.Int, parentId)
    .input("SheetNameEng", sql.NVarChar, String(original.SheetNameEng ?? ""))
    .input("SheetDescEng", sql.NVarChar, String(original.SheetDescEng ?? ""))
    .input("SheetNameFr", sql.NVarChar, String(original.SheetNameFr ?? ""))
    .input("SheetDescFr", sql.NVarChar, String(original.SheetDescFr ?? ""))
    .input("SheetDescEng2", sql.NVarChar, String(original.SheetDescEng2 ?? ""))
    .input("SheetDescFr2", sql.NVarChar, String(original.SheetDescFr2 ?? ""))
    .input("ClientDocNum", sql.NVarChar, String(original.ClientDocNum ?? ""))
    .input("CompanyDocNum", sql.NVarChar, String(original.CompanyDocNum ?? ""))
    .input("ProjID", sql.Int, original.ProjID ?? 0)
    .input("ClientID", sql.Int, original.ClientID ?? 0)
    .input("AreaID", sql.Int, original.AreaID ?? 0)
    .input("PackageName", sql.NVarChar, String(original.PackageName ?? ""))
    .input("EquipmentName", sql.NVarChar, String(original.EquipmentName ?? ""))
    .input("EquipmentTagNum", sql.NVarChar, String(original.EquipmentTagNum ?? ""))
    .input("ServiceName", sql.NVarChar, String(original.ServiceName ?? ""))
    .input("RequiredQty", sql.Int, String(original.RequiredQty ?? 0))
    .input("ItemLocation", sql.NVarChar, String(original.ItemLocation ?? ""))
    .input("ManuID", sql.Int, original.ManuID ?? 0)
    .input("SuppID", sql.Int, original.SuppID ?? 0)
    .input("InstallPackNum", sql.NVarChar, String(original.InstallPackNum ?? ""))
    .input("EquipSize", sql.Float, String(original.EquipSize))
    .input("ModelNumber", sql.NVarChar, String(original.ModelNumber ?? ""))
    .input("Driver", sql.NVarChar, String(original.Driver ?? ""))
    .input("LocationDwg", sql.NVarChar, String(original.LocationDwg ?? ""))
    .input("PID", sql.Int, original.PID ?? 0)
    .input("InstallDwg", sql.NVarChar, String(original.InstallDwg ?? ""))
    .input("CodeStd", sql.NVarChar, String(original.CodeStd ?? ""))
    .input("RevisionDate", sql.DateTime, new Date())
    .input("RevisionNum", sql.Int, newRevision ?? 0)
    .input("PreparedByID", sql.Int, original.PreparedByID ?? 0)
    .input("PreparedByDate", sql.DateTime, new Date())
    .input("VerifiedByID", sql.Int, original.VerifiedByID ?? 0)
    .input("VerifiedByDate", sql.DateTime, new Date())
    .input("ApprovedByID", sql.Int, original.ApprovedByID ?? 0)
    .input("ApprovedByDate", sql.DateTime, new Date())
    .input("Status", sql.NVarChar(20), "Draft")
    .input("IsLatest", sql.Bit, true)
    .query(`
      INSERT INTO Sheets (
        ParentSheetID, SheetNameEng, SheetDescEng, SheetDescEng2, SheetNameFr, SheetDescFr, SheetDescFr2,
        ClientDocNum, CompanyDocNum, ProjID, ClientID, AreaID, PackageName,
        EquipmentName, EquipmentTagNum, ServiceName, RequiredQty,
        ItemLocation, ManuID, SuppID, InstallPackNum, EquipSize, ModelNumber,
        Driver, LocationDwg, PID, InstallDwg, CodeStd, RevisionNum, RevisionDate, Status,
        PreparedByID, PreparedByDate, VerifiedByID, VerifiedByDate, ApprovedByID, ApprovedByDate, IsLatest 
      )
      OUTPUT INSERTED.SheetID
      VALUES (
        @ParentSheetID, @SheetNameEng, @SheetDescEng, @SheetDescEng2, @SheetNameFr, @SheetDescFr, @SheetDescFr2,
        @ClientDocNum, @CompanyDocNum, @ProjID, @ClientID, @AreaID, @PackageName,
        @EquipmentName, @EquipmentTagNum, @ServiceName, @RequiredQty,
        @ItemLocation, @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNumber,
        @Driver, @LocationDwg, @PID, @InstallDwg, @CodeStd, @RevisionNum, @RevisionDate, @Status, 
        @PreparedByID, @PreparedByDate, @VerifiedByID, @VerifiedByDate, @ApprovedByID, @ApprovedByDate, @IsLatest
      )
    `);

  const newSheetId = insertResult.recordset[0].SheetID;

  // 3. Copy InformationValues
  const infoResult = await pool.request()
    .input("SheetID", sql.Int, originalSheetId)
    .query("SELECT InfoTemplateID, InfoValue, UOM FROM InformationValues WHERE SheetID = @SheetID");

  for (const row of infoResult.recordset) {
    await pool.request()
      .input("SheetID", sql.Int, newSheetId)
      .input("InfoTemplateID", sql.Int, row.InfoTemplateID)
      .input("InfoValue", sql.NVarChar(255), row.InfoValue)
      .input("UOM", sql.NVarChar(50), row.UOM)
      .query(`
        INSERT INTO InformationValues (SheetID, InfoTemplateID, InfoValue, UOM)
        VALUES (@SheetID, @InfoTemplateID, @InfoValue, @UOM)
      `);
  }

  return newSheetId;
}
