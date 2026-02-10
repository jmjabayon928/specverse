// src/backend/database/platformAdminQueries.ts
import { poolPromise, sql } from '../config/db'

export type PlatformAdminRow = {
  userId: number
  isActive: boolean
  createdAt: Date
  createdByUserId: number | null
  revokedAt: Date | null
  revokedByUserId: number | null
}

export async function isActivePlatformAdmin(userId: number): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('UserID', sql.Int, userId)
    .query<{ UserID: number }>(`
      SELECT UserID
      FROM dbo.PlatformAdmins
      WHERE UserID = @UserID
        AND IsActive = 1
    `)
  return (result.recordset.length ?? 0) > 0
}

export async function listActivePlatformAdmins(): Promise<PlatformAdminRow[]> {
  const pool = await poolPromise
  const result = await pool.request().query<{
    UserID: number
    IsActive: number
    CreatedAt: Date
    CreatedByUserID: number | null
    RevokedAt: Date | null
    RevokedByUserID: number | null
  }>(`
    SELECT
      UserID,
      IsActive,
      CreatedAt,
      CreatedByUserID,
      RevokedAt,
      RevokedByUserID
    FROM dbo.PlatformAdmins
    WHERE IsActive = 1
    ORDER BY CreatedAt ASC
  `)
  return (result.recordset ?? []).map(row => ({
    userId: row.UserID,
    isActive: row.IsActive === 1,
    createdAt: row.CreatedAt,
    createdByUserId: row.CreatedByUserID ?? null,
    revokedAt: row.RevokedAt ?? null,
    revokedByUserId: row.RevokedByUserID ?? null,
  }))
}

/**
 * Revokes a platform admin (sets IsActive = 0, RevokedAt, RevokedByUserID).
 * Only updates rows where UserID = targetUserId AND IsActive = 1.
 * Returns true if a row was updated, false otherwise (e.g. already inactive).
 */
export async function revokePlatformAdmin(args: {
  targetUserId: number
  revokedByUserId: number
}): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('TargetUserID', sql.Int, args.targetUserId)
    .input('RevokedByUserID', sql.Int, args.revokedByUserId)
    .query(`
      UPDATE dbo.PlatformAdmins
      SET IsActive = 0,
          RevokedAt = SYSUTCDATETIME(),
          RevokedByUserID = @RevokedByUserID
      WHERE UserID = @TargetUserID
        AND IsActive = 1
    `)
  const rowsAffected = (result as { rowsAffected?: number[] }).rowsAffected?.[0] ?? 0
  return rowsAffected > 0
}

function isSqlServerError(err: unknown): err is { number?: number; message?: string } {
  return typeof err === 'object' && err !== null && 'number' in err
}

function isDuplicateKeyError(err: unknown): boolean {
  if (!isSqlServerError(err)) return false
  const n = err.number
  return n === 2627 || n === 2601
}

export type GrantPlatformAdminResult = 'already_active' | 'inserted' | 'reactivated'

export async function grantPlatformAdmin(args: {
  targetUserId: number
  grantedByUserId: number
}): Promise<GrantPlatformAdminResult> {
  const pool = await poolPromise

  const activeCheck = await pool
    .request()
    .input('TargetUserID', sql.Int, args.targetUserId)
    .query<{ UserID: number }>(`
      SELECT UserID
      FROM dbo.PlatformAdmins
      WHERE UserID = @TargetUserID
        AND IsActive = 1
    `)
  if ((activeCheck.recordset?.length ?? 0) > 0) {
    return 'already_active'
  }

  const updateResult = await pool
    .request()
    .input('TargetUserID', sql.Int, args.targetUserId)
    .query(`
      UPDATE dbo.PlatformAdmins
      SET IsActive = 1,
          RevokedAt = NULL,
          RevokedByUserID = NULL
      WHERE UserID = @TargetUserID
        AND IsActive = 0
    `)
  const rowsAffected = (updateResult as { rowsAffected?: number[] }).rowsAffected?.[0] ?? 0
  if (rowsAffected > 0) {
    return 'reactivated'
  }

  try {
    await pool
      .request()
      .input('TargetUserID', sql.Int, args.targetUserId)
      .input('GrantedByUserID', sql.Int, args.grantedByUserId)
      .query(`
        INSERT INTO dbo.PlatformAdmins (UserID, IsActive, CreatedByUserID, CreatedAt)
        VALUES (@TargetUserID, 1, @GrantedByUserID, SYSUTCDATETIME())
      `)
    return 'inserted'
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return 'already_active'
    }
    throw err
  }
}
