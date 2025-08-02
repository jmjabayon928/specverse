import { poolPromise, sql } from '../config/db';

export async function getPackagesByEstimationId(estimationId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EstimationID', sql.Int, estimationId)
    .query(`
      SELECT 
        ep.PackageID,
        ep.EstimationID,
        ep.PackageName,
        ep.Description,
        ep.Sequence,
        (
          SELECT SUM(q.QuotedUnitCost)
          FROM EstimationItems i
          JOIN EstimationItemSupplierQuotes q ON q.ItemID = i.EItemID
          WHERE i.PackageID = ep.PackageID AND q.IsSelected = 1
        ) AS TotalMaterialCost,
        ep.TotalLaborCost,
        ep.TotalDurationDays,
        ep.CreatedBy,
        ep.CreatedAt,
        ep.ModifiedBy,
        ep.ModifiedAt,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        u2.FirstName + ' ' + u2.LastName AS ModifiedByName
      FROM EstimationPackages ep
        LEFT JOIN Users u ON ep.CreatedBy = u.UserID
        LEFT JOIN Users u2 ON ep.ModifiedBy = u2.UserID
      WHERE ep.EstimationID = @EstimationID
      ORDER BY ep.Sequence ASC, ep.CreatedAt ASC
    `);
  return result.recordset;
}

export async function getPackageById(packageId: number) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("PackageID", sql.Int, packageId)
    .query(`
      SELECT 
        ep.*, 
        u1.FirstName + ' ' + u1.LastName AS CreatedByName,
        u2.FirstName + ' ' + u2.LastName AS ModifiedByName
      FROM EstimationPackages ep
      LEFT JOIN Users u1 ON ep.CreatedBy = u1.UserID
      LEFT JOIN Users u2 ON ep.ModifiedBy = u2.UserID
      WHERE ep.PackageID = @PackageID
    `);

  return result.recordset[0];
}

export async function createPackage(data: {
  EstimationID: number;
  PackageName: string;
  Description?: string;
  Sequence?: number; // ✅ Add Sequence
  CreatedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EstimationID', sql.Int, data.EstimationID)
    .input('PackageName', sql.NVarChar(255), data.PackageName)
    .input('Description', sql.NVarChar(sql.MAX), data.Description ?? null)
    .input('Sequence', sql.Int, data.Sequence ?? 1) // ✅ Handle Sequence here
    .input('CreatedBy', sql.Int, data.CreatedBy ?? null)
    .query(`
      INSERT INTO EstimationPackages (EstimationID, PackageName, Description, Sequence, CreatedAt, CreatedBy)
      OUTPUT INSERTED.PackageID
      VALUES (@EstimationID, @PackageName, @Description, @Sequence, GETDATE(), @CreatedBy)
    `);
  return result.recordset[0].PackageID;
}

export async function updatePackage(packageId: number, data: {
  PackageName: string;
  Description?: string;
  Sequence: number;
  ModifiedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('PackageID', sql.Int, packageId)
    .input('PackageName', sql.NVarChar(255), data.PackageName)
    .input('Description', sql.NVarChar(sql.MAX), data.Description ?? null)
    .input('Sequence', sql.Int, data.Sequence) 
    .input('ModifiedBy', sql.Int, data.ModifiedBy ?? null)
    .query(`
      UPDATE EstimationPackages
      SET 
        PackageName = @PackageName,
        Description = @Description,
        Sequence = @Sequence, 
        ModifiedAt = GETDATE(),
        ModifiedBy = @ModifiedBy
      WHERE PackageID = @PackageID;

      SELECT * FROM EstimationPackages WHERE PackageID = @PackageID;
    `);

  return result.recordset[0];
}

export async function deletePackage(packageId: number) {
  const pool = await poolPromise;
  await pool.request()
    .input('PackageID', sql.Int, packageId)
    .query(`
      DELETE FROM EstimationPackages WHERE PackageID = @PackageID
    `);
}

export async function isDuplicatePackageName(estimationId: number, packageName: string) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("EstimationID", sql.Int, estimationId)
    .input("PackageName", sql.VarChar, packageName)
    .query(`
      SELECT 1 FROM EstimationPackages
      WHERE EstimationID = @EstimationID AND PackageName = @PackageName
    `);
  return result.recordset.length > 0;
}

export async function getAllPackages() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      ep.PackageID,
      ep.PackageName,
      ep.EstimationID
    FROM EstimationPackages ep
    ORDER BY ep.PackageID DESC
  `);
  return result.recordset;
}