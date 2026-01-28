// src/backend/database/auditQueries.ts
import { poolPromise, sql } from "../config/db";

interface AuditLogInput {
  TableName?: string | null;
  RecordID?: number | null;
  Action: string;
  PerformedBy: number; // Required
  Route?: string | null;
  Method?: string | null;
  StatusCode?: number | null;
  Changes?: string | null;
}

export async function insertAuditLog(entry: AuditLogInput): Promise<void> {
  const pool = await poolPromise;

  // 🔍 Defensive logging
  if (entry.PerformedBy === undefined || entry.PerformedBy === null) {
    console.error("🛑 insertAuditLog: PerformedBy is undefined or null!", entry);
    throw new Error("PerformedBy must not be null");
  }

  await pool.request()
    .input("TableName", sql.NVarChar(255), entry.TableName ?? null)
    .input("RecordID", sql.Int, entry.RecordID ?? null)
    .input("Action", sql.NVarChar(50), entry.Action)
    .input("PerformedBy", sql.Int, entry.PerformedBy) // This must not be null
    .input("Route", sql.NVarChar(500), entry.Route ?? null)
    .input("Method", sql.NVarChar(10), entry.Method ?? null)
    .input("StatusCode", sql.Int, entry.StatusCode ?? null)
    .input("Changes", sql.NVarChar(sql.MAX), entry.Changes ?? null)
    .query(`
      INSERT INTO AuditLogs 
        (TableName, RecordID, Action, PerformedBy, PerformedAt, Route, Method, StatusCode, Changes)
      VALUES 
        (@TableName, @RecordID, @Action, @PerformedBy, GETDATE(), @Route, @Method, @StatusCode, @Changes)
    `);
}

export interface GetAuditLogsForRecordInput {
  tableName: "Sheets";
  recordId: number;
  limit: number;
}

export async function getAuditLogsForRecord(
  input: GetAuditLogsForRecordInput
): Promise<unknown[]> {
  const pool = await poolPromise;

  const result = await pool
    .request()
    .input("TableName", sql.NVarChar(255), input.tableName)
    .input("RecordID", sql.Int, input.recordId)
    .input("Limit", sql.Int, input.limit)
    .query(`
      SELECT TOP (@Limit)
        a.*,
        u.UserID AS PerformedByUserID,
        u.FirstName + ' ' + u.LastName AS PerformedByName,
        CONVERT(varchar, a.PerformedAt, 126) AS PerformedAtISO
      FROM AuditLogs a
        LEFT JOIN Users u ON u.UserID = a.PerformedBy
      WHERE a.TableName = @TableName
        AND a.RecordID = @RecordID
      ORDER BY a.PerformedAt DESC
    `);

  return result.recordset as unknown[];
}
