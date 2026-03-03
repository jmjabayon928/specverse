// src/backend/database/importJobQueries.ts
import { poolPromise, sql } from '../config/db'

export type ImportJobStatus =
  | 'preview_created'
  | 'preview_complete'
  | 'running'
  | 'succeeded'
  | 'failed'

export interface ImportJobRow {
  ImportJobID: number
  AccountID: number
  JobStatus: string
  JobMode: string | null
  SourceFileName: string | null
  SourceFileSha256: string | null
  StartedByUserID: number | null
  StartedAt: Date | null
  CompletedAt: Date | null
  TotalRows: number | null
  CreatedCount: number | null
  UpdatedCount: number | null
  SkippedCount: number | null
  ErrorCount: number | null
  ParamsJson: string | null
  ErrorSummary: string | null
  CreatedAt: Date
  UpdatedAt: Date | null
}

export interface InsertImportJobInput {
  accountId: number
  jobStatus: ImportJobStatus
  jobMode?: string | null
  sourceFileName?: string | null
  sourceFileSha256?: string | null
  startedByUserID?: number | null
  paramsJson?: string | null
}

export async function insertImportJob(
  input: InsertImportJobInput
): Promise<number> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, input.accountId)
    .input('JobStatus', sql.NVarChar(50), input.jobStatus)
    .input('JobMode', sql.NVarChar(50), input.jobMode ?? 'preview')
    .input('SourceFileName', sql.NVarChar(500), input.sourceFileName ?? null)
    .input('SourceFileSha256', sql.Char(64), input.sourceFileSha256 ?? null)
    .input('StartedByUserID', sql.Int, input.startedByUserID ?? null)
    .input('ParamsJson', sql.NVarChar(sql.MAX), input.paramsJson ?? null)
    .query(`
      INSERT INTO dbo.ImportJobs (AccountID, JobStatus, JobMode, SourceFileName, SourceFileSha256, StartedByUserID, ParamsJson)
      OUTPUT INSERTED.ImportJobID
      VALUES (@AccountID, @JobStatus, @JobMode, @SourceFileName, @SourceFileSha256, @StartedByUserID, @ParamsJson)
    `)
  const row = result.recordset[0] as { ImportJobID: number }
  return row.ImportJobID
}

/**
 * Atomic transition: set JobStatus to 'running' only if currently 'preview_complete'.
 * Returns number of rows updated (0 or 1). Race-safe for double-run.
 */
export async function trySetJobRunning(
  jobId: number,
  accountId: number
): Promise<number> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('ImportJobID', sql.Int, jobId)
    .input('AccountID', sql.Int, accountId)
    .query(`
      UPDATE dbo.ImportJobs
      SET JobStatus = 'running', StartedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
      WHERE ImportJobID = @ImportJobID AND AccountID = @AccountID AND JobStatus = 'preview_complete'
    `)
  return result.rowsAffected?.[0] ?? 0
}

export async function getImportJobById(
  jobId: number
): Promise<ImportJobRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('ImportJobID', sql.Int, jobId)
    .query(`
      SELECT ImportJobID, AccountID, JobStatus, JobMode, SourceFileName, SourceFileSha256,
             StartedByUserID, StartedAt, CompletedAt, TotalRows, CreatedCount, UpdatedCount,
             SkippedCount, ErrorCount, ParamsJson, ErrorSummary, CreatedAt, UpdatedAt
      FROM dbo.ImportJobs
      WHERE ImportJobID = @ImportJobID
    `)
  const row = result.recordset[0] as ImportJobRow | undefined
  return row ?? null
}

export async function updateImportJob(
  jobId: number,
  updates: {
    jobStatus?: ImportJobStatus
    startedAt?: Date | null
    completedAt?: Date | null
    totalRows?: number | null
    createdCount?: number | null
    updatedCount?: number | null
    skippedCount?: number | null
    errorCount?: number | null
    paramsJson?: string | null
    errorSummary?: string | null
  }
): Promise<void> {
  const pool = await poolPromise
  const request = pool.request().input('ImportJobID', sql.Int, jobId)
  const setClauses: string[] = ['UpdatedAt = GETUTCDATE()']

  if (updates.jobStatus !== undefined) {
    request.input('JobStatus', sql.NVarChar(50), updates.jobStatus)
    setClauses.push('JobStatus = @JobStatus')
  }
  if (updates.startedAt !== undefined) {
    request.input('StartedAt', sql.DateTime2, updates.startedAt)
    setClauses.push('StartedAt = @StartedAt')
  }
  if (updates.completedAt !== undefined) {
    request.input('CompletedAt', sql.DateTime2, updates.completedAt)
    setClauses.push('CompletedAt = @CompletedAt')
  }
  if (updates.totalRows !== undefined) {
    request.input('TotalRows', sql.Int, updates.totalRows)
    setClauses.push('TotalRows = @TotalRows')
  }
  if (updates.createdCount !== undefined) {
    request.input('CreatedCount', sql.Int, updates.createdCount)
    setClauses.push('CreatedCount = @CreatedCount')
  }
  if (updates.updatedCount !== undefined) {
    request.input('UpdatedCount', sql.Int, updates.updatedCount)
    setClauses.push('UpdatedCount = @UpdatedCount')
  }
  if (updates.skippedCount !== undefined) {
    request.input('SkippedCount', sql.Int, updates.skippedCount)
    setClauses.push('SkippedCount = @SkippedCount')
  }
  if (updates.errorCount !== undefined) {
    request.input('ErrorCount', sql.Int, updates.errorCount)
    setClauses.push('ErrorCount = @ErrorCount')
  }
  if (updates.paramsJson !== undefined) {
    request.input('ParamsJson', sql.NVarChar(sql.MAX), updates.paramsJson)
    setClauses.push('ParamsJson = @ParamsJson')
  }
  if (updates.errorSummary !== undefined) {
    request.input('ErrorSummary', sql.NVarChar(2000), updates.errorSummary)
    setClauses.push('ErrorSummary = @ErrorSummary')
  }

  await request.query(
    `UPDATE dbo.ImportJobs SET ${setClauses.join(', ')} WHERE ImportJobID = @ImportJobID`
  )
}
