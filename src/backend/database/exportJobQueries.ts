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
             ErrorMessage, FileName, FilePath
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

export async function updateExportJobCompleted(
  jobId: number,
  fileName: string,
  filePath: string
): Promise<void> {
  const pool = await poolPromise
  const completedAt = new Date()
  const expiresAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)
  await pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('CompletedAt', sql.DateTime2, completedAt)
    .input('ExpiresAt', sql.DateTime2, expiresAt)
    .input('FileName', sql.NVarChar(255), fileName)
    .input('FilePath', sql.NVarChar(500), filePath)
    .input('Progress', sql.Int, 100)
    .query(`
      UPDATE dbo.ExportJobs
      SET Status = 'completed', CompletedAt = @CompletedAt, ExpiresAt = @ExpiresAt,
          FileName = @FileName, FilePath = @FilePath, Progress = @Progress
      WHERE Id = @Id
    `)
}

export async function updateExportJobFailed(
  jobId: number,
  errorMessage: string
): Promise<void> {
  const pool = await poolPromise
  const completedAt = new Date()
  const expiresAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)
  await pool
    .request()
    .input('Id', sql.Int, jobId)
    .input('CompletedAt', sql.DateTime2, completedAt)
    .input('ExpiresAt', sql.DateTime2, expiresAt)
    .input('ErrorMessage', sql.NVarChar(1000), errorMessage)
    .query(`
      UPDATE dbo.ExportJobs
      SET Status = 'failed', CompletedAt = @CompletedAt, ExpiresAt = @ExpiresAt,
          ErrorMessage = @ErrorMessage
      WHERE Id = @Id
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
      SET Status = 'cancelled', CompletedAt = @CompletedAt, ExpiresAt = @ExpiresAt
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
