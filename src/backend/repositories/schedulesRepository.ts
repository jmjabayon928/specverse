// src/backend/repositories/schedulesRepository.ts
import { poolPromise, sql } from '../config/db'
import type { Transaction } from 'mssql'
import type {
  ScheduleHeader,
  ScheduleColumnRow,
  ScheduleEntryRow,
  ScheduleEntryValueRow,
  ScheduleDetail,
} from '@/domain/schedules/scheduleTypes'

export type SchedulesListFilters = {
  clientId?: number
  projectId?: number
  disciplineId?: number
  subtypeId?: number
}

export async function listSchedules(
  accountId: number,
  filters: SchedulesListFilters
): Promise<ScheduleHeader[]> {
  const pool = await poolPromise
  let query = `
    SELECT ScheduleID AS scheduleId, AccountID AS accountId, DisciplineID AS disciplineId,
           SubtypeID AS subtypeId, Name AS name, Scope AS scope, ClientID AS clientId,
           ProjectID AS projectId, CreatedAt AS createdAt, CreatedBy AS createdBy,
           UpdatedAt AS updatedAt, UpdatedBy AS updatedBy
    FROM dbo.Schedules
    WHERE AccountID = @AccountID
  `
  const request = pool.request().input('AccountID', sql.Int, accountId)

  if (filters.clientId != null) {
    query += ' AND ClientID = @ClientID'
    request.input('ClientID', sql.Int, filters.clientId)
  }
  if (filters.projectId != null) {
    query += ' AND ProjectID = @ProjectID'
    request.input('ProjectID', sql.Int, filters.projectId)
  }
  if (filters.disciplineId != null) {
    query += ' AND DisciplineID = @DisciplineID'
    request.input('DisciplineID', sql.Int, filters.disciplineId)
  }
  if (filters.subtypeId != null) {
    query += ' AND SubtypeID = @SubtypeID'
    request.input('SubtypeID', sql.Int, filters.subtypeId)
  }

  query += ' ORDER BY Name, ScheduleID'

  const result = await request.query(query)
  return (result.recordset ?? []) as ScheduleHeader[]
}

export async function getScheduleById(
  accountId: number,
  scheduleId: number
): Promise<ScheduleHeader | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('ScheduleID', sql.Int, scheduleId)
    .query(`
      SELECT ScheduleID AS scheduleId, AccountID AS accountId, DisciplineID AS disciplineId,
             SubtypeID AS subtypeId, Name AS name, Scope AS scope, ClientID AS clientId,
             ProjectID AS projectId, CreatedAt AS createdAt, CreatedBy AS createdBy,
             UpdatedAt AS updatedAt, UpdatedBy AS updatedBy
      FROM dbo.Schedules
      WHERE ScheduleID = @ScheduleID AND AccountID = @AccountID
    `)
  if (result.recordset?.length === 0) {
    return null
  }
  return result.recordset[0] as ScheduleHeader
}

export async function getScheduleColumns(
  accountId: number,
  scheduleId: number
): Promise<ScheduleColumnRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('ScheduleID', sql.Int, scheduleId)
    .query(`
      SELECT ScheduleColumnID AS scheduleColumnId, AccountID AS accountId, ScheduleID AS scheduleId,
             ColumnKey AS columnKey, ColumnLabel AS columnLabel, DataType AS dataType,
             EnumOptionsJSON AS enumOptionsJson, DisplayOrder AS displayOrder,
             IsRequired AS isRequired, IsEditable AS isEditable,
             CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM dbo.ScheduleColumns
      WHERE ScheduleID = @ScheduleID AND AccountID = @AccountID
      ORDER BY DisplayOrder, ScheduleColumnID
    `)
  return (result.recordset ?? []) as ScheduleColumnRow[]
}

