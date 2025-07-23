import { poolPromise, sql } from "../config/db";


/**
 * ✅ For use in token generation and /auth/me route
 */
export const getUserPermissions = async (userId: number): Promise<string[]> => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("UserID", sql.Int, userId)
    .query(`
      SELECT p.PermissionKey
      FROM RolePermissions rp
      JOIN Permissions p ON rp.PermissionID = p.PermissionID
      JOIN Users u ON u.RoleID = rp.RoleID
      WHERE u.UserID = @UserID
    `);

  return result.recordset.map((row) => row.PermissionKey); 
};

/**
 * Check if a user has a given permission.
 * @param userId - User's ID
 * @param permissionKey - e.g. "can_approve_estimation"
 * @returns boolean indicating if user has that permission
 */
export async function checkUserPermission(userId: number, permissionKey: string): Promise<boolean> {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("UserID", sql.Int, userId)
    .input("PermissionKey", sql.VarChar, permissionKey)
    .query(`
      SELECT 1
      FROM Users u
      JOIN Roles r ON u.RoleID = r.RoleID
      JOIN RolePermissions rp ON r.RoleID = rp.RoleID
      JOIN Permissions p ON rp.PermissionID = p.PermissionID
      WHERE u.UserID = @UserID AND p.PermissionKey = @PermissionKey
    `);
    
  return result.recordset.length > 0;
}
