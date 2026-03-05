// src/backend/database/exportJobQueries.ts
import { poolPromise, sql } from '../config/db'

export type ExportJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ExportJobRow {
  Id: number
  JobType: string
  Status: string
  Progress: number
  ParamsJson: string | null
  CreatedBy: number
  CreatedAt: Date
  StartedAt: Date | null
  CompletedAt: Date | null
  ExpiresAt: Date | null
  ErrorMessage: string | null
  FileName: string | null
  FilePath: string | null
  LeaseId?: string | null
  LeasedUntil?: Date | null
  AttemptCount?: number
  AccountID?: number | null
  NextAttemptAt?: Date | null
  MaxAttempts?: number
  LastErrorAt?: Date | null
}

export interface InsertExportJobInput {
  jobType: string
  status: ExportJobStatus
  progress?: number
  paramsJson: string | null
  createdBy: number
}

export async function insertExportJob(
  input: InsertExportJobInput
): Promise<number> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('JobType', sql.NVarChar(50), input.jobType)
    .input('Status', sql.NVarChar(20), input.status)
    .input('Progress', sql.Int, input.progress ?? 0)
    .input('ParamsJson', sql.NVarChar(sql.MAX), input.paramsJson)
    .input('CreatedBy', sql.Int, input.createdBy)
    .query(`
      INSERT INTO dbo.ExportJobs (JobType, Status, Progress, ParamsJson, CreatedBy)
      OUTPUT INSERTED.Id
      VALUES (@JobType, @Status, @Progress, @ParamsJson, @CreatedBy)
    `)
  const row = result.recordset[0] as { Id: number }
  return row.Id
}

export async function getExportJobById(
  jobId: number
): Promise<ExportJobRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('Id', sql.Int, jobId)
    .query(`
      SELECT Id, JobType, Status, Progress, ParamsJson,
             CreatedBy, CreatedAt, StartedAt, CompletedAt, ExpiresAt,
             ErrorMessage, FileName, FilePath,
             LeaseId, LeasedUntil, AttemptCount,
             AccountID, NextAttemptAt, MaxAttempts, LastErrorAt
      FROM dbo.ExportJobs
      WHERE Id = @Id
    `)
  const row = result.recordset[0] as ExportJobRow | undefined
  return row ?? null
}

export async function updateExportJobRunning(jobId: number): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('StartedAt', sql.DateTime2, new Date())
    .query(`
      UPDATE dbo.ExportJobs
      SET Status = 'running', StartedAt = @StartedAt
      WHERE Id = @Id
    `)
}

export interface ClaimExportJobResult {
  claimed: boolean
  row: ExportJobRow | null
}

/** Atomically claim a job (queued or reclaimable). Uses UPDLOCK, READPAST, ROWLOCK. Returns claimed and row. */
export async function claimExportJob(
  jobId: number,
  workerLeaseId: string,
  leasedUntil: Date,
  startedAt: Date
): Promise<ClaimExportJobResult> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('LeaseId', sql.UniqueIdentifier, workerLeaseId)
    .input('LeasedUntil', sql.DateTime2, leasedUntil)
    .input('StartedAt', sql.DateTime2, startedAt)
    .query(`
      UPDATE ej
      SET ej.Status = 'running',
          ej.StartedAt = COALESCE(ej.StartedAt, @StartedAt),
          ej.LeaseId = @LeaseId,
          ej.LeasedUntil = @LeasedUntil,
          ej.AttemptCount = ej.AttemptCount + 1,
          ej.ErrorMessage = NULL,
          ej.Progress = 0
      OUTPUT INSERTED.Id, INSERTED.JobType, INSERTED.Status, INSERTED.Progress, INSERTED.ParamsJson,
             INSERTED.CreatedBy, INSERTED.CreatedAt, INSERTED.StartedAt, INSERTED.CompletedAt, INSERTED.ExpiresAt,
             INSERTED.ErrorMessage, INSERTED.FileName, INSERTED.FilePath,
             INSERTED.LeaseId, INSERTED.LeasedUntil, INSERTED.AttemptCount
      FROM dbo.ExportJobs ej WITH (UPDLOCK, READPAST, ROWLOCK)
      WHERE ej.Id = @Id
        AND (
          ej.Status = 'queued'
          OR (ej.Status = 'running' AND ej.LeasedUntil IS NOT NULL AND ej.LeasedUntil < SYSUTCDATETIME())
        )
    `)
  const row = result.recordset?.[0] as ExportJobRow | undefined
  const claimed = result.rowsAffected[0] === 1
  return { claimed, row: claimed && row ? row : null }
}

