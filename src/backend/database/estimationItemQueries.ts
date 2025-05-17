import { poolPromise, sql } from '../config/db';

export async function getItemsByPackageId(packageId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('PackageID', sql.Int, packageId)
    .query(`
      SELECT * FROM EstimationItems
      WHERE PackageID = @PackageID
      ORDER BY CreatedAt ASC
    `);
  return result.recordset;
}

export async function getItemById(itemId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EItemID', sql.Int, itemId)
    .query(`
      SELECT * FROM EstimationItems
      WHERE EItemID = @EItemID
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
      INSERT INTO EstimationItems (EstimationID, PackageID, ItemID, Quantity, Description, CreatedAt, CreatedBy)
      OUTPUT INSERTED.EItemID
      VALUES (@EstimationID, @PackageID, @ItemID, @Quantity, @Description, GETDATE(), @CreatedBy)
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

      SELECT * FROM EstimationItems WHERE EItemID = @EItemID;
    `);
  return result.recordset[0];
}
