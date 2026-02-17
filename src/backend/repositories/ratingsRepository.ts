// src/backend/repositories/ratingsRepository.ts
import { poolPromise, sql } from '../config/db'
import type { Transaction } from 'mssql'

export type RatingsBlockSummaryRow = {
  ratingsBlockId: number
  sheetId: number
  blockType: string
  ratingsBlockTemplateId: number | null
  lockedAt: Date | null
  lockedBy: number | null
  updatedAt: Date
}

export type RatingsBlockRow = {
  ratingsBlockId: number
  sheetId: number
  blockType: string
  ratingsBlockTemplateId: number | null
  sourceValueSetId: number | null
  lockedAt: Date | null
  lockedBy: number | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type RatingsEntryRow = {
  entryId: number
  ratingsBlockId: number
  key: string
  value: string | null
  uom: string | null
  orderIndex: number
  templateFieldId: number | null
}

export type CreateRatingsBlockInput = {
  sheetId: number
  blockType: string
  notes?: string | null
  sourceValueSetId?: number | null
  ratingsBlockTemplateId?: number | null
  entries: Array<{
    key: string
    value: string | null
    uom?: string | null
    orderIndex?: number | null
    templateFieldId?: number | null
  }>
}

export type UpdateRatingsBlockInput = {
  blockType?: string
  notes?: string | null
  sourceValueSetId?: number | null
  entries?: Array<{
    key: string
    value: string | null
    uom?: string | null
    orderIndex?: number | null
    templateFieldId?: number | null
  }>
}

export type RatingsBlockTemplateRow = {
  id: number
  accountId: number | null
  blockType: string
  standardCode: string
  standardRef: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type RatingsBlockTemplateFieldRow = {
  templateFieldId: number
  ratingsBlockTemplateId: number
  fieldKey: string
  label: string | null
  dataType: string
  uom: string | null
  isRequired: boolean
  orderIndex: number
}

export const listRatingsBlocksForSheet = async (
  accountId: number,
  sheetId: number
): Promise<RatingsBlockSummaryRow[]> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT rb.RatingsBlockID AS ratingsBlockId, rb.SheetID AS sheetId, rb.BlockType AS blockType,
             rb.RatingsBlockTemplateID AS ratingsBlockTemplateId,
             rb.LockedAt AS lockedAt, rb.LockedBy AS lockedBy, rb.UpdatedAt AS updatedAt
      FROM dbo.RatingsBlocks rb
      INNER JOIN dbo.Sheets s ON s.SheetID = rb.SheetID AND s.AccountID = @AccountID
      WHERE rb.SheetID = @SheetID
      ORDER BY rb.RatingsBlockID
    `)

  return result.recordset as RatingsBlockSummaryRow[]
}

export const getRatingsBlockById = async (
  accountId: number,
  ratingsBlockId: number
): Promise<RatingsBlockRow | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('RatingsBlockID', sql.Int, ratingsBlockId)
    .query(`
      SELECT rb.RatingsBlockID AS ratingsBlockId, rb.SheetID AS sheetId, rb.BlockType AS blockType,
             rb.RatingsBlockTemplateID AS ratingsBlockTemplateId,
             rb.SourceValueSetID AS sourceValueSetId, rb.LockedAt AS lockedAt, rb.LockedBy AS lockedBy,
             rb.Notes AS notes, rb.CreatedAt AS createdAt, rb.UpdatedAt AS updatedAt
      FROM dbo.RatingsBlocks rb
      INNER JOIN dbo.Sheets s ON s.SheetID = rb.SheetID AND s.AccountID = @AccountID
      WHERE rb.RatingsBlockID = @RatingsBlockID
    `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0] as RatingsBlockRow
}

export const listRatingsBlockTemplates = async (): Promise<RatingsBlockTemplateRow[]> => {
  const pool = await poolPromise
  const result = await pool.request().query(`
    SELECT RatingsBlockTemplateID AS id, AccountID AS accountId, BlockType AS blockType,
           StandardCode AS standardCode, StandardRef AS standardRef, Description AS description,
           IsActive AS isActive, CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM dbo.RatingsBlockTemplates
    WHERE IsActive = 1
    ORDER BY StandardCode, BlockType, RatingsBlockTemplateID
  `)
  return result.recordset as RatingsBlockTemplateRow[]
}

export const getRatingsBlockTemplateById = async (
  id: number
): Promise<{ template: RatingsBlockTemplateRow; fields: RatingsBlockTemplateFieldRow[] } | null> => {
  const pool = await poolPromise
  const templateResult = await pool
    .request()
    .input('RatingsBlockTemplateID', sql.Int, id)
    .query(`
      SELECT RatingsBlockTemplateID AS id, AccountID AS accountId, BlockType AS blockType,
             StandardCode AS standardCode, StandardRef AS standardRef, Description AS description,
             IsActive AS isActive, CreatedAt AS createdAt, UpdatedAt AS updatedAt
      FROM dbo.RatingsBlockTemplates
      WHERE RatingsBlockTemplateID = @RatingsBlockTemplateID
    `)
  if (templateResult.recordset.length === 0) {
    return null
  }
  const template = templateResult.recordset[0] as RatingsBlockTemplateRow
  const fieldsResult = await pool
    .request()
    .input('RatingsBlockTemplateID', sql.Int, id)
    .query(`
      SELECT TemplateFieldID AS templateFieldId, RatingsBlockTemplateID AS ratingsBlockTemplateId,
             FieldKey AS fieldKey, Label AS label, DataType AS dataType, UOM AS uom,
             IsRequired AS isRequired, OrderIndex AS orderIndex
      FROM dbo.RatingsBlockTemplateFields
      WHERE RatingsBlockTemplateID = @RatingsBlockTemplateID
      ORDER BY OrderIndex
    `)
  const fields = fieldsResult.recordset as RatingsBlockTemplateFieldRow[]
  return { template, fields }
}

export const listRatingsEntriesForBlock = async (
  ratingsBlockId: number
): Promise<RatingsEntryRow[]> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('RatingsBlockID', sql.Int, ratingsBlockId)
    .query(`
      SELECT EntryID AS entryId, RatingsBlockID AS ratingsBlockId, [Key] AS [key], Value AS value,
             UOM AS uom, OrderIndex AS orderIndex, TemplateFieldID AS templateFieldId
      FROM dbo.RatingsEntries
      WHERE RatingsBlockID = @RatingsBlockID
      ORDER BY OrderIndex, EntryID
    `)

  return result.recordset as RatingsEntryRow[]
}

export const createRatingsBlockWithEntries = async (
  tx: Transaction,
  input: CreateRatingsBlockInput
): Promise<RatingsBlockRow> => {
  const request = new sql.Request(tx)

  const result = await request
    .input('SheetID', sql.Int, input.sheetId)
    .input('BlockType', sql.NVarChar(100), input.blockType ?? '')
    .input('SourceValueSetID', sql.Int, input.sourceValueSetId ?? null)
    .input('Notes', sql.NVarChar(sql.MAX), input.notes ?? null)
    .input('RatingsBlockTemplateID', sql.Int, input.ratingsBlockTemplateId ?? null)
    .query(`
      INSERT INTO dbo.RatingsBlocks (SheetID, BlockType, SourceValueSetID, Notes, RatingsBlockTemplateID)
      OUTPUT INSERTED.RatingsBlockID AS ratingsBlockId, INSERTED.SheetID AS sheetId,
             INSERTED.BlockType AS blockType, INSERTED.RatingsBlockTemplateID AS ratingsBlockTemplateId,
             INSERTED.SourceValueSetID AS sourceValueSetId, INSERTED.LockedAt AS lockedAt, INSERTED.LockedBy AS lockedBy,
             INSERTED.Notes AS notes, INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
      VALUES (@SheetID, @BlockType, @SourceValueSetID, @Notes, @RatingsBlockTemplateID)
    `)

  const block = result.recordset[0] as RatingsBlockRow
  const ratingsBlockId = block.ratingsBlockId

  if (input.entries && input.entries.length > 0) {
    for (let i = 0; i < input.entries.length; i++) {
      const e = input.entries[i]
      const orderIndex = e.orderIndex ?? i
      await new sql.Request(tx)
        .input('RatingsBlockID', sql.Int, ratingsBlockId)
        .input('Key', sql.NVarChar(255), e.key)
        .input('Value', sql.NVarChar(sql.MAX), e.value ?? null)
        .input('UOM', sql.NVarChar(50), e.uom ?? null)
        .input('OrderIndex', sql.Int, orderIndex)
        .input('TemplateFieldID', sql.Int, e.templateFieldId ?? null)
        .query(`
          INSERT INTO dbo.RatingsEntries (RatingsBlockID, [Key], Value, UOM, OrderIndex, TemplateFieldID)
          VALUES (@RatingsBlockID, @Key, @Value, @UOM, @OrderIndex, @TemplateFieldID)
        `)
    }
  }

  return block
}

export const updateRatingsBlockWithEntries = async (
  tx: Transaction,
  ratingsBlockId: number,
  input: UpdateRatingsBlockInput
): Promise<RatingsBlockRow | null> => {
  if (
    input.blockType !== undefined ||
    input.notes !== undefined ||
    input.sourceValueSetId !== undefined
  ) {
    const blockType = input.blockType ?? ''
    const notes = input.notes ?? null
    const sourceValueSetId = input.sourceValueSetId ?? null

    await new sql.Request(tx)
      .input('RatingsBlockID', sql.Int, ratingsBlockId)
      .input('BlockType', sql.NVarChar(100), blockType)
      .input('Notes', sql.NVarChar(sql.MAX), notes)
      .input('SourceValueSetID', sql.Int, sourceValueSetId)
      .query(`
        UPDATE dbo.RatingsBlocks
        SET BlockType = @BlockType, Notes = @Notes, SourceValueSetID = @SourceValueSetID, UpdatedAt = GETDATE()
        WHERE RatingsBlockID = @RatingsBlockID
      `)
  }

  if (input.entries !== undefined) {
    await new sql.Request(tx)
      .input('RatingsBlockID', sql.Int, ratingsBlockId)
      .query(`DELETE FROM dbo.RatingsEntries WHERE RatingsBlockID = @RatingsBlockID`)

    for (let i = 0; i < input.entries.length; i++) {
      const e = input.entries[i]
      const orderIndex = e.orderIndex ?? i
      await new sql.Request(tx)
        .input('RatingsBlockID', sql.Int, ratingsBlockId)
        .input('Key', sql.NVarChar(255), e.key)
        .input('Value', sql.NVarChar(sql.MAX), e.value ?? null)
        .input('UOM', sql.NVarChar(50), e.uom ?? null)
        .input('OrderIndex', sql.Int, orderIndex)
        .input('TemplateFieldID', sql.Int, e.templateFieldId ?? null)
        .query(`
          INSERT INTO dbo.RatingsEntries (RatingsBlockID, [Key], Value, UOM, OrderIndex, TemplateFieldID)
          VALUES (@RatingsBlockID, @Key, @Value, @UOM, @OrderIndex, @TemplateFieldID)
        `)
    }
  }

  return getRatingsBlockByIdInTransaction(tx, ratingsBlockId)
}

async function getRatingsBlockByIdInTransaction(
  tx: Transaction,
  ratingsBlockId: number
): Promise<RatingsBlockRow | null> {
  const result = await new sql.Request(tx)
    .input('RatingsBlockID', sql.Int, ratingsBlockId)
    .query(`
      SELECT RatingsBlockID AS ratingsBlockId, SheetID AS sheetId, BlockType AS blockType,
             RatingsBlockTemplateID AS ratingsBlockTemplateId,
             SourceValueSetID AS sourceValueSetId, LockedAt AS lockedAt, LockedBy AS lockedBy,
             Notes AS notes, CreatedAt AS createdAt, UpdatedAt AS updatedAt
      FROM dbo.RatingsBlocks
      WHERE RatingsBlockID = @RatingsBlockID
    `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0] as RatingsBlockRow
}

export const deleteRatingsBlock = async (
  accountId: number,
  ratingsBlockId: number
): Promise<boolean> => {
  const pool = await poolPromise

  const blockExists = await getRatingsBlockById(accountId, ratingsBlockId)
  if (!blockExists) {
    return false
  }

  await pool
    .request()
    .input('RatingsBlockID', sql.Int, ratingsBlockId)
    .query(`DELETE FROM dbo.RatingsEntries WHERE RatingsBlockID = @RatingsBlockID`)

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('RatingsBlockID', sql.Int, ratingsBlockId)
    .query(`
      DELETE rb
      FROM dbo.RatingsBlocks rb
      INNER JOIN dbo.Sheets s ON s.SheetID = rb.SheetID AND s.AccountID = @AccountID
      WHERE rb.RatingsBlockID = @RatingsBlockID
    `)

  const totalRows = Array.isArray(result.rowsAffected)
    ? result.rowsAffected.reduce((sum, value) => sum + value, 0)
    : 0

  return totalRows > 0
}
