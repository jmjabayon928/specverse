import { poolPromise, sql } from "../config/db";

export type AccountContext = {
  accountId: number;
  roleId: number;
  roleName: string;
  permissions: string[];
  isOwner: boolean;
  ownerUserId: number | null;
};

function isAdmin(roleId: number, roleName: string): boolean {
  if (roleId === 1) return true;
  const name = typeof roleName === "string" ? roleName.trim().toLowerCase() : "";
  return name === "admin";
}

async function getPermissionsForRole(
  roleId: number,
  roleName: string,
  pool: Awaited<typeof poolPromise>
): Promise<string[]> {
  if (isAdmin(roleId, roleName)) {
    const result = await pool.request().query<{ PermissionKey: string }>(`
      SELECT PermissionKey
      FROM dbo.Permissions
      ORDER BY PermissionKey
    `);
    return result.recordset.map((r) => r.PermissionKey);
  }
  const result = await pool
    .request()
    .input("RoleID", sql.Int, roleId)
    .query<{ PermissionKey: string }>(`
      SELECT p.PermissionKey
      FROM dbo.RolePermissions rp
      INNER JOIN dbo.Permissions p ON p.PermissionID = rp.PermissionID
      WHERE rp.RoleID = @RoleID
    `);
  return result.recordset.map((r) => r.PermissionKey);
}

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
    .query<{ AccountID: number; RoleID: number; RoleName: string; OwnerUserID: number | null; IsOwner: number }>(`
      SELECT TOP 1
        am.AccountID,
        am.RoleID,
        r.RoleName,
        a.OwnerUserID AS OwnerUserID,
        CASE WHEN (am.IsOwner = 1) OR (a.OwnerUserID = @UserID) THEN 1 ELSE 0 END AS IsOwner
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

  const permissions = await getPermissionsForRole(row.RoleID, row.RoleName, pool);

  return {
    accountId: row.AccountID,
    roleId: row.RoleID,
    roleName: row.RoleName,
    permissions,
    ownerUserId: row.OwnerUserID ?? null,
    isOwner: row.IsOwner === 1,
  };
}

/**
 * Resolve account context for a user in a specific account.
 * Returns null if the user has no active membership in that account (AccountMembers.IsActive = 1, Accounts.IsActive = 1).
 */
export async function getAccountContextForUserAndAccount(
  userId: number,
  accountId: number,
): Promise<AccountContext | null> {
  const pool = await poolPromise;

  const member = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .input("AccountID", sql.Int, accountId)
    .query<{ AccountID: number; RoleID: number; RoleName: string; OwnerUserID: number | null; IsOwner: number }>(`
      SELECT am.AccountID, am.RoleID, r.RoleName,
        a.OwnerUserID AS OwnerUserID,
        CASE WHEN (am.IsOwner = 1) OR (a.OwnerUserID = @UserID) THEN 1 ELSE 0 END AS IsOwner
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Accounts a ON a.AccountID = am.AccountID
      INNER JOIN dbo.Roles r ON r.RoleID = am.RoleID
      WHERE am.UserID = @UserID
        AND am.AccountID = @AccountID
        AND am.IsActive = 1
        AND a.IsActive = 1
    `);

  const row = member.recordset[0];
  if (!row) return null;

  const permissions = await getPermissionsForRole(row.RoleID, row.RoleName, pool);

  return {
    accountId: row.AccountID,
    roleId: row.RoleID,
    roleName: row.RoleName,
    permissions,
    ownerUserId: row.OwnerUserID ?? null,
    isOwner: row.IsOwner === 1,
  };
}

