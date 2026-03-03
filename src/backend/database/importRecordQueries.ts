// src/backend/database/importRecordQueries.ts
import type { Transaction } from 'mssql'
import { poolPromise, sql } from '../config/db'

export interface ImportErrorRow {
  ImportErrorID: number
  AccountID: number
  ImportJobID: number
  SourceRowNumber: number
  SourceColumnName: string | null
  SourceValue: string | null
  ErrorCode: string
  ErrorMessage: string
  Severity: string
  CreatedAt: Date
}

export interface ImportRecordProvenanceRow {
  ImportRecordProvenanceID: number
  AccountID: number
  ImportJobID: number
  EntityType: string
  EntityID: number
  SourceRowNumber: number
  SourceNaturalKey: string | null
  ActionTaken: string
  CreatedAt: Date
}

export interface ImportUnmappedFieldRow {
  ImportUnmappedFieldID: number
  AccountID: number
  ImportJobID: number
  EntityType: string
  EntityID: number
  SourceColumnName: string
  SourceValue: string | null
  NormalizedFieldKey: string
  CreatedAt: Date
}

export interface InsertImportErrorInput {
  accountId: number
  importJobId: number
  sourceRowNumber: number
  sourceColumnName: string | null
  sourceValue: string | null
  errorCode: string
  errorMessage: string
  severity: 'error' | 'warn'
}

export interface InsertImportRecordProvenanceInput {
  accountId: number
  importJobId: number
  entityType: string
  entityId: number
  sourceRowNumber: number
  sourceNaturalKey: string | null
  actionTaken: 'created' | 'updated' | 'skipped'
}

export interface InsertImportUnmappedFieldInput {
  accountId: number
  importJobId: number
  entityType: string
  entityId: number
  sourceColumnName: string
  sourceValue: string | null
  normalizedFieldKey: string
}

export async function insertImportError(
  input: InsertImportErrorInput,
  transaction?: Transaction
): Promise<void> {
  const req = transaction ? transaction.request() : (await poolPromise).request()
  await req
    .input('AccountID', sql.Int, input.accountId)
    .input('ImportJobID', sql.Int, input.importJobId)
    .input('SourceRowNumber', sql.Int, input.sourceRowNumber)
    .input('SourceColumnName', sql.NVarChar(255), input.sourceColumnName)
    .input('SourceValue', sql.NVarChar(2000), input.sourceValue)
    .input('ErrorCode', sql.NVarChar(50), input.errorCode)
    .input('ErrorMessage', sql.NVarChar(1000), input.errorMessage)
    .input('Severity', sql.NVarChar(20), input.severity)
    .query(`
      INSERT INTO dbo.ImportErrors (AccountID, ImportJobID, SourceRowNumber, SourceColumnName, SourceValue, ErrorCode, ErrorMessage, Severity)
      VALUES (@AccountID, @ImportJobID, @SourceRowNumber, @SourceColumnName, @SourceValue, @ErrorCode, @ErrorMessage, @Severity)
    `)
}

export async function insertImportErrorsBatch(
  inputs: InsertImportErrorInput[]
): Promise<void> {
  if (inputs.length === 0) return
  const pool = await poolPromise
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()
    for (const input of inputs) {
      await tx
        .request()
        .input('AccountID', sql.Int, input.accountId)
        .input('ImportJobID', sql.Int, input.importJobId)
        .input('SourceRowNumber', sql.Int, input.sourceRowNumber)
        .input('SourceColumnName', sql.NVarChar(255), input.sourceColumnName)
        .input('SourceValue', sql.NVarChar(2000), input.sourceValue)
        .input('ErrorCode', sql.NVarChar(50), input.errorCode)
        .input('ErrorMessage', sql.NVarChar(1000), input.errorMessage)
        .input('Severity', sql.NVarChar(20), input.severity)
        .query(`
          INSERT INTO dbo.ImportErrors (AccountID, ImportJobID, SourceRowNumber, SourceColumnName, SourceValue, ErrorCode, ErrorMessage, Severity)
          VALUES (@AccountID, @ImportJobID, @SourceRowNumber, @SourceColumnName, @SourceValue, @ErrorCode, @ErrorMessage, @Severity)
        `)
    }
    await tx.commit()
  } catch (err) {
    try {
      await tx.rollback()
    } catch {
      /* ignore */
    }
    throw err
  }
}

