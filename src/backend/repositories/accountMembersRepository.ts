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
  isOwner: boolean
  createdAt: Date
  updatedAt: Date
}

const isOwnerExpr = `CASE WHEN (am.IsOwner = 1) OR (a.OwnerUserID = am.UserID) THEN 1 ELSE 0 END`

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
      IsOwner: number
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
        ${isOwnerExpr} AS IsOwner,
        am.CreatedAt,
        am.UpdatedAt
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Accounts a ON a.AccountID = am.AccountID
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
    isOwner: row.IsOwner === 1,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  }))
}

/**
 * Returns the member row for the given account and user, or null if not found.
 */
export async function getMemberByAccountAndUser(
  accountId: number,
  userId: number,
): Promise<AccountMemberRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('UserID', sql.Int, userId)
    .query<{
      AccountMemberID: number
      UserID: number
      Email: string | null
      FirstName: string | null
      LastName: string | null
      RoleID: number
      RoleName: string
      IsActive: boolean
      IsOwner: number
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
        ${isOwnerExpr} AS IsOwner,
        am.CreatedAt,
        am.UpdatedAt
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Accounts a ON a.AccountID = am.AccountID
      INNER JOIN dbo.Users u ON u.UserID = am.UserID
      INNER JOIN dbo.Roles r ON r.RoleID = am.RoleID
      WHERE am.AccountID = @AccountID AND am.UserID = @UserID
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
    isOwner: row.IsOwner === 1,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  }
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
      IsOwner: number
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
        ${isOwnerExpr} AS IsOwner,
        am.CreatedAt,
        am.UpdatedAt
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Accounts a ON a.AccountID = am.AccountID
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
    isOwner: row.IsOwner === 1,
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
 * Count of active members who are owners (am.IsOwner = 1 or a.OwnerUserID = am.UserID). No double count.
 */
export async function countActiveOwnersInAccount(accountId: number): Promise<number> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .query<{ Cnt: number }>(`
      SELECT COUNT(*) AS Cnt
      FROM dbo.AccountMembers am
      INNER JOIN dbo.Accounts a ON a.AccountID = am.AccountID
      WHERE am.AccountID = @AccountID
        AND am.IsActive = 1
        AND ((am.IsOwner = 1) OR (a.OwnerUserID = am.UserID))
    `)
  return result.recordset[0]?.Cnt ?? 0
}

/**
 * Clears IsOwner for all members in the account. Use before setting exactly one member as owner.
 */
export async function clearAccountMemberOwnerFlags(
  accountId: number,
  tx?: InstanceType<typeof sql.Transaction>,
): Promise<void> {
  const req = tx ? tx.request() : (await poolPromise).request()
  await req
    .input('AccountID', sql.Int, accountId)
    .query(`
      UPDATE dbo.AccountMembers
      SET IsOwner = 0, UpdatedAt = GETDATE()
      WHERE AccountID = @AccountID
    `)
}

/**
 * Sets IsOwner flag for a member. Caller must ensure row exists.
 */
export async function setMemberIsOwner(
  accountId: number,
  accountMemberId: number,
  isOwner: boolean,
  tx?: InstanceType<typeof sql.Transaction>,
): Promise<void> {
  const req = tx ? tx.request() : (await poolPromise).request()
  await req
    .input('AccountID', sql.Int, accountId)
    .input('AccountMemberID', sql.Int, accountMemberId)
    .input('IsOwner', sql.Bit, isOwner ? 1 : 0)
    .query(`
      UPDATE dbo.AccountMembers
      SET IsOwner = @IsOwner, UpdatedAt = GETDATE()
      WHERE AccountID = @AccountID AND AccountMemberID = @AccountMemberID
    `)
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

/**
 * Inserts a new account member. Caller must ensure (accountId, userId) is not already present.
 */
export async function insertAccountMember(
  accountId: number,
  userId: number,
  roleId: number,
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('UserID', sql.Int, userId)
    .input('RoleID', sql.Int, roleId)
    .query(`
      INSERT INTO dbo.AccountMembers (AccountID, UserID, RoleID, IsActive, CreatedAt, UpdatedAt)
      VALUES (@AccountID, @UserID, @RoleID, 1, GETDATE(), GETDATE())
    `)
}
