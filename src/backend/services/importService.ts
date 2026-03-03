// src/backend/services/importService.ts
import fs from 'fs/promises'
import crypto from 'crypto'
import { AppError } from '../errors/AppError'
import {
  insertImportJob,
  getImportJobById,
  updateImportJob,
  trySetJobRunning,
  type ImportJobStatus,
} from '../database/importJobQueries'
import {
  insertImportErrorsBatch,
  insertImportErrorsBatchInTransaction,
  insertImportProvenanceBatch,
  insertImportUnmappedField,
  getImportErrorsByJobId,
  getImportUnmappedFieldsByJobId,
} from '../database/importRecordQueries'
import {
  getCustomFieldDefinitionByAccountAndKey,
  upsertCustomFieldDefinition,
  upsertCustomFieldValuesBatch,
} from '../database/customFieldQueries'
import type { InsertImportErrorInput, InsertImportRecordProvenanceInput } from '../database/importRecordQueries'
import type { UpsertCustomFieldValueInput } from '../database/customFieldQueries'
import { upsertAsset, getAssetsByTagNorms, type UpsertAssetInput } from '../repositories/assetsRepository'
import { parseFile, type ParsedRow, truncateSourceValue } from '../utils/fileParser'
import { normalizeTag } from './instrumentsService'
import { poolPromise, sql } from '../config/db'

const ENTITY_TYPE_ASSET = 'Asset'
const RUN_CHUNK_SIZE = 200

// Field mapping: CSV/Excel column names -> Asset field names
const ASSET_FIELD_MAP: Record<string, keyof UpsertAssetInput> = {
  'AssetTag': 'assetTag',
  'Asset Tag': 'assetTag',
  'Tag': 'assetTag',
  'AssetName': 'assetName',
  'Asset Name': 'assetName',
  'Name': 'assetName',
  'Location': 'location',
  'System': 'system',
  'Service': 'service',
  'Criticality': 'criticality',
  'DisciplineID': 'disciplineId',
  'Discipline ID': 'disciplineId',
  'SubtypeID': 'subtypeId',
  'Subtype ID': 'subtypeId',
  'ClientID': 'clientId',
  'Client ID': 'clientId',
  'ProjectID': 'projectId',
  'Project ID': 'projectId',
}

export interface PreviewImportResult {
  jobId: number
  preview: {
    totalRows: number
    validRows: number
    errors: Array<{
      rowIndex: number
      field: string | null
      message: string
    }>
    sampleRows: Array<{
      rowIndex: number
      assetTag: string
      assetName: string | null
      location: string | null
      customFields: Record<string, string | null>
    }>
    unmappedFields: Array<{
      columnName: string
      sampleValues: string[]
    }>
    customFieldDefinitions: Array<{
      fieldName: string
      dataType: string
      sampleValues: string[]
    }>
  }
}

export interface RunImportOptions {
  skipErrors?: boolean
  createCustomFields?: boolean
}

export interface RunImportResult {
  jobId: number
  status: ImportJobStatus
  totalRows: number
  processedRows: number
  successRows: number
  errorRows: number
}

/**
 * Normalize AssetTag to AssetTagNorm (same as instruments)
 */
function normalizeAssetTag(tag: string): string {
  return normalizeTag(tag)
}

/**
 * Parse a string into typed custom field value (ValueNumber, ValueBool, ValueDate, or ValueString)
 */
function parseCustomFieldValue(
  str: string
): { valueString?: string | null; valueNumber?: number | null; valueBool?: boolean | null; valueDate?: Date | null } | null {
  if (str === '') return null
  const trimmed = str.trim()
  if (trimmed.toLowerCase() === 'true') return { valueBool: true }
  if (trimmed.toLowerCase() === 'false') return { valueBool: false }
  const num = Number(trimmed)
  if (!isNaN(num) && isFinite(num)) return { valueNumber: num }
  const isoDate = /^\d{4}-\d{2}-\d{2}(T|$)/.test(trimmed) ? new Date(trimmed) : null
  if (isoDate && !isNaN(isoDate.getTime())) return { valueDate: isoDate }
  return { valueString: truncateSourceValue(trimmed) ?? trimmed }
}

