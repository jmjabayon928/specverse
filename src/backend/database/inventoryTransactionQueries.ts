import { poolPromise, sql } from "../config/db";

export interface AddInventoryTransactionInput {
  inventoryId: number;
  transactionType: string;
  quantityChanged: number;
  uom?: string;
  referenceNote?: string;
}

// ✅ get all transactions for an item
export async function getInventoryTransactions(inventoryId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("InventoryID", sql.Int, inventoryId)
    .query(`
      SELECT 
        t.TransactionID,
        t.InventoryID,
        t.TransactionType,
        t.QuantityChanged,
        t.UOM,
        t.ReferenceNote,
        u.FirstName + ' ' + u.LastName AS PerformedByName, 
        CONVERT(varchar, t.PerformedAt, 126) AS PerformedAt 
      FROM InventoryTransactions t 
        LEFT JOIN Users u ON u.UserID = t.PerformedBy
      WHERE t.InventoryID = @InventoryID
      ORDER BY t.PerformedAt DESC
    `);

  const records = result.recordset;

  return records.map(row => ({
    id: row.TransactionID,
    itemName: "", // Optional, or you can add a JOIN if needed
    quantity: row.QuantityChanged,
    transactionType: row.TransactionType,
    date: row.PerformedAt,
    performedBy: row.PerformedByName
  }));
}

// ✅ add new stock transaction
export async function addInventoryTransaction(data: AddInventoryTransactionInput) {
  const pool = await poolPromise;

  await pool.request()
    .input("InventoryID", sql.Int, data.inventoryId)
    .input("TransactionType", sql.VarChar(50), data.transactionType)
    .input("QuantityChanged", sql.Decimal(18, 4), data.quantityChanged)
    .input("UOM", sql.VarChar(50), data.uom ?? "")
    .input("ReferenceNote", sql.VarChar(500), data.referenceNote ?? "")
    // 🔧 dev patch: set PerformedBy = 2
    .query(`
      INSERT INTO InventoryTransactions (
        InventoryID, TransactionType, QuantityChanged, UOM,
        ReferenceNote, PerformedBy, PerformedAt
      )
      VALUES (
        @InventoryID, @TransactionType, @QuantityChanged, @UOM,
        @ReferenceNote, 2, GETDATE()
      )
    `);
}

export async function getAllInventoryTransactions() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      t.TransactionID,
      t.InventoryID,
      i.ItemName,
      t.Quantity,
      t.Type,
      t.TransactionDate,
      u.FirstName + ' ' + u.LastName AS PerformedBy
    FROM InventoryTransactions t
    JOIN InventoryItems i ON t.InventoryID = i.InventoryID
    JOIN Users u ON t.PerformedBy = u.UserID
    ORDER BY t.TransactionDate DESC
  `);
  return result.recordset;
}

export async function getAllInventoryMaintenanceLogs() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      m.MaintenanceID,
      m.InventoryID,
      i.ItemName,
      m.Description,
      m.MaintenanceDate,
      u.FirstName + ' ' + u.LastName AS PerformedBy
    FROM InventoryMaintenance m
    JOIN InventoryItems i ON m.InventoryID = i.InventoryID
    JOIN Users u ON m.PerformedBy = u.UserID
    ORDER BY m.MaintenanceDate DESC
  `);
  return result.recordset;
}

export async function getAllInventoryAuditLogs() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      a.AuditLogID,
      a.InventoryID,
      i.ItemName,
      a.ActionType,
      a.OldValue,
      a.NewValue,
      u.FirstName + ' ' + u.LastName AS ChangedBy,
      a.ChangedAt
    FROM InventoryAuditLogs a
    JOIN InventoryItems i ON a.InventoryID = i.InventoryID
    JOIN Users u ON a.ChangedBy = u.UserID
    ORDER BY a.ChangedAt DESC
  `);
  return result.recordset;
}