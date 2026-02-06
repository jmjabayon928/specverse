// src/backend/repositories/accountsRepository.ts
import { poolPromise, sql } from '../config/db'

export type AccountWithRole = {
  accountId: number
  accountName: string
  slug: string
  isActive: boolean
  roleName: string
}

/**
 * Lists accounts where the user has an active membership and the account is active.
 */
export async function listAccountsForUser(userId: number): Promise<AccountWithRole[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('UserID', sql.Int, userId)
    .query<{
      AccountID: number
      AccountName: string
      Slug: string
      IsActive: boolean
      RoleName: string
    }>(`
      SELECT
        a.AccountID,
        a.AccountName,
        a.Slug,
        CAST(a.IsActive AS TINYINT) AS IsActive,
        r.RoleName
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Accounts a ON a.AccountID = am.AccountID
      INNER JOIN dbo.Roles r ON r.RoleID = am.RoleID
      WHERE am.UserID = @UserID
        AND am.IsActive = 1
        AND a.IsActive = 1
      ORDER BY a.AccountName
    `)
  return result.recordset.map(row => ({
    accountId: row.AccountID,
    accountName: row.AccountName,
    slug: row.Slug,
    isActive: Boolean(row.IsActive),
    roleName: row.RoleName,
  }))
}