/**
 * Infer data type from sample values
 */
function inferDataType(values: string[]): string {
  if (values.length === 0) return 'varchar'
  
  let hasNumbers = false
  let hasDecimals = false
  let hasDates = false
  
  for (const value of values) {
    if (value === null || value === '') continue
    
    // Check for date patterns
    if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      hasDates = true
      continue
    }
    
    // Check for numbers
    const num = Number(value)
    if (!isNaN(num) && isFinite(num)) {
      hasNumbers = true
      if (String(num) !== value || value.includes('.')) {
        hasDecimals = true
      }
    }
  }
  
  if (hasDates) return 'datetime'
  if (hasDecimals) return 'decimal'
  if (hasNumbers) return 'int'
  return 'varchar'
}

/**
 * Log structured event for import job state transitions
 */
function logImportEvent(
  event: string,
  jobId: number,
  accountId: number,
  correlationId: string,
  metadata?: Record<string, unknown>
): void {
  const logData = {
    event,
    jobId,
    accountId,
    correlationId,
    timestamp: new Date().toISOString(),
    ...metadata,
  }
  console.log(`[ImportJob] ${JSON.stringify(logData)}`)
}

/**
 * Preview import: parse file, validate, identify unmapped fields
 */
export async function previewImport(
  filePath: string,
  accountId: number,
  userId: number,
  correlationId: string
): Promise<PreviewImportResult> {
  // Calculate file hash for idempotency
  const fileBuffer = await fs.readFile(filePath)
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
  const fileName = filePath.split(/[/\\]/).pop() || 'unknown'
  const fileSize = fileBuffer.length

  // Parse file
  const { rows, headers } = await parseFile(filePath)

  // Create import job with schema columns
  const jobId = await insertImportJob({
    accountId,
    jobStatus: 'preview_created',
    jobMode: 'preview',
    sourceFileName: fileName,
    sourceFileSha256: fileHash,
    startedByUserID: userId,
    paramsJson: null, // Will be updated after parsing
  })

  logImportEvent('preview_created', jobId, accountId, correlationId, {
    fileName,
    fileSize,
    totalRows: rows.length,
  })

  // Map headers to asset fields
  const headerMap = new Map<string, string>()
  const unmappedHeaders: string[] = []
  
  for (const header of headers) {
    const normalizedHeader = header.trim()
    const mappedField = ASSET_FIELD_MAP[normalizedHeader] || ASSET_FIELD_MAP[normalizedHeader.toLowerCase()]
    if (mappedField) {
      headerMap.set(normalizedHeader, mappedField)
    } else {
      unmappedHeaders.push(normalizedHeader)
    }
  }

  // Validate rows and collect errors
  const errors: Array<{ rowIndex: number; field: string | null; message: string }> = []
  const validRows: ParsedRow[] = []
  const unmappedFieldSamples = new Map<string, Set<string>>()

  for (const row of rows) {
    let isValid = true
    
    // Check required field: AssetTag
    const assetTagValue = row.data[headers.find(h => ASSET_FIELD_MAP[h] === 'assetTag' || ASSET_FIELD_MAP[h.toLowerCase()] === 'assetTag') || '']
    if (!assetTagValue || String(assetTagValue).trim() === '') {
      errors.push({
        rowIndex: row.rowIndex,
        field: 'AssetTag',
        message: 'AssetTag is required',
      })
      isValid = false
    }

    // Collect samples for unmapped fields
    for (const header of unmappedHeaders) {
      const value = row.data[header]
      if (value !== null && value !== '') {
        if (!unmappedFieldSamples.has(header)) {
          unmappedFieldSamples.set(header, new Set())
        }
        const samples = unmappedFieldSamples.get(header)!
        if (samples.size < 10) {
          samples.add(String(value))
        }
      }
    }

    if (isValid) {
      validRows.push(row)
    }
  }

  // Insert errors with schema columns (AccountID, SourceRowNumber, SourceColumnName, SourceValue, ErrorCode, Severity)
  if (errors.length > 0) {
    await insertImportErrorsBatch(
      errors.map(e => ({
        accountId,
        importJobId: jobId,
        sourceRowNumber: e.rowIndex,
        sourceColumnName: e.field ? truncateSourceValue(e.field) : null,
        sourceValue: null, // Do not store sensitive source value in errors
        errorCode: 'REQUIRED',
        errorMessage: truncateSourceValue(e.message) || 'Validation error',
        severity: 'error' as const,
      }))
    )
  }

  // Insert unmapped fields row-level: first N rows per column (EntityID=0 at preview)
  function normalizedFieldKey(col: string): string {
    return col.trim().replace(/\s+/g, '_').toLowerCase() || 'unknown'
  }
  const UNMAPPED_SAMPLES_PER_COLUMN = 10
  for (const [columnName, samples] of unmappedFieldSamples.entries()) {
    const srcCol = truncateSourceValue(columnName) || 'Unknown'
    const normKey = normalizedFieldKey(columnName)
    const values = Array.from(samples).slice(0, UNMAPPED_SAMPLES_PER_COLUMN)
    for (const sourceValue of values) {
      const truncated = truncateSourceValue(sourceValue)
      if (truncated) {
        await insertImportUnmappedField({
          accountId,
          importJobId: jobId,
          entityType: ENTITY_TYPE_ASSET,
          entityId: 0,
          sourceColumnName: srcCol,
          sourceValue: truncated,
          normalizedFieldKey: normKey,
        })
      }
    }
  }

  // Store normalized rows JSON for /run to use (store in ParamsJson)
  // Truncate data values before storing
  const normalizedRows = rows.map(r => ({
    rowIndex: r.rowIndex,
    data: Object.fromEntries(
      Object.entries(r.data).map(([key, value]) => [
        truncateSourceValue(key) || key,
        truncateSourceValue(value),
      ])
    ),
  }))
  
  const paramsPayload = {
    rows: normalizedRows,
    headers: headers.map(h => truncateSourceValue(h) || h),
    fileHash,
    limits: { maxRows: 2000, maxFileSize: 10 * 1024 * 1024 },
    correlationId,
  }
  const updatedParamsJson = JSON.stringify(paramsPayload)

  await updateImportJob(jobId, {
    jobStatus: 'preview_complete',
    paramsJson: updatedParamsJson,
    totalRows: rows.length,
  })

  logImportEvent('preview_completed', jobId, accountId, correlationId, {
    totalRows: rows.length,
    validRows: validRows.length,
    errorCount: errors.length,
  })

  // Build custom field definitions preview
  const customFieldDefinitions = Array.from(unmappedFieldSamples.entries()).map(([fieldName, samples]) => ({
    fieldName,
    dataType: inferDataType(Array.from(samples)),
    sampleValues: Array.from(samples).slice(0, 5),
  }))

  // Build sample rows (first 5 valid rows)
  const sampleRows = validRows.slice(0, 5).map(row => {
    const assetTag = String(row.data[headers.find(h => ASSET_FIELD_MAP[h] === 'assetTag' || ASSET_FIELD_MAP[h.toLowerCase()] === 'assetTag') || ''] || '')
    const assetName = row.data[headers.find(h => ASSET_FIELD_MAP[h] === 'assetName' || ASSET_FIELD_MAP[h.toLowerCase()] === 'assetName') || ''] || null
    const location = row.data[headers.find(h => ASSET_FIELD_MAP[h] === 'location' || ASSET_FIELD_MAP[h.toLowerCase()] === 'location') || ''] || null
    
    const customFields: Record<string, string | null> = {}
    for (const header of unmappedHeaders) {
      customFields[header] = row.data[header] || null
    }
    
    return {
      rowIndex: row.rowIndex,
      assetTag,
      assetName: assetName ? String(assetName) : null,
      location: location ? String(location) : null,
      customFields,
    }
  })

  return {
    jobId,
    preview: {
      totalRows: rows.length,
      validRows: validRows.length,
      errors: errors.slice(0, 100), // Limit to first 100 errors
      sampleRows,
      unmappedFields: Array.from(unmappedFieldSamples.entries()).map(([columnName, samples]) => ({
        columnName,
        sampleValues: Array.from(samples).slice(0, 10),
      })),
      customFieldDefinitions,
    },
  }
}

