// src/backend/services/exportJobService.ts
import path from 'path'
import fs from 'fs/promises'
import { createWriteStream, existsSync } from 'fs'
import { Readable, Transform } from 'stream'
import jwt from 'jsonwebtoken'
import archiver from 'archiver'
import { randomUUID } from 'crypto'
import {
  insertExportJob,
  getExportJobById,
  claimExportJob,
  claimNextExportJob,
  heartbeatExportJob,
  updateExportJobCompleted,
  updateExportJobFailed,
  updateExportJobCancelled,
  updateExportJobResetForRetry,
  listExportJobsForCleanup,
  getExportJobItemsForJob,
  insertExportJobItem,
  type ExportJobRow,
  type ExportJobStatus,
} from '../database/exportJobQueries'
import {
  getInventoryTransactionsPaged,
  getInventoryTransactionsForCsv,
  type InventoryTransactionFilters,
} from '../database/inventoryTransactionQueries'
import type { InventoryTransactionDTO } from '@/domain/inventory/inventoryTypes'
import { getAssetById } from './assetsService'
import { listChecklistRunsByAssetId } from './checklistsService'
import { fetchAssetDocuments } from './assetDocumentsService'
import { fetchFilledSheetsForAsset } from './filledSheetService'
import { getAccountContextForUser } from '../database/accountContextQueries'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables')
}

const EXPORT_JOBS_DIR = path.join(process.cwd(), 'exports', 'jobs')
const CSV_LIMIT = 10000
const DOWNLOAD_TOKEN_EXPIRES_IN = '5m'
const LEASE_TTL_MS = 5 * 60 * 1000
const HEARTBEAT_INTERVAL_MS = 60 * 1000

/** Normalize relative path for deterministic manifest: forward slashes, trim leading slashes. Rejects ".." segments. */
function normalizeRelativePath(relativePath: string): string {
  if (relativePath.includes('..')) {
    throw new Error('Relative path must not contain ".."')
  }
  const normalized = relativePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
  return normalized || relativePath
}

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

