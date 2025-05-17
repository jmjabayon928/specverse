import { poolPromise, sql } from "../config/db";

export async function getAllEstimations() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT * FROM Estimations ORDER BY CreatedAt DESC
  `);
  return result.recordset;
}

export async function getEstimationById(estimationId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("EstimationID", sql.Int, estimationId)
    .query(`
      SELECT * FROM Estimations WHERE EstimationID = @EstimationID
    `);
  return result.recordset[0];
}

export async function createEstimation(data: {
  ProjectID: number;
  Title: string;
  Description?: string;
  CreatedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("ProjectID", sql.Int, data.ProjectID)
    .input("Title", sql.NVarChar(255), data.Title)
    .input("Description", sql.NVarChar(sql.MAX), data.Description ?? null)
    .input("CreatedBy", sql.Int, data.CreatedBy ?? null)
    .query(`
      INSERT INTO Estimations (ProjectID, Title, Description, Status, CreatedAt, CreatedBy)
      OUTPUT INSERTED.*
      VALUES (@ProjectID, @Title, @Description, 'Draft', GETDATE(), @CreatedBy)
    `);
  return result.recordset[0];
}

export async function updateEstimation(estimationId: number, data: {
  Title: string;
  Description?: string;
  ModifiedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("EstimationID", sql.Int, estimationId)
    .input("Title", sql.NVarChar(255), data.Title)
    .input("Description", sql.NVarChar(sql.MAX), data.Description ?? null)
    .input("ModifiedBy", sql.Int, data.ModifiedBy ?? null)
    .query(`
      UPDATE Estimations
      SET Title = @Title,
          Description = @Description,
          ModifiedAt = GETDATE(),
          ModifiedBy = @ModifiedBy
      WHERE EstimationID = @EstimationID;

      SELECT * FROM Estimations WHERE EstimationID = @EstimationID;
    `);
  return result.recordset[0];
}
