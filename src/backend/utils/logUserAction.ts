// src/backend/utils/logUserAction.ts
import { poolPromise, sql } from "../config/db";

export async function logUserAction({
  userId,
  action,
  module,
  sheetId,
  details,
  ipAddress,
  browserAgent,
}: {
  userId: number;
  action: string;
  module: string;
  sheetId?: number;
  details?: string;
  ipAddress?: string;
  browserAgent?: string;
}) {
  const pool = await poolPromise;
  await pool.request()
    .input("UserID", sql.Int, userId)
    .input("Action", sql.NVarChar(100), action)
    .input("Module", sql.NVarChar(50), module)
    .input("SheetID", sql.Int, sheetId || null)
    .input("Details", sql.NVarChar(sql.MAX), details || null)
    .input("IPAddress", sql.NVarChar(50), ipAddress || null)
    .input("BrowserAgent", sql.NVarChar(255), browserAgent || null)
    .query(`
      INSERT INTO UserLogs (UserID, Action, Module, SheetID, Details, IPAddress, BrowserAgent)
      VALUES (@UserID, @Action, @Module, @SheetID, @Details, @IPAddress, @BrowserAgent)
    `);
}
