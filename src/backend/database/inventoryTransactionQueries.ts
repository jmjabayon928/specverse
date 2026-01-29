import { poolPromise, sql } from "../config/db";
import type { InventoryTransactionDTO } from "@/domain/inventory/inventoryTypes";

export interface AddInventoryTransactionInput {
  inventoryId: number;
  transactionType: string;
  quantityChanged: number;
  uom?: string;
  referenceNote?: string;
}

export interface InventoryTransactionFilters {
  warehouseId?: number;
  itemId?: number;
  transactionType?: string;
  dateFrom?: Date;
  dateTo?: Date;
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
      t.QuantityChanged,
      t.TransactionType,
      CONVERT(varchar, t.PerformedAt, 126) AS PerformedAt,
      u.FirstName + ' ' + u.LastName AS PerformedBy
    FROM InventoryTransactions t
    JOIN InventoryItems i ON t.InventoryID = i.InventoryID
    LEFT JOIN Users u ON t.PerformedBy = u.UserID
    ORDER BY t.PerformedAt DESC
  `);
  return result.recordset;
}

// Get paginated inventory transactions with filters.
// ASSUMPTION (pending DB verification): Join chain t -> Inventory i (t.InventoryID = i.InventoryID), i -> InventoryItems ii (i.InventoryID = ii.InventoryID).
// Verify in SSMS: (1) InventoryTransactions.InventoryID FK target, (2) Inventory PK column, (3) Inventory.ItemID vs InventoryItems.InventoryID. If Inventory uses Id as PK, use t.InventoryID = i.Id and i.ItemID = ii.InventoryID.
export async function getInventoryTransactionsPaged(
  filters: InventoryTransactionFilters,
  page: number,
  pageSize: number
): Promise<{ total: number; rows: InventoryTransactionDTO[] }> {
  const pool = await poolPromise;
  const request = pool.request();

  // Build WHERE clause with parameterized inputs
  const whereConditions: string[] = [];
  
  if (filters.warehouseId !== undefined) {
    request.input("WarehouseID", sql.Int, filters.warehouseId);
    whereConditions.push("i.WarehouseID = @WarehouseID");
  }
  
  if (filters.itemId !== undefined) {
    request.input("InventoryID", sql.Int, filters.itemId);
    whereConditions.push("t.InventoryID = @InventoryID");
  }
  
  if (filters.transactionType !== undefined) {
    request.input("TransactionType", sql.VarChar(50), filters.transactionType);
    whereConditions.push("t.TransactionType = @TransactionType");
  }
  
  if (filters.dateFrom !== undefined) {
    const dateFromStart = new Date(filters.dateFrom);
    dateFromStart.setUTCHours(0, 0, 0, 0);
    request.input("DateFrom", sql.DateTime2, dateFromStart);
    whereConditions.push("t.PerformedAt >= @DateFrom");
  }
  
  if (filters.dateTo !== undefined) {
    const dateToEnd = new Date(filters.dateTo);
    dateToEnd.setUTCHours(23, 59, 59, 999);
    request.input("DateTo", sql.DateTime2, dateToEnd);
    whereConditions.push("t.PerformedAt <= @DateTo");
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(" AND ")}`
    : "";

  // Count query
  const countResult = await request.query(`
    SELECT COUNT(*) AS total
    FROM InventoryTransactions t
    JOIN Inventory i ON t.InventoryID = i.InventoryID
    JOIN InventoryItems ii ON i.InventoryID = ii.InventoryID
    JOIN Warehouses w ON i.WarehouseID = w.WarehouseID
    ${whereClause}
  `);
  const total = countResult.recordset[0]?.total ?? 0;

  // Data query with pagination
  request.input("Offset", sql.Int, (page - 1) * pageSize);
  request.input("PageSize", sql.Int, pageSize);

  const dataResult = await request.query(`
    SELECT 
      t.TransactionID AS transactionId,
      t.InventoryID AS itemId,
      ii.ItemName AS itemName,
      i.WarehouseID AS warehouseId,
      w.WarehouseName AS warehouseName,
      t.QuantityChanged AS quantityChanged,
      t.TransactionType AS transactionType,
      CONVERT(varchar, t.PerformedAt, 126) AS performedAt,
      CASE 
        WHEN u.FirstName IS NOT NULL AND u.LastName IS NOT NULL 
        THEN u.FirstName + ' ' + u.LastName 
        ELSE NULL 
      END AS performedBy
    FROM InventoryTransactions t
    JOIN Inventory i ON t.InventoryID = i.InventoryID
    JOIN InventoryItems ii ON i.InventoryID = ii.InventoryID
    JOIN Warehouses w ON i.WarehouseID = w.WarehouseID
    LEFT JOIN Users u ON t.PerformedBy = u.UserID
    ${whereClause}
    ORDER BY t.PerformedAt DESC, t.TransactionID DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY
  `);

