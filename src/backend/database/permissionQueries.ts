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
 * Account-scoped permissions (Phase 2.5): resolve RoleID from AccountMembers for the current account.
 */
export const getAccountPermissions = async (
  userId: number,
  accountId: number,
): Promise<string[]> => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .input("AccountID", sql.Int, accountId)
    .query(`
      SELECT p.PermissionKey
      FROM dbo.AccountMembers am
      JOIN dbo.RolePermissions rp ON rp.RoleID = am.RoleID
      JOIN dbo.Permissions p ON p.PermissionID = rp.PermissionID
      WHERE am.UserID = @UserID
        AND am.AccountID = @AccountID
        AND am.IsActive = 1
    `);

  return result.recordset.map(r => r.PermissionKey);
};

/**
 * Check if a user has a given permission.
 * @param userId - User's ID
 * @param permissionKey - e.g. "can_approve_estimation"
 * @returns boolean indicating if user has that permission
 */
export async function checkUserPermission(
  userId: number,
  accountId: number,
  permissionKey: string,
): Promise<boolean> {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("UserID", sql.Int, userId)
    .input("AccountID", sql.Int, accountId)
    .input("PermissionKey", sql.VarChar, permissionKey)
    .query(`
      SELECT 1
      FROM dbo.AccountMembers am
      JOIN dbo.Roles r ON am.RoleID = r.RoleID
      JOIN dbo.RolePermissions rp ON r.RoleID = rp.RoleID
      JOIN dbo.Permissions p ON rp.PermissionID = p.PermissionID
      WHERE am.UserID = @UserID
        AND am.AccountID = @AccountID
        AND am.IsActive = 1
        AND p.PermissionKey = @PermissionKey
    `);
    
  return result.recordset.length > 0;
}
