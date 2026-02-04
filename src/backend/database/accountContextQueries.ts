import { poolPromise, sql } from "../config/db";

export type AccountContext = {
  accountId: number;
  roleId: number;
  roleName: string;
  permissions: string[];
};

export async function getDefaultAccountId(): Promise<number | null> {
  const pool = await poolPromise;
  const result = await pool.request().query<{ AccountID: number }>(`
    SELECT TOP 1 AccountID
    FROM dbo.Accounts
    WHERE Slug = N'default'
  `);

  return result.recordset[0]?.AccountID ?? null;
}

/**
 * Validate that an account exists and is active. Returns the AccountID if valid, otherwise null.
 */
export async function getActiveAccountId(accountId: number): Promise<number | null> {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("AccountID", sql.Int, accountId)
    .query<{ AccountID: number }>(`
      SELECT AccountID
      FROM dbo.Accounts
      WHERE AccountID = @AccountID
        AND IsActive = 1
    `);

  return result.recordset[0]?.AccountID ?? null;
}

/**
 * Resolve the active account context for a user.
 *
 * Deterministic selection:
 * - Prefer membership in Accounts.Slug = 'default' if present
 * - Else pick the lowest AccountID membership
 */
export async function getAccountContextForUser(
  userId: number,
): Promise<AccountContext | null> {
  const pool = await poolPromise;

  const member = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .query<{ AccountID: number; RoleID: number; RoleName: string }>(`
      SELECT TOP 1
        am.AccountID,
        am.RoleID,
        r.RoleName
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Accounts a ON a.AccountID = am.AccountID
      INNER JOIN dbo.Roles r ON r.RoleID = am.RoleID
      WHERE am.UserID = @UserID
        AND am.IsActive = 1
        AND a.IsActive = 1
      ORDER BY
        CASE WHEN a.Slug = N'default' THEN 0 ELSE 1 END,
        am.AccountID ASC
    `);

  const row = member.recordset[0];
  if (!row) return null;

  const perms = await pool
    .request()
    .input("RoleID", sql.Int, row.RoleID)
    .query<{ PermissionKey: string }>(`
      SELECT p.PermissionKey
      FROM dbo.RolePermissions rp
      INNER JOIN dbo.Permissions p ON p.PermissionID = rp.PermissionID
      WHERE rp.RoleID = @RoleID
    `);

  return {
    accountId: row.AccountID,
    roleId: row.RoleID,
    roleName: row.RoleName,
    permissions: perms.recordset.map(r => r.PermissionKey),
  };
}