const BATCH_MAX_ROWS = 200

/**
 * Batch insert for ImportRecordProvenance. Single INSERT with multiple VALUES.
 * Bounded to BATCH_MAX_ROWS. Requires transaction.
 */
export async function insertImportProvenanceBatch(
  tx: Transaction,
  rows: InsertImportRecordProvenanceInput[]
): Promise<void> {
  if (rows.length === 0) return
  const batch = rows.slice(0, BATCH_MAX_ROWS)
  const req = tx.request()
  const valueTuples = batch.map((_, i) => {
    const p = (n: string) => `${n}${i}`
    req.input(p('AccountID'), sql.Int, batch[i].accountId)
    req.input(p('ImportJobID'), sql.Int, batch[i].importJobId)
    req.input(p('EntityType'), sql.NVarChar(50), batch[i].entityType)
    req.input(p('EntityID'), sql.Int, batch[i].entityId)
    req.input(p('SourceRowNumber'), sql.Int, batch[i].sourceRowNumber)
    req.input(p('SourceNaturalKey'), sql.NVarChar(255), batch[i].sourceNaturalKey)
    req.input(p('ActionTaken'), sql.NVarChar(20), batch[i].actionTaken)
    return `(@${p('AccountID')}, @${p('ImportJobID')}, @${p('EntityType')}, @${p('EntityID')}, @${p('SourceRowNumber')}, @${p('SourceNaturalKey')}, @${p('ActionTaken')})`
  })
  await req.query(`
    INSERT INTO dbo.ImportRecordProvenance (AccountID, ImportJobID, EntityType, EntityID, SourceRowNumber, SourceNaturalKey, ActionTaken)
    VALUES ${valueTuples.join(', ')}
  `)
}

/**
 * Batch insert for ImportErrors within a transaction. Single INSERT with multiple VALUES.
 * Bounded to BATCH_MAX_ROWS.
 */
export async function insertImportErrorsBatchInTransaction(
  tx: Transaction,
  rows: InsertImportErrorInput[]
): Promise<void> {
  if (rows.length === 0) return
  const batch = rows.slice(0, BATCH_MAX_ROWS)
  const req = tx.request()
  const valueTuples = batch.map((_, i) => {
    const p = (n: string) => `${n}${i}`
    req.input(p('AccountID'), sql.Int, batch[i].accountId)
    req.input(p('ImportJobID'), sql.Int, batch[i].importJobId)
    req.input(p('SourceRowNumber'), sql.Int, batch[i].sourceRowNumber)
    req.input(p('SourceColumnName'), sql.NVarChar(255), batch[i].sourceColumnName)
    req.input(p('SourceValue'), sql.NVarChar(2000), batch[i].sourceValue)
    req.input(p('ErrorCode'), sql.NVarChar(50), batch[i].errorCode)
    req.input(p('ErrorMessage'), sql.NVarChar(1000), batch[i].errorMessage)
    req.input(p('Severity'), sql.NVarChar(20), batch[i].severity)
    return `(@${p('AccountID')}, @${p('ImportJobID')}, @${p('SourceRowNumber')}, @${p('SourceColumnName')}, @${p('SourceValue')}, @${p('ErrorCode')}, @${p('ErrorMessage')}, @${p('Severity')})`
  })
  await req.query(`
    INSERT INTO dbo.ImportErrors (AccountID, ImportJobID, SourceRowNumber, SourceColumnName, SourceValue, ErrorCode, ErrorMessage, Severity)
    VALUES ${valueTuples.join(', ')}
  `)
}