const CSV_HEADERS = [
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

function escapeCsvField(field: unknown): string {
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

function csvLine(row: InventoryTransactionDTO): string {
  return [
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
}

/** Create a readable stream of CSV (header + one line per row). Avoids building one big string in memory. */
function createInventoryTransactionsCsvStream(
  rows: InventoryTransactionDTO[]
): Readable {
  const headerLine = CSV_HEADERS.join(',')
  let index = 0
  let headerSent = false
  const stream = new Readable({
    objectMode: false,
    read() {
      if (!headerSent) {
        headerSent = true
        this.push(headerLine + '\n')
        return
      }
      if (index >= rows.length) {
        this.push(null)
        return
      }
      this.push(csvLine(rows[index]) + '\n')
      index += 1
    },
  })
  return stream
}

/** Backoff seconds by attempt index (0-based): 30, 120, 600. */
function backoffSecondsForAttempt(attemptCount: number): number {
  const backoff = [30, 120, 600]
  return backoff[Math.min(attemptCount, backoff.length - 1)] ?? 600
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

  if (process.env.NODE_ENV !== 'test') {
    setImmediate(() => {
      void runExportJob(jobId).catch((err) => {
        console.error('Export job failed:', jobId, err)
      })
    })
  }

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

/** Run a job that is already claimed. Used by runner and by runExportJob after claim. */
export async function runClaimedExportJob(row: ExportJobRow, leaseId: string): Promise<void> {
  const jobId = row.Id
  if (process.env.NODE_ENV !== 'test') {
    console.log(JSON.stringify({ msg: 'export_job_start', jobId, leaseId }))
  }

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  const scheduleHeartbeat = (): void => {
    heartbeatTimer = setInterval(async () => {
      try {
        const nextUntil = new Date(Date.now() + LEASE_TTL_MS)
        const ok = await heartbeatExportJob(jobId, leaseId, nextUntil)
        if (!ok && process.env.NODE_ENV !== 'test') {
          console.warn(JSON.stringify({ msg: 'export_job_heartbeat_failed', jobId, leaseId }))
        }
      } catch (heartbeatErr) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            JSON.stringify({
              msg: 'export_job_heartbeat_error',
              jobId,
              leaseId,
              error: heartbeatErr instanceof Error ? heartbeatErr.message : String(heartbeatErr),
            })
          )
        }
      }
    }, HEARTBEAT_INTERVAL_MS)
  }
  scheduleHeartbeat()

  const attemptCount = row.AttemptCount ?? 0

  try {
    if (row.JobType === 'inventory_transactions_csv') {
      const zipFileName = `export-${jobId}.zip`
      const expectedRelativePath = `jobs/${zipFileName}`
      const entryName = 'inventory_transactions/transactions.csv'
      const normalizedEntry = normalizeRelativePath(entryName)

      if (
        row.Status === 'running' &&
        row.LeaseId === leaseId &&
        row.FileName === zipFileName &&
        row.FilePath === expectedRelativePath
      ) {
        const stored = row.FilePath
        if (!path.isAbsolute(stored) && !stored.includes('..')) {
          const basename = path.basename(stored)
          const absolutePath = path.join(EXPORT_JOBS_DIR, basename)
          const resolved = path.resolve(absolutePath)
          const root = path.resolve(EXPORT_JOBS_DIR)
          const relative = path.relative(root, resolved)
          if (!relative.startsWith('..') && !path.isAbsolute(relative) && existsSync(resolved)) {
            await updateExportJobCompleted(jobId, zipFileName, expectedRelativePath, leaseId)
            const items = await getExportJobItemsForJob(jobId)
            const hasEntry = items.some((i) => i.RelativePath === normalizedEntry)
            if (!hasEntry) {
              await insertExportJobItem({
                jobId,
                relativePath: normalizedEntry,
                sourceType: 'inventory_transactions_csv',
                sourceId: null,
                byteSize: null,
              })
            }
            if (process.env.NODE_ENV !== 'test') {
              console.log(JSON.stringify({ msg: 'export_job_complete_skip_regenerate', jobId, leaseId }))
            }
            return
          }
        }
      }

      const params = row.ParamsJson
        ? (JSON.parse(row.ParamsJson) as Record<string, unknown>)
        : {}
      const filters = paramsToInventoryFilters(params)
      const rows = await getInventoryTransactionsForCsv(filters, CSV_LIMIT)
      await ensureExportJobsDir()

      const zipFilePath = path.join(EXPORT_JOBS_DIR, zipFileName)

      const csvStream = createInventoryTransactionsCsvStream(rows)
      const byteCounter = new Transform({
        transform(chunk: Buffer | string, _enc, cb) {
          ;(this as Transform & { _bytes: number })._bytes =
            ((this as Transform & { _bytes: number })._bytes || 0) + chunk.length
          cb(null, chunk)
        },
      })
      ;(byteCounter as Transform & { _bytes: number })._bytes = 0
      csvStream.pipe(byteCounter)

      const output = createWriteStream(zipFilePath)
      const archive = archiver('zip', { zlib: { level: 9 } })
      archive.pipe(output)
      archive.append(byteCounter, { name: normalizedEntry })
      archive.finalize()

      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve())
        archive.on('error', reject)
        output.on('error', reject)
      })

      const csvByteSize = (byteCounter as Transform & { _bytes?: number })._bytes ?? null
      await insertExportJobItem({
        jobId,
        relativePath: normalizedEntry,
        sourceType: 'inventory_transactions_csv',
        sourceId: null,
        byteSize: csvByteSize ?? undefined,
      })

      const relativePath = `jobs/${zipFileName}`
      await updateExportJobCompleted(jobId, zipFileName, relativePath, leaseId)

      if (process.env.NODE_ENV !== 'test') {
        console.log(JSON.stringify({ msg: 'export_job_complete', jobId, leaseId }))
      }
    } else if (row.JobType === 'handover_binder') {
      const zipFileName = `handover-binder-${jobId}.zip`
      const expectedRelativePath = `jobs/${zipFileName}`

      // Check if already completed (reuse existing zip if present)
      if (
        row.Status === 'running' &&
        row.LeaseId === leaseId &&
        row.FileName === zipFileName &&
        row.FilePath === expectedRelativePath
      ) {
        const stored = row.FilePath
        if (!path.isAbsolute(stored) && !stored.includes('..')) {
          const basename = path.basename(stored)
          const absolutePath = path.join(EXPORT_JOBS_DIR, basename)
          const resolved = path.resolve(absolutePath)
          const root = path.resolve(EXPORT_JOBS_DIR)
          const relative = path.relative(root, resolved)
          if (!relative.startsWith('..') && !path.isAbsolute(relative) && existsSync(resolved)) {
            // Verify manifest.json exists in ExportJobItems (sanity check)
            const items = await getExportJobItemsForJob(jobId)
            const hasManifest = items.some((i) => i.RelativePath === normalizeRelativePath('manifest.json'))
            if (hasManifest) {
              await updateExportJobCompleted(jobId, zipFileName, expectedRelativePath, leaseId)
              if (process.env.NODE_ENV !== 'test') {
                console.log(JSON.stringify({ msg: 'export_job_complete_skip_regenerate', jobId, leaseId }))
              }
              return
            }
          }
        }
      }

      // Parse params with validation
      let params: Record<string, unknown> = {}
      try {
        params = row.ParamsJson ? (JSON.parse(row.ParamsJson) as Record<string, unknown>) : {}
      } catch {
        await updateExportJobFailed(
          jobId,
          'Invalid ParamsJson format',
          leaseId,
          backoffSecondsForAttempt(attemptCount)
        )
        return
      }

      const assetIdRaw = params.assetId
      const assetId = typeof assetIdRaw === 'number' && Number.isInteger(assetIdRaw) && assetIdRaw > 0 ? assetIdRaw : null

      if (!assetId) {
        await updateExportJobFailed(
          jobId,
          'Missing or invalid assetId parameter (must be positive integer)',
          leaseId,
          backoffSecondsForAttempt(attemptCount)
        )
        return
      }

      // Get accountId - prefer from row, otherwise query from user
      let accountId = row.AccountID ?? null
      if (!accountId) {
        const accountContext = await getAccountContextForUser(row.CreatedBy)
        if (!accountContext) {
          await updateExportJobFailed(
            jobId,
            'Unable to determine account context',
            leaseId,
            backoffSecondsForAttempt(attemptCount)
          )
          return
        }
        accountId = accountContext.accountId
      }

      await ensureExportJobsDir()
      const zipFilePath = path.join(EXPORT_JOBS_DIR, zipFileName)
      const output = createWriteStream(zipFilePath)
      const archive = archiver('zip', { zlib: { level: 9 } })
      archive.pipe(output)

      const manifest: {
        exportType: string
        assetId: number
        assetTag: string | null
        exportedAt: string
        sections: {
          asset: { file: string; included: boolean }
          checklists: { file: string; count: number; included: boolean }
          documents: { file: string; count: number; included: boolean }
          datasheets: { file: string; count: number; included: boolean }
        }
      } = {
        exportType: 'handover_binder',
        assetId,
        assetTag: null,
        exportedAt: new Date().toISOString(),
        sections: {
          asset: { file: 'asset-summary.json', included: false },
          checklists: { file: 'checklists/index.json', count: 0, included: false },
          documents: { file: 'documents/index.json', count: 0, included: false },
          datasheets: { file: 'datasheets/index.json', count: 0, included: false },
        },
      }

      try {
        // Helper to safely add file to archive and track in ExportJobItems
        const addFileToArchive = async (
          content: string,
          relativePath: string,
          sourceId: number | null
        ): Promise<void> => {
          const normalizedPath = normalizeRelativePath(relativePath)
          archive.append(content, { name: normalizedPath })
          const byteSize = Buffer.byteLength(content, 'utf8')
          await insertExportJobItem({
            jobId,
            relativePath: normalizedPath,
            sourceType: 'handover_binder',
            sourceId,
            byteSize,
          })
        }

        // 1. Collect asset summary (required - fail if missing)
        const asset = await getAssetById(accountId, assetId)
        if (!asset) {
          await updateExportJobFailed(
            jobId,
            `Asset ${assetId} not found or access denied`,
            leaseId,
            backoffSecondsForAttempt(attemptCount)
          )
          return
        }

        manifest.assetTag = asset.assetTag
        const assetSummary = {
          assetId: asset.assetId,
          assetTag: asset.assetTag,
          assetName: asset.assetName,
          location: asset.location,
          system: asset.system,
          service: asset.service,
          criticality: asset.criticality,
          disciplineId: asset.disciplineId,
          subtypeId: asset.subtypeId,
          clientId: asset.clientId,
          projectId: asset.projectId,
          facilityId: asset.facilityId,
          facilityName: asset.facilityName,
          systemId: asset.systemId,
          systemName: asset.systemName,
          createdAt: asset.createdAt instanceof Date ? asset.createdAt.toISOString() : String(asset.createdAt),
          updatedAt: asset.updatedAt instanceof Date ? asset.updatedAt.toISOString() : String(asset.updatedAt),
        }
        await addFileToArchive(JSON.stringify(assetSummary, null, 2), 'asset-summary.json', assetId)
        manifest.sections.asset.included = true

        // 2. Collect checklists (paginate with safety limit)
        try {
          const checklistRuns: unknown[] = []
          let checklistPage = 1
          const checklistPageSize = 100
          const maxChecklistPages = 1000 // Safety limit: 100k checklists max
          while (checklistPage <= maxChecklistPages) {
            const checklistResult = await listChecklistRunsByAssetId(accountId, assetId, checklistPage, checklistPageSize)
            checklistRuns.push(...checklistResult.items)
            if (checklistRuns.length >= checklistResult.total || checklistResult.items.length === 0) break
            checklistPage++
          }
          manifest.sections.checklists.count = checklistRuns.length
          manifest.sections.checklists.included = true

          const checklistIndex = {
            total: checklistRuns.length,
            runs: checklistRuns.map((run) => ({
              checklistRunId: (run as { checklistRunId: number }).checklistRunId,
              runName: (run as { runName: string }).runName,
              status: (run as { status: string }).status,
              createdAt: (run as { createdAt: string }).createdAt,
              checklistTemplateId: (run as { checklistTemplateId: number }).checklistTemplateId,
              totalEntries: (run as { totalEntries: number }).totalEntries,
              completedEntries: (run as { completedEntries: number }).completedEntries,
              completionPercentage: (run as { completionPercentage: number }).completionPercentage,
            })),
          }
          await addFileToArchive(JSON.stringify(checklistIndex, null, 2), 'checklists/index.json', assetId)
        } catch (checklistErr) {
          // Log but continue - partial export is acceptable
          if (process.env.NODE_ENV !== 'test') {
            console.warn(JSON.stringify({ msg: 'binder_checklist_collection_failed', jobId, error: checklistErr instanceof Error ? checklistErr.message : String(checklistErr) }))
          }
          manifest.sections.checklists.included = false
        }

        // 3. Collect documents (paginate with safety limit)
        try {
          const documents: unknown[] = []
          let documentSkip = 0
          const documentTake = 100
          const maxDocumentPages = 1000 // Safety limit: 100k documents max
          let documentPageCount = 0
          while (documentPageCount < maxDocumentPages) {
            const documentResult = await fetchAssetDocuments({
              accountId,
              assetId,
              take: documentTake,
              skip: documentSkip,
            })
            documents.push(...documentResult.items)
            if (documents.length >= documentResult.total || documentResult.items.length === 0) break
            documentSkip += documentTake
            documentPageCount++
          }
          manifest.sections.documents.count = documents.length
          manifest.sections.documents.included = true

          const documentIndex = {
            total: documents.length,
            items: documents.map((doc) => ({
              attachmentId: (doc as { attachmentId: number }).attachmentId,
              filename: (doc as { filename: string }).filename,
              contentType: (doc as { contentType: string }).contentType,
              filesize: (doc as { filesize: number }).filesize,
              uploadedAt: (doc as { uploadedAt: string }).uploadedAt,
              uploadedBy: (doc as { uploadedBy: number }).uploadedBy,
            })),
          }
          await addFileToArchive(JSON.stringify(documentIndex, null, 2), 'documents/index.json', assetId)
        } catch (documentErr) {
          // Log but continue - partial export is acceptable
          if (process.env.NODE_ENV !== 'test') {
            console.warn(JSON.stringify({ msg: 'binder_document_collection_failed', jobId, error: documentErr instanceof Error ? documentErr.message : String(documentErr) }))
          }
          manifest.sections.documents.included = false
        }

        // 4. Collect datasheets (paginate with safety limit)
        try {
          const datasheets: unknown[] = []
          let datasheetSkip = 0
          const datasheetTake = 100
          const maxDatasheetPages = 1000 // Safety limit: 100k datasheets max
          let datasheetPageCount = 0
          while (datasheetPageCount < maxDatasheetPages) {
            const datasheetResult = await fetchFilledSheetsForAsset({
              accountId,
              assetId,
              take: datasheetTake,
              skip: datasheetSkip,
            })
            datasheets.push(...datasheetResult.items)
            if (datasheets.length >= datasheetResult.total || datasheetResult.items.length === 0) break
            datasheetSkip += datasheetTake
            datasheetPageCount++
          }
          manifest.sections.datasheets.count = datasheets.length
          manifest.sections.datasheets.included = true

          const datasheetIndex = {
            total: datasheets.length,
            items: datasheets.map((sheet) => ({
              sheetId: (sheet as { sheetId: number }).sheetId,
              sheetName: (sheet as { sheetName: string }).sheetName,
              equipmentTagNum: (sheet as { equipmentTagNum: string }).equipmentTagNum,
              status: (sheet as { status: string }).status,
              revisionDate: (sheet as { revisionDate: string }).revisionDate,
            })),
          }
          await addFileToArchive(JSON.stringify(datasheetIndex, null, 2), 'datasheets/index.json', assetId)
        } catch (datasheetErr) {
          // Log but continue - partial export is acceptable
          if (process.env.NODE_ENV !== 'test') {
            console.warn(JSON.stringify({ msg: 'binder_datasheet_collection_failed', jobId, error: datasheetErr instanceof Error ? datasheetErr.message : String(datasheetErr) }))
          }
          manifest.sections.datasheets.included = false
        }

        // 5. Add manifest (always included, even if some sections failed)
        await addFileToArchive(JSON.stringify(manifest, null, 2), 'manifest.json', assetId)

        // Finalize archive and wait for completion
        archive.finalize()

        await new Promise<void>((resolve, reject) => {
          output.on('close', () => resolve())
          archive.on('error', (err) => {
            reject(new Error(`Archive finalization failed: ${err instanceof Error ? err.message : String(err)}`))
          })
          output.on('error', (err) => {
            reject(new Error(`File write failed: ${err instanceof Error ? err.message : String(err)}`))
          })
        })

        const relativePath = `jobs/${zipFileName}`
        await updateExportJobCompleted(jobId, zipFileName, relativePath, leaseId)

        if (process.env.NODE_ENV !== 'test') {
          console.log(JSON.stringify({ msg: 'export_job_complete', jobId, leaseId, jobType: 'handover_binder' }))
        }
      } catch (collectErr) {
        const message = collectErr instanceof Error ? collectErr.message : 'Failed to collect binder data'
        await updateExportJobFailed(jobId, message, leaseId, backoffSecondsForAttempt(attemptCount))
        // Don't rethrow - error already handled
      }
    } else {
      await updateExportJobFailed(
        jobId,
        `Unsupported job type: ${row.JobType}`,
        leaseId,
        backoffSecondsForAttempt(attemptCount)
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    await updateExportJobFailed(
      jobId,
      message,
      leaseId,
      backoffSecondsForAttempt(attemptCount)
    )
    if (process.env.NODE_ENV !== 'test') {
      console.error(JSON.stringify({ msg: 'export_job_failed', jobId, leaseId, error: message }))
    }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
  }
}

