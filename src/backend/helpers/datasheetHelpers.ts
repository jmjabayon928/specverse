import { poolPromise, sql } from "../config/db";

export async function duplicateSheet(originalSheetId: number): Promise<number> {
  const pool = await poolPromise;

  // 1. Get original sheet
  const result = await pool.request()
    .input("SheetID", sql.Int, originalSheetId)
    .query("SELECT * FROM Sheets WHERE SheetID = @SheetID");

  const original = result.recordset[0];
  if (!original) throw new Error("Original sheet not found");

  // 2. Insert duplicate (simplified — add all fields you need)
  const insertResult = await pool.request()
    .input("SheetName", sql.NVarChar, original.SheetName)
    .input("SheetDesc", sql.NVarChar, original.SheetDesc)
    .input("ParentSheetID", sql.Int, original.ParentSheetID ?? original.SheetID)
    .input("RevisionNum", sql.Int, original.RevisionNum + 1)
    .input("Status", sql.NVarChar(20), "Draft")
    .query(`
      INSERT INTO Sheets (SheetName, SheetDesc, ParentSheetID, RevisionNum, Status)
      OUTPUT INSERTED.SheetID
      VALUES (@SheetName, @SheetDesc, @ParentSheetID, @RevisionNum, @Status)
    `);

  return insertResult.recordset[0].SheetID;
}