export async function getScheduleEntries(
  accountId: number,
  scheduleId: number
): Promise<ScheduleEntryRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('ScheduleID', sql.Int, scheduleId)
    .query(`
      SELECT ScheduleEntryID AS scheduleEntryId, AccountID AS accountId, ScheduleID AS scheduleId,
             AssetID AS assetId, SheetID AS sheetId, RowDataJSON AS rowDataJson,
             CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM dbo.ScheduleEntries
      WHERE ScheduleID = @ScheduleID AND AccountID = @AccountID
      ORDER BY ScheduleEntryID
    `)
  return (result.recordset ?? []) as ScheduleEntryRow[]
}

export async function getScheduleEntryValuesForSchedule(
  accountId: number,
  scheduleId: number
): Promise<ScheduleEntryValueRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('ScheduleID', sql.Int, scheduleId)
    .query(`
      SELECT sev.ScheduleEntryValueID AS scheduleEntryValueId, sev.AccountID AS accountId,
             sev.ScheduleEntryID AS scheduleEntryId, sev.ScheduleColumnID AS scheduleColumnId,
             sev.ValueString AS valueString, sev.ValueNumber AS valueNumber,
             sev.ValueBool AS valueBool, sev.ValueDate AS valueDate, sev.ValueJson AS valueJson,
             sev.UpdatedAt AS updatedAt, sev.UpdatedBy AS updatedBy
      FROM dbo.ScheduleEntryValues sev
      INNER JOIN dbo.ScheduleEntries se ON se.ScheduleEntryID = sev.ScheduleEntryID AND se.AccountID = sev.AccountID
      WHERE se.ScheduleID = @ScheduleID AND sev.AccountID = @AccountID
    `)
  return (result.recordset ?? []) as ScheduleEntryValueRow[]
}

export async function getScheduleDetail(
  accountId: number,
  scheduleId: number
): Promise<ScheduleDetail | null> {
  const schedule = await getScheduleById(accountId, scheduleId)
  if (!schedule) {
    return null
  }
  const [columns, entries, values] = await Promise.all([
    getScheduleColumns(accountId, scheduleId),
    getScheduleEntries(accountId, scheduleId),
    getScheduleEntryValuesForSchedule(accountId, scheduleId),
  ])
  return { schedule, columns, entries, values }
}

export type CreateScheduleInput = {
  accountId: number
  disciplineId: number
  subtypeId: number
  name: string
  scope: string | null
  clientId: number | null
  projectId: number | null
  createdBy: number
  updatedBy: number
}

export async function createSchedule(input: CreateScheduleInput): Promise<ScheduleHeader> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, input.accountId)
    .input('DisciplineID', sql.Int, input.disciplineId)
    .input('SubtypeID', sql.Int, input.subtypeId)
    .input('Name', sql.NVarChar(500), input.name)
    .input('Scope', sql.NVarChar(sql.MAX), input.scope)
    .input('ClientID', sql.Int, input.clientId)
    .input('ProjectID', sql.Int, input.projectId)
    .input('CreatedBy', sql.Int, input.createdBy)
    .input('UpdatedBy', sql.Int, input.updatedBy)
    .query(`
      INSERT INTO dbo.Schedules (AccountID, DisciplineID, SubtypeID, Name, Scope, ClientID, ProjectID, CreatedBy, UpdatedBy)
      OUTPUT INSERTED.ScheduleID AS scheduleId, INSERTED.AccountID AS accountId,
             INSERTED.DisciplineID AS disciplineId, INSERTED.SubtypeID AS subtypeId,
             INSERTED.Name AS name, INSERTED.Scope AS scope, INSERTED.ClientID AS clientId,
             INSERTED.ProjectID AS projectId, INSERTED.CreatedAt AS createdAt,
             INSERTED.CreatedBy AS createdBy, INSERTED.UpdatedAt AS updatedAt, INSERTED.UpdatedBy AS updatedBy
      VALUES (@AccountID, @DisciplineID, @SubtypeID, @Name, @Scope, @ClientID, @ProjectID, @CreatedBy, @UpdatedBy)
    `)
  return result.recordset[0] as ScheduleHeader
}

