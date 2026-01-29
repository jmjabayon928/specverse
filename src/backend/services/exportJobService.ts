// src/backend/services/exportJobService.ts
import path from 'path'
import fs from 'fs/promises'
import jwt from 'jsonwebtoken'
import {
  insertExportJob,
  getExportJobById,
  updateExportJobRunning,
  updateExportJobCompleted,
  updateExportJobFailed,
  updateExportJobCancelled,
  listExportJobsForCleanup,
  type ExportJobRow,
  type ExportJobStatus,
} from '../database/exportJobQueries'
import {
  getInventoryTransactionsPaged,
  getInventoryTransactionsForCsv,
  type InventoryTransactionFilters,
} from '../database/inventoryTransactionQueries'
import type { InventoryTransactionDTO } from '@/domain/inventory/inventoryTypes'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables')
}

const EXPORT_JOBS_DIR = path.join(process.cwd(), 'exports', 'jobs')
const CSV_LIMIT = 10000
const DOWNLOAD_TOKEN_EXPIRES_IN = '5m'

export interface StartExportJobParams {
  jobType: string
  params: Record<string, unknown>
  userId: number
}

export interface ExportJobStatusDTO {
  jobId: number
  jobType: string
  status: string
  progress: number
  createdAt: string
  completedAt: string | null
  expiresAt: string | null
  errorMessage: string | null
  fileName: string | null
}

export interface DownloadTokenPayload {
  jobId: number
  userId: number
}

function rowToStatusDto(row: ExportJobRow): ExportJobStatusDTO {
  return {
    jobId: row.Id,
    jobType: row.JobType,
    status: row.Status,
    progress: row.Progress,
    createdAt: row.CreatedAt.toISOString(),
    completedAt: row.CompletedAt ? row.CompletedAt.toISOString() : null,
    expiresAt: row.ExpiresAt ? row.ExpiresAt.toISOString() : null,
    errorMessage: row.ErrorMessage,
    fileName: row.FileName,
  }
}

async function ensureExportJobsDir(): Promise<void> {
  await fs.mkdir(EXPORT_JOBS_DIR, { recursive: true })
}

/** Pre-check: for inventory_transactions_csv, enforce 10k limit. Returns error message or null. */
async function preCheckInventoryTransactionsCsv(
  params: Record<string, unknown>
): Promise<{ allowed: boolean; message?: string }> {
  const filters = paramsToInventoryFilters(params)
  const { total } = await getInventoryTransactionsPaged(filters, 1, 1)
  if (total > CSV_LIMIT) {
    return {
      allowed: false,
      message:
        'CSV export limit exceeded. Maximum 10,000 rows allowed. Please apply additional filters to reduce the result set.',
    }
  }
  return { allowed: true }
}

function paramsToInventoryFilters(
  params: Record<string, unknown>
): InventoryTransactionFilters {
  return {
    warehouseId:
      typeof params.warehouseId === 'number'
        ? params.warehouseId
        : undefined,
    itemId: typeof params.itemId === 'number' ? params.itemId : undefined,
    transactionType:
      typeof params.transactionType === 'string'
        ? params.transactionType
        : undefined,
    dateFrom:
      params.dateFrom instanceof Date
        ? params.dateFrom
        : typeof params.dateFrom === 'string'
          ? new Date(params.dateFrom)
          : undefined,
    dateTo:
      params.dateTo instanceof Date
        ? params.dateTo
        : typeof params.dateTo === 'string'
          ? new Date(params.dateTo)
          : undefined,
  }
}

function buildInventoryTransactionsCsv(rows: InventoryTransactionDTO[]): string {
  const headers = [
    'Transaction ID',
    'Item ID',
    'Item Name',
    'Warehouse ID',
    'Warehouse Name',
    'Quantity Changed',
    'Transaction Type',
    'Performed At',
    'Performed By',
  ]
  const escapeCsvField = (field: unknown): string => {
    if (field === null || field === undefined) return ''
    const str = String(field)
    if (
      str.includes(',') ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      [
        escapeCsvField(row.transactionId),
        escapeCsvField(row.itemId),
        escapeCsvField(row.itemName),
        escapeCsvField(row.warehouseId),
        escapeCsvField(row.warehouseName),
        escapeCsvField(row.quantityChanged),
        escapeCsvField(row.transactionType),
        escapeCsvField(row.performedAt),
        escapeCsvField(row.performedBy),
      ].join(',')
    ),
  ]
  return csvRows.join('\n')
}

