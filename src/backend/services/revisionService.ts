import { poolPromise } from "../config/db";
import sql from "mssql";

export async function createNewRevision(sheetId: number, createdBy: number): Promise<number> {
    const pool = await poolPromise;
  
    // Step 1: Get current max revision number
    const { recordset } = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .query("SELECT ISNULL(MAX(RevisionNum), 0) AS MaxRev FROM SheetRevisions WHERE SheetID = @SheetID");
  
    const newRevNum = recordset[0].MaxRev + 1;
  
    // Step 2: Insert new revision
    const insertResult = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .input("RevisionNum", sql.Int, newRevNum)
      .input("RevisionDate", sql.Date, new Date())
      .input("Status", sql.VarChar(20), "Draft")
      .input("PreparedByID", sql.Int, createdBy)
      .input("PreparedByDate", sql.Date, new Date())
      .query(`
        INSERT INTO SheetRevisions (SheetID, RevisionNum, RevisionDate, Status, PreparedByID, PreparedByDate)
        OUTPUT INSERTED.RevisionID
        VALUES (@SheetID, @RevisionNum, @RevisionDate, @Status, @PreparedByID, @PreparedByDate)
      `);
  
    const newRevisionId = insertResult.recordset[0].RevisionID;
  
    // Step 3: Duplicate all InformationValues (optional, or create empty)
    await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .input("NewRevisionID", sql.Int, newRevisionId)
      .query(`
        INSERT INTO InformationValues (InfoTemplateID, SheetID, RevisionID, InfoValue1, UOM1, InfoValue2, UOM2)
        SELECT InfoTemplateID, SheetID, @NewRevisionID, InfoValue1, UOM1, InfoValue2, UOM2
        FROM InformationValues
        WHERE SheetID = @SheetID AND RevisionID = (
          SELECT TOP 1 RevisionID FROM SheetRevisions 
          WHERE SheetID = @SheetID 
          ORDER BY RevisionNum DESC
        )
      `);
  
    return newRevisionId;
  }
  