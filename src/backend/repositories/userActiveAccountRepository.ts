// src/backend/repositories/userActiveAccountRepository.ts
import { poolPromise, sql } from '../config/db'

/**
 * Returns the stored active AccountID for the user, or null if none.
 */
export async function getActiveAccountId(userId: number): Promise<number | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('UserID', sql.Int, userId)
    .query<{ AccountID: number }>(`
      SELECT AccountID
      FROM dbo.UserActiveAccount
      WHERE UserID = @UserID
    `)
  const row = result.recordset[0]
  return row?.AccountID ?? null
}

/**
 * Upserts the active account for the user. Replaces any existing row.
 */
export async function setActiveAccount(userId: number, accountId: number): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('UserID', sql.Int, userId)
    .input('AccountID', sql.Int, accountId)
    .query(`
      MERGE dbo.UserActiveAccount AS t
      USING (SELECT @UserID AS UserID, @AccountID AS AccountID) AS s
      ON t.UserID = s.UserID
      WHEN MATCHED THEN
        UPDATE SET AccountID = s.AccountID, UpdatedAt = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (UserID, AccountID, UpdatedAt)
        VALUES (s.UserID, s.AccountID, GETDATE());
    `)
}

/**
 * Removes the stored active account for the user (e.g. when membership is invalid).
 */
export async function clearActiveAccount(userId: number): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('UserID', sql.Int, userId)
    .query(`DELETE FROM dbo.UserActiveAccount WHERE UserID = @UserID`)
}
