import { poolPromise, sql } from "@/backend/config/db";

// ✅ Type for single row from SELECT
interface AuditLogRow {
  AuditLogID: number;
  InventoryID: number;
  ActionType: string;
  OldValue: string | null;
  NewValue: string | null;
  ChangedByName: string | null;
  ChangedAt: string;
}

// ✅ Type for adding a new audit log
export interface AddInventoryAuditLogInput {
  inventoryId: number;
  actionType: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedBy: number;
  changedAt?: Date;
}

// ✅ Main query for Audit Logs table
export async function getInventoryAuditLogs(inventoryId: number) {
  const pool = await poolPromise;

  const result = await pool.request()
    .input("InventoryID", sql.Int, inventoryId)
    .query(`
      SELECT 
        a.AuditLogID,
        a.InventoryID,
        a.ActionType,
        a.OldValue,
        a.NewValue,
        u.FirstName + ' ' + u.LastName AS ChangedByName,
        CONVERT(varchar, a.ChangedAt, 126) AS ChangedAt
      FROM InventoryAuditLogs a
      LEFT JOIN Users u ON u.UserID = a.ChangedBy
      WHERE a.InventoryID = @InventoryID
      ORDER BY a.ChangedAt DESC
    `);

  return result.recordset.map((row: AuditLogRow) => ({
    auditLogId: row.AuditLogID,
    inventoryId: row.InventoryID,
    actionType: row.ActionType,
    oldValue: row.OldValue ?? "-",
    newValue: row.NewValue ?? "-",
    changedByName: row.ChangedByName ?? "Unknown",
    changedAt: row.ChangedAt
  }));
}

// ✅ If you want: add a reusable insert function too
export async function addInventoryAuditLog(data: AddInventoryAuditLogInput) {
  const pool = await poolPromise;

  await pool.request()
    .input("InventoryID", sql.Int, data.inventoryId)
    .input("ActionType", sql.NVarChar(50), data.actionType)
    .input("OldValue", sql.NVarChar(sql.MAX), data.oldValue ?? "")
    .input("NewValue", sql.NVarChar(sql.MAX), data.newValue ?? "")
    .input("ChangedBy", sql.Int, data.changedBy)
    .input("ChangedAt", sql.DateTime, data.changedAt ?? new Date())
    .query(`
      INSERT INTO InventoryAuditLogs (
        InventoryID, ActionType, OldValue, NewValue, ChangedBy, ChangedAt
      )
      VALUES (
        @InventoryID, @ActionType, @OldValue, @NewValue, @ChangedBy, @ChangedAt
      )
    `);
}