/** Run the export job (worker): claim by jobId, then run. Used when triggered by HTTP (setImmediate). */
export async function runExportJob(jobId: number): Promise<void> {
  const leaseId = randomUUID()
  const startedAt = new Date()
  const leasedUntil = new Date(Date.now() + LEASE_TTL_MS)

  const { claimed, row } = await claimExportJob(jobId, leaseId, leasedUntil, startedAt)
  if (!claimed || !row) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify({ msg: 'export_job_claim_skipped', jobId, leaseId }))
    }
    return
  }
  await runClaimedExportJob(row, leaseId)
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

/** Retry a failed job: reset to queued and re-run using stored ParamsJson. Returns true if accepted. */
export async function retryExportJob(jobId: number): Promise<boolean> {
  const row = await getExportJobById(jobId)
  if (!row) return false
  if (row.Status !== 'failed') return false
  await updateExportJobResetForRetry(jobId)
  if (process.env.NODE_ENV !== 'test') {
    setImmediate(() => {
      void runExportJob(jobId).catch((err) => {
        console.error('Export job retry failed:', jobId, err)
      })
    })
  }
  return true
}

export interface ExportJobRunnerOptions {
  enabled: boolean
  workerId: string
  pollIntervalMs: number
  leaseTtlMs: number
  heartbeatMs: number
  globalConcurrency: number
  perAccountLimit: number
}

