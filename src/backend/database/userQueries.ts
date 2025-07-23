import { poolPromise, sql } from "../config/db";

export async function getUserByEmail(email: string) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("Email", sql.NVarChar, email)
    .query(`
      SELECT u.*, r.RoleName
      FROM Users u
      LEFT JOIN Roles r ON u.RoleID = r.RoleID
      WHERE u.Email = @Email
    `);
  return result.recordset[0];
}
