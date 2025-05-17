import { poolPromise, sql } from "../config/db";
import { NewPackageInput } from "@/types/estimation";

export async function getPackagesByEstimationId(estimationId: number) {
    console.log("Querying with EstimationID:", estimationId); 
    const pool = await poolPromise;
    const result = await pool.request()
        .input("EstimationID", sql.Int, estimationId)
        .query(`
            SELECT *
            FROM EstimationPackages
            WHERE EstimationID = @EstimationID
            ORDER BY PackageID
        `);
    console.log("DB query result:", result.recordset);
    return result.recordset;
}

export async function getPackageById(packageId: number) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("PackageID", sql.Int, packageId)
        .query(`
            SELECT *
            FROM EstimationPackages
            WHERE PackageID = @PackageID
        `);
    return result.recordset[0];
}

export async function createPackage(data: NewPackageInput) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("EstimationID", sql.Int, data.EstimationID)
        .input("PackageName", sql.NVarChar(255), data.PackageName)
        .input("Description", sql.NVarChar(sql.MAX), data.Description ?? '')
        .query(`
            INSERT INTO EstimationPackages (EstimationID, PackageName, Description)
            VALUES (@EstimationID, @PackageName, @Description);
            SELECT SCOPE_IDENTITY() AS PackageID
        `);
    return result.recordset[0].PackageID;
}
