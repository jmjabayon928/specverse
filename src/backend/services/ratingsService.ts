// src/backend/services/ratingsService.ts
import {
  listRatingsBlocksForSheet,
  getRatingsBlockById,
  listRatingsEntriesForBlock,
  createRatingsBlockWithEntries,
  updateRatingsBlockWithEntries,
  deleteRatingsBlock,
  listRatingsBlockTemplates,
  getRatingsBlockTemplateById,
  type RatingsBlockSummaryRow,
  type RatingsBlockRow,
  type RatingsEntryRow,
  type RatingsBlockTemplateRow,
  type RatingsBlockTemplateFieldRow,
  type CreateRatingsBlockInput,
  type UpdateRatingsBlockInput,
} from '../repositories/ratingsRepository'
import { poolPromise, sql } from '../config/db'
import { sheetBelongsToAccount } from './sheetAccessService'
import { runInTransaction } from './filledSheetService'
import { AppError } from '../errors/AppError'

async function getSheetStatus(
  accountId: number,
  sheetId: number
): Promise<string | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .query<{ Status: string }>(
      `SELECT Status FROM dbo.Sheets WHERE SheetID = @SheetID AND AccountID = @AccountID`
    )
  return result.recordset[0]?.Status ?? null
}

export type RatingsBlockSummary = RatingsBlockSummaryRow

type AuditContext = { userId?: number }

function logRatingsAudit(
  action: 'create' | 'update' | 'delete' | 'lock' | 'unlock',
  ratingsBlockId: number,
  sheetId: number,
  accountId: number,
  ctx?: AuditContext
): void {
  const userId = ctx?.userId ?? '?'
  console.log(
    `[RatingsAudit] action=${action} ratingsBlockId=${ratingsBlockId} sheetId=${sheetId} userId=${userId} accountId=${accountId}`
  )
}
export type RatingsBlockWithEntries = {
  block: RatingsBlockRow
  entries: RatingsEntryRow[]
}

export const listRatingsTemplates = async (): Promise<RatingsBlockTemplateRow[]> => {
  return listRatingsBlockTemplates()
}

export const getRatingsTemplateById = async (
  id: number
): Promise<{ template: RatingsBlockTemplateRow; fields: RatingsBlockTemplateFieldRow[] } | null> => {
  return getRatingsBlockTemplateById(id)
}

export const listForSheet = async (
  accountId: number,
  sheetId: number
): Promise<RatingsBlockSummary[]> => {
  const belongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!belongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }
  return listRatingsBlocksForSheet(accountId, sheetId)
}

export const getById = async (
  accountId: number,
  ratingsBlockId: number
): Promise<RatingsBlockWithEntries | null> => {
  const block = await getRatingsBlockById(accountId, ratingsBlockId)
  if (!block) {
    return null
  }
  const entries = await listRatingsEntriesForBlock(ratingsBlockId)
  return { block, entries }
}

type CreateRatingsBlockRequest = CreateRatingsBlockInput & {
  templateId?: number
  initialValues?: Record<string, string | null>
}

export const create = async (
  accountId: number,
  input: CreateRatingsBlockRequest,
  auditCtx?: AuditContext
): Promise<RatingsBlockRow> => {
  const belongs = await sheetBelongsToAccount(input.sheetId, accountId)
  if (!belongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }

  let repoInput: CreateRatingsBlockInput
  if (input.templateId != null) {
    const templateData = await getRatingsBlockTemplateById(input.templateId)
    if (!templateData) {
      throw new AppError('Ratings template not found', 404)
    }
    const initialValues = input.initialValues ?? {}
    const entries = [...templateData.fields]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((f) => ({
        key: f.fieldKey,
        value: f.fieldKey in initialValues ? initialValues[f.fieldKey] : null,
        uom: f.uom ?? null,
        orderIndex: f.orderIndex,
        templateFieldId: f.templateFieldId,
      }))
    repoInput = {
      sheetId: input.sheetId,
      blockType: input.blockType,
      notes: input.notes,
      sourceValueSetId: input.sourceValueSetId,
      ratingsBlockTemplateId: input.templateId,
      entries,
    }
  } else {
    repoInput = {
      sheetId: input.sheetId,
      blockType: input.blockType,
      notes: input.notes,
      sourceValueSetId: input.sourceValueSetId,
      entries: input.entries ?? [],
    }
  }

  const block = await runInTransaction(async (tx) => {
    return createRatingsBlockWithEntries(tx, repoInput)
  })
  logRatingsAudit('create', block.ratingsBlockId, block.sheetId, accountId, auditCtx)
  return block
}