let runnerTimeoutId: ReturnType<typeof setTimeout> | null = null

/** Start the background export job runner. Stops any existing runner. */
export function startExportJobRunner(opts: ExportJobRunnerOptions): void {
  if (runnerTimeoutId) {
    clearTimeout(runnerTimeoutId)
    runnerTimeoutId = null
  }
  if (!opts.enabled) return

  let inFlight = 0
  let consecutiveEmptyPolls = 0

  const scheduleNext = (delayMs: number): void => {
    runnerTimeoutId = setTimeout(() => {
      runOne().catch((err) => {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(JSON.stringify({ msg: 'export_job_runner_poll_error', error: String(err) }))
        }
      }).finally(() => {
        const nextDelay =
          consecutiveEmptyPolls === 0
            ? opts.pollIntervalMs
            : Math.min(10000, opts.pollIntervalMs * (1 + consecutiveEmptyPolls))
        scheduleNext(nextDelay)
      })
    }, delayMs)
  }

  const runOne = async (): Promise<void> => {
    if (inFlight >= opts.globalConcurrency) return
    const leaseId = randomUUID()
    const leasedUntil = new Date(Date.now() + opts.leaseTtlMs)
    const startedAt = new Date()
    const { claimed, row } = await claimNextExportJob(
      leaseId,
      leasedUntil,
      startedAt,
      opts.perAccountLimit
    )
    if (!claimed || !row) {
      consecutiveEmptyPolls += 1
      return
    }
    consecutiveEmptyPolls = 0
    inFlight += 1
    runClaimedExportJob(row, leaseId).catch((err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.error(
          JSON.stringify({
            msg: 'export_job_runner_error',
            jobId: row.Id,
            leaseId,
            error: err instanceof Error ? err.message : String(err),
          })
        )
      }
    }).finally(() => {
      inFlight -= 1
    })
  }

  scheduleNext(opts.pollIntervalMs)

  if (process.env.NODE_ENV !== 'test') {
    console.log(
      JSON.stringify({
        msg: 'export_job_runner_started',
        workerId: opts.workerId,
        pollIntervalMs: opts.pollIntervalMs,
        globalConcurrency: opts.globalConcurrency,
        perAccountLimit: opts.perAccountLimit,
      })
    )
  }
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