export async function updateSchedule(
  accountId: number,
  scheduleId: number,
  name: string | undefined,
  scope: string | null | undefined,
  updatedBy: number
): Promise<boolean> {
  const pool = await poolPromise
  if (name === undefined && scope === undefined) {
    return true
  }
  let query = 'UPDATE dbo.Schedules SET UpdatedBy = @UpdatedBy, UpdatedAt = GETDATE()'
  const request = pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('ScheduleID', sql.Int, scheduleId)
    .input('UpdatedBy', sql.Int, updatedBy)
  if (name !== undefined) {
    query += ', Name = @Name'
    request.input('Name', sql.NVarChar(500), name)
  }
  if (scope !== undefined) {
    query += ', Scope = @Scope'
    request.input('Scope', sql.NVarChar(sql.MAX), scope)
  }
  query += ' WHERE ScheduleID = @ScheduleID AND AccountID = @AccountID'
  const result = await request.query(query)
  const total = Array.isArray(result.rowsAffected)
    ? result.rowsAffected.reduce((s, n) => s + n, 0)
    : 0
  return total > 0
}

export type ColumnInput = {
  scheduleColumnId?: number
  columnKey: string
  columnLabel: string
  dataType: string
  enumOptionsJson: string | null
  displayOrder: number
  isRequired: boolean
  isEditable: boolean
}

export async function replaceScheduleColumns(
  tx: Transaction,
  accountId: number,
  scheduleId: number,
  columns: ColumnInput[],
  createdBy: number
): Promise<ScheduleColumnRow[]> {
  const req = new sql.Request(tx)

  const existing = await req
    .input('AccountID', sql.Int, accountId)
    .input('ScheduleID', sql.Int, scheduleId)
    .query(`
      SELECT ScheduleColumnID AS scheduleColumnId, ColumnKey AS columnKey
      FROM dbo.ScheduleColumns
      WHERE ScheduleID = @ScheduleID AND AccountID = @AccountID
    `)
  const existingRows = (existing.recordset ?? []) as { scheduleColumnId: number; columnKey: string }[]
  const payloadIds = new Set(
    columns.map(c => c.scheduleColumnId).filter((id): id is number => id != null && id > 0)
  )
  const toDelete = existingRows.filter(r => !payloadIds.has(r.scheduleColumnId))
  for (const row of toDelete) {
    await new sql.Request(tx)
      .input('ScheduleColumnID', sql.Int, row.scheduleColumnId)
      .query('DELETE FROM dbo.ScheduleColumns WHERE ScheduleColumnID = @ScheduleColumnID')
  }

  const keyToId = new Map(existingRows.map(r => [r.columnKey, r.scheduleColumnId]))

  for (let i = 0; i < columns.length; i++) {
    const c = columns[i]
    const existingId = c.scheduleColumnId ?? keyToId.get(c.columnKey)

    if (existingId != null && existingId > 0) {
      await new sql.Request(tx)
        .input('ScheduleColumnID', sql.Int, existingId)
        .input('ColumnLabel', sql.NVarChar(255), c.columnLabel)
        .input('DataType', sql.NVarChar(50), c.dataType)
        .input('EnumOptionsJSON', sql.NVarChar(sql.MAX), c.enumOptionsJson)
        .input('DisplayOrder', sql.Int, c.displayOrder)
        .input('IsRequired', sql.Bit, c.isRequired)
        .input('IsEditable', sql.Bit, c.isEditable)
        .query(`
          UPDATE dbo.ScheduleColumns
          SET ColumnLabel = @ColumnLabel, DataType = @DataType, EnumOptionsJSON = @EnumOptionsJSON,
              DisplayOrder = @DisplayOrder, IsRequired = @IsRequired, IsEditable = @IsEditable
          WHERE ScheduleColumnID = @ScheduleColumnID
        `)
      keyToId.set(c.columnKey, existingId)
    } else {
      if (keyToId.has(c.columnKey)) {
        throw new Error('DUPLICATE_COLUMN_KEY')
      }
      const ins = await new sql.Request(tx)
        .input('AccountID', sql.Int, accountId)
        .input('ScheduleID', sql.Int, scheduleId)
        .input('ColumnKey', sql.NVarChar(100), c.columnKey)
        .input('ColumnLabel', sql.NVarChar(255), c.columnLabel)
        .input('DataType', sql.NVarChar(50), c.dataType)
        .input('EnumOptionsJSON', sql.NVarChar(sql.MAX), c.enumOptionsJson)
        .input('DisplayOrder', sql.Int, c.displayOrder)
        .input('IsRequired', sql.Bit, c.isRequired)
        .input('IsEditable', sql.Bit, c.isEditable)
        .input('CreatedBy', sql.Int, createdBy)
        .query(`
          INSERT INTO dbo.ScheduleColumns (AccountID, ScheduleID, ColumnKey, ColumnLabel, DataType, EnumOptionsJSON, DisplayOrder, IsRequired, IsEditable, CreatedBy)
          OUTPUT INSERTED.ScheduleColumnID AS scheduleColumnId
          VALUES (@AccountID, @ScheduleID, @ColumnKey, @ColumnLabel, @DataType, @EnumOptionsJSON, @DisplayOrder, @IsRequired, @IsEditable, @CreatedBy)
        `)
      const newId = (ins.recordset[0] as { scheduleColumnId: number }).scheduleColumnId
      keyToId.set(c.columnKey, newId)
      existingRows.push({ scheduleColumnId: newId, columnKey: c.columnKey })
    }
  }

  const cols = await new sql.Request(tx)
    .input('AccountID', sql.Int, accountId)
    .input('ScheduleID', sql.Int, scheduleId)
    .query(`
      SELECT ScheduleColumnID AS scheduleColumnId, AccountID AS accountId, ScheduleID AS scheduleId,
             ColumnKey AS columnKey, ColumnLabel AS columnLabel, DataType AS dataType,
             EnumOptionsJSON AS enumOptionsJson, DisplayOrder AS displayOrder,
             IsRequired AS isRequired, IsEditable AS isEditable,
             CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM dbo.ScheduleColumns
      WHERE ScheduleID = @ScheduleID AND AccountID = @AccountID
      ORDER BY DisplayOrder, ScheduleColumnID
    `)
  return (cols.recordset ?? []) as ScheduleColumnRow[]
}