/** Atomically claim the next runnable job (queued or reclaimable), with per-account fairness. */
export async function claimNextExportJob(
  workerLeaseId: string,
  leasedUntil: Date,
  startedAt: Date,
  perAccountLimit: number
): Promise<ClaimExportJobResult> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('LeaseId', sql.UniqueIdentifier, workerLeaseId)
    .input('LeasedUntil', sql.DateTime2, leasedUntil)
    .input('StartedAt', sql.DateTime2, startedAt)
    .input('PerAccountLimit', sql.Int, perAccountLimit)
    .query(`
      ;WITH pick AS (
        SELECT TOP 1 ej.Id
        FROM dbo.ExportJobs ej WITH (UPDLOCK, READPAST, ROWLOCK)
        WHERE (
          (ej.Status = 'queued' AND (ej.NextAttemptAt IS NULL OR ej.NextAttemptAt <= SYSUTCDATETIME()))
          OR (ej.Status = 'running' AND ej.LeasedUntil IS NOT NULL AND ej.LeasedUntil < DATEADD(SECOND, -30, SYSUTCDATETIME()))
        )
        AND (
          (SELECT COUNT(1) FROM dbo.ExportJobs r WITH (READPAST)
           WHERE r.AccountID = ej.AccountID AND r.Status = 'running'
             AND r.LeasedUntil IS NOT NULL              AND r.LeasedUntil >= SYSUTCDATETIME())
        ) < @PerAccountLimit
        ORDER BY COALESCE(ej.NextAttemptAt, ej.CreatedAt), ej.CreatedAt, ej.Id
      )
      UPDATE ej
      SET ej.Status = 'running', ej.Progress = 0, ej.LeaseId = @LeaseId, ej.LeasedUntil = @LeasedUntil,
          ej.AttemptCount = ej.AttemptCount + 1, ej.ErrorMessage = NULL,
          ej.StartedAt = COALESCE(ej.StartedAt, @StartedAt)
      OUTPUT INSERTED.Id, INSERTED.JobType, INSERTED.Status, INSERTED.Progress, INSERTED.ParamsJson,
             INSERTED.CreatedBy, INSERTED.CreatedAt, INSERTED.StartedAt, INSERTED.CompletedAt, INSERTED.ExpiresAt,
             INSERTED.ErrorMessage, INSERTED.FileName, INSERTED.FilePath,
             INSERTED.LeaseId, INSERTED.LeasedUntil, INSERTED.AttemptCount,
             INSERTED.AccountID, INSERTED.NextAttemptAt, INSERTED.MaxAttempts, INSERTED.LastErrorAt
      FROM dbo.ExportJobs ej
      INNER JOIN pick ON pick.Id = ej.Id
    `)
  const row = result.recordset?.[0] as ExportJobRow | undefined
  const claimed = result.rowsAffected[0] === 1
  return { claimed, row: claimed && row ? row : null }
}