const INT_REGEX = /^-?\d+$/
const DECIMAL_REGEX = /^-?\d+(\.\d+)?$/

function normalizeValue(val: string | null | undefined): string | null {
  if (val === undefined || val === null) return null
  const s = typeof val === 'string' ? val.trim() : String(val).trim()
  return s === '' ? null : s
}

function validateAndNormalizeTemplatedEntries(
  entries: Array<{ key: string; value: string | null; uom?: string | null; orderIndex?: number | null; templateFieldId?: number | null }>,
  fields: RatingsBlockTemplateFieldRow[]
): Array<{ key: string; value: string | null; uom: string | null; orderIndex: number; templateFieldId: number }> {
  const fieldByKey = new Map(fields.map((f) => [f.fieldKey, f]))
  const templateKeys = new Set(fields.map((f) => f.fieldKey))

  for (const e of entries) {
    if (!templateKeys.has(e.key)) {
      throw new AppError('Invalid ratings payload: unknown entry key', 400)
    }
  }

  for (const f of fields) {
    if (!f.isRequired) continue
    const entry = entries.find((e) => e.key === f.fieldKey)
    const val = normalizeValue(entry?.value)
    if (val === null) {
      throw new AppError('Invalid ratings payload: required field missing', 400)
    }
  }

  for (const e of entries) {
    const field = fieldByKey.get(e.key)
    if (!field) continue
    const val = normalizeValue(e.value)
    if (val === null && !field.isRequired) continue
    if (field.dataType === 'int' && val !== null) {
      if (!INT_REGEX.test(val)) {
        throw new AppError('Invalid ratings payload: integer value required', 400)
      }
    }
    if (field.dataType === 'decimal' && val !== null) {
      if (!DECIMAL_REGEX.test(val)) {
        throw new AppError('Invalid ratings payload: numeric value required', 400)
      }
    }
  }

  return [...fields]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((f) => {
      const entry = entries.find((e) => e.key === f.fieldKey)
      return {
        key: f.fieldKey,
        value: normalizeValue(entry?.value) ?? null,
        uom: f.uom ?? null,
        orderIndex: f.orderIndex,
        templateFieldId: f.templateFieldId,
      }
    })
}

export const update = async (
  accountId: number,
  ratingsBlockId: number,
  input: UpdateRatingsBlockInput,
  auditCtx?: AuditContext
): Promise<RatingsBlockWithEntries> => {
  const block = await getRatingsBlockById(accountId, ratingsBlockId)
  if (!block) {
    throw new AppError('Ratings block not found', 404)
  }
  if (block.lockedAt != null) {
    throw new AppError('Ratings block is locked', 409)
  }

  const merged: UpdateRatingsBlockInput = {
    blockType: input.blockType ?? block.blockType,
    notes: input.notes !== undefined ? input.notes : block.notes,
    sourceValueSetId: input.sourceValueSetId !== undefined ? input.sourceValueSetId : block.sourceValueSetId,
  }
  if (input.entries !== undefined) {
    if (block.ratingsBlockTemplateId != null) {
      const templateData = await getRatingsBlockTemplateById(block.ratingsBlockTemplateId)
      if (!templateData) {
        throw new AppError('Ratings template not found', 404)
      }
      const existingEntries = await listRatingsEntriesForBlock(ratingsBlockId)
      const templateKeys = new Set(templateData.fields.map((f) => f.fieldKey))
      const canonicalByKey = new Map<string, string | null>()
      for (const f of templateData.fields) {
        const existing = existingEntries.find((e) => e.key === f.fieldKey)
        canonicalByKey.set(f.fieldKey, normalizeValue(existing?.value ?? null))
      }
      for (const e of input.entries) {
        if (templateKeys.has(e.key)) {
          canonicalByKey.set(e.key, normalizeValue(e.value))
        }
      }
      const canonicalEntries = templateData.fields.map((f) => ({
        key: f.fieldKey,
        value: canonicalByKey.get(f.fieldKey) ?? null,
      }))
      merged.entries = validateAndNormalizeTemplatedEntries(canonicalEntries, templateData.fields)
    } else {
      merged.entries = input.entries
    }
  }

  const updated = await runInTransaction(async (tx) => {
    return updateRatingsBlockWithEntries(tx, ratingsBlockId, merged)
  })

  if (!updated) {
    throw new AppError('Ratings block not found', 404)
  }

  logRatingsAudit('update', ratingsBlockId, updated.sheetId, accountId, auditCtx)
  const entries = await listRatingsEntriesForBlock(ratingsBlockId)
  return { block: updated, entries }
}