  const rows: InventoryTransactionDTO[] = dataResult.recordset.map((row) => ({
    transactionId: Number(row.transactionId),
    itemId: Number(row.itemId),
    itemName: String(row.itemName),
    warehouseId: Number(row.warehouseId),
    warehouseName: String(row.warehouseName),
    quantityChanged: Number(row.quantityChanged),
    transactionType: String(row.transactionType),
    performedAt: String(row.performedAt),
    performedBy: row.performedBy ?? null,
  }));

  return { total, rows };
}

// Get inventory transactions for CSV export (max 10,000 rows)
export async function getInventoryTransactionsForCsv(
  filters: InventoryTransactionFilters,
  limit: number = 10000
): Promise<InventoryTransactionDTO[]> {
  const pool = await poolPromise;
  const request = pool.request();

  // Build WHERE clause with parameterized inputs
  const whereConditions: string[] = [];
  
  if (filters.warehouseId !== undefined) {
    request.input("WarehouseID", sql.Int, filters.warehouseId);
    whereConditions.push("i.WarehouseID = @WarehouseID");
  }
  
  if (filters.itemId !== undefined) {
    request.input("InventoryID", sql.Int, filters.itemId);
    whereConditions.push("t.InventoryID = @InventoryID");
  }
  
  if (filters.transactionType !== undefined) {
    request.input("TransactionType", sql.VarChar(50), filters.transactionType);
    whereConditions.push("t.TransactionType = @TransactionType");
  }
  
  if (filters.dateFrom !== undefined) {
    const dateFromStart = new Date(filters.dateFrom);
    dateFromStart.setUTCHours(0, 0, 0, 0);
    request.input("DateFrom", sql.DateTime2, dateFromStart);
    whereConditions.push("t.PerformedAt >= @DateFrom");
  }
  
  if (filters.dateTo !== undefined) {
    const dateToEnd = new Date(filters.dateTo);
    dateToEnd.setUTCHours(23, 59, 59, 999);
    request.input("DateTo", sql.DateTime2, dateToEnd);
    whereConditions.push("t.PerformedAt <= @DateTo");
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(" AND ")}`
    : "";

  request.input("Limit", sql.Int, limit);

  const result = await request.query(`
    SELECT 
      t.TransactionID AS transactionId,
      t.InventoryID AS itemId,
      ii.ItemName AS itemName,
      i.WarehouseID AS warehouseId,
      w.WarehouseName AS warehouseName,
      t.QuantityChanged AS quantityChanged,
      t.TransactionType AS transactionType,
      CONVERT(varchar, t.PerformedAt, 126) AS performedAt,
      CASE 
        WHEN u.FirstName IS NOT NULL AND u.LastName IS NOT NULL 
        THEN u.FirstName + ' ' + u.LastName 
        ELSE NULL 
      END AS performedBy
    FROM InventoryTransactions t
    JOIN Inventory i ON t.InventoryID = i.InventoryID
    JOIN InventoryItems ii ON i.InventoryID = ii.InventoryID
    JOIN Warehouses w ON i.WarehouseID = w.WarehouseID
    LEFT JOIN Users u ON t.PerformedBy = u.UserID
    ${whereClause}
    ORDER BY t.PerformedAt DESC, t.TransactionID DESC
    OFFSET 0 ROWS
    FETCH NEXT @Limit ROWS ONLY
  `);

  return result.recordset.map((row) => ({
    transactionId: Number(row.transactionId),
    itemId: Number(row.itemId),
    itemName: String(row.itemName),
    warehouseId: Number(row.warehouseId),
    warehouseName: String(row.warehouseName),
    quantityChanged: Number(row.quantityChanged),
    transactionType: String(row.transactionType),
    performedAt: String(row.performedAt),
    performedBy: row.performedBy ?? null,
  }));
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