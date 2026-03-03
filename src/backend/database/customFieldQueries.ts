// src/backend/database/customFieldQueries.ts
import type { Transaction } from 'mssql'
import { poolPromise, sql } from '../config/db'

export interface CustomFieldDefinitionRow {
  CustomFieldID: number
  AccountID: number
  EntityType: string
  FieldKey: string
  DisplayLabel: string
  DataType: string
  EnumOptionsJson: string | null
  IsIndexed: boolean
  IsRequired: boolean
  SortOrder: number | null
  CreatedAt: Date
  UpdatedAt: Date | null
}

export interface InsertCustomFieldDefinitionInput {
  accountId: number
  entityType: string
  fieldKey: string
  displayLabel: string
  dataType: string
  enumOptionsJson?: string | null
  isIndexed?: boolean
  isRequired?: boolean
  sortOrder?: number | null
}

export interface UpsertCustomFieldValueInput {
  accountId: number
  entityType: string
  entityId: number
  customFieldId: number
  valueString?: string | null
  valueNumber?: number | null
  valueBool?: boolean | null
  valueDate?: Date | null
  valueJson?: string | null
}

export async function getCustomFieldDefinitionByAccountAndKey(
  accountId: number,
  entityType: string,
  fieldKey: string
): Promise<CustomFieldDefinitionRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('EntityType', sql.NVarChar(50), entityType)
    .input('FieldKey', sql.NVarChar(255), fieldKey)
    .query(`
      SELECT CustomFieldID, AccountID, EntityType, FieldKey, DisplayLabel, DataType, EnumOptionsJson, IsIndexed, IsRequired, SortOrder, CreatedAt, UpdatedAt
      FROM dbo.CustomFieldDefinitions
      WHERE AccountID = @AccountID AND EntityType = @EntityType AND FieldKey = @FieldKey
    `)
  const row = result.recordset[0] as CustomFieldDefinitionRow | undefined
  return row ?? null
}

function isSqlDuplicateKeyError(err: unknown): err is { number: number; message?: string } {
  if (err != null && typeof err === 'object' && 'number' in err && typeof (err as { number: unknown }).number === 'number') {
    return true
  }
  return false
}

export async function upsertCustomFieldDefinition(
  input: InsertCustomFieldDefinitionInput
): Promise<number> {
  const pool = await poolPromise
  const request = pool
    .request()
    .input('AccountID', sql.Int, input.accountId)
    .input('EntityType', sql.NVarChar(50), input.entityType)
    .input('FieldKey', sql.NVarChar(255), input.fieldKey)
    .input('DisplayLabel', sql.NVarChar(255), input.displayLabel)
    .input('DataType', sql.NVarChar(50), input.dataType)
    .input('EnumOptionsJson', sql.NVarChar(sql.MAX), input.enumOptionsJson ?? null)
    .input('IsIndexed', sql.Bit, input.isIndexed ?? false)
    .input('IsRequired', sql.Bit, input.isRequired ?? false)
    .input('SortOrder', sql.Int, input.sortOrder ?? null)
  try {
    const result = await request.query(`
      MERGE dbo.CustomFieldDefinitions AS target
      USING (SELECT @AccountID AS AccountID, @EntityType AS EntityType, @FieldKey AS FieldKey) AS source
      ON target.AccountID = source.AccountID AND target.EntityType = source.EntityType AND target.FieldKey = source.FieldKey
      WHEN MATCHED THEN
        UPDATE SET DisplayLabel = @DisplayLabel, DataType = @DataType, EnumOptionsJson = @EnumOptionsJson, IsIndexed = @IsIndexed, IsRequired = @IsRequired, SortOrder = @SortOrder, UpdatedAt = GETUTCDATE()
      WHEN NOT MATCHED THEN
        INSERT (AccountID, EntityType, FieldKey, DisplayLabel, DataType, EnumOptionsJson, IsIndexed, IsRequired, SortOrder)
        VALUES (@AccountID, @EntityType, @FieldKey, @DisplayLabel, @DataType, @EnumOptionsJson, @IsIndexed, @IsRequired, @SortOrder)
      OUTPUT INSERTED.CustomFieldID;
    `)
    const row = result.recordset[0] as { CustomFieldID: number }
    return row.CustomFieldID
  } catch (err) {
    if (isSqlDuplicateKeyError(err) && (err.number === 2601 || err.number === 2627)) {
      const existing = await getCustomFieldDefinitionByAccountAndKey(
        input.accountId,
        input.entityType,
        input.fieldKey
      )
      if (existing != null) return existing.CustomFieldID
      // re-select returned null; rethrow original error (do not swallow)
    }
    throw err
  }
}

const BATCH_MAX_ROWS = 200

function rowToJsonValue(row: UpsertCustomFieldValueInput): Record<string, number | string | boolean | null> {
  return {
    AccountID: row.accountId,
    EntityType: row.entityType,
    EntityID: row.entityId,
    CustomFieldID: row.customFieldId,
    ValueString: row.valueString ?? null,
    ValueNumber: row.valueNumber ?? null,
    ValueBool: row.valueBool ?? null,
    ValueDate: row.valueDate != null ? row.valueDate.toISOString() : null,
    ValueJson: row.valueJson ?? null,
  }
}

/**
 * Batch upsert for CustomFieldValues within a transaction. Set-based UPDATE + INSERT using OPENJSON.
 * Bounded to BATCH_MAX_ROWS. Preserves typed columns and UpdatedAt/CreatedAt.
 */
