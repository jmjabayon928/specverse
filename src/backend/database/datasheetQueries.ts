// src/backend/database/datasheetQueries.ts
import { dbConfig } from "../config/db";
import { poolPromise, sql } from "../config/db";


export async function getDatasheetById(sheetId: number) {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input("SheetID", sql.Int, sheetId)
            .query(`
              SELECT s.SheetName, s.SheetDesc, s.SheetDesc2, s.ClientDocNum, p.ClientProjNum, 
                    s.CompanyDocNum, p.ProjNum AS CompanyProjNum, a.AreaName, 
                    s.PackageName, s.RevisionNum, s.RevisionDate, 
                    pe.FirstName + ' ' + pe.LastName AS PreparedBy, s.PreparedByDate, 
                    ve.FirstName + ' ' + ve.LastName AS VerifiedBy, s.VerifiedByDate, 
                    ae.FirstName + ' ' + ae.LastName AS ApprovedBy, s.ApprovedByDate, 
                    s.EquipmentName, s.EquipmentTagNum, s.ServiceName, s.RequiredQty, 
                    s.ItemLocation, m.ManuName, su.SuppName, s.InstallPackNum, 
                    s.EquipSize, s.ModelNum, s.Driver, s.LocationDwg, s.PID, 
                    s.InstallDwg, s.CodeStd, c.ClientName, c.ClientLogo 
              FROM Sheets s
              LEFT JOIN Clients c ON s.ClientID = c.ClientID
              LEFT JOIN Projects p ON s.ProjectID = p.ProjectID
              LEFT JOIN Areas a ON s.AreaID = a.AreaID
              LEFT JOIN Users pe ON s.PreparedByID = pe.UserID
              LEFT JOIN Users ve ON s.VerifiedByID = ve.UserID
              LEFT JOIN Users ae ON s.ApprovedByID = ae.UserID
              LEFT JOIN Manufacturers m ON s.ManuID = m.ManuID
              LEFT JOIN Suppliers su ON s.SuppID = su.SuppID
              WHERE s.SheetID = @SheetID
            `);

        return result.recordset[0] || null;
    } catch (error) {
        console.error("Database Error:", error);
        throw error;
    }
}

export async function getSubSheetsBySheetId(sheetId: string) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("SheetID", sql.Int, parseInt(sheetId)) // or cast earlier if sheetId is already number
    .query(`SELECT SubID, SubName FROM SubSheets WHERE SheetID = @SheetID`);
  return result.recordset;
}

export async function getInformationBySubSheetId(subId: string) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("SubID", sql.Int, subId)
    .query(`
      SELECT it.InfoTemplateID, it.Label, it.Required, iv.InfoValue, it.UOM
      FROM InformationTemplates it JOIN InformationValues iv ON it.InfoTemplateID = iv.InfoTemplateID
      WHERE it.SubID = @SubID
      ORDER BY it.OrderIndex
    `);
  return result.recordset;
}

export async function getTranslatedSheetNameAndDescription(sheetId: number, lang: string) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("LangCode", sql.VarChar, lang)
    .query(`
      SELECT SheetName, SheetDesc, SheetDesc2, EquipmentName, ServiceName
      FROM SheetTranslations
      WHERE SheetID = @SheetID AND LangCode = @LangCode
    `);

  return result.recordset[0]; 
}