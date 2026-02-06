// src/backend/repositories/accountMembersRepository.ts
import { poolPromise, sql } from '../config/db'

export type AccountMemberRow = {
  accountMemberId: number
  userId: number
  email: string | null
  firstName: string | null
  lastName: string | null
  roleId: number
  roleName: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Lists members for an account (AccountMembers + Users + Roles). Scoped by accountId only.
 */
export async function listMembers(accountId: number): Promise<AccountMemberRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .query<{
      AccountMemberID: number
      UserID: number
      Email: string | null
      FirstName: string | null
      LastName: string | null
      RoleID: number
      RoleName: string
      IsActive: boolean
      CreatedAt: Date
      UpdatedAt: Date
    }>(`
      SELECT
        am.AccountMemberID,
        am.UserID,
        u.Email,
        u.FirstName,
        u.LastName,
        am.RoleID,
        r.RoleName,
        CAST(am.IsActive AS TINYINT) AS IsActive,
        am.CreatedAt,
        am.UpdatedAt
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Users u ON u.UserID = am.UserID
      INNER JOIN dbo.Roles r ON r.RoleID = am.RoleID
      WHERE am.AccountID = @AccountID
      ORDER BY u.Email
    `)
  return result.recordset.map(row => ({
    accountMemberId: row.AccountMemberID,
    userId: row.UserID,
    email: row.Email,
    firstName: row.FirstName,
    lastName: row.LastName,
    roleId: row.RoleID,
    roleName: row.RoleName,
    isActive: Boolean(row.IsActive),
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  }))
}

/**
 * Returns the member row if found in the given account, otherwise null.
 */
export async function getMemberInAccount(
  accountId: number,
  accountMemberId: number,
): Promise<AccountMemberRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('AccountMemberID', sql.Int, accountMemberId)
    .query<{
      AccountMemberID: number
      UserID: number
      Email: string | null
      FirstName: string | null
      LastName: string | null
      RoleID: number
      RoleName: string
      IsActive: boolean
      CreatedAt: Date
      UpdatedAt: Date
    }>(`
      SELECT
        am.AccountMemberID,
        am.UserID,
        u.Email,
        u.FirstName,
        u.LastName,
        am.RoleID,
        r.RoleName,
        CAST(am.IsActive AS TINYINT) AS IsActive,
        am.CreatedAt,
        am.UpdatedAt
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Users u ON u.UserID = am.UserID
      INNER JOIN dbo.Roles r ON r.RoleID = am.RoleID
      WHERE am.AccountID = @AccountID AND am.AccountMemberID = @AccountMemberID
    `)
  const row = result.recordset[0]
  if (!row) return null
  return {
    accountMemberId: row.AccountMemberID,
    userId: row.UserID,
    email: row.Email,
    firstName: row.FirstName,
    lastName: row.LastName,
    roleId: row.RoleID,
    roleName: row.RoleName,
    isActive: Boolean(row.IsActive),
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  }
}

/**
 * Number of active members in the account with Admin role.
 * Admin = RoleName normalized equals 'admin' (case-insensitive, trimmed). See roleUtils.isAdminRole.
 */
export async function countActiveAdminsInAccount(accountId: number): Promise<number> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .query<{ Cnt: number }>(`
      SELECT COUNT(*) AS Cnt
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Roles r ON r.RoleID = am.RoleID
      WHERE am.AccountID = @AccountID
        AND am.IsActive = 1
        AND LOWER(LTRIM(RTRIM(r.RoleName))) = N'admin'
    `)
  return result.recordset[0]?.Cnt ?? 0
}

/**
 * Updates RoleID for a member in the account. Caller must ensure row exists and last-admin is checked.
 */
export async function updateMemberRole(
  accountId: number,
  accountMemberId: number,
  roleId: number,
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('AccountMemberID', sql.Int, accountMemberId)
    .input('RoleID', sql.Int, roleId)
    .query(`
      UPDATE dbo.AccountMembers
      SET RoleID = @RoleID, UpdatedAt = GETDATE()
      WHERE AccountID = @AccountID AND AccountMemberID = @AccountMemberID
    `)
}

/**
 * Updates IsActive for a member in the account. Caller must ensure row exists and last-admin is checked.
 */
export async function updateMemberStatus(
  accountId: number,
  accountMemberId: number,
  isActive: boolean,
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('AccountMemberID', sql.Int, accountMemberId)
    .input('IsActive', sql.Bit, isActive ? 1 : 0)
    .query(`
      UPDATE dbo.AccountMembers
      SET IsActive = @IsActive, UpdatedAt = GETDATE()
      WHERE AccountID = @AccountID AND AccountMemberID = @AccountMemberID
    `)
}
