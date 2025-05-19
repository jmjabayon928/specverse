import { poolPromise, sql } from "../config/db";

export async function getAllProjects() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT ProjID, ProjName FROM Projects ORDER BY ProjName
  `);
  return result.recordset;
}