export async function insertImportRecordProvenance(
  input: InsertImportRecordProvenanceInput,
  transaction?: Transaction
): Promise<number> {
  const req = transaction ? transaction.request() : (await poolPromise).request()
  const result = await req
    .input('AccountID', sql.Int, input.accountId)
    .input('ImportJobID', sql.Int, input.importJobId)
    .input('EntityType', sql.NVarChar(50), input.entityType)
    .input('EntityID', sql.Int, input.entityId)
    .input('SourceRowNumber', sql.Int, input.sourceRowNumber)
    .input('SourceNaturalKey', sql.NVarChar(255), input.sourceNaturalKey)
    .input('ActionTaken', sql.NVarChar(20), input.actionTaken)
    .query(`
      INSERT INTO dbo.ImportRecordProvenance (AccountID, ImportJobID, EntityType, EntityID, SourceRowNumber, SourceNaturalKey, ActionTaken)
      OUTPUT INSERTED.ImportRecordProvenanceID
      VALUES (@AccountID, @ImportJobID, @EntityType, @EntityID, @SourceRowNumber, @SourceNaturalKey, @ActionTaken)
    `)
  const row = result.recordset[0] as { ImportRecordProvenanceID: number }
  return row.ImportRecordProvenanceID
}

export async function insertImportUnmappedField(
  input: InsertImportUnmappedFieldInput
): Promise<number> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, input.accountId)
    .input('ImportJobID', sql.Int, input.importJobId)
    .input('EntityType', sql.NVarChar(50), input.entityType)
    .input('EntityID', sql.Int, input.entityId)
    .input('SourceColumnName', sql.NVarChar(255), input.sourceColumnName)
    .input('SourceValue', sql.NVarChar(2000), input.sourceValue)
    .input('NormalizedFieldKey', sql.NVarChar(255), input.normalizedFieldKey)
    .query(`
      INSERT INTO dbo.ImportUnmappedFields (AccountID, ImportJobID, EntityType, EntityID, SourceColumnName, SourceValue, NormalizedFieldKey)
      OUTPUT INSERTED.ImportUnmappedFieldID
      VALUES (@AccountID, @ImportJobID, @EntityType, @EntityID, @SourceColumnName, @SourceValue, @NormalizedFieldKey)
    `)
  const row = result.recordset[0] as { ImportUnmappedFieldID: number }
  return row.ImportUnmappedFieldID
}

export async function getImportErrorsByJobId(
  importJobId: number,
  accountId: number
): Promise<ImportErrorRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('ImportJobID', sql.Int, importJobId)
    .input('AccountID', sql.Int, accountId)
    .query(`
      SELECT ImportErrorID, AccountID, ImportJobID, SourceRowNumber, SourceColumnName, SourceValue, ErrorCode, ErrorMessage, Severity, CreatedAt
      FROM dbo.ImportErrors
      WHERE ImportJobID = @ImportJobID AND AccountID = @AccountID
      ORDER BY SourceRowNumber, ImportErrorID
    `)
  return (result.recordset ?? []) as ImportErrorRow[]
}

export async function getImportUnmappedFieldsByJobId(
  importJobId: number,
  accountId: number
): Promise<ImportUnmappedFieldRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('ImportJobID', sql.Int, importJobId)
    .input('AccountID', sql.Int, accountId)
    .query(`
      SELECT ImportUnmappedFieldID, AccountID, ImportJobID, EntityType, EntityID, SourceColumnName, SourceValue, NormalizedFieldKey, CreatedAt
      FROM dbo.ImportUnmappedFields
      WHERE ImportJobID = @ImportJobID AND AccountID = @AccountID
      ORDER BY SourceColumnName, ImportUnmappedFieldID
    `)
  return (result.recordset ?? []) as ImportUnmappedFieldRow[]
}