/** Requeue job with backoff: set Status='queued', ErrorMessage, LastErrorAt, NextAttemptAt, clear lease. */
export async function requeueExportJobWithBackoff(
  jobId: number,
  leaseId: string,
  errorMessage: string,
  nextAttemptAt: Date,
  lastErrorAt: Date
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('LeaseId', sql.UniqueIdentifier, leaseId)
    .input('ErrorMessage', sql.NVarChar(1000), errorMessage)
    .input('NextAttemptAt', sql.DateTime2, nextAttemptAt)
    .input('LastErrorAt', sql.DateTime2, lastErrorAt)
    .query(`
      UPDATE dbo.ExportJobs
      SET Status = 'queued', ErrorMessage = @ErrorMessage, LastErrorAt = @LastErrorAt,
          NextAttemptAt = @NextAttemptAt, LeaseId = NULL, LeasedUntil = NULL
      WHERE Id = @Id AND LeaseId = @LeaseId
    `)
}

/** Extend lease while job is running. */
export async function heartbeatExportJob(
  jobId: number,
  leaseId: string,
  newLeasedUntil: Date
): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('LeaseId', sql.UniqueIdentifier, leaseId)
    .input('LeasedUntil', sql.DateTime2, newLeasedUntil)
    .query(`
      UPDATE dbo.ExportJobs
      SET LeasedUntil = @LeasedUntil
      WHERE Id = @Id AND LeaseId = @LeaseId AND Status = 'running'
    `)
  return result.rowsAffected[0] === 1
}

/** Clear lease when job reaches terminal state (only if lease matches). */
export async function clearLeaseOnTerminal(
  jobId: number,
  leaseId: string
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('LeaseId', sql.UniqueIdentifier, leaseId)
    .query(`
      UPDATE dbo.ExportJobs
      SET LeaseId = NULL, LeasedUntil = NULL
      WHERE Id = @Id AND LeaseId = @LeaseId
    `)
}

export interface InsertExportJobItemInput {
  jobId: number
  relativePath: string
  sourceType: string
  sourceId?: number | null
  byteSize?: number | null
}

/** List relative paths of items for a job (for idempotency check). */
export async function getExportJobItemsForJob(
  jobId: number
): Promise<{ RelativePath: string }[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('JobId', sql.Int, jobId)
    .query(`
      SELECT RelativePath FROM dbo.ExportJobItems WHERE JobId = @JobId
    `)
  return (result.recordset as { RelativePath: string }[]) ?? []
}

/** Insert one ExportJobItem; RelativePathHash computed in SQL. */
export async function insertExportJobItem(
  input: InsertExportJobItemInput
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('JobId', sql.Int, input.jobId)
    .input('RelativePath', sql.NVarChar(1000), input.relativePath)
    .input('SourceType', sql.NVarChar(40), input.sourceType)
    .input('SourceId', sql.Int, input.sourceId ?? null)
    .input('ByteSize', sql.BigInt, input.byteSize ?? null)
    .query(`
      INSERT INTO dbo.ExportJobItems (JobId, RelativePath, RelativePathHash, SourceType, SourceId, ItemStatus, ByteSize)
      VALUES (
        @JobId,
        @RelativePath,
        HASHBYTES('SHA2_256', CONVERT(VARBINARY(MAX), @RelativePath)),
        @SourceType,
        @SourceId,
        'completed',
        @ByteSize
      )
    `)
}

export async function updateExportJobCompleted(
  jobId: number,
  fileName: string,
  filePath: string,
  leaseId: string | null
): Promise<void> {
  const pool = await poolPromise
  const completedAt = new Date()
  const expiresAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)
  const req = pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('CompletedAt', sql.DateTime2, completedAt)
    .input('ExpiresAt', sql.DateTime2, expiresAt)
    .input('FileName', sql.NVarChar(255), fileName)
    .input('FilePath', sql.NVarChar(500), filePath)
    .input('Progress', sql.Int, 100)
  if (leaseId != null) {
    req.input('LeaseId', sql.UniqueIdentifier, leaseId)
  }
  const whereClause =
    leaseId != null
      ? 'WHERE Id = @Id AND (LeaseId = @LeaseId OR LeaseId IS NULL)'
      : 'WHERE Id = @Id'
  await req.query(`
      UPDATE dbo.ExportJobs
      SET Status = 'completed', CompletedAt = @CompletedAt, ExpiresAt = @ExpiresAt,
          FileName = @FileName, FilePath = @FilePath, Progress = @Progress,
          LeaseId = NULL, LeasedUntil = NULL
      ${whereClause}
    `)
}

