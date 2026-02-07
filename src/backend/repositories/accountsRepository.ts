// src/backend/repositories/accountsRepository.ts
import { poolPromise, sql } from '../config/db'

/**
 * Returns the account name for the given account ID, or null if not found.
 */
export async function getAccountNameById(accountId: number): Promise<string | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .query<{ AccountName: string }>(`
      SELECT AccountName FROM dbo.Accounts WHERE AccountID = @AccountID
    `)
  const row = result.recordset[0]
  return row?.AccountName ?? null
}

export type AccountDto = {
  accountId: number
  accountName: string
  slug: string
  isActive: boolean
}

export type AccountWithRole = {
  accountId: number
  accountName: string
  slug: string
  isActive: boolean
  roleName: string
}

export async function getAccountById(accountId: number): Promise<AccountDto | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .query<{
      AccountID: number
      AccountName: string
      Slug: string
      IsActive: boolean
    }>(`
      SELECT
        a.AccountID,
        a.AccountName,
        a.Slug,
        CAST(a.IsActive AS TINYINT) AS IsActive
      FROM dbo.Accounts a
      WHERE a.AccountID = @AccountID
    `)
  const row = result.recordset[0]
  if (!row) return null
  return {
    accountId: row.AccountID,
    accountName: row.AccountName,
    slug: row.Slug,
    isActive: Boolean(row.IsActive),
  }
}

export async function createAccount(
  accountName: string,
  slug: string,
  isActive: boolean,
): Promise<AccountDto> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountName', sql.NVarChar(255), accountName)
    .input('Slug', sql.NVarChar(64), slug)
    .input('IsActive', sql.Bit, isActive)
    .query<{
      AccountID: number
      AccountName: string
      Slug: string
      IsActive: boolean
    }>(`
      INSERT INTO dbo.Accounts (AccountName, Slug, IsActive)
      OUTPUT
        inserted.AccountID,
        inserted.AccountName,
        inserted.Slug,
        CAST(inserted.IsActive AS TINYINT) AS IsActive
      VALUES (@AccountName, @Slug, @IsActive)
    `)
  const row = result.recordset[0]
  // Insert with OUTPUT should always return exactly one row; guard anyway.
  if (!row) {
    throw new Error('Failed to create account')
  }
  return {
    accountId: row.AccountID,
    accountName: row.AccountName,
    slug: row.Slug,
    isActive: Boolean(row.IsActive),
  }
}

export type AccountPatch = { accountName?: string; slug?: string; isActive?: boolean }

export async function updateAccount(accountId: number, patch: AccountPatch): Promise<AccountDto | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('AccountName', sql.NVarChar(255), patch.accountName ?? null)
    .input('Slug', sql.NVarChar(64), patch.slug ?? null)
    .input('IsActive', sql.Bit, patch.isActive ?? null)
    .query<{
      AccountID: number
      AccountName: string
      Slug: string
      IsActive: boolean
    }>(`
      UPDATE dbo.Accounts
      SET
        AccountName = COALESCE(@AccountName, AccountName),
        Slug = COALESCE(@Slug, Slug),
        IsActive = COALESCE(@IsActive, IsActive)
      OUTPUT
        inserted.AccountID,
        inserted.AccountName,
        inserted.Slug,
        CAST(inserted.IsActive AS TINYINT) AS IsActive
      WHERE AccountID = @AccountID
    `)
  const row = result.recordset[0]
  if (!row) return null
  return {
    accountId: row.AccountID,
    accountName: row.AccountName,
    slug: row.Slug,
    isActive: Boolean(row.IsActive),
  }
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
