import { poolPromise, sql } from '../config/db';

export async function getPackagesByEstimationId(estimationId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EstimationID', sql.Int, estimationId)
    .query(`
      SELECT * FROM EstimationPackages
      WHERE EstimationID = @EstimationID
      ORDER BY Sequence ASC, CreatedAt ASC
    `);
  return result.recordset;
}

export async function getPackageById(packageId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('PackageID', sql.Int, packageId)
    .query(`
      SELECT * FROM EstimationPackages
      WHERE PackageID = @PackageID
    `);
  return result.recordset[0];
}

export async function createPackage(data: {
  EstimationID: number;
  PackageName: string;
  Description?: string;
  CreatedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EstimationID', sql.Int, data.EstimationID)
    .input('PackageName', sql.NVarChar(255), data.PackageName)
    .input('Description', sql.NVarChar(sql.MAX), data.Description ?? null)
    .input('CreatedBy', sql.Int, data.CreatedBy ?? null)
    .query(`
      INSERT INTO EstimationPackages (EstimationID, PackageName, Description, CreatedAt, CreatedBy)
      OUTPUT INSERTED.PackageID
      VALUES (@EstimationID, @PackageName, @Description, GETDATE(), @CreatedBy)
    `);
  return result.recordset[0].PackageID;
}

export async function updatePackage(packageId: number, data: {
  PackageName: string;
  Description?: string;
  ModifiedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('PackageID', sql.Int, packageId)
    .input('PackageName', sql.NVarChar(255), data.PackageName)
    .input('Description', sql.NVarChar(sql.MAX), data.Description ?? null)
    .input('ModifiedBy', sql.Int, data.ModifiedBy ?? null)
    .query(`
      UPDATE EstimationPackages
      SET PackageName = @PackageName,
          Description = @Description,
          ModifiedAt = GETDATE(),
          ModifiedBy = @ModifiedBy
      WHERE PackageID = @PackageID;

      SELECT * FROM EstimationPackages WHERE PackageID = @PackageID;
    `);
  return result.recordset[0];
}