/** Mark job as failed (terminal) or requeue with backoff. BackoffSeconds used when AttemptCount < MaxAttempts. */
export async function updateExportJobFailed(
  jobId: number,
  errorMessage: string,
  leaseId: string | null,
  backoffSeconds: number
): Promise<void> {
  const pool = await poolPromise
  const completedAt = new Date()
  const expiresAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)
  const req = pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('CompletedAt', sql.DateTime2, completedAt)
    .input('ExpiresAt', sql.DateTime2, expiresAt)
    .input('ErrorMessage', sql.NVarChar(1000), errorMessage)
    .input('BackoffSeconds', sql.Int, backoffSeconds)
  if (leaseId != null) {
    req.input('LeaseId', sql.UniqueIdentifier, leaseId)
  }
  const whereClause =
    leaseId != null
      ? 'WHERE Id = @Id AND (LeaseId = @LeaseId OR LeaseId IS NULL)'
      : 'WHERE Id = @Id'
  await req.query(`
      UPDATE dbo.ExportJobs
      SET Status = CASE WHEN AttemptCount >= ISNULL(MaxAttempts, 3) THEN 'failed' ELSE 'queued' END,
          NextAttemptAt = CASE WHEN AttemptCount < ISNULL(MaxAttempts, 3) THEN DATEADD(SECOND, @BackoffSeconds, SYSUTCDATETIME()) ELSE NULL END,
          LastErrorAt = SYSUTCDATETIME(),
          ErrorMessage = @ErrorMessage,
          LeaseId = NULL, LeasedUntil = NULL,
          CompletedAt = CASE WHEN AttemptCount >= ISNULL(MaxAttempts, 3) THEN @CompletedAt ELSE CompletedAt END,
          ExpiresAt = CASE WHEN AttemptCount >= ISNULL(MaxAttempts, 3) THEN @ExpiresAt ELSE ExpiresAt END
      ${whereClause}
    `)
}

export async function updateExportJobCancelled(jobId: number): Promise<void> {
  const pool = await poolPromise
  const completedAt = new Date()
  const expiresAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)
  await pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('CompletedAt', sql.DateTime2, completedAt)
    .input('ExpiresAt', sql.DateTime2, expiresAt)
    .query(`
      UPDATE dbo.ExportJobs
      SET Status = 'cancelled', CompletedAt = @CompletedAt, ExpiresAt = @ExpiresAt,
          LeaseId = NULL, LeasedUntil = NULL
      WHERE Id = @Id
    `)
}

/** Reset a failed job for retry: set status to queued, clear error and completion and lease fields. */
export async function updateExportJobResetForRetry(jobId: number): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('Id', sql.Int, jobId)
    .query(`
      UPDATE dbo.ExportJobs
      SET Status = 'queued', ErrorMessage = NULL, Progress = 0,
          CompletedAt = NULL, ExpiresAt = NULL, FileName = NULL, FilePath = NULL,
          LeaseId = NULL, LeasedUntil = NULL
      WHERE Id = @Id
    `)
}

/** List jobs for cleanup: completed/failed/cancelled with ExpiresAt < cutoff */
export async function listExportJobsForCleanup(
  cutoff: Date
): Promise<{ Id: number; FilePath: string | null }[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('Cutoff', sql.DateTime2, cutoff)
    .query(`
      SELECT Id, FilePath
      FROM dbo.ExportJobs
      WHERE ExpiresAt IS NOT NULL AND ExpiresAt < @Cutoff
    `)
  return (result.recordset as { Id: number; FilePath: string | null }[]) ?? []
}
