import { poolPromise, sql } from "../config/db";
import { NewEstimationItemInput } from "@/types/estimation";

export async function getItemsByPackageId(packageId: number) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("PackageID", sql.Int, packageId)
        .query(`
            SELECT *
            FROM EstimationItems
            WHERE PackageID = @PackageID
            ORDER BY ItemID
        `);
    return result.recordset;
}

export async function createItem(data: NewEstimationItemInput) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("PackageID", sql.Int, data.PackageID)
        .input("EstimationID", sql.Int, data.EstimationID)
        .input("PartName", sql.NVarChar(255), data.PartName)
        .input("Quantity", sql.Decimal(18,2), data.Quantity)
        .input("UnitCost", sql.Decimal(18,2), data.UnitCost)
        .input("UnitOfMeasure", sql.NVarChar(50), data.UnitOfMeasure ?? '')
        .input("Description", sql.NVarChar(sql.MAX), data.Description ?? '')
        .query(`
            INSERT INTO EstimationItems (PackageID, EstimationID, PartName, Quantity, UnitCost, UnitOfMeasure, Description)
            VALUES (@PackageID, @EstimationID, @PartName, @Quantity, @UnitCost, @UnitOfMeasure, @Description);
            SELECT SCOPE_IDENTITY() AS ItemID
        `);
    return result.recordset[0].ItemID;
}
