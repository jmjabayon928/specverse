import { poolPromise, sql } from "../config/db";

export interface AddInventoryTransactionInput {
  inventoryId: number;
  transactionType: string;
  quantityChanged: number;
  uom?: string;
  referenceNote?: string;
}

// ✅ define type for raw SQL result
type InventoryTransactionRow = {
  TransactionID: number;
  InventoryID: number;
  TransactionType: string;
  QuantityChanged: number;
  UOM?: string;
  ReferenceNote?: string;
  PerformedByName: string;
  PerformedAt?: string;
};

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

  const records = result.recordset as InventoryTransactionRow[];

  return records.map(row => ({
    transactionId: row.TransactionID,
    inventoryId: row.InventoryID,
    transactionType: row.TransactionType,
    quantityChanged: row.QuantityChanged,
    uom: row.UOM,
    referenceNote: row.ReferenceNote,
    PerformedByName: row.PerformedByName,
    performedAt: row.PerformedAt,
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
    // ✅ dev patch: set PerformedBy = 2, PerformedAt = current date
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