export type EntryInput = {
  scheduleEntryId?: number
  assetId: number
  sheetId: number | null
  rowDataJson: string | null
  values: Array<{
    columnKey: string
    valueString: string | null
    valueNumber: number | null
    valueBool: boolean | null
    valueDate: string | null
    valueJson: string | null
  }>
}

export async function replaceScheduleEntries(
  tx: Transaction,
  accountId: number,
  scheduleId: number,
  entries: EntryInput[],
  columnKeyToId: Map<string, number>,
  createdBy: number,
  updatedBy: number
): Promise<void> {
  const existing = await new sql.Request(tx)
    .input('AccountID', sql.Int, accountId)
    .input('ScheduleID', sql.Int, scheduleId)
    .query(`
      SELECT ScheduleEntryID AS scheduleEntryId
      FROM dbo.ScheduleEntries
      WHERE ScheduleID = @ScheduleID AND AccountID = @AccountID
    `)
  const existingIds = new Set(
    (existing.recordset ?? []).map((r: { scheduleEntryId: number }) => r.scheduleEntryId)
  )
  const payloadEntryIds = new Set(
    entries.map(e => e.scheduleEntryId).filter((id): id is number => id != null && id > 0)
  )
  const toDeleteEntries = [...existingIds].filter(id => !payloadEntryIds.has(id))
  for (const entryId of toDeleteEntries) {
    await new sql.Request(tx)
      .input('ScheduleEntryID', sql.Int, entryId)
      .query('DELETE FROM dbo.ScheduleEntryValues WHERE ScheduleEntryID = @ScheduleEntryID')
    await new sql.Request(tx)
      .input('ScheduleEntryID', sql.Int, entryId)
      .query('DELETE FROM dbo.ScheduleEntries WHERE ScheduleEntryID = @ScheduleEntryID')
  }

  const entryIdMap = new Map<number, number>()
  for (const e of entries) {
    let entryId: number
    if (e.scheduleEntryId != null && e.scheduleEntryId > 0 && existingIds.has(e.scheduleEntryId)) {
      entryId = e.scheduleEntryId
      await new sql.Request(tx)
        .input('ScheduleEntryID', sql.Int, entryId)
        .input('SheetID', sql.Int, e.sheetId)
        .input('RowDataJSON', sql.NVarChar(sql.MAX), e.rowDataJson)
        .query(`
          UPDATE dbo.ScheduleEntries SET SheetID = @SheetID, RowDataJSON = @RowDataJSON
          WHERE ScheduleEntryID = @ScheduleEntryID
        `)
    } else {
      const ins = await new sql.Request(tx)
        .input('AccountID', sql.Int, accountId)
        .input('ScheduleID', sql.Int, scheduleId)
        .input('AssetID', sql.Int, e.assetId)
        .input('SheetID', sql.Int, e.sheetId)
        .input('RowDataJSON', sql.NVarChar(sql.MAX), e.rowDataJson)
        .input('CreatedBy', sql.Int, createdBy)
        .query(`
          INSERT INTO dbo.ScheduleEntries (AccountID, ScheduleID, AssetID, SheetID, RowDataJSON, CreatedBy)
          OUTPUT INSERTED.ScheduleEntryID AS scheduleEntryId
          VALUES (@AccountID, @ScheduleID, @AssetID, @SheetID, @RowDataJSON, @CreatedBy)
        `)
      entryId = (ins.recordset[0] as { scheduleEntryId: number }).scheduleEntryId
    }
    entryIdMap.set(entryId, entryId)

    await new sql.Request(tx)
      .input('ScheduleEntryID', sql.Int, entryId)
      .query('DELETE FROM dbo.ScheduleEntryValues WHERE ScheduleEntryID = @ScheduleEntryID')

    for (const v of e.values) {
      const colId = columnKeyToId.get(v.columnKey)
      if (colId == null) {
        throw new Error('UNKNOWN_COLUMN_KEY')
      }
      const valueDate = v.valueDate != null && v.valueDate !== '' ? new Date(v.valueDate) : null
      const typedCount = [
        v.valueString != null && v.valueString !== '',
        v.valueNumber != null,
        v.valueBool != null,
        valueDate != null,
        v.valueJson != null && v.valueJson !== '',
      ].filter(Boolean).length
      if (typedCount > 1) {
        throw new Error('MULTIPLE_VALUES_PER_CELL')
      }

      await new sql.Request(tx)
        .input('AccountID', sql.Int, accountId)
        .input('ScheduleEntryID', sql.Int, entryId)
        .input('ScheduleColumnID', sql.Int, colId)
        .input('ValueString', sql.NVarChar(sql.MAX), v.valueString ?? null)
        .input('ValueNumber', sql.Float, v.valueNumber ?? null)
        .input('ValueBool', sql.Bit, v.valueBool ?? null)
        .input('ValueDate', sql.DateTime2, valueDate)
        .input('ValueJson', sql.NVarChar(sql.MAX), v.valueJson ?? null)
        .input('UpdatedBy', sql.Int, updatedBy)
        .query(`
          INSERT INTO dbo.ScheduleEntryValues (AccountID, ScheduleEntryID, ScheduleColumnID, ValueString, ValueNumber, ValueBool, ValueDate, ValueJson, UpdatedBy)
          VALUES (@AccountID, @ScheduleEntryID, @ScheduleColumnID, @ValueString, @ValueNumber, @ValueBool, @ValueDate, @ValueJson, @UpdatedBy)
        `)
    }
  }
}