export const remove = async (
  accountId: number,
  ratingsBlockId: number,
  auditCtx?: AuditContext
): Promise<boolean> => {
  const block = await getRatingsBlockById(accountId, ratingsBlockId)
  if (!block) {
    throw new AppError('Ratings block not found', 404)
  }
  if (block.lockedAt != null) {
    throw new AppError('Ratings block is locked', 409)
  }

  const deleted = await deleteRatingsBlock(accountId, ratingsBlockId)
  if (deleted) {
    logRatingsAudit('delete', ratingsBlockId, block.sheetId, accountId, auditCtx)
  }
  return deleted
}

export const lock = async (
  accountId: number,
  ratingsBlockId: number,
  userId: number,
  auditCtx?: AuditContext
): Promise<RatingsBlockWithEntries> => {
  const block = await getRatingsBlockById(accountId, ratingsBlockId)
  if (!block) {
    throw new AppError('Ratings block not found', 404)
  }
  if (block.lockedAt != null) {
    const entries = await listRatingsEntriesForBlock(ratingsBlockId)
    return { block, entries }
  }

  const status = await getSheetStatus(accountId, block.sheetId)
  if (status !== 'Approved') {
    throw new AppError('Ratings can only be locked for approved datasheets.', 409)
  }

  const pool = await poolPromise
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('RatingsBlockID', sql.Int, ratingsBlockId)
    .input('LockedBy', sql.Int, userId)
    .query(`
      UPDATE rb
      SET rb.LockedAt = GETDATE(), rb.LockedBy = @LockedBy, rb.UpdatedAt = GETDATE()
      FROM dbo.RatingsBlocks rb
      INNER JOIN dbo.Sheets s ON s.SheetID = rb.SheetID AND s.AccountID = @AccountID
      WHERE rb.RatingsBlockID = @RatingsBlockID AND rb.LockedAt IS NULL
    `)

  logRatingsAudit('lock', ratingsBlockId, block.sheetId, accountId, auditCtx)
  const updated = await getRatingsBlockById(accountId, ratingsBlockId)
  if (!updated) throw new AppError('Ratings block not found', 404)
  const entries = await listRatingsEntriesForBlock(ratingsBlockId)
  return { block: updated, entries }
}

export const unlock = async (
  accountId: number,
  ratingsBlockId: number,
  auditCtx?: AuditContext
): Promise<RatingsBlockWithEntries> => {
  const block = await getRatingsBlockById(accountId, ratingsBlockId)
  if (!block) {
    throw new AppError('Ratings block not found', 404)
  }

  const pool = await poolPromise
  await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('RatingsBlockID', sql.Int, ratingsBlockId)
    .query(`
      UPDATE rb
      SET rb.LockedAt = NULL, rb.LockedBy = NULL, rb.UpdatedAt = GETDATE()
      FROM dbo.RatingsBlocks rb
      INNER JOIN dbo.Sheets s ON s.SheetID = rb.SheetID AND s.AccountID = @AccountID
      WHERE rb.RatingsBlockID = @RatingsBlockID
    `)

  logRatingsAudit('unlock', ratingsBlockId, block.sheetId, accountId, auditCtx)
  const updated = await getRatingsBlockById(accountId, ratingsBlockId)
  if (!updated) throw new AppError('Ratings block not found', 404)
  const entries = await listRatingsEntriesForBlock(ratingsBlockId)
  return { block: updated, entries }
}
