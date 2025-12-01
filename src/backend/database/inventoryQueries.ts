// src/backend/database/inventoryQueries.ts
import { poolPromise, sql } from "../config/db";
import type { InventoryItem, InventoryItemDB } from "@/domain/inventory/inventoryTypes";

// ✅ Add safe comparison helper
function isDifferent(a: unknown, b: unknown): boolean {
  if (a === b) return false;

  // Compare numbers safely
  if (typeof a === "number" && typeof b === "number") {
    return a !== b;
  }

  // Compare strings trimmed
  if (typeof a === "string" && typeof b === "string") {
    return a.trim() !== b.trim();
  }

  // null / undefined mismatch
  if ((a == null && b != null) || (a != null && b == null)) {
    return true;
  }

  // Fallback strict comparison
  return a !== b;
}

export async function getAllInventoryItems(): Promise<InventoryItemDB[]> {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      InventoryID AS inventoryId,
      ItemCode AS itemCode,
      ItemName AS itemName,
      QuantityOnHand AS quantityOnHand,
      ReorderLevel AS reorderLevel,
      Location AS location
    FROM InventoryItems
    WHERE IsActive = 1
    ORDER BY ItemName
  `);
  return result.recordset;
}

// Fetch all inventory items
export async function getInventoryItemById(inventoryId: number): Promise<InventoryItemDB | null> {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("InventoryID", sql.Int, inventoryId)
    .query(`
      SELECT 
        i.InventoryID AS inventoryId, 
        ii.ItemCode AS itemCode, 
        ii.ItemName AS itemName,
        ii.Description AS description, 
        ii.CategoryID AS categoryId, 
        ii.SupplierID AS supplierId,
        ii.ManufacturerID AS manufacturerId, 
        w.WarehouseName AS location, 
        ii.ReorderLevel AS reorderLevel,
        ii.UOM AS uom,
        i.Quantity AS quantityOnHand
      FROM Inventory i
        JOIN InventoryItems ii ON i.InventoryID = ii.InventoryID
          JOIN Warehouses w ON i.WarehouseID = w.WarehouseID
      WHERE i.InventoryID = @InventoryID AND ii.IsActive = 1
    `);
  return result.recordset[0] ?? null;
}

export async function createInventoryItem(data: InventoryItem): Promise<number> {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("ItemCode", sql.NVarChar(100), data.itemCode)
    .input("ItemName", sql.NVarChar(255), data.itemName)
    .input("Description", sql.NVarChar(1000), data.description ?? "")
    .input("CategoryID", sql.Int, data.categoryId ?? null)
    .input("SupplierID", sql.Int, data.supplierId ?? null)
    .input("ManufacturerID", sql.Int, data.manufacturerId ?? null)
    .input("Location", sql.NVarChar(255), data.location ?? "")
    .input("ReorderLevel", sql.Decimal(18, 4), data.reorderLevel)
    .input("UOM", sql.NVarChar(50), data.uom ?? "")
    .query(`
      INSERT INTO InventoryItems (ItemCode, ItemName, Description, CategoryID, SupplierID, ManufacturerID, Location, ReorderLevel, QuantityOnHand, UOM, CreatedAt, UpdatedAt, IsActive)
      VALUES (@ItemCode, @ItemName, @Description, @CategoryID, @SupplierID, @ManufacturerID, @Location, @ReorderLevel, 0, @UOM, GETDATE(), GETDATE(), 1);
      SELECT SCOPE_IDENTITY() AS NewID;
    `);

  const newId = result.recordset[0].InventoryID;

  // ✅ Insert audit record (system creation)
  await pool.request()
    .input("InventoryID", sql.Int, newId)
    .input("ActionType", sql.NVarChar(50), "CREATE")
    .input("OldValue", sql.NVarChar(sql.MAX), "")
    .input("NewValue", sql.NVarChar(sql.MAX), JSON.stringify(data))
    .input("ChangedBy", sql.Int, 2)           // 👈 dev hardcoded user
    .input("ChangedAt", sql.DateTime, new Date())
    .query(`
      INSERT INTO InventoryAuditLogs (
        InventoryID, ActionType, OldValue, NewValue, ChangedBy, ChangedAt
      )
      VALUES (
        @InventoryID, @ActionType, @OldValue, @NewValue, @ChangedBy, @ChangedAt
      )
    `);
  return newId;
}

export async function updateInventoryItem(inventoryId: number, data: InventoryItem) {
  const pool = await poolPromise;

  // ✅ Get current values
  const originalResult = await pool.request()
    .input("InventoryID", sql.Int, inventoryId)
    .query(`
      SELECT ItemCode, ItemName, Description, CategoryID, SupplierID,
             ManufacturerID, Location, ReorderLevel, UOM
      FROM InventoryItems
      WHERE InventoryID = @InventoryID AND IsActive = 1
    `);

  const original = originalResult.recordset[0];
  if (!original) return;

  // ✅ Detect changes
  const changes: Array<{ field: keyof InventoryItem; oldValue: unknown; newValue: unknown }> = [];

  const fields: Array<keyof InventoryItem> = [
    "itemCode", "itemName", "description", "categoryId",
    "supplierId", "manufacturerId", "location", "reorderLevel", "uom"
  ];

  const mapping: Record<keyof InventoryItem, string> = {
    itemCode: "ItemCode",
    itemName: "ItemName",
    description: "Description",
    categoryId: "CategoryID",
    supplierId: "SupplierID",
    manufacturerId: "ManufacturerID",
    location: "Location",
    reorderLevel: "ReorderLevel",
    uom: "UOM"
  };

  for (const field of fields) {
    const dbField = mapping[field];
    const oldVal = original[dbField];
    const newVal = data[field] ?? (typeof oldVal === "string" ? "" : null);

    // ✅ Use safe comparison
    if (isDifferent(oldVal, newVal)) {
      changes.push({ field, oldValue: oldVal, newValue: newVal });
    }
  }
  console.log("Detected Changes:", changes);

  // ✅ Update InventoryItems
  await pool.request()
    .input("InventoryID", sql.Int, inventoryId)
    .input("ItemCode", sql.NVarChar(100), data.itemCode)
    .input("ItemName", sql.NVarChar(255), data.itemName)
    .input("Description", sql.NVarChar(1000), data.description ?? "")
    .input("CategoryID", sql.Int, data.categoryId ?? null)
    .input("SupplierID", sql.Int, data.supplierId ?? null)
    .input("ManufacturerID", sql.Int, data.manufacturerId ?? null)
    .input("Location", sql.NVarChar(255), data.location ?? "")
    .input("ReorderLevel", sql.Decimal(18, 4), data.reorderLevel)
    .input("UOM", sql.NVarChar(50), data.uom ?? "")
    .query(`
      UPDATE InventoryItems
      SET ItemCode = @ItemCode,
          ItemName = @ItemName,
          Description = @Description,
          CategoryID = @CategoryID,
          SupplierID = @SupplierID,
          ManufacturerID = @ManufacturerID,
          Location = @Location,
          ReorderLevel = @ReorderLevel,
          UOM = @UOM
      WHERE InventoryID = @InventoryID AND IsActive = 1
    `);

  // ✅ Insert audit logs for changes
  for (const change of changes) {
    await pool.request()
      .input("InventoryID", sql.Int, inventoryId)
      .input("ActionType", sql.NVarChar(50), `UPDATE ${change.field}`)
      .input("OldValue", sql.NVarChar(sql.MAX), `${change.oldValue ?? ""}`)
      .input("NewValue", sql.NVarChar(sql.MAX), `${change.newValue ?? ""}`)
      .input("ChangedBy", sql.Int, 2)
      .input("ChangedAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO InventoryAuditLogs (
          InventoryID, ActionType, OldValue, NewValue, ChangedBy, ChangedAt
        )
        VALUES (
          @InventoryID, @ActionType, @OldValue, @NewValue, @ChangedBy, @ChangedAt
        )
      `);
  }
}

export async function softDeleteInventoryItem(inventoryId: number) {
  const pool = await poolPromise;
  await pool.request()
    .input("InventoryID", sql.Int, inventoryId)
    .query(`UPDATE InventoryItems SET IsActive = 0 WHERE InventoryID = @InventoryID`);
}

export async function getInventoryList(): Promise<{
  InventoryID: number;
  SheetName: string;
  Quantity: number;
  WarehouseName: string;
  LastUpdated: string;
}[]> {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      i.InventoryID,
      ii.ItemName AS SheetName,
      i.Quantity AS Quantity,
      w.WarehouseName AS WarehouseName,
      i.LastUpdated AS LastUpdated
    FROM Inventory i
	  JOIN InventoryItems ii ON i.InventoryID = ii.InventoryID
    JOIN Warehouses w ON i.WarehouseID = w.WarehouseID
  `);
  return result.recordset;
}
