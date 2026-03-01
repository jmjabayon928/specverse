// src/backend/repositories/authSessionsRepository.ts
import { poolPromise, sql } from '../config/db'
import type { AuthSessionRow } from '../domain/authSessionTypes'
import crypto from 'crypto'

/**
 * Creates a new auth session in the database.
 */
export async function createAuthSession(
  sidHash: Buffer,
  userId: number,
  accountId: number | null,
  expiresAt: Date,
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('SidHash', sql.VarBinary(32), sidHash)
    .input('UserID', sql.Int, userId)
    .input('AccountID', sql.Int, accountId)
    .input('ExpiresAt', sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO dbo.AuthSessions (SidHash, UserID, AccountID, ExpiresAt, CreatedAt)
      VALUES (@SidHash, @UserID, @AccountID, @ExpiresAt, SYSUTCDATETIME())
    `)
}

/**
 * Finds an active (not revoked, not expired) session by sid hash.
 */
export async function findActiveSessionBySidHash(sidHash: Buffer): Promise<AuthSessionRow | null> {
  const pool = await poolPromise
  const now = new Date()
  const result = await pool
    .request()
    .input('SidHash', sql.VarBinary(32), sidHash)
    .input('Now', sql.DateTime2, now)
    .query<{
      SidHash: Buffer
      UserID: number
      AccountID: number | null
      ExpiresAt: Date
      RevokedAt: Date | null
      CreatedAt: Date
    }>(`
      SELECT SidHash, UserID, AccountID, ExpiresAt, RevokedAt, CreatedAt
      FROM dbo.AuthSessions
      WHERE SidHash = @SidHash
        AND RevokedAt IS NULL
        AND ExpiresAt > @Now
    `)
  const row = result.recordset[0]
  if (!row) return null
  return {
    SidHash: row.SidHash,
    UserID: row.UserID,
    AccountID: row.AccountID,
    ExpiresAt: row.ExpiresAt,
    RevokedAt: row.RevokedAt,
    CreatedAt: row.CreatedAt,
  }
}

/**
 * Revokes a session by setting RevokedAt.
 */
export async function revokeSessionBySidHash(sidHash: Buffer): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('SidHash', sql.VarBinary(32), sidHash)
    .input('RevokedAt', sql.DateTime2, new Date())
    .query(`
      UPDATE dbo.AuthSessions
      SET RevokedAt = @RevokedAt
      WHERE SidHash = @SidHash
        AND RevokedAt IS NULL
    `)
}

/**
 * Cleans up expired sessions (optional maintenance).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const pool = await poolPromise
  const now = new Date()
  const result = await pool
    .request()
    .input('Now', sql.DateTime2, now)
    .query<{ Deleted: number }>(`
      DELETE FROM dbo.AuthSessions
      WHERE ExpiresAt <= @Now
      SELECT @@ROWCOUNT AS Deleted
    `)
  return result.recordset[0]?.Deleted ?? 0
}

/**
 * Helper: Compute SHA-256 hash of a sid string.
 */
export function hashSid(sid: string): Buffer {
  return crypto.createHash('sha256').update(sid, 'utf8').digest()
}