/**
 * Run import: process rows, upsert assets, create custom fields
 */
export async function runImport(
  jobId: number,
  accountId: number,
  userId: number,
  options: RunImportOptions = {},
  correlationId: string
): Promise<RunImportResult> {
  const { skipErrors = false, createCustomFields = true } = options

  // Load job
  const job = await getImportJobById(jobId)
  if (!job) {
    throw new AppError('Import job not found', 404)
  }

  if (job.AccountID !== accountId) {
    throw new AppError('Import job not found', 404)
  }

  const params = job.ParamsJson ? JSON.parse(job.ParamsJson) : {}
  if (!params.fileHash) {
    throw new AppError('Import job missing file hash. Preview may have failed.', 400)
  }

  const rowsData: Array<{ rowIndex: number; data: Record<string, string | null> }> = Array.isArray(params.rows)
    ? params.rows
    : []
  const headers: string[] = Array.isArray(params.headers) ? params.headers : []
  if (rowsData.length === 0) {
    throw new AppError('No rows to import. Preview data may be missing.', 400)
  }

  const effectiveCorrelationId = correlationId || params.correlationId || 'unknown'
  logImportEvent('run_started', jobId, accountId, effectiveCorrelationId, {
    totalRows: rowsData.length,
    skipErrors,
    createCustomFields,
  })

  // Atomic guarded transition: set running only if preview_complete (race-safe)
  const rowsUpdated = await trySetJobRunning(jobId, accountId)
  if (rowsUpdated === 0) {
    const current = await getImportJobById(jobId)
    if (!current) {
      throw new AppError('Import job not found', 404)
    }
    throw new AppError('Job is not in preview_complete status.', 400)
  }

  // Load unmapped fields (row-level; get unique column names for custom field defs)
  const unmappedRows = await getImportUnmappedFieldsByJobId(jobId, accountId)
  const unmappedColumnsByKey = new Map<string, { sourceColumnName: string }>()
  for (const r of unmappedRows) {
    if (!unmappedColumnsByKey.has(r.NormalizedFieldKey)) {
      unmappedColumnsByKey.set(r.NormalizedFieldKey, { sourceColumnName: r.SourceColumnName })
    }
  }

  // Load existing errors
  const existingErrors = await getImportErrorsByJobId(jobId, accountId)
  const errorRowIndexes = new Set(existingErrors.map(e => e.SourceRowNumber))

  // Create custom field definitions if needed (by NormalizedFieldKey, DisplayLabel = column name)
  const customFieldDefMap = new Map<string, number>()
  if (createCustomFields) {
    for (const [fieldKey, { sourceColumnName }] of unmappedColumnsByKey.entries()) {
      const existing = await getCustomFieldDefinitionByAccountAndKey(
        accountId,
        ENTITY_TYPE_ASSET,
        fieldKey
      )
      if (existing) {
        customFieldDefMap.set(sourceColumnName, existing.CustomFieldID)
      } else {
        const samples = unmappedRows.filter(r => r.NormalizedFieldKey === fieldKey).map(r => r.SourceValue).filter(Boolean) as string[]
        const dataType = inferDataType(samples)
        const fieldDefId = await upsertCustomFieldDefinition({
          accountId,
          entityType: ENTITY_TYPE_ASSET,
          fieldKey,
          displayLabel: sourceColumnName,
          dataType,
        })
        customFieldDefMap.set(sourceColumnName, fieldDefId)
      }
    }
  }

  // Pre-fetch existing assets by tag norms (bulk query for performance)
  const allTagNorms = rowsData
    .filter(r => !errorRowIndexes.has(r.rowIndex))
    .map(r => {
      const assetTagValue = r.data[headers.find(h => ASSET_FIELD_MAP[h] === 'assetTag' || ASSET_FIELD_MAP[h.toLowerCase()] === 'assetTag') || '']
      return assetTagValue ? normalizeAssetTag(String(assetTagValue)) : null
    })
    .filter((tag): tag is string => tag !== null)
  
  await getAssetsByTagNorms(accountId, allTagNorms)

  const pool = await poolPromise
  const transaction = new sql.Transaction(pool)
  let processedRows = 0
  let successRows = 0
  let errorRows = 0
  let createdCount = 0
  let updatedCount = 0

  function isUniqueConstraintError(err: unknown): boolean {
    if (err && typeof err === 'object' && 'number' in err) {
      const n = (err as { number?: number }).number
      if (n === 2627 || n === 2601) return true
    }
    const msg = err instanceof Error ? err.message : String(err)
    return /unique|duplicate|UX_Assets_Account_TagNorm/i.test(msg)
  }

  try {
    await transaction.begin()

    for (let chunkStart = 0; chunkStart < rowsData.length; chunkStart += RUN_CHUNK_SIZE) {
      const chunk = rowsData.slice(chunkStart, chunkStart + RUN_CHUNK_SIZE)
      const chunkProvenance: InsertImportRecordProvenanceInput[] = []
      const chunkErrors: InsertImportErrorInput[] = []
      const chunkCustomValues: UpsertCustomFieldValueInput[] = []

      for (const rowData of chunk) {
        if (errorRowIndexes.has(rowData.rowIndex) && !skipErrors) {
          errorRows++
          processedRows++
          continue
        }

        try {
          const assetTagValue = rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'assetTag' || ASSET_FIELD_MAP[h.toLowerCase()] === 'assetTag') || '']
          if (!assetTagValue || String(assetTagValue).trim() === '') {
            throw new Error('AssetTag is required')
          }

          const assetTag = String(assetTagValue).trim()
          const assetTagNorm = normalizeAssetTag(assetTag)

          const assetInput: UpsertAssetInput = {
            accountId,
            assetTag,
            assetTagNorm,
            assetName: rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'assetName' || ASSET_FIELD_MAP[h.toLowerCase()] === 'assetName') || ''] || null,
            location: rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'location' || ASSET_FIELD_MAP[h.toLowerCase()] === 'location') || ''] || null,
            system: rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'system' || ASSET_FIELD_MAP[h.toLowerCase()] === 'system') || ''] || null,
            service: rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'service' || ASSET_FIELD_MAP[h.toLowerCase()] === 'service') || ''] || null,
            criticality: rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'criticality' || ASSET_FIELD_MAP[h.toLowerCase()] === 'criticality') || ''] || null,
            disciplineId: rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'disciplineId' || ASSET_FIELD_MAP[h.toLowerCase()] === 'disciplineId') || ''] ? Number(rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'disciplineId' || ASSET_FIELD_MAP[h.toLowerCase()] === 'disciplineId') || '']) : null,
            subtypeId: rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'subtypeId' || ASSET_FIELD_MAP[h.toLowerCase()] === 'subtypeId') || ''] ? Number(rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'subtypeId' || ASSET_FIELD_MAP[h.toLowerCase()] === 'subtypeId') || '']) : null,
            clientId: rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'clientId' || ASSET_FIELD_MAP[h.toLowerCase()] === 'clientId') || ''] ? Number(rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'clientId' || ASSET_FIELD_MAP[h.toLowerCase()] === 'clientId') || '']) : null,
            projectId: rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'projectId' || ASSET_FIELD_MAP[h.toLowerCase()] === 'projectId') || ''] ? Number(rowData.data[headers.find(h => ASSET_FIELD_MAP[h] === 'projectId' || ASSET_FIELD_MAP[h.toLowerCase()] === 'projectId') || '']) : null,
          }

          let assetResult: { assetId: number; action: 'created' | 'updated' }
          try {
            assetResult = await upsertAsset(assetInput, transaction)
          } catch (err) {
            if (isUniqueConstraintError(err)) {
              assetResult = await upsertAsset(assetInput, transaction)
            } else {
              throw err
            }
          }

          const actionTaken = assetResult.action === 'created' ? 'created' : assetResult.action === 'updated' ? 'updated' : 'skipped'
          if (assetResult.action === 'created') createdCount++
          if (assetResult.action === 'updated') updatedCount++

          chunkProvenance.push({
            accountId,
            importJobId: jobId,
            entityType: ENTITY_TYPE_ASSET,
            entityId: assetResult.assetId,
            sourceRowNumber: rowData.rowIndex,
            sourceNaturalKey: assetTagNorm,
            actionTaken,
          })

          for (const [columnName, customFieldId] of customFieldDefMap.entries()) {
            const raw = rowData.data[columnName]
            if (raw === null || raw === '') continue
            const str = String(raw).trim()
            const valueInput = parseCustomFieldValue(str)
            if (valueInput) {
              chunkCustomValues.push({
                accountId,
                entityType: ENTITY_TYPE_ASSET,
                entityId: assetResult.assetId,
                customFieldId,
                ...valueInput,
              })
            }
          }

          successRows++
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          chunkErrors.push({
            accountId,
            importJobId: jobId,
            sourceRowNumber: rowData.rowIndex,
            sourceColumnName: null,
            sourceValue: null,
            errorCode: 'IMPORT_ERROR',
            errorMessage: truncateSourceValue(errorMessage) || 'Unknown error',
            severity: 'error',
          })
          errorRows++

          if (!skipErrors) {
            await transaction.rollback()
            const failSummary = `[correlationId: ${effectiveCorrelationId}] Fatal error at row ${rowData.rowIndex}: ${errorMessage}`
            const paramsWithCorrelation = { ...params, correlationId: effectiveCorrelationId }
            await updateImportJob(jobId, { jobStatus: 'failed', completedAt: new Date(), errorSummary: failSummary, paramsJson: JSON.stringify(paramsWithCorrelation) })
            throw new AppError(`Import failed at row ${rowData.rowIndex}: ${errorMessage}`, 400)
          }
        }

        processedRows++
      }

      await insertImportProvenanceBatch(transaction, chunkProvenance)
      await insertImportErrorsBatchInTransaction(transaction, chunkErrors)
      await upsertCustomFieldValuesBatch(transaction, chunkCustomValues)
    }

    await transaction.commit()

    const paramsWithCorrelation = { ...params, correlationId: effectiveCorrelationId }
    await updateImportJob(jobId, {
      jobStatus: 'succeeded',
      completedAt: new Date(),
      totalRows: rowsData.length,
      createdCount,
      updatedCount,
      skippedCount: 0,
      errorCount: errorRows,
      errorSummary: errorRows > 0 ? `[correlationId: ${effectiveCorrelationId}] ${errorRows} row(s) had errors` : null,
      paramsJson: JSON.stringify(paramsWithCorrelation),
    })

    logImportEvent('run_succeeded', jobId, accountId, effectiveCorrelationId, {
      totalRows: rowsData.length,
      processedRows,
      successRows,
      errorRows,
    })

    return {
      jobId,
      status: 'succeeded',
      totalRows: rowsData.length,
      processedRows,
      successRows,
      errorRows,
    }
  } catch (err) {
    try {
      await transaction.rollback()
    } catch {
      /* ignore */
    }

    const errorMessage = err instanceof Error ? err.message : 'Import failed'
    const truncatedErrorMessage = truncateSourceValue(errorMessage) || 'Import failed'
    const failSummary = `[correlationId: ${effectiveCorrelationId}] ${truncatedErrorMessage}`
    const paramsWithCorrelation = { ...params, correlationId: effectiveCorrelationId }
    await updateImportJob(jobId, {
      jobStatus: 'failed',
      completedAt: new Date(),
      errorCount: errorRows,
      errorSummary: failSummary,
      paramsJson: JSON.stringify(paramsWithCorrelation),
    })

    logImportEvent('run_failed', jobId, accountId, effectiveCorrelationId, {
      totalRows: rowsData.length,
      processedRows,
      errorMessage: truncatedErrorMessage,
    })
    
    if (err instanceof AppError) {
      throw err
    }
    
    throw new AppError(`Import failed: ${truncatedErrorMessage}`, 500)
  }
}