export async function upsertCustomFieldValuesBatch(
  tx: Transaction,
  rows: UpsertCustomFieldValueInput[]
): Promise<void> {
  if (rows.length === 0) return
  const batch = rows.slice(0, BATCH_MAX_ROWS)
  const rowsJson = JSON.stringify(batch.map(rowToJsonValue))
  await tx.request()
    .input('RowsJson', sql.NVarChar(sql.MAX), rowsJson)
    .query(`
      ;WITH src AS (
        SELECT
          json.AccountID AS AccountID,
          json.EntityType AS EntityType,
          json.EntityID AS EntityID,
          json.CustomFieldID AS CustomFieldID,
          json.ValueString AS ValueString,
          json.ValueNumber AS ValueNumber,
          json.ValueBool AS ValueBool,
          TRY_CONVERT(datetime2, json.ValueDate, 126) AS ValueDate,
          json.ValueJson AS ValueJson
        FROM OPENJSON(@RowsJson) WITH (
          AccountID int '$.AccountID',
          EntityType nvarchar(40) '$.EntityType',
          EntityID int '$.EntityID',
          CustomFieldID int '$.CustomFieldID',
          ValueString nvarchar(4000) '$.ValueString',
          ValueNumber decimal(18,6) '$.ValueNumber',
          ValueBool bit '$.ValueBool',
          ValueDate nvarchar(50) '$.ValueDate',
          ValueJson nvarchar(max) '$.ValueJson'
        ) AS json
      )
      UPDATE t
      SET
        t.ValueString = src.ValueString,
        t.ValueNumber = src.ValueNumber,
        t.ValueBool = src.ValueBool,
        t.ValueDate = src.ValueDate,
        t.ValueJson = src.ValueJson,
        t.UpdatedAt = SYSUTCDATETIME()
      FROM dbo.CustomFieldValues t
      INNER JOIN src ON t.AccountID = src.AccountID AND t.EntityType = src.EntityType AND t.EntityID = src.EntityID AND t.CustomFieldID = src.CustomFieldID;

      ;WITH src AS (
        SELECT
          json.AccountID AS AccountID,
          json.EntityType AS EntityType,
          json.EntityID AS EntityID,
          json.CustomFieldID AS CustomFieldID,
          json.ValueString AS ValueString,
          json.ValueNumber AS ValueNumber,
          json.ValueBool AS ValueBool,
          TRY_CONVERT(datetime2, json.ValueDate, 126) AS ValueDate,
          json.ValueJson AS ValueJson
        FROM OPENJSON(@RowsJson) WITH (
          AccountID int '$.AccountID',
          EntityType nvarchar(40) '$.EntityType',
          EntityID int '$.EntityID',
          CustomFieldID int '$.CustomFieldID',
          ValueString nvarchar(4000) '$.ValueString',
          ValueNumber decimal(18,6) '$.ValueNumber',
          ValueBool bit '$.ValueBool',
          ValueDate nvarchar(50) '$.ValueDate',
          ValueJson nvarchar(max) '$.ValueJson'
        ) AS json
      )
      INSERT INTO dbo.CustomFieldValues (AccountID, EntityType, EntityID, CustomFieldID, ValueString, ValueNumber, ValueBool, ValueDate, ValueJson, CreatedAt, UpdatedAt)
      SELECT src.AccountID, src.EntityType, src.EntityID, src.CustomFieldID, src.ValueString, src.ValueNumber, src.ValueBool, src.ValueDate, src.ValueJson, SYSUTCDATETIME(), SYSUTCDATETIME()
      FROM src
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.CustomFieldValues t
        WHERE t.AccountID = src.AccountID AND t.EntityType = src.EntityType AND t.EntityID = src.EntityID AND t.CustomFieldID = src.CustomFieldID
      );
    `)
}

export async function upsertCustomFieldValue(
  input: UpsertCustomFieldValueInput,
  transaction?: Transaction
): Promise<number> {
  const req = transaction ? transaction.request() : (await poolPromise).request()
  const result = await req
    .input('AccountID', sql.Int, input.accountId)
    .input('EntityType', sql.NVarChar(50), input.entityType)
    .input('EntityID', sql.Int, input.entityId)
    .input('CustomFieldID', sql.Int, input.customFieldId)
    .input('ValueString', sql.NVarChar(sql.MAX), input.valueString ?? null)
    .input('ValueNumber', sql.Float, input.valueNumber ?? null)
    .input('ValueBool', sql.Bit, input.valueBool ?? null)
    .input('ValueDate', sql.DateTime2, input.valueDate ?? null)
    .input('ValueJson', sql.NVarChar(sql.MAX), input.valueJson ?? null)
    .query(`
      MERGE dbo.CustomFieldValues AS target
      USING (SELECT @AccountID AS AccountID, @EntityType AS EntityType, @EntityID AS EntityID, @CustomFieldID AS CustomFieldID) AS source
      ON target.AccountID = source.AccountID AND target.EntityType = source.EntityType AND target.EntityID = source.EntityID AND target.CustomFieldID = source.CustomFieldID
      WHEN MATCHED THEN
        UPDATE SET ValueString = @ValueString, ValueNumber = @ValueNumber, ValueBool = @ValueBool, ValueDate = @ValueDate, ValueJson = @ValueJson, UpdatedAt = GETUTCDATE()
      WHEN NOT MATCHED THEN
        INSERT (AccountID, EntityType, EntityID, CustomFieldID, ValueString, ValueNumber, ValueBool, ValueDate, ValueJson)
        VALUES (@AccountID, @EntityType, @EntityID, @CustomFieldID, @ValueString, @ValueNumber, @ValueBool, @ValueDate, @ValueJson)
      OUTPUT INSERTED.CustomFieldValueID;
    `)
  const row = result.recordset[0] as { CustomFieldValueID: number }
  return row.CustomFieldValueID
}
