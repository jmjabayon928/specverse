// src/backend/repositories/sheetInstrumentSnapshotsRepository.ts
import { poolPromise, sql } from '../config/db'

export interface SnapshotRow {
  accountId: number
  sheetId: number
  payloadJson: string
  builtAt: Date
  buildMs: number | null
  instrumentCount: number
  buildVersion: number
  lastError: string | null
  lastErrorAt: Date | null
}

export interface SnapshotMeta {
  buildMs: number
  instrumentCount: number
}

export interface ClaimedQueueRow {
  accountId: number
  sheetId: number
  attempts: number
}

/** WHERE fragment for claimable rows: unclaimed or stale (claimed > 5 min ago). Used in dequeue selection. */
export const CLAIMABLE_ROW_WHERE =
  '(ClaimedAt IS NULL OR ClaimedAt < DATEADD(minute, -5, SYSUTCDATETIME()))'

/**
 * Get snapshot for (accountId, sheetId). Returns null if not found.
 */
export async function getSnapshot(
  accountId: number,
  sheetId: number
): Promise<SnapshotRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT AccountID AS accountId, SheetID AS sheetId, PayloadJson AS payloadJson,
             BuiltAt AS builtAt, BuildMs AS buildMs, InstrumentCount AS instrumentCount,
             BuildVersion AS buildVersion, LastError AS lastError, LastErrorAt AS lastErrorAt
      FROM dbo.SheetInstrumentSnapshots
      WHERE AccountID = @AccountID AND SheetID = @SheetID
    `)
  const row = result.recordset?.[0] as SnapshotRow | undefined
  return row ?? null
}

/**
 * Upsert snapshot row. On success clears LastError/LastErrorAt.
 */
export async function upsertSnapshot(
  accountId: number,
  sheetId: number,
  payloadJson: string,
  meta: SnapshotMeta
): Promise<void> {
  const pool = await poolPromise
  const builtAt = new Date()
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .input('PayloadJson', sql.NVarChar(sql.MAX), payloadJson)
    .input('BuiltAt', sql.DateTime2, builtAt)
    .input('BuildMs', sql.Int, meta.buildMs)
    .input('InstrumentCount', sql.Int, meta.instrumentCount)
    .input('BuildVersion', sql.Int, 1)
    .query(`
      MERGE dbo.SheetInstrumentSnapshots AS t
      USING (SELECT @AccountID AS AccountID, @SheetID AS SheetID) AS s
      ON t.AccountID = s.AccountID AND t.SheetID = s.SheetID
      WHEN MATCHED THEN
        UPDATE SET PayloadJson = @PayloadJson, BuiltAt = @BuiltAt, BuildMs = @BuildMs,
                   InstrumentCount = @InstrumentCount, BuildVersion = @BuildVersion,
                   LastError = NULL, LastErrorAt = NULL
      WHEN NOT MATCHED THEN
        INSERT (AccountID, SheetID, PayloadJson, BuiltAt, BuildMs, InstrumentCount, BuildVersion, LastError, LastErrorAt)
        VALUES (@AccountID, @SheetID, @PayloadJson, @BuiltAt, @BuildMs, @InstrumentCount, @BuildVersion, NULL, NULL);
    `)
}

/**
 * Write only LastError/LastErrorAt (e.g. on build failure). Upserts if row does not exist.
 */
export async function upsertSnapshotError(
  accountId: number,
  sheetId: number,
  lastError: string
): Promise<void> {
  const pool = await poolPromise
  const lastErrorAt = new Date()
  const truncated = lastError.length > 500 ? lastError.slice(0, 497) + '...' : lastError
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .input('LastError', sql.NVarChar(500), truncated)
    .input('LastErrorAt', sql.DateTime2, lastErrorAt)
    .query(`
      MERGE dbo.SheetInstrumentSnapshots AS t
      USING (SELECT @AccountID AS AccountID, @SheetID AS SheetID) AS s
      ON t.AccountID = s.AccountID AND t.SheetID = s.SheetID
      WHEN MATCHED THEN
        UPDATE SET LastError = @LastError, LastErrorAt = @LastErrorAt
      WHEN NOT MATCHED THEN
        INSERT (AccountID, SheetID, PayloadJson, BuiltAt, BuildMs, InstrumentCount, BuildVersion, LastError, LastErrorAt)
        VALUES (@AccountID, @SheetID, N'[]', SYSUTCDATETIME(), NULL, 0, 1, @LastError, @LastErrorAt);
    `)
}

function getRowsAffected(result: { rowsAffected?: number[] }): number {
  const arr = result.rowsAffected
  if (!Array.isArray(arr) || arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0)
}

function isDuplicateKeyError(err: unknown): boolean {
  const n = (err as { number?: number; code?: number }).number ?? (err as { number?: number; code?: number }).code
  return n === 2601 || n === 2627
}

/**
 * Enqueue a snapshot rebuild for (accountId, sheetId). UPDATE-then-INSERT: update existing row with lock; if none, insert (with TRY/CATCH race handling).
 */
export async function enqueueSnapshotRebuild(
  accountId: number,
  sheetId: number,
  reason: string | null
): Promise<void> {
  const pool = await poolPromise
  const reasonVal = reason != null && reason.length > 100 ? reason.slice(0, 97) + '...' : reason
  const req = pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .input('Reason', sql.NVarChar(100), reasonVal)

  const updateResult = await req.query(`
    UPDATE q WITH (ROWLOCK, UPDLOCK)
    SET EnqueuedAt = SYSUTCDATETIME(), Reason = @Reason, ClaimedAt = NULL, ClaimedBy = NULL
    FROM dbo.SheetInstrumentSnapshotQueue q
    WHERE q.AccountID = @AccountID AND q.SheetID = @SheetID
  `)
  if (getRowsAffected(updateResult) > 0) return

  try {
    await pool
      .request()
      .input('AccountID', sql.Int, accountId)
      .input('SheetID', sql.Int, sheetId)
      .input('Reason', sql.NVarChar(100), reasonVal)
      .query(`
        INSERT INTO dbo.SheetInstrumentSnapshotQueue (AccountID, SheetID, EnqueuedAt, Attempts, LastAttemptAt, Reason, ClaimedAt, ClaimedBy)
        VALUES (@AccountID, @SheetID, SYSUTCDATETIME(), 0, NULL, @Reason, NULL, NULL)
      `)
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      await pool
        .request()
        .input('AccountID', sql.Int, accountId)
        .input('SheetID', sql.Int, sheetId)
        .input('Reason', sql.NVarChar(100), reasonVal)
        .query(`
          UPDATE q WITH (ROWLOCK, UPDLOCK)
          SET EnqueuedAt = SYSUTCDATETIME(), Reason = @Reason, ClaimedAt = NULL, ClaimedBy = NULL
          FROM dbo.SheetInstrumentSnapshotQueue q
          WHERE q.AccountID = @AccountID AND q.SheetID = @SheetID
        `)
    } else {
      throw err
    }
  }
}

/**
 * Atomically claim one queue row (oldest EnqueuedAt). Claimable if unclaimed or stale (ClaimedAt > 5 min ago). Returns claimed row or null.
 */
export async function dequeueOneClaimed(workerId: string): Promise<ClaimedQueueRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('WorkerId', sql.NVarChar(100), workerId)
    .query(`
      UPDATE q
      SET ClaimedAt = SYSUTCDATETIME(), ClaimedBy = @WorkerId, LastAttemptAt = SYSUTCDATETIME(), Attempts = Attempts + 1
      OUTPUT inserted.AccountID AS accountId, inserted.SheetID AS sheetId, inserted.Attempts AS attempts
      FROM dbo.SheetInstrumentSnapshotQueue q
      INNER JOIN (
        SELECT TOP (1) AccountID, SheetID
        FROM dbo.SheetInstrumentSnapshotQueue WITH (ROWLOCK, READPAST, UPDLOCK)
        WHERE ${CLAIMABLE_ROW_WHERE}
        ORDER BY EnqueuedAt ASC
      ) t ON q.AccountID = t.AccountID AND q.SheetID = t.SheetID
    `)
  const row = result.recordset?.[0] as ClaimedQueueRow | undefined
  return row ?? null
}

/**
 * Atomically claim up to maxItems queue rows (oldest EnqueuedAt first). Claimable if unclaimed or stale (ClaimedAt > 5 min ago). Returns all claimed rows.
 */
export async function dequeueManyClaimed(
  workerId: string,
  maxItems: number
): Promise<ClaimedQueueRow[]> {
  if (maxItems <= 0) return []
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('WorkerId', sql.NVarChar(100), workerId)
    .input('Max', sql.Int, maxItems)
    .query(`
      UPDATE q
      SET ClaimedAt = SYSUTCDATETIME(), ClaimedBy = @WorkerId, LastAttemptAt = SYSUTCDATETIME(), Attempts = Attempts + 1
      OUTPUT inserted.AccountID AS accountId, inserted.SheetID AS sheetId, inserted.Attempts AS attempts
      FROM dbo.SheetInstrumentSnapshotQueue q
      INNER JOIN (
        SELECT TOP (@Max) AccountID, SheetID
        FROM dbo.SheetInstrumentSnapshotQueue WITH (ROWLOCK, READPAST, UPDLOCK)
        WHERE ${CLAIMABLE_ROW_WHERE}
        ORDER BY EnqueuedAt ASC
      ) t ON q.AccountID = t.AccountID AND q.SheetID = t.SheetID
    `)
  const rows = (result.recordset ?? []) as ClaimedQueueRow[]
  return rows
}

/**
 * Delete one queue row by (accountId, sheetId).
 */
export async function deleteQueueRow(accountId: number, sheetId: number): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .query(`
      DELETE FROM dbo.SheetInstrumentSnapshotQueue
      WHERE AccountID = @AccountID AND SheetID = @SheetID
    `)
}

/**
 * Release claim so the row can be retried. Only clears if ClaimedBy = @WorkerId (worker-safe).
 */
export async function releaseQueueClaim(
  accountId: number,
  sheetId: number,
  workerId: string
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .input('WorkerId', sql.NVarChar(100), workerId)
    .query(`
      UPDATE dbo.SheetInstrumentSnapshotQueue
      SET ClaimedAt = NULL, ClaimedBy = NULL
      WHERE AccountID = @AccountID AND SheetID = @SheetID AND ClaimedBy = @WorkerId
    `)
}

/**
 * Return distinct SheetIDs that have a link to the given instrument (for enqueue on instrument update).
 */
export async function listSheetIdsLinkedToInstrument(
  accountId: number,
  instrumentId: number
): Promise<number[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('InstrumentID', sql.Int, instrumentId)
    .query(`
      SELECT DISTINCT SheetID AS sheetId
      FROM dbo.InstrumentDatasheetLinks
      WHERE AccountID = @AccountID AND InstrumentID = @InstrumentID
    `)
  const rows = (result.recordset ?? []) as { sheetId: number }[]
  return rows.map((r) => r.sheetId)
}
