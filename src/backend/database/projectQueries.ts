import { poolPromise } from "../config/db";

export async function getAllProjects() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT ProjectID, ProjName FROM Projects ORDER BY ProjName
  `);
  return result.recordset;
}
