// src/backend/database/datasheetTemplateQueries.ts
import { poolPromise} from "../config/db";

export async function getAllTemplates() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      s.SheetID AS sheetId,
      s.SheetName AS sheetName,
      s.SheetDesc AS sheetDesc,
      s.CategoryID AS categoryId,
      c.CategoryName AS categoryName,
      s.PreparedByID AS preparedById,
      u.FirstName + ' ' + u.LastName AS preparedByName,
      s.RevisionDate AS revisionDate
    FROM Sheets s
    LEFT JOIN Categories c ON s.CategoryID = c.CategoryID
    LEFT JOIN Users u ON s.PreparedByID = u.UserID
    WHERE s.IsTemplate = 1
    ORDER BY s.RevisionDate DESC
  `);

  return result.recordset;
}
