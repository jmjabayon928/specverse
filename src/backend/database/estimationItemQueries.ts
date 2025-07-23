import { poolPromise, sql } from '../config/db';

export async function getItemsByPackageId(packageId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("PackageID", sql.Int, packageId)
    .query(`
      SELECT 
        ei.EItemID,
        ei.EstimationID,
        ei.PackageID,
        ei.ItemID,
        ei.Quantity,
        ei.Description,
        ei.CreatedAt,
        ei.CreatedBy,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        s.SheetName AS ItemName,
        CASE 
          WHEN EXISTS (
            SELECT 1 
            FROM EstimationItemSupplierQuotes q 
            WHERE q.ItemID = ei.EItemID AND q.IsSelected = 1
          ) THEN 1 ELSE 0 
        END AS HasSelectedQuote
      FROM EstimationItems ei
        LEFT JOIN Users u ON ei.CreatedBy = u.UserID
        LEFT JOIN Inventory i ON ei.ItemID = i.InventoryID
        LEFT JOIN Sheets s ON i.SheetID = s.SheetID
      WHERE ei.PackageID = @PackageID
    `);

  return result.recordset;
}

export async function getItemById(itemId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EItemID', sql.Int, itemId)
    .query(`
      SELECT 
        ei.EItemID,
        ei.EstimationID,
        ei.PackageID,
        ei.ItemID,
        ei.Quantity,
        ei.Description,
        ei.CreatedAt,
        ei.CreatedBy,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        s.SheetName AS ItemName
      FROM EstimationItems ei
      LEFT JOIN Users u ON ei.CreatedBy = u.UserID
      LEFT JOIN Inventory i ON ei.ItemID = i.InventoryID
      LEFT JOIN Sheets s ON i.SheetID = s.SheetID
      WHERE ei.EItemID = @EItemID
    `);
  return result.recordset[0];
}

export async function createItem(data: {
  EstimationID: number;
  PackageID?: number;
  ItemID: number;
  Quantity: number;
  Description?: string;
  CreatedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EstimationID', sql.Int, data.EstimationID)
    .input('PackageID', sql.Int, data.PackageID ?? null)
    .input('ItemID', sql.Int, data.ItemID)
    .input('Quantity', sql.Decimal(18, 2), data.Quantity)
    .input('Description', sql.NVarChar(sql.MAX), data.Description ?? null)
    .input('CreatedBy', sql.Int, data.CreatedBy ?? null)
    .query(`
      INSERT INTO EstimationItems (EstimationID, PackageID, ItemID, Quantity, Description, CreatedAt, CreatedBy, ModifiedAt, ModifiedBy)
      OUTPUT INSERTED.EItemID
      VALUES (@EstimationID, @PackageID, @ItemID, @Quantity, @Description, GETDATE(), 2, GETDATE(), 1)
    `);
  return result.recordset[0].EItemID;
}

export async function updateItem(eItemId: number, data: {
  Quantity: number;
  Description?: string;
  ModifiedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EItemID', sql.Int, eItemId)
    .input('Quantity', sql.Decimal(18, 2), data.Quantity)
    .input('Description', sql.NVarChar(sql.MAX), data.Description ?? null)
    .input('ModifiedBy', sql.Int, data.ModifiedBy ?? null)
    .query(`
      UPDATE EstimationItems
      SET Quantity = @Quantity,
          Description = @Description,
          ModifiedAt = GETDATE(),
          ModifiedBy = @ModifiedBy
      WHERE EItemID = @EItemID;

      SELECT 
        ei.EItemID,
        ei.EstimationID,
        ei.PackageID,
        ei.ItemID,
        ei.Quantity,
        ei.Description,
        ei.CreatedAt,
        ei.CreatedBy,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        s.SheetName AS ItemName
      FROM EstimationItems ei
      LEFT JOIN Users u ON ei.CreatedBy = u.UserID
      LEFT JOIN Inventory i ON ei.ItemID = i.InventoryID
      LEFT JOIN Sheets s ON i.SheetID = s.SheetID
      WHERE ei.EItemID = @EItemID;
    `);

  return result.recordset[0];
}

export async function isDuplicateItem(packageId: number, itemId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("PackageID", sql.Int, packageId)
    .input("ItemID", sql.Int, itemId)
    .query(`
      SELECT 1 FROM EstimationItems
      WHERE PackageID = @PackageID AND ItemID = @ItemID
    `);
  return result.recordset.length > 0;
}



