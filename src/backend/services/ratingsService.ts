// src/backend/services/ratingsService.ts
import {
  listRatingsBlocksForSheet,
  getRatingsBlockById,
  listRatingsEntriesForBlock,
  createRatingsBlockWithEntries,
  updateRatingsBlockWithEntries,
  deleteRatingsBlock,
  type RatingsBlockSummaryRow,
  type RatingsBlockRow,
  type RatingsEntryRow,
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

export const create = async (
  accountId: number,
  input: CreateRatingsBlockInput,
  auditCtx?: AuditContext
): Promise<RatingsBlockRow> => {
  const belongs = await sheetBelongsToAccount(input.sheetId, accountId)
  if (!belongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }

  const block = await runInTransaction(async (tx) => {
    return createRatingsBlockWithEntries(tx, input)
  })
  logRatingsAudit('create', block.ratingsBlockId, block.sheetId, accountId, auditCtx)
  return block
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
    merged.entries = input.entries
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
