// src/backend/database/inventoryQueries.ts
import { poolPromise, sql } from "../config/db";
import type {
  InventoryItemDB,
  InventoryItemWrite,
  InventoryListItem,
} from "@/domain/inventory/inventoryTypes";

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

export async function createInventoryItem(data: InventoryItemWrite): Promise<number> {
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

export async function updateInventoryItem(inventoryId: number, data: InventoryItemWrite) {
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
  const changes: Array<{ field: keyof InventoryItemWrite; oldValue: unknown; newValue: unknown }> = [];

  const fields: Array<keyof InventoryItemWrite> = [
    "itemCode",
    "itemName",
    "description",
    "categoryId",
    "supplierId",
    "manufacturerId",
    "location",
    "reorderLevel",
    "uom",
  ];

  const mapping: Record<keyof InventoryItemWrite, string> = {
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

const listSelectColumns = `
  i.InventoryID AS inventoryId,
  ii.ItemName AS sheetName,
  i.Quantity AS quantity,
  ii.ReorderLevel AS reorderLevel,
  w.WarehouseName AS warehouseName,
  CONVERT(varchar, i.LastUpdated, 126) AS lastUpdated,
  c.CategoryName AS categoryName,
  s.SuppName AS supplierName,
  m.ManuName AS manufacturerName
`;

const listFromJoins = `
  FROM Inventory i
  JOIN InventoryItems ii ON i.InventoryID = ii.InventoryID
  JOIN Warehouses w ON i.WarehouseID = w.WarehouseID
  LEFT JOIN Categories c ON ii.CategoryID = c.CategoryID
  LEFT JOIN Suppliers s ON ii.SupplierID = s.SuppID
  LEFT JOIN Manufacturers m ON ii.ManufacturerID = m.ManuID
`;

export interface InventoryListFilters {
  search?: string;
  warehouseId?: number;
  categoryId?: number;
  suppId?: number;
  manuId?: number;
}

function escapeLike(s: string): string {
  return s.replace(/%/g, "[%]").replace(/_/g, "[_]");
}

export async function getInventoryList(): Promise<InventoryListItem[]> {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT ${listSelectColumns}
    ${listFromJoins}
  `);
  return mapRecordsetToListItems(result.recordset);
}

function mapRecordsetToListItems(recordset: Record<string, unknown>[]): InventoryListItem[] {
  return recordset.map((row) => {
    const cat = row.categoryName ?? row.CategoryName;
    const supp = row.supplierName ?? row.SuppName;
    const manu = row.manufacturerName ?? row.ManuName;
    const reorder = row.reorderLevel ?? row.ReorderLevel;
    return {
      inventoryId: Number(row.inventoryId),
      sheetName: String(row.sheetName ?? ""),
      quantity: Number(row.quantity),
      reorderLevel: reorder != null ? Number(reorder) : null,
      warehouseName: String(row.warehouseName ?? ""),
      lastUpdated: row.lastUpdated != null ? String(row.lastUpdated) : "",
      categoryName: cat != null ? String(cat) : null,
      supplierName: supp != null ? String(supp) : null,
      manufacturerName: manu != null ? String(manu) : null,
    };
  });
}

export async function getInventoryListPaged(
  filters: InventoryListFilters,
  page: number,
  pageSize: number
): Promise<{ total: number; rows: InventoryListItem[] }> {
  const pool = await poolPromise;
  const request = pool.request();
  const whereConditions: string[] = [];

  if (filters.search !== undefined && filters.search.trim() !== "") {
    const trimmed = filters.search.trim().slice(0, 200);
    const escaped = escapeLike(trimmed);
    request.input("Search", sql.NVarChar(201), `%${escaped}%`);
    whereConditions.push("ii.ItemName LIKE @Search");
  }
  if (filters.warehouseId !== undefined) {
    request.input("WarehouseID", sql.Int, filters.warehouseId);
    whereConditions.push("i.WarehouseID = @WarehouseID");
  }
  if (filters.categoryId !== undefined) {
    request.input("CategoryID", sql.Int, filters.categoryId);
    whereConditions.push("ii.CategoryID = @CategoryID");
  }
  if (filters.suppId !== undefined) {
    request.input("SupplierID", sql.Int, filters.suppId);
    whereConditions.push("ii.SupplierID = @SupplierID");
  }
  if (filters.manuId !== undefined) {
    request.input("ManufacturerID", sql.Int, filters.manuId);
    whereConditions.push("ii.ManufacturerID = @ManufacturerID");
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const countResult = await request.query(`
    SELECT COUNT(*) AS total
    ${listFromJoins}
    ${whereClause}
  `);
  const total = countResult.recordset[0]?.total ?? 0;

  request.input("Offset", sql.Int, (page - 1) * pageSize);
  request.input("PageSize", sql.Int, pageSize);

  const dataResult = await request.query(`
    SELECT ${listSelectColumns}
    ${listFromJoins}
    ${whereClause}
    ORDER BY ii.ItemName, i.InventoryID
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY
  `);

  const rows = mapRecordsetToListItems(dataResult.recordset as Record<string, unknown>[]);
  return { total, rows };
}
