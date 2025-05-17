import { poolPromise, sql } from "../config/db";
import { NewEstimationInput } from "@/types/estimation";

export async function getAllEstimations() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT EstimationID, SheetID, Title, Status, EstimationDate, TotalMaterialCost
        FROM ProjectEstimations
        ORDER BY EstimationDate DESC
    `);
    return result.recordset;
}

export async function getEstimationById(estimationId: number) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("EstimationID", sql.Int, estimationId)
        .query(`
            SELECT *
            FROM ProjectEstimations
            WHERE EstimationID = @EstimationID
        `);
    return result.recordset[0];
}

export async function createEstimation(data: NewEstimationInput) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("ProjectID", sql.Int, data.ProjectID)
        .input("Title", sql.NVarChar(255), data.Title)
        .input("Description", sql.NVarChar(sql.MAX), data.Description ?? '')
        .input("CreatedBy", sql.Int, data.CreatedBy)
        .query(`
            INSERT INTO ProjectEstimations (ProjectID, Title, Description, CreatedBy)
            VALUES (@ProjectID, @Title, @Description, @CreatedBy);
            SELECT SCOPE_IDENTITY() AS EstimationID
        `);
    return result.recordset[0].EstimationID;
}
