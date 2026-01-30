import { poolPromise, sql } from "@/backend/config/db";

export interface AddInventoryMaintenanceInput {
  inventoryId: number;
  maintenanceDate: string;       // ✅ ISO date string from frontend
  description: string;
  notes?: string;
}

// ✅ raw SQL row type
type InventoryMaintenanceRow = {
  MaintenanceLogID: number;
  InventoryID: number;
  MaintenanceDate: string;
  Description: string;
  Notes?: string;
  PerformedByUserId: number | null;
  PerformedByName: string | null;
  CreatedAt: string;
};

export interface AddMaintenanceLogInput {
  inventoryId: number;
  maintenanceDate: string; // ISO date string
  description: string;
  notes?: string;
}

// ✅ GET all maintenance logs for an item
export async function getInventoryMaintenanceLogs(inventoryId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("InventoryID", sql.Int, inventoryId)
    .query(`
      SELECT 
        ml.MaintenanceLogID,
        ml.InventoryID,
        CONVERT(varchar, ml.MaintenanceDate, 126) AS MaintenanceDate,
        ml.Description,
        ml.Notes,
        ml.PerformedBy AS PerformedByUserId,
        CASE WHEN u.UserID IS NOT NULL THEN u.FirstName + ' ' + u.LastName ELSE NULL END AS PerformedByName,
        CONVERT(varchar, ml.CreatedAt, 126) AS CreatedAt
      FROM InventoryMaintenanceLogs ml
        LEFT JOIN Users u ON u.UserID = ml.PerformedBy
      WHERE ml.InventoryID = @InventoryID
      ORDER BY ml.MaintenanceDate DESC
    `);

  const records = result.recordset as InventoryMaintenanceRow[];

  // Canonical fields only. Deprecated aliases (id, date, performedBy) removed after frontend migrated to maintenanceId, maintenanceDate, performedByName.
  return records.map(row => ({
    maintenanceId: row.MaintenanceLogID,
    inventoryId: row.InventoryID,
    maintenanceDate: row.MaintenanceDate,
    description: row.Description,
    notes: row.Notes ?? "",
    performedByUserId: row.PerformedByUserId ?? null,
    performedByName: row.PerformedByName ?? null,
    createdAt: row.CreatedAt,
  }));
}

// ✅ POST add new maintenance log
export async function addInventoryMaintenanceLog(data: AddMaintenanceLogInput) {
  const pool = await poolPromise;
  await pool.request()
    .input("InventoryID", sql.Int, data.inventoryId)
    .input("MaintenanceDate", sql.Date, data.maintenanceDate)
    .input("Description", sql.NVarChar(1000), data.description)
    .input("Notes", sql.NVarChar(1000), data.notes ?? "")
    // ✅ PATCH: hard-code PerformedBy + PerformedAt (just like transactions)
    .query(`
      INSERT INTO InventoryMaintenanceLogs (
        InventoryID, MaintenanceDate, Description, Notes,
        PerformedBy, CreatedAt
      )
      VALUES (
        @InventoryID, @MaintenanceDate, @Description, @Notes,
        2, GETDATE()
      )
    `);
}
