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
    .input("SheetNameEng", sql.NVarChar, original.SheetNameEng)
    .input("SheetDescEng", sql.NVarChar, original.SheetDescEng)
    .input("ParentSheetID", sql.Int, original.ParentSheetID ?? original.SheetID)
    .input("RevisionNum", sql.Int, original.RevisionNum + 1)
    .input("Status", sql.NVarChar(20), "Draft")
    .query(`
      INSERT INTO Sheets (SheetNameEng, SheetDescEng, ParentSheetID, RevisionNum, Status)
      OUTPUT INSERTED.SheetID
      VALUES (@SheetNameEng, @SheetDescEng, @ParentSheetID, @RevisionNum, @Status)
    `);

  return insertResult.recordset[0].SheetID;
}
