// src/backend/database/datasheetQueries.ts
import { dbConfig } from "../config/db";
import { poolPromise, sql } from "../config/db";


export async function getDatasheetById(sheetId: string) {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input("SheetID", sql.Int, sheetId)
            .query(`
      SELECT s.SheetNameEng, s.SheetNameFr, s.SheetDescEng, s.SheetDescFr, 
             s.SheetDescEng2, s.SheetDescFr2, s.ClientDocNum, p.ClientProjNum, 
             s.CompanyDocNum, p.ProjNum AS CompanyProjNum, a.AreaName, 
             s.PackageName, s.RevisionNum, s.RevisionDate, 
             pe.FirstName + ' ' + pe.LastName AS PreparedBy, s.PreparedByDate, 
             ve.FirstName + ' ' + ve.LastName AS VerifiedBy, s.VerifiedByDate, 
             ae.FirstName + ' ' + ae.LastName AS ApprovedBy, s.ApprovedByDate, 
             s.EquipmentName, s.EquipmentTagNum, s.ServiceName, s.RequiredQty, 
             s.ItemLocation, m.ManuName, su.SuppName, s.InstallPackNum, 
             s.EquipSize, s.ModelNumber, s.Driver, s.LocationDwg, s.PID, 
             s.InstallDwg, s.CodeStd, c.ClientName, c.ClientLogo 
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

        return result.recordset[0] || null;
    } catch (error) {
        console.error("Database Error:", error);
        throw error;
    }
}

export async function getSubSheetsBySheetId(sheetId: string) {
    const pool = await sql.connect();
    const result = await pool
      .request()
      .input("SheetID", sql.Int, sheetId)
      .query(`SELECT SubID, SubNameEng, SubNameFr FROM SubSheets WHERE SheetID = @SheetID`);
    return result.recordset;
  }
  
  export async function getInformationBySubSheetId(subId: string) {
    const pool = await sql.connect();
    const result = await pool
      .request()
      .input("SubID", sql.Int, subId)
      .query(`
        SELECT InfoID, LabelEng, LabelFr, InfoValue1, InfoValue2, UOM1, UOM2
        FROM Information
        WHERE SubID = @SubID
      `);
    return result.recordset;
  }
  
  export async function getTranslatedSheetNameAndDescription(sheetId: number, lang: string) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .input("LanguageCode", sql.VarChar, lang)
      .query(`
        SELECT TranslatedName, TranslatedDescription
        FROM SheetTranslations
        WHERE SheetID = @SheetID AND LanguageCode = @LanguageCode
      `);
  
    return result.recordset[0]; // May return undefined
  }