/** Start a new export job; enqueues execution via setImmediate. Returns jobId. */
export async function startExportJob(
  input: StartExportJobParams
): Promise<{ jobId: number; status: ExportJobStatus; createdAt: string }> {
  if (input.jobType === 'inventory_transactions_csv') {
    const check = await preCheckInventoryTransactionsCsv(input.params)
    if (!check.allowed) {
      const err = new Error(check.message) as Error & { statusCode?: number }
      err.statusCode = 413
      throw err
    }
  }

  const paramsJson =
    Object.keys(input.params).length > 0
      ? JSON.stringify(input.params)
      : null
  const jobId = await insertExportJob({
    jobType: input.jobType,
    status: 'queued',
    progress: 0,
    paramsJson,
    createdBy: input.userId,
  })

  setImmediate(() => {
    runExportJob(jobId).catch((err) => {
      console.error('Export job failed:', jobId, err)
    })
  })

  const row = await getExportJobById(jobId)
  const createdAt = row?.CreatedAt.toISOString() ?? new Date().toISOString()
  return { jobId, status: 'queued', createdAt }
}

/** Get job status by id. Returns null if not found. */
export async function getExportJobStatus(
  jobId: number
): Promise<ExportJobStatusDTO | null> {
  const row = await getExportJobById(jobId)
  if (!row) return null
  return rowToStatusDto(row)
}

/** Run the export job (worker): generate file, write to disk, update row. */
export async function runExportJob(jobId: number): Promise<void> {
  const row = await getExportJobById(jobId)
  if (!row || row.Status !== 'queued') return

  await updateExportJobRunning(jobId)

  try {
    if (row.JobType === 'inventory_transactions_csv') {
      const params = row.ParamsJson
        ? (JSON.parse(row.ParamsJson) as Record<string, unknown>)
        : {}
      const filters = paramsToInventoryFilters(params)
      const rows = await getInventoryTransactionsForCsv(filters, CSV_LIMIT)
      const csv = buildInventoryTransactionsCsv(rows)
      await ensureExportJobsDir()
      const fileName = `inventory-transactions-${jobId}.csv`
      const filePath = path.join(EXPORT_JOBS_DIR, fileName)
      await fs.writeFile(filePath, csv, 'utf8')
      const relativePath = `jobs/${fileName}`
      await updateExportJobCompleted(jobId, fileName, relativePath)
    } else {
      await updateExportJobFailed(
        jobId,
        `Unsupported job type: ${row.JobType}`
      )
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Export failed'
    await updateExportJobFailed(jobId, message)
  }
}

/** Resolve absolute file path for a completed job. Returns null if expired, file missing, or path unsafe. */
export async function resolveExportFilePath(
  jobId: number
): Promise<{ absolutePath: string; fileName: string } | null> {
  const row = await getExportJobById(jobId)
  if (!row || row.Status !== 'completed' || !row.FilePath || !row.FileName)
    return null
  if (row.ExpiresAt && new Date() > row.ExpiresAt) return null
  const stored = row.FilePath
  if (path.isAbsolute(stored) || stored.includes('..')) return null
  const basename = path.basename(stored)
  const absolutePath = path.join(EXPORT_JOBS_DIR, basename)
  const resolved = path.resolve(absolutePath)
  const root = path.resolve(EXPORT_JOBS_DIR)
  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  try {
    await fs.access(resolved)
  } catch {
    return null
  }
  return { absolutePath: resolved, fileName: row.FileName }
}

/** Generate a short-lived JWT for download (jobId + userId). */
export function generateDownloadToken(jobId: number, userId: number): string {
  const payload: DownloadTokenPayload = { jobId, userId }
  return jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: DOWNLOAD_TOKEN_EXPIRES_IN,
  })
}

/** Verify download token; returns payload or null. */
export function verifyDownloadToken(
  token: string
): DownloadTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as unknown
    if (
      decoded &&
      typeof decoded === 'object' &&
      'jobId' in decoded &&
      'userId' in decoded &&
      typeof (decoded as DownloadTokenPayload).jobId === 'number' &&
      typeof (decoded as DownloadTokenPayload).userId === 'number'
    ) {
      return decoded as DownloadTokenPayload
    }
    return null
  } catch {
    return null
  }
}

/** Cancel a job (queued or running). Returns true if cancelled. */
export async function cancelExportJob(jobId: number): Promise<boolean> {
  const row = await getExportJobById(jobId)
  if (!row) return false
  if (row.Status !== 'queued' && row.Status !== 'running') return false
  await updateExportJobCancelled(jobId)
  return true
}

/** Cleanup expired jobs: delete files and optionally clear FilePath. */
export async function cleanupExpiredExportJobs(): Promise<{
  deletedFiles: number
}> {
  const cutoff = new Date()
  const jobs = await listExportJobsForCleanup(cutoff)
  let deletedFiles = 0
  for (const job of jobs) {
    if (job.FilePath) {
      const absolutePath = path.join(
        EXPORT_JOBS_DIR,
        path.basename(job.FilePath)
      )
      try {
        await fs.unlink(absolutePath)
        deletedFiles += 1
      } catch {
        // ignore missing file
      }
    }
  }
  return { deletedFiles }
}
