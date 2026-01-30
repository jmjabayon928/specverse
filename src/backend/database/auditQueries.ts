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
        a.LogID AS AuditLogID,
        a.TableName,
        a.RecordID,
        a.Action,
        a.PerformedBy,
        a.PerformedAt,
        a.Route,
        a.Method,
        a.StatusCode,
        a.Changes,
        u.UserID AS PerformedByUserID,
        u.FirstName + ' ' + u.LastName AS PerformedByName,
        CONVERT(varchar, a.PerformedAt, 126) AS PerformedAtISO
      FROM AuditLogs a
        LEFT JOIN Users u ON u.UserID = a.PerformedBy
      WHERE a.TableName = @TableName
        AND a.RecordID = @RecordID
      ORDER BY a.PerformedAt DESC, a.LogID DESC
    `);

  return result.recordset as unknown[];
}

export interface GetAllAuditLogsFilters {
  actorUserId?: number;
  action?: string;
  entityType?: string;
  entityId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface GetAllAuditLogsPagination {
  page: number;
  pageSize: number;
}

export async function getAllAuditLogs(
  filters: GetAllAuditLogsFilters,
  pagination: GetAllAuditLogsPagination
): Promise<unknown[]> {
  const pool = await poolPromise;
  const request = pool.request();

  const offset = (pagination.page - 1) * pagination.pageSize;

  // Build WHERE clause conditions
  const conditions: string[] = [];

  if (filters.actorUserId !== undefined) {
    request.input("ActorUserId", sql.Int, filters.actorUserId);
    conditions.push("a.PerformedBy = @ActorUserId");
  }

  if (filters.action !== undefined && filters.action.trim() !== "") {
    request.input("Action", sql.NVarChar(50), filters.action.trim());
    conditions.push("a.Action = @Action");
  }

  if (filters.entityType !== undefined && filters.entityType.trim() !== "") {
    request.input("EntityType", sql.NVarChar(255), filters.entityType.trim());
    conditions.push("a.TableName = @EntityType");
  }

  if (filters.entityId !== undefined) {
    request.input("EntityId", sql.Int, filters.entityId);
    conditions.push("a.RecordID = @EntityId");
  }

  if (filters.dateFrom !== undefined && filters.dateFrom.trim() !== "") {
    request.input("DateFrom", sql.DateTime2, filters.dateFrom);
    conditions.push("a.PerformedAt >= @DateFrom");
  }

  if (filters.dateTo !== undefined && filters.dateTo.trim() !== "") {
    request.input("DateTo", sql.DateTime2, filters.dateTo);
    conditions.push("a.PerformedAt <= @DateTo");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  request.input("Offset", sql.Int, offset);
  request.input("PageSize", sql.Int, pagination.pageSize);

  const result = await request.query(`
    SELECT
      a.LogID AS AuditLogID,
      a.TableName,
      a.RecordID,
      a.Action,
      a.PerformedBy,
      a.PerformedAt,
      a.Route,
      a.Method,
      a.StatusCode,
      a.Changes,
      u.UserID AS PerformedByUserID,
      u.FirstName + ' ' + u.LastName AS PerformedByName,
      CONVERT(varchar, a.PerformedAt, 126) AS PerformedAtISO
    FROM AuditLogs a
      LEFT JOIN Users u ON u.UserID = a.PerformedBy
    ${whereClause}
    ORDER BY a.PerformedAt DESC, a.LogID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
  `);

  return result.recordset as unknown[];
}

export async function getAllAuditLogsCount(
  filters: GetAllAuditLogsFilters
): Promise<number> {
  const pool = await poolPromise;
  const request = pool.request();

  // Build WHERE clause conditions (same as getAllAuditLogs)
  const conditions: string[] = [];

  if (filters.actorUserId !== undefined) {
    request.input("ActorUserId", sql.Int, filters.actorUserId);
    conditions.push("a.PerformedBy = @ActorUserId");
  }

  if (filters.action !== undefined && filters.action.trim() !== "") {
    request.input("Action", sql.NVarChar(50), filters.action.trim());
    conditions.push("a.Action = @Action");
  }

  if (filters.entityType !== undefined && filters.entityType.trim() !== "") {
    request.input("EntityType", sql.NVarChar(255), filters.entityType.trim());
    conditions.push("a.TableName = @EntityType");
  }

  if (filters.entityId !== undefined) {
    request.input("EntityId", sql.Int, filters.entityId);
    conditions.push("a.RecordID = @EntityId");
  }

  if (filters.dateFrom !== undefined && filters.dateFrom.trim() !== "") {
    request.input("DateFrom", sql.DateTime2, filters.dateFrom);
    conditions.push("a.PerformedAt >= @DateFrom");
  }

  if (filters.dateTo !== undefined && filters.dateTo.trim() !== "") {
    request.input("DateTo", sql.DateTime2, filters.dateTo);
    conditions.push("a.PerformedAt <= @DateTo");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await request.query(`
    SELECT COUNT(1) AS Total
    FROM AuditLogs a
    ${whereClause}
  `);

  return (result.recordset[0] as { Total: number })?.Total ?? 0;
}
