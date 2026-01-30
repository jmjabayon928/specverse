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

// Join key: InventoryItems.InventoryID exists and matches InventoryMaintenanceLogs.InventoryID (see inventoryQueries / getAllInventoryItems).
export async function getAllInventoryMaintenanceLogs(): Promise<
  Array<{
    maintenanceId: number;
    inventoryId: number;
    itemName: string;
    maintenanceDate: string;
    description: string;
    performedByUserId: number | null;
    performedByName: string | null;
    notes: string | null;
    createdAt: string | null;
  }>
> {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      ml.MaintenanceLogID,
      ml.InventoryID,
      i.ItemName,
      CONVERT(varchar, ml.MaintenanceDate, 126) AS MaintenanceDate,
      ml.Description,
      ml.Notes,
      CONVERT(varchar, ml.CreatedAt, 126) AS CreatedAt,
      ml.PerformedBy AS PerformedByUserId,
      CASE WHEN u.UserID IS NOT NULL THEN u.FirstName + ' ' + u.LastName ELSE NULL END AS PerformedByName
    FROM InventoryMaintenanceLogs ml
    JOIN InventoryItems i ON ml.InventoryID = i.InventoryID
    LEFT JOIN Users u ON ml.PerformedBy = u.UserID
    ORDER BY ml.MaintenanceDate DESC, ml.MaintenanceLogID DESC
  `);
  const rows = result.recordset as Array<{
    MaintenanceLogID: number;
    InventoryID: number;
    ItemName: string;
    MaintenanceDate: string;
    Description: string;
    Notes: string | null;
    CreatedAt: string | null;
    PerformedByUserId: number | null;
    PerformedByName: string | null;
  }>;
  return rows.map((r) => ({
    maintenanceId: r.MaintenanceLogID,
    inventoryId: r.InventoryID,
    itemName: r.ItemName ?? "",
    maintenanceDate: r.MaintenanceDate,
    description: r.Description ?? "",
    performedByUserId: r.PerformedByUserId ?? null,
    performedByName: r.PerformedByName ?? null,
    notes: r.Notes ?? null,
    createdAt: r.CreatedAt ?? null,
  }));
}

export async function getAllInventoryAuditLogs(): Promise<
  Array<{
    auditLogId: number;
    inventoryId: number;
    itemName: string;
    actionType: string;
    oldValue: string;
    newValue: string;
    changedBy: string;
    changedAt: string;
  }>
> {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      a.AuditLogID AS auditLogId,
      a.InventoryID AS inventoryId,
      i.ItemName AS itemName,
      a.ActionType AS actionType,
      a.OldValue,
      a.NewValue,
      CONVERT(varchar, a.ChangedAt, 126) AS changedAt,
      CASE WHEN u.UserID IS NOT NULL THEN u.FirstName + ' ' + u.LastName ELSE NULL END AS changedBy
    FROM InventoryAuditLogs a
    JOIN InventoryItems i ON a.InventoryID = i.InventoryID
    LEFT JOIN Users u ON a.ChangedBy = u.UserID
    ORDER BY a.ChangedAt DESC, a.AuditLogID DESC
  `);
  const rows = result.recordset as Array<Record<string, unknown>>;
  return rows.map((r) => {
    const auditLogId = Number(r.auditLogId ?? r.AuditLogID);
    const inventoryId = Number(r.inventoryId ?? r.InventoryID);
    return {
      auditLogId,
      inventoryId,
      itemName: String(r.itemName ?? r.ItemName ?? ""),
      actionType: String(r.actionType ?? r.ActionType ?? ""),
      oldValue: String(r.OldValue ?? r.oldValue ?? ""),
      newValue: String(r.NewValue ?? r.newValue ?? ""),
      changedBy: String(r.changedBy ?? r.ChangedBy ?? ""),
      changedAt: String(r.changedAt ?? r.ChangedAt ?? ""),
    };
  });
}