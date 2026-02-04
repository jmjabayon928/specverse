// src/backend/services/filledSheetService.ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { poolPromise, sql } from '../config/db'
import { insertAuditLog } from '../database/auditQueries'
import {
  getValueSetId,
  ensureRequirementValueSet,
  ensureRequirementValueSetInTransaction,
  getValueSetStatus,
} from '../database/valueSetQueries'
import { notifyUsers } from '../utils/notifyUsers'
import { createRevision } from '../database/sheetRevisionQueries'
import { AppError } from '../errors/AppError'
import type {
  InfoField,
  SheetStatus,
  UnifiedSheet,
  UnifiedSubsheet,
  AttachmentMeta,
  NoteCreatePayload,
  NoteUpdatePayload,
  NoteType,
  SheetNoteDTO,
  SheetAttachmentDTO,
  RequiredTemplateField,
} from '@/domain/datasheets/sheetTypes'
import type { AuditContext } from '@/domain/audit/auditTypes'
import { convertToUSC } from '@/utils/unitConversionTable'
import { getSheetTranslations } from '@/backend/services/translationService'
import { sheetBelongsToAccount } from '@/backend/services/sheetAccessService'
import { applySheetTranslations } from '@/utils/applySheetTranslations'
import { generateDatasheetPDF } from '@/utils/generateDatasheetPDF'
import { generateDatasheetExcel } from '@/utils/generateDatasheetExcel'

type UOM = 'SI' | 'USC'

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {
    // directory already exists or cannot be created, nothing else to do here
  }
}

export type CreateFilledNoteInput = {
  sheetId: number
  noteTypeId: number
  body: string
  createdBy?: number | null
}

function buildAttachmentUrl(
  a: Pick<SheetAttachmentDTO, 'storageProvider' | 'storedName' | 'storagePath'>
): string {
  const provider = a.storageProvider?.toLowerCase?.()

  if (provider === 'local') {
    return `/api/backend/files/${encodeURIComponent(a.storedName)}`
  }

  if (provider === 's3') {
    return `/api/backend/files/s3/${encodeURIComponent(a.storagePath)}`
  }

  return a.storagePath || ''
}

export type CreatedAttachmentDTO = {
  attachmentId: number
  sheetAttachmentId: number
  orderIndex: number
  originalName: string
  storedName: string
  contentType: string
  fileSizeBytes: number
  storageProvider: string
  storagePath: string
  sha256: string | null
  uploadedBy: number | null
  uploadedAt: string // ISO
  fileUrl: string // convenient for UI (same as storagePath for 'public')
}

export type CreateAttachmentInput = {
  sheetId: number
  originalName: string
  storedName: string
  contentType: string
  fileSizeBytes: number
  storageProvider: string
  storagePath: string
  sha256?: string | null
  uploadedBy?: number | null
}

/* ──────────────────────────────────────────────────────────────
   Queries for filled sheet listing (account-scoped: only caller's account)
   ────────────────────────────────────────────────────────────── */

export const fetchAllFilled = async (accountId: number) => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .query(`
    SELECT 
      s.SheetID AS sheetId,
      s.SheetName AS sheetName,
      s.SheetDesc AS sheetDesc,
      s.CategoryID AS categoryId,
      c.CategoryName AS categoryName,
      s.PreparedByID AS preparedById,
      u.FirstName + ' ' + u.LastName AS preparedByName,
      s.RevisionDate AS revisionDate,
      s.Status AS status,
      s.DisciplineID AS disciplineId,
      d.Name AS disciplineName,
      s.SubtypeID AS subtypeId,
      st.Name AS subtypeName
    FROM Sheets s
    LEFT JOIN Categories c ON s.CategoryID = c.CategoryID
    LEFT JOIN Users u ON s.PreparedByID = u.UserID
    LEFT JOIN dbo.Disciplines d ON d.DisciplineID = s.DisciplineID
    LEFT JOIN dbo.DatasheetSubtypes st ON st.SubtypeID = s.SubtypeID
    WHERE s.IsTemplate = 0 AND s.AccountID = @AccountID
    ORDER BY s.SheetID DESC
  `)

  return result.recordset ?? []
}

export async function getRequiredTemplateFields(templateId: number): Promise<RequiredTemplateField[]> {
  const pool = await poolPromise
  const req = pool.request()
  req.input('TemplateID', sql.Int, templateId)

  const rs = await req.query<{
    InfoTemplateID: number
    Required: boolean | number
    InfoType: string | null
    Label: string | null
  }>(`
    SELECT t.InfoTemplateID, t.Required, t.InfoType, t.Label
    FROM dbo.SubSheets s
    JOIN dbo.InformationTemplates t ON t.SubID = s.SubID
    WHERE s.SheetID = @TemplateID
    ORDER BY s.OrderIndex, t.OrderIndex;
  `)

  return rs.recordset.map(r => ({
    infoTemplateId: r.InfoTemplateID,
    required: r.Required === true || r.Required === 1,
    infoType: r.InfoType ?? 'varchar',
    label: r.Label ?? null,
  }))
}

/* ──────────────────────────────────────────────────────────────
   Creation flow for filled sheets
   ────────────────────────────────────────────────────────────── */

export async function createFilledSheet(
  data: UnifiedSheet & { fieldValues: Record<string, string> },
  context: AuditContext,
  accountId: number
): Promise<{ sheetId: number }> {
  const templateIdNum = validateTopLevel(data)
  const templateBelongs = await sheetBelongsToAccount(templateIdNum, accountId)
  if (!templateBelongs) {
    throw new AppError('Template not found.', 404)
  }

  return runInTransaction(async tx => {
    const templateMetaResult = await tx.request()
      .input('TemplateID', sql.Int, templateIdNum)
      .query<{ Status: string; IsLatest: number; IsTemplate: number }>(`
        SELECT Status, CAST(IsLatest AS INT) AS IsLatest, CAST(IsTemplate AS INT) AS IsTemplate
        FROM Sheets WHERE SheetID = @TemplateID
      `)
    const templateMeta = templateMetaResult.recordset[0]
    if (!templateMeta) {
      throw new AppError('Template not found.', 400)
    }
    if (templateMeta.IsTemplate !== 1) {
      throw new AppError('Filled sheets can only be created from a template. The given sheet is not a template.', 400)
    }
    if (templateMeta.Status !== 'Approved') {
      throw new AppError(
        `Filled sheets can only be created from an approved template. Template status: ${templateMeta.Status}.`,
        409
      )
    }
    if (templateMeta.IsLatest !== 1) {
      throw new AppError(
        'Filled sheets can only be created from the latest version of the template.',
        409
      )
    }

    const templateRows = await fetchTemplateFields(tx, templateIdNum)
    const fieldMap = buildTemplateFieldMap(templateRows)

    const infoTemplateIds = templateRows.map(r => r.InfoTemplateID)
    const optionsMap = await fetchOptionsForInfoTemplateIds(tx, infoTemplateIds)
    const fieldMetaByInfoTemplateId = buildFieldMetaByInfoTemplateId(templateRows, optionsMap)
    const valuesKeyedByTemplateId = buildValuesKeyedByTemplateId(data, templateRows)
    const valueErrors = validateFilledValues(fieldMetaByInfoTemplateId, valuesKeyedByTemplateId)
    if (valueErrors.length > 0) {
      if (
        process.env.NODE_ENV !== 'production' &&
        process.env.SPECVERSE_DEBUG_FILLED_VALIDATE === '1'
      ) {
        const watchIds = new Set([3792, 3795, 3796, 3797])
        console.debug('[FILLED_VALIDATE]', {
          templateId: data.templateId,
          errorCount: valueErrors.length,
        })
        for (const err of valueErrors) {
          if (!watchIds.has(err.infoTemplateId)) continue
          const id = err.infoTemplateId
          const raw = valuesKeyedByTemplateId[String(id)]
          const rawType = typeof raw
          const trimmed = String(raw ?? '').trim()
          const trimmedLen = trimmed.length
          const meta = fieldMetaByInfoTemplateId[id]
          const optionsRaw = meta?.options ?? []
          const optionsNormalized = optionsRaw.map((o: string) => String(o).trim())
          const match = optionsNormalized.length > 0 && optionsNormalized.includes(trimmed)
          const optionsCodePointsSample = optionsNormalized.slice(0, 3).map((o: string) => codePoints(o))
          const logObj: Record<string, unknown> = {
            id,
            raw,
            rawType,
            trimmed,
            trimmedLen,
            trimmedCodePoints: codePoints(trimmed),
            infoType: meta?.infoType,
            required: meta?.required,
            optionsRaw,
            optionsNormalized,
            optionsCodePointsSample,
            match,
          }
          if (id === 3792 || id === 3795) {
            const numberValue = typeof raw === 'number' ? raw : Number(trimmed)
            logObj.numberValue = numberValue
            logObj.isFinite = Number.isFinite(numberValue)
          }
          console.debug('[FILLED_VALIDATE]', logObj)
        }
      }
      throw new AppError('Validation failed', 400, true, { fieldErrors: valueErrors })
    }

    const templateSheetRow = await tx.request()
      .input('TemplateID', sql.Int, templateIdNum)
      .query<{ DisciplineID: number | null; SubtypeID: number | null }>(`
        SELECT DisciplineID, SubtypeID FROM Sheets WHERE SheetID = @TemplateID
      `)
    const templateSheet = templateSheetRow.recordset[0]
    const disciplineId = templateSheet?.DisciplineID ?? data.disciplineId ?? null
    const subtypeId = templateSheet?.SubtypeID ?? data.subtypeId ?? null
    const dataWithDiscipline: UnifiedSheet & { fieldValues: Record<string, string> } = {
      ...data,
      disciplineId: disciplineId ?? undefined,
      subtypeId: subtypeId ?? undefined,
    }

    const sheetId = await insertSheet(tx, dataWithDiscipline, context.userId, templateIdNum, accountId)
    const valueSetId = await ensureRequirementValueSetInTransaction(tx, sheetId, context.userId, accountId)
    await cloneSubsheetsAndFields(tx, sheetId, dataWithDiscipline, fieldMap, valueSetId, accountId)

    await writeAuditAndNotify(sheetId, dataWithDiscipline, context)

    return { sheetId }
  })
}

/* ──────────────────────────────────────────────────────────────
   Helpers: transactions, coercers, validation
   ────────────────────────────────────────────────────────────── */

export async function runInTransaction<T>(fn: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  const pool = await poolPromise
  const tx = new sql.Transaction(pool)
  let didBegin = false
  let didCommit = false

  try {
    await tx.begin()
    didBegin = true
    const out = await fn(tx)
    await tx.commit()
    didCommit = true
    return out
  } catch (error) {
    if (didBegin && !didCommit) {
      try {
        await tx.rollback()
      } catch (rollbackErr: unknown) {
        console.error('rollback failed', rollbackErr)
      }
    }
    throw error
  }
}

function isBlank(v: unknown): boolean {
  if (v === null) return true
  if (v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  return false
}

function nv(v: unknown): string | null {
  if (isBlank(v)) return null
  return String(v)
}

function iv(v: unknown): number | null {
  if (v === null || v === undefined || v === '') {
    return null
  }

  const n = Number(v)
  if (!Number.isFinite(n)) {
    return null
  }

  return n
}

function validateTopLevel(data: UnifiedSheet): number {
  const errors: string[] = []

  const checkRequired = (value: unknown, label: string) => {
    if (isBlank(value)) {
      errors.push(`Missing required field: ${label}`)
    }
  }

  checkRequired(data.sheetName, 'Sheet Name')
  checkRequired(data.equipmentName, 'Equipment Name')
  checkRequired(data.equipmentTagNum, 'Equipment Tag Number')
  checkRequired(data.categoryId, 'Category')
  checkRequired(data.clientId, 'Client')
  checkRequired(data.projectId, 'Project')

  const templateIdNumber = Number(data.templateId)
  const isValidTemplateId = Number.isInteger(templateIdNumber) && templateIdNumber > 0

  if (!isValidTemplateId) {
    errors.push('Invalid templateId.')
  }

  if (errors.length > 0) {
    throw new Error(`VALIDATION: ${errors.join('; ')}`)
  }

  return templateIdNumber
}

type TemplateFieldRow = {
  InfoTemplateID: number
  Required: boolean | number
  UOM: string | null
  OrderIndex: number
  SubName: string
  Label?: string | null
  InfoType?: string | null
}

async function fetchTemplateFields(
  tx: sql.Transaction,
  templateId: number
): Promise<TemplateFieldRow[]> {
  const rs = await tx.request()
    .input('TemplateID', sql.Int, templateId)
    .query(`
      SELECT t.InfoTemplateID, t.Required, t.UOM, t.OrderIndex, s.SubName, t.Label, t.InfoType
      FROM InformationTemplates t
      JOIN Subsheets s ON t.SubID = s.SubID
      WHERE s.SheetID = @TemplateID
      ORDER BY s.OrderIndex, t.OrderIndex
    `)

  return (rs.recordset ?? []) as TemplateFieldRow[]
}

async function fetchOptionsForInfoTemplateIds(
  tx: sql.Transaction,
  infoTemplateIds: number[]
): Promise<Record<number, string[]>> {
  if (infoTemplateIds.length === 0) return {}

  const request = tx.request()
  for (let i = 0; i < infoTemplateIds.length; i += 1) {
    request.input(`id${i}`, sql.Int, infoTemplateIds[i])
  }
  const placeholders = infoTemplateIds.map((_, i) => `@id${i}`).join(', ')
  const rs = await request.query(`
    SELECT InfoTemplateID, OptionValue, SortOrder
    FROM InformationTemplateOptions
    WHERE InfoTemplateID IN (${placeholders})
    ORDER BY InfoTemplateID, SortOrder
  `)

  const map: Record<number, string[]> = {}
  for (const row of rs.recordset ?? []) {
    const id = (row as { InfoTemplateID: number; OptionValue: string; SortOrder: number }).InfoTemplateID
    const val = (row as { InfoTemplateID: number; OptionValue: string; SortOrder: number }).OptionValue
    if (!map[id]) map[id] = []
    map[id].push(val)
  }
  return map
}

function buildFieldMetaByInfoTemplateId(
  rows: TemplateFieldRow[],
  optionsMap: Record<number, string[]>
): Record<number, FilledFieldMeta> {
  const map: Record<number, FilledFieldMeta> = {}
  for (const row of rows) {
    const rawOptions = optionsMap[row.InfoTemplateID] ?? []
    const options = rawOptions.map(o => (typeof o === 'string' ? o.trim() : String(o).trim()))
    map[row.InfoTemplateID] = {
      required: row.Required === true || row.Required === 1,
      label: row.Label ?? null,
      infoType: (row.InfoType ?? 'varchar').toString(),
      options,
    }
  }
  return map
}

/**
 * Build values keyed by template InfoTemplateID from create payload.
 * Primary/authoritative source: fieldValues[String(infoTemplateId)].
 * Legacy (field.id / field.originalId) is fallback only; OrderIndex is not used for value lookup.
 */
function buildValuesKeyedByTemplateId(
  data: UnifiedSheet & { fieldValues: Record<string, string> },
  templateRows: TemplateFieldRow[]
): Record<string, string> {
  const out: Record<string, string> = {}
  const subsheets = data.subsheets ?? []

  for (const row of templateRows) {
    const primary = data.fieldValues[String(row.InfoTemplateID)]
    const sub = subsheets.find(s => (s.name ?? '').trim() === (row.SubName ?? '').trim())
    const field = sub?.fields?.[row.OrderIndex]
    const legacy =
      field != null
        ? data.fieldValues[String(field.id)] ?? data.fieldValues[String(field.originalId)]
        : undefined
    const raw = primary ?? legacy
    out[String(row.InfoTemplateID)] = typeof raw === 'string' ? raw : (raw != null ? String(raw) : '')
  }

  return out
}

/** Fetch field meta (InfoType, options, required, label) for given InfoTemplateIDs (e.g. filled sheet field IDs). */
async function fetchFieldMetaByInfoTemplateIds(
  tx: sql.Transaction,
  infoTemplateIds: number[]
): Promise<Record<number, FilledFieldMeta>> {
  if (infoTemplateIds.length === 0) return {}

  const request = tx.request()
  for (let i = 0; i < infoTemplateIds.length; i += 1) {
    request.input(`id${i}`, sql.Int, infoTemplateIds[i])
  }
  const placeholders = infoTemplateIds.map((_, i) => `@id${i}`).join(', ')
  const rs = await request.query(`
    SELECT InfoTemplateID, Required, Label, InfoType
    FROM InformationTemplates
    WHERE InfoTemplateID IN (${placeholders})
  `)

  const rows = (rs.recordset ?? []) as Array<{
    InfoTemplateID: number
    Required: boolean | number
    Label?: string | null
    InfoType?: string | null
  }>
  const optionsMap = await fetchOptionsForInfoTemplateIds(tx, infoTemplateIds)

  const map: Record<number, FilledFieldMeta> = {}
  for (const row of rows) {
    map[row.InfoTemplateID] = {
      required: row.Required === true || row.Required === 1,
      label: row.Label ?? null,
      infoType: (row.InfoType ?? 'varchar').toString(),
      options: optionsMap[row.InfoTemplateID] ?? [],
    }
  }
  return map
}

function buildTemplateFieldMap(
  rows: Array<{
    InfoTemplateID: number
    Required: boolean | number
    UOM: string | null
    OrderIndex: number
    SubName: string
    Label?: string | null
  }>
): Record<string, Record<number, { required: boolean; uom: string | null; label?: string | null }>> {
  const map: Record<string, Record<number, { required: boolean; uom: string | null; label?: string | null }>> = {}

  for (const row of rows) {
    if (!map[row.SubName]) {
      map[row.SubName] = {}
    }

    map[row.SubName][row.OrderIndex] = {
      required: row.Required === true || row.Required === 1,
      uom: row.UOM,
      label: row.Label ?? null,
    }
  }

  return map
}

/* ──────────────────────────────────────────────────────────────
   Filled value validation: type + options (BE authoritative)
   ────────────────────────────────────────────────────────────── */

/** First up to 10 code points of a string (for debug / hidden-char detection). */
function codePoints(s: string): number[] {
  const out: number[] = []
  for (let i = 0; i < s.length && out.length < 10; i += 1) {
    const cp = s.codePointAt(i)
    if (cp !== undefined) out.push(cp)
    if (cp !== undefined && cp > 0xffff) i += 1
  }
  return out
}

/** Parse numeric string (allows commas, sign, decimals). Returns null if invalid. */
function parseNumericBackend(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const cleaned = trimmed.replaceAll(/(?<=\d)[, ](?=\d{3}\b)/g, '')
  const re = /^[+-]?(?:\d+|\d+\.\d+|\.\d+)$/
  if (!re.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Parse as integer only; rejects decimals. */
function parseIntegerBackend(value: string): number | null {
  const n = parseNumericBackend(value)
  if (n == null) return null
  return Number.isInteger(n) ? n : null
}

export type FilledFieldMeta = {
  required: boolean
  label: string | null
  infoType: string
  options: string[]
}

export type FilledValueError = {
  infoTemplateId: number
  message: string
  label?: string | null
  optionsPreview?: string[]
  optionsCount?: number
}

/**
 * Validate filled sheet values: required, int/decimal type, options membership.
 * Returns list of errors; empty if valid.
 */
export function validateFilledValues(
  fieldMetaByInfoTemplateId: Record<number, FilledFieldMeta>,
  values: Record<string, string>
): FilledValueError[] {
  const errors: FilledValueError[] = []

  for (const [idStr, meta] of Object.entries(fieldMetaByInfoTemplateId)) {
    const infoTemplateId = Number(idStr)
    if (!Number.isInteger(infoTemplateId)) continue

    const key = String(infoTemplateId)
    const raw = values[key]
    const trimmed = typeof raw === 'string' ? raw.trim() : (typeof raw === 'number' ? (Number.isFinite(raw) ? String(raw) : '') : String(raw ?? '').trim())

    if (meta.required && trimmed === '') {
      errors.push({
        infoTemplateId,
        message: 'This field is required.',
        label: meta.label,
      })
      continue
    }

    if (trimmed === '') continue

    const infoType = (meta.infoType ?? 'varchar').toLowerCase()

    if (infoType === 'int') {
      const parsed =
        typeof raw === 'number' ? (Number.isInteger(raw) ? raw : null) : parseIntegerBackend(trimmed)
      if (parsed === null) {
        errors.push({
          infoTemplateId,
          message: 'Enter a whole number.',
          label: meta.label,
        })
      }
      continue
    }

    if (infoType === 'decimal') {
      const valid =
        typeof raw === 'number' ? Number.isFinite(raw) : parseNumericBackend(trimmed) !== null
      if (!valid) {
        errors.push({
          infoTemplateId,
          message: 'Enter a number.',
          label: meta.label,
        })
      }
      continue
    }

    const normalizedOptions = (meta.options ?? []).map(o => String(o).trim())
    if (normalizedOptions.length > 0) {
      const received = trimmed
      if (!normalizedOptions.includes(received)) {
        const optionsPreview = normalizedOptions.slice(0, 5)
        errors.push({
          infoTemplateId,
          message: 'Choose a valid option.',
          label: meta.label,
          optionsPreview: optionsPreview.length > 0 ? optionsPreview : undefined,
          optionsCount: meta.options.length,
        })
      }
    }
  }

  return errors
}

/* ──────────────────────────────────────────────────────────────
   Helpers: inserting sheet, subsheets, templates, values
   ────────────────────────────────────────────────────────────── */

async function insertSheet(
  tx: sql.Transaction,
  data: UnifiedSheet,
  userId: number | undefined,
  templateIdNum: number,
  accountId: number
): Promise<number> {
  const rs = await tx.request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetName', sql.VarChar(255), nv(data.sheetName))
    .input('SheetDesc', sql.VarChar(255), nv(data.sheetDesc))
    .input('SheetDesc2', sql.VarChar(255), nv(data.sheetDesc2))
    .input('ClientDocNum', sql.Int, iv(data.clientDocNum))
    .input('ClientProjNum', sql.Int, iv(data.clientProjectNum))
    .input('CompanyDocNum', sql.Int, iv(data.companyDocNum))
    .input('CompanyProjNum', sql.Int, iv(data.companyProjectNum))
    .input('AreaID', sql.Int, iv(data.areaId))
    .input('PackageName', sql.VarChar(100), nv(data.packageName))
    .input('RevisionNum', sql.Int, iv(data.revisionNum))
    .input('RevisionDate', sql.Date, new Date())
    .input('PreparedByID', sql.Int, iv(userId))
    .input('PreparedByDate', sql.DateTime, new Date())
    .input('EquipmentName', sql.VarChar(150), nv(data.equipmentName))
    .input('EquipmentTagNum', sql.VarChar(150), nv(data.equipmentTagNum))
    .input('ServiceName', sql.VarChar(150), nv(data.serviceName))
    .input('RequiredQty', sql.Int, iv(data.requiredQty))
    .input('ItemLocation', sql.VarChar(255), nv(data.itemLocation))
    .input('ManuID', sql.Int, iv(data.manuId))
    .input('SuppID', sql.Int, iv(data.suppId))
    .input('InstallPackNum', sql.VarChar(100), nv(data.installPackNum))
    .input('EquipSize', sql.Int, iv(data.equipSize))
    .input('ModelNum', sql.VarChar(50), nv(data.modelNum))
    .input('Driver', sql.VarChar(150), nv(data.driver))
    .input('LocationDwg', sql.VarChar(255), nv(data.locationDwg))
    .input('PID', sql.Int, iv(data.pid))
    .input('InstallDwg', sql.VarChar(255), nv(data.installDwg))
    .input('CodeStd', sql.VarChar(255), nv(data.codeStd))
    .input('CategoryID', sql.Int, iv(data.categoryId))
    .input('ClientID', sql.Int, iv(data.clientId))
    .input('ProjectID', sql.Int, iv(data.projectId))
    .input('DisciplineID', sql.Int, iv(data.disciplineId))
    .input('SubtypeID', sql.Int, iv(data.subtypeId))
    .input('Status', sql.VarChar(50), 'Draft')
    .input('IsLatest', sql.Bit, 1)
    .input('IsTemplate', sql.Bit, 0)
    .input('AutoCADImport', sql.Bit, 0)
    .input('TemplateID', sql.Int, templateIdNum)
    .query<{ SheetID: number }>(`
      INSERT INTO Sheets (
        SheetName, SheetDesc, SheetDesc2, ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
        AreaID, PackageName, RevisionNum, RevisionDate, PreparedByID, PreparedByDate,
        EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
        ManuID, SuppID, InstallPackNum, EquipSize, ModelNum, Driver, LocationDwg, PID, InstallDwg, CodeStd,
        CategoryID, ClientID, ProjectID, DisciplineID, SubtypeID, Status, IsLatest, IsTemplate, AutoCADImport, TemplateID, AccountID
      )
      OUTPUT INSERTED.SheetID
      VALUES (
        @SheetName, @SheetDesc, @SheetDesc2, @ClientDocNum, @ClientProjNum, @CompanyDocNum, @CompanyProjNum,
        @AreaID, @PackageName, @RevisionNum, @RevisionDate, @PreparedByID, @PreparedByDate,
        @EquipmentName, @EquipmentTagNum, @ServiceName, @RequiredQty, @ItemLocation,
        @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNum, @Driver, @LocationDwg, @PID, @InstallDwg, @CodeStd,
        @CategoryID, @ClientID, @ProjectID, @DisciplineID, @SubtypeID, @Status, @IsLatest, @IsTemplate, @AutoCADImport, @TemplateID, @AccountID
      );
    `)

  return rs.recordset[0].SheetID
}

async function cloneSubsheetsAndFields(
  tx: sql.Transaction,
  sheetId: number,
  data: UnifiedSheet & { fieldValues: Record<string, string> },
  fieldMap: Record<string, Record<number, { required: boolean; uom: string | null; label?: string | null }>>,
  valueSetId: number,
  accountId: number
): Promise<void> {
  for (let i = 0; i < data.subsheets.length; i += 1) {
    const subsheet = data.subsheets[i]
    const newSubId = await insertSubsheet(tx, sheetId, subsheet.name, subsheet.id, i, accountId)

    for (let j = 0; j < subsheet.fields.length; j += 1) {
      const field = subsheet.fields[j]
      const sortIndex = field.sortOrder ?? j
      const meta = fieldMap[subsheet.name]?.[sortIndex]

      const enrichedField: InfoField = {
        ...field,
        uom: meta?.uom ?? field.uom,
        required: meta?.required ?? Boolean(field.required),
      }

      const newInfoId = await insertInfoTemplate(
        tx,
        newSubId,
        enrichedField,
        enrichedField.sortOrder ?? j,
        accountId
      )

      if (Array.isArray(enrichedField.options) && enrichedField.options.length > 0) {
        await insertInfoOptions(tx, newInfoId, enrichedField.options, accountId)
      }

      const originalId = enrichedField.id
      if (originalId === undefined || originalId === null) {
        continue
      }

      const raw = data.fieldValues[String(originalId)]
      if (!isBlank(raw)) {
        const uom = enrichedField.uom ?? ''
        await insertInfoValue(tx, newInfoId, sheetId, String(raw), valueSetId, uom, accountId)
      }
    }
  }
}

async function insertSubsheet(
  tx: sql.Transaction,
  sheetId: number,
  subName: string,
  templateSubId: number | undefined,
  orderIndex: number,
  accountId: number
): Promise<number> {
  const rs = await tx.request()
    .input('AccountID', sql.Int, accountId)
    .input('SubName', sql.VarChar(150), nv(subName))
    .input('SheetID', sql.Int, sheetId)
    .input('OrderIndex', sql.Int, orderIndex)
    .input('TemplateSubID', sql.Int, iv(templateSubId))
    .query<{ SubID: number }>(`
      INSERT INTO SubSheets (SubName, SheetID, OrderIndex, TemplateSubID, AccountID)
      OUTPUT INSERTED.SubID
      VALUES (@SubName, @SheetID, @OrderIndex, @TemplateSubID, @AccountID);
    `)

  return rs.recordset[0].SubID
}

async function insertInfoTemplate(
  tx: sql.Transaction,
  subId: number,
  field: InfoField,
  orderIndex: number,
  accountId: number
): Promise<number> {
  const required = Boolean(field.required)
  const uom = field.uom ?? ''

  const rs = await tx.request()
    .input('AccountID', sql.Int, accountId)
    .input('SubID', sql.Int, subId)
    .input('Label', sql.VarChar(150), nv(field.label))
    .input('InfoType', sql.VarChar(30), nv(field.infoType))
    .input('OrderIndex', sql.Int, orderIndex)
    .input('UOM', sql.VarChar(50), nv(uom))
    .input('Required', sql.Bit, required ? 1 : 0)
    .input('TemplateInfoTemplateID', sql.Int, iv(field.id))
    .query<{ InfoTemplateID: number }>(`
      INSERT INTO InformationTemplates
        (SubID, Label, InfoType, OrderIndex, UOM, Required, TemplateInfoTemplateID, AccountID)
      OUTPUT INSERTED.InfoTemplateID
      VALUES
        (@SubID, @Label, @InfoType, @OrderIndex, @UOM, @Required, @TemplateInfoTemplateID, @AccountID);
    `)

  return rs.recordset[0].InfoTemplateID
}

async function insertInfoOptions(
  tx: sql.Transaction,
  infoTemplateId: number,
  options: string[],
  accountId: number
): Promise<void> {
  for (let k = 0; k < options.length; k += 1) {
    await tx.request()
      .input('AccountID', sql.Int, accountId)
      .input('InfoTemplateID', sql.Int, infoTemplateId)
      .input('OptionValue', sql.VarChar(100), nv(options[k]))
      .input('SortOrder', sql.Int, k)
      .query(`
        INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder, AccountID)
        VALUES (@InfoTemplateID, @OptionValue, @SortOrder, @AccountID);
      `)
  }
}

async function insertInfoValue(
  tx: sql.Transaction,
  infoTemplateId: number,
  sheetId: number,
  value: string,
  valueSetId: number | null | undefined,
  uom: string | null | undefined,
  accountId: number
): Promise<void> {
  if (valueSetId != null) {
    await tx.request()
      .input('AccountID', sql.Int, accountId)
      .input('InfoTemplateID', sql.Int, infoTemplateId)
      .input('SheetID', sql.Int, sheetId)
      .input('InfoValue', sql.VarChar(sql.MAX), value)
      .input('ValueSetID', sql.Int, valueSetId)
      .input('UOM', sql.NVarChar(50), uom ?? '')
      .query(`
        INSERT INTO InformationValues (InfoTemplateID, SheetID, InfoValue, ValueSetID, UOM, AccountID)
        VALUES (@InfoTemplateID, @SheetID, @InfoValue, @ValueSetID, @UOM, @AccountID);
      `)
    return
  }
  await tx.request()
    .input('AccountID', sql.Int, accountId)
    .input('InfoTemplateID', sql.Int, infoTemplateId)
    .input('SheetID', sql.Int, sheetId)
    .input('InfoValue', sql.VarChar(sql.MAX), value)
    .query(`
      INSERT INTO InformationValues (InfoTemplateID, SheetID, InfoValue, AccountID)
      VALUES (@InfoTemplateID, @SheetID, @InfoValue, @AccountID);
    `)
}

/* ──────────────────────────────────────────────────────────────
   Audit and notifications for creation
   ────────────────────────────────────────────────────────────── */

async function writeAuditAndNotify(
  sheetId: number,
  data: UnifiedSheet & { fieldValues: Record<string, string> },
  context: AuditContext
): Promise<void> {
  if (context?.userId) {
    await insertAuditLog({
      PerformedBy: context.userId,
      TableName: 'Sheets',
      RecordID: sheetId,
      Action: 'Create Filled Sheet',
      Route: context.route ?? null,
      Method: context.method ?? null,
      StatusCode: 201,
      Changes: JSON.stringify(data),
    })
  }

  await notifyUsers({
    recipientRoleIds: [1, 2],
    sheetId,
    title: 'New Filled Sheet Created',
    message: `Filled sheet #${sheetId} has been created by User #${context.userId}.`,
    category: 'Datasheet',
    createdBy: context.userId,
  })
}

/* ──────────────────────────────────────────────────────────────
   Note types and high-level helpers
   ────────────────────────────────────────────────────────────── */

export const getAllNoteTypes = async (): Promise<NoteType[]> => {
  const pool = await poolPromise

  const result = await pool.request().query<{
    NoteTypeID: number
    NoteType: string
    Description: string | null
  }>(`
    SELECT NoteTypeID, NoteType, Description
    FROM dbo.NoteTypes
    ORDER BY NoteTypeID
  `)

  return result.recordset.map(r => ({
    noteTypeId: r.NoteTypeID,
    noteType: r.NoteType,
    description: r.Description,
  }))
}

/**
 * Handy when you need TemplateID for a given filled SheetID.
 */
export async function getFilledSheetTemplateId(sheetId: number) {
  const pool = await poolPromise
  const result = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .query('SELECT TemplateID FROM Sheets WHERE SheetID = @SheetID')

  return result.recordset[0]
}

/**
 * Resolve the latest approved template in the chain for a given source template ID.
 * Used by clone so the new filled sheet binds to the latest approved template, not the source's TemplateID.
 * Deterministic: if source is Approved and IsLatest=1 return it; else resolve latest in chain by ParentSheetID/IsLatest.
 * Throws AppError 409 if 0 or >1 templates match (or cycle, or non-template).
 */
export async function getLatestApprovedTemplateId(sourceTemplateId: number): Promise<number> {
  const pool = await poolPromise
  type TemplateRow = { SheetID: number; Status: string; IsLatest: number; IsTemplate: number; ParentSheetID: number | null }

  const sourceResult = await pool
    .request()
    .input('SheetID', sql.Int, sourceTemplateId)
    .query<TemplateRow>(`
      SELECT SheetID, Status, CAST(IsLatest AS INT) AS IsLatest, CAST(IsTemplate AS INT) AS IsTemplate, ParentSheetID
      FROM Sheets
      WHERE SheetID = @SheetID AND IsTemplate = 1
    `)
  const sourceRow = sourceResult.recordset[0]
  if (!sourceRow) {
    throw new AppError('Template not found or sheet is not a template.', 409)
  }
  if (sourceRow.Status === 'Approved' && sourceRow.IsLatest === 1) {
    return sourceRow.SheetID
  }

  const chain = new Set<number>([sourceTemplateId])
  let currentBatch: number[] = [sourceTemplateId]

  while (currentBatch.length > 0) {
    const nextBatch: number[] = []
    for (const parentId of currentBatch) {
      const childResult = await pool
        .request()
        .input('ParentSheetID', sql.Int, parentId)
        .query<{ SheetID: number }>(`
          SELECT SheetID FROM Sheets WHERE ParentSheetID = @ParentSheetID AND IsTemplate = 1
        `)
      for (const row of childResult.recordset ?? []) {
        if (chain.has(row.SheetID)) {
          throw new AppError(
            'No latest approved template found in template chain (cycle detected).',
            409
          )
        }
        chain.add(row.SheetID)
        nextBatch.push(row.SheetID)
      }
    }
    currentBatch = nextBatch
  }

  if (chain.size === 0) {
    throw new AppError('No latest approved template in chain.', 409)
  }
  const chainIds = Array.from(chain).join(',')
  const latestResult = await pool
    .request()
    .input('ChainIds', sql.VarChar(4000), chainIds)
    .query<{ SheetID: number }>(`
      SELECT SheetID FROM Sheets
      WHERE IsTemplate = 1
        AND Status = 'Approved'
        AND CAST(IsLatest AS INT) = 1
        AND SheetID IN (SELECT CAST(LTRIM(RTRIM(value)) AS INT) FROM STRING_SPLIT(@ChainIds, ',') WHERE LEN(LTRIM(RTRIM(value))) > 0)
    `)
  const rows = latestResult.recordset ?? []
  if (rows.length === 0) {
    throw new AppError('No latest approved template in chain.', 409)
  }
  if (rows.length > 1) {
    throw new AppError(
      'Multiple latest approved templates in chain; cannot resolve deterministically.',
      409
    )
  }
  return rows[0].SheetID
}

/* ──────────────────────────────────────────────────────────────
   Load a filled sheet with fields, notes, attachments
   ────────────────────────────────────────────────────────────── */

export async function getFilledSheetDetailsById(
  sheetId: number,
  lang: string = 'eng',
  uom: UOM = 'SI',
  accountId: number
) {
  const pool = await poolPromise

  const sheetResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('AccountID', sql.Int, accountId)
    .query(`
      SELECT 
        s.*,
        s.RevisionNum,
        u1.FirstName + ' ' + u1.LastName AS preparedByName,
        u2.FirstName + ' ' + u2.LastName AS verifiedByName,
        u3.FirstName + ' ' + u3.LastName AS approvedByName,
        u4.FirstName + ' ' + u4.LastName AS modifiedByName,
        u5.FirstName + ' ' + u5.LastName AS rejectedByName,
        a.AreaName,
        m.ManuName AS manuName,
        sup.SuppName AS suppName,
        cat.CategoryName,
        c.ClientName,
        c.ClientLogo,
        p.ProjName AS projectName,
        d.Name AS disciplineName,
        ds.Name AS subtypeName
      FROM Sheets s
      LEFT JOIN Users u1 ON s.PreparedByID = u1.UserID
      LEFT JOIN Users u2 ON s.VerifiedByID = u2.UserID
      LEFT JOIN Users u3 ON s.ApprovedByID = u3.UserID
      LEFT JOIN Users u4 ON s.ModifiedByID = u4.UserID
      LEFT JOIN Users u5 ON s.RejectedByID = u5.UserID
      LEFT JOIN Areas a ON s.AreaID = a.AreaID
      LEFT JOIN Manufacturers m ON s.ManuID = m.ManuID
      LEFT JOIN Suppliers sup ON s.SuppID = sup.SuppID
      LEFT JOIN Categories cat ON s.CategoryID = cat.CategoryID
      LEFT JOIN Clients c ON s.ClientID = c.ClientID
      LEFT JOIN Projects p ON s.ProjectID = p.ProjectID
      LEFT JOIN dbo.Disciplines d ON s.DisciplineID = d.DisciplineID
      LEFT JOIN dbo.DatasheetSubtypes ds ON s.SubtypeID = ds.SubtypeID
      WHERE s.SheetID = @SheetID AND s.AccountID = @AccountID
    `)

  const row = sheetResult.recordset[0]

  if (!row) {
    return null
  }

  const datasheet: UnifiedSheet = buildUnifiedSheetFromRow(row)

  const requirementValueSetId = await getValueSetId(sheetId, 'Requirement', null)
  const templatesResult =
    requirementValueSetId != null
      ? await pool.request()
          .input('SheetID', sql.Int, sheetId)
          .input('TemplateID', sql.Int, row.TemplateID)
          .input('ValueSetID', sql.Int, requirementValueSetId)
          .query(`
      SELECT 
        sub.SubID,
        sub.SubName,
        t.InfoTemplateID,
        t.Label,
        t.InfoType,
        t.UOM,
        t.Required,
        t.OrderIndex AS SortOrder,
        ivTop.InfoValue AS Value,
        COALESCE(ivTop.UOM, t.UOM) AS UOM,
        ts.SubID AS TemplateSubID,
        t.TemplateInfoTemplateID AS TemplateInfoTemplateID
      FROM Subsheets sub
      INNER JOIN InformationTemplates t ON sub.SubID = t.SubID
      OUTER APPLY (
        SELECT TOP 1 iv.InfoValue, iv.UOM
        FROM InformationValues iv
        WHERE iv.InfoTemplateID = t.InfoTemplateID
          AND (iv.ValueSetID = @ValueSetID OR (iv.ValueSetID IS NULL AND iv.SheetID = @SheetID))
        ORDER BY CASE WHEN iv.ValueSetID IS NOT NULL THEN 0 ELSE 1 END
      ) ivTop
      LEFT JOIN Subsheets ts ON ts.SheetID = @TemplateID AND ts.SubName = sub.SubName
      LEFT JOIN InformationTemplates tt ON tt.SubID = ts.SubID AND tt.OrderIndex = t.OrderIndex
      WHERE sub.SheetID = @SheetID
      ORDER BY sub.OrderIndex, t.OrderIndex;
    `)
      : await pool.request()
          .input('SheetID', sql.Int, sheetId)
          .input('TemplateID', sql.Int, row.TemplateID)
          .query(`
      SELECT 
        sub.SubID,
        sub.SubName,
        t.InfoTemplateID,
        t.Label,
        t.InfoType,
        t.UOM,
        t.Required,
        t.OrderIndex AS SortOrder,
        iv.InfoValue AS Value,
        ts.SubID AS TemplateSubID,
        t.TemplateInfoTemplateID AS TemplateInfoTemplateID
      FROM Subsheets sub
      INNER JOIN InformationTemplates t ON sub.SubID = t.SubID
      LEFT JOIN InformationValues iv ON t.InfoTemplateID = iv.InfoTemplateID AND iv.SheetID = @SheetID
      LEFT JOIN Subsheets ts ON ts.SheetID = @TemplateID AND ts.SubName = sub.SubName
      LEFT JOIN InformationTemplates tt ON tt.SubID = ts.SubID AND tt.OrderIndex = t.OrderIndex
      WHERE sub.SheetID = @SheetID
      ORDER BY sub.OrderIndex, t.OrderIndex;
    `)

  const optionsResult = await pool.request().query(`
    SELECT InfoTemplateID, OptionValue
    FROM InformationTemplateOptions
    ORDER BY InfoTemplateID, SortOrder;
  `)

  const optionMap: Record<number, Record<string, string>> = {}

  for (const optionRow of optionsResult.recordset) {
    if (!optionMap[optionRow.InfoTemplateID]) {
      optionMap[optionRow.InfoTemplateID] = {}
    }

    const count = Object.keys(optionMap[optionRow.InfoTemplateID]).length
    optionMap[optionRow.InfoTemplateID][String(count)] = optionRow.OptionValue
  }

  const rows = templatesResult.recordset
  const subsheetsMap = new Map<number, UnifiedSubsheet>()

  for (const fieldRow of rows) {
    const originalSubId = fieldRow.TemplateSubID ?? fieldRow.SubID
    const originalFieldId = fieldRow.TemplateInfoTemplateID ?? fieldRow.InfoTemplateID

    if (!subsheetsMap.has(originalSubId)) {
      subsheetsMap.set(originalSubId, {
        id: fieldRow.SubID,
        originalId: fieldRow.TemplateSubID,
        name: fieldRow.SubName,
        fields: [],
      })
    }

    let value = fieldRow.Value ?? undefined
    let displayUom = fieldRow.UOM ?? undefined

    if (uom === 'USC' && fieldRow.UOM && value !== undefined) {
      const converted = convertToUSC(value, fieldRow.UOM)
      if (converted) {
        value = converted.value
        displayUom = converted.unit
      }
    }

    const field = {
      id: fieldRow.InfoTemplateID,
      templateInfoTemplateID: fieldRow.TemplateInfoTemplateID,
      originalId: originalFieldId,
      label: fieldRow.Label,
      infoType: fieldRow.InfoType,
      uom: displayUom,
      sortOrder: fieldRow.SortOrder,
      required: Boolean(fieldRow.Required),
      options: Object.values(optionMap[fieldRow.InfoTemplateID] ?? {}),
      value,
    }

    subsheetsMap.get(originalSubId)?.fields.push(field)
  }

  datasheet.subsheets = Array.from(subsheetsMap.values())

  type NoteRow = {
    id: number
    noteTypeId: number | null
    noteTypeName: string | null
    orderIndex: number | null
    body: string | null
    createdAt: Date | string | null
    createdBy: number | null
    createdByName: string | null
  }

  const notesResult = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .query<NoteRow>(`
      SELECT
        n.NoteID       AS id,
        n.NoteTypeID   AS noteTypeId,
        nt.NoteType    AS noteTypeName,
        n.OrderIndex   AS orderIndex,
        n.NoteText     AS body,
        n.CreatedAt    AS createdAt,
        n.CreatedBy    AS createdBy,
        u.FirstName + ' ' + u.LastName AS createdByName
      FROM dbo.SheetNotes n
      LEFT JOIN dbo.NoteTypes nt ON nt.NoteTypeID = n.NoteTypeID
      LEFT JOIN dbo.Users u ON u.UserID = n.CreatedBy
      WHERE n.SheetID = @SheetID
      ORDER BY n.OrderIndex ASC, n.CreatedAt DESC
    `)

  const notes: SheetNoteDTO[] = notesResult.recordset.map(note => ({
    id: note.id,
    noteTypeId: note.noteTypeId,
    noteTypeName: note.noteTypeName ?? null,
    orderIndex: note.orderIndex,
    body: note.body ?? '',
    createdAt: note.createdAt ? new Date(note.createdAt as unknown as string).toISOString() : '',
    createdBy: note.createdBy,
    createdByName: note.createdByName ?? null,
  }))

  ;(datasheet as typeof datasheet & { notes: SheetNoteDTO[] }).notes = notes

  type AttachmentRow = {
    sheetAttachmentId: number
    orderIndex: number | null
    isFromTemplate: boolean | number | null
    linkedFromSheetId: number | null
    cloneOnCreate: boolean | number | null

    id: number
    originalName: string | null
    storedName: string | null
    contentType: string | null
    fileSizeBytes: number | null
    storageProvider: string | null
    storagePath: string | null
    sha256: string | null
    uploadedBy: number | null
    uploadedAt: Date | string | null
    isViewable: boolean | number | null
    uploadedByName: string | null
  }

  const attsResult = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT
        sa.SheetAttachmentID           AS sheetAttachmentId,
        sa.OrderIndex                  AS orderIndex,
        sa.IsFromTemplate              AS isFromTemplate,
        sa.LinkedFromSheetID           AS linkedFromSheetId,
        sa.CloneOnCreate               AS cloneOnCreate,
        sa.CreatedAt                   AS linkedCreatedAt,

        a.AttachmentID                 AS id,
        a.OriginalName                 AS originalName,
        a.StoredName                   AS storedName,
        a.ContentType                  AS contentType,
        a.FileSizeBytes                AS fileSizeBytes,
        a.StorageProvider              AS storageProvider,
        a.StoragePath                  AS storagePath,
        a.Sha256                       AS sha256,
        a.UploadedBy                   AS uploadedBy,
        a.UploadedAt                   AS uploadedAt,
        a.IsViewable                   AS isViewable,
        u.FirstName + ' ' + u.LastName AS uploadedByName
      FROM SheetAttachments sa
      INNER JOIN Attachments a
        ON a.AttachmentID = sa.AttachmentID
      LEFT JOIN Users u
        ON u.UserID = a.UploadedBy
      WHERE sa.SheetID = @SheetID
      ORDER BY sa.OrderIndex ASC, a.UploadedAt DESC
    `)

  const attRows: AttachmentRow[] = attsResult.recordset as AttachmentRow[]
  const attachments: SheetAttachmentDTO[] = attRows.map(att => {
    const isFromTemplateBool =
      typeof att.isFromTemplate === 'boolean' ? att.isFromTemplate : att.isFromTemplate === 1
    const cloneOnCreateBool =
      typeof att.cloneOnCreate === 'boolean' ? att.cloneOnCreate : att.cloneOnCreate === 1
    const isViewableBool =
      typeof att.isViewable === 'boolean' ? att.isViewable : att.isViewable === 1

    const dto: SheetAttachmentDTO = {
      sheetAttachmentId: att.sheetAttachmentId,
      orderIndex: Number(att.orderIndex ?? 0),
      isFromTemplate: isFromTemplateBool,
      linkedFromSheetId: att.linkedFromSheetId ?? null,
      cloneOnCreate: cloneOnCreateBool,

      id: att.id,
      originalName: att.originalName ?? '',
      storedName: att.storedName ?? '',
      contentType: att.contentType ?? '',
      fileSizeBytes: Number(att.fileSizeBytes ?? 0),
      storageProvider: att.storageProvider ?? '',
      storagePath: att.storagePath ?? '',
      sha256: att.sha256 ?? null,
      uploadedBy: att.uploadedBy ?? null,
      uploadedByName: att.uploadedByName ?? null,
      uploadedAt: att.uploadedAt ? new Date(att.uploadedAt as unknown as string).toISOString() : '',
      isViewable: isViewableBool,
      fileUrl: '',
    }

    dto.fileUrl = buildAttachmentUrl(dto)
    return dto
  })

  ;(datasheet as typeof datasheet & { attachments: SheetAttachmentDTO[] }).attachments = attachments

  if (lang === 'eng') {
    return { datasheet, translations: null }
  }

  const translations = await getSheetTranslations(row.TemplateID, lang)
  const translatedSheet = applySheetTranslations(datasheet, translations) as typeof datasheet & {
    notes: SheetNoteDTO[]
    attachments: SheetAttachmentDTO[]
  }

  translatedSheet.notes = (datasheet as typeof translatedSheet).notes
  translatedSheet.attachments = (datasheet as typeof translatedSheet).attachments

  return { datasheet: translatedSheet, translations }
}

/* ──────────────────────────────────────────────────────────────
   UnifiedSheet mapping
   ────────────────────────────────────────────────────────────── */

interface RawSheetRow {
  SheetID: number
  SheetName: string
  SheetDesc: string
  SheetDesc2: string
  ClientID: number
  ClientName: string
  ClientLogo: string
  ClientProjNum: string
  ClientDocNum: string
  CompanyDocNum: string
  CompanyProjNum: string
  AreaID: number
  AreaName: string
  PackageName: string
  RevisionNum: number
  RevisionDate: Date | null
  EngineeringRevision?: string | null
  ClientRevisionCode?: string | null
  PreparedByID: number
  preparedByName: string
  PreparedByDate: Date | null
  VerifiedByID: number | null
  verifiedByName: string | null
  VerifiedByDate: Date | null
  ApprovedByID: number | null
  approvedByName: string | null
  ApprovedByDate: Date | null
  RejectedByID: number | null
  rejectedByName: string | null
  RejectedByDate: Date | null
  ModifiedByID: number | null
  modifiedByName: string | null
  ModifiedByDate: Date | null
  IsTemplate: boolean
  IsLatest: boolean
  Status: string
  RejectComment: string | null
  ItemLocation: string
  RequiredQty: number
  EquipmentName: string
  EquipmentTagNum: string
  ServiceName: string
  ManuID: number
  manuName: string
  SuppID: number
  suppName: string
  InstallPackNum: string
  EquipSize: string
  ModelNum: string
  Driver: string
  LocationDwg: string
  PID: string
  InstallDwg: string
  CodeStd: string
  CategoryID: number
  CategoryName: string
  ProjectID: number
  projectName: string
  TemplateID: number
  ParentSheetID: number
  DisciplineID?: number | null
  disciplineName?: string | null
  SubtypeID?: number | null
  subtypeName?: string | null
}

function buildUnifiedSheetFromRow(row: RawSheetRow): UnifiedSheet {
  const formatDate = (value: Date | null): string => {
    if (!value) {
      return ''
    }

    return value.toISOString().split('T')[0]
  }

  const revisionDate = formatDate(row.RevisionDate)
  const preparedByDate = formatDate(row.PreparedByDate)
  const verifiedDate = formatDate(row.VerifiedByDate)
  const approvedDate = formatDate(row.ApprovedByDate)
  const rejectedDate = formatDate(row.RejectedByDate)
  const modifiedDate = formatDate(row.ModifiedByDate)

  const allowedStatuses: SheetStatus[] = [
    'Draft',
    'Rejected',
    'Modified Draft',
    'Verified',
    'Approved',
  ]

  const status: SheetStatus = allowedStatuses.includes(row.Status as SheetStatus)
    ? (row.Status as SheetStatus)
    : 'Draft'

  return {
    sheetId: row.SheetID,
    sheetName: row.SheetName,
    sheetDesc: row.SheetDesc,
    sheetDesc2: row.SheetDesc2,
    clientId: row.ClientID,
    clientName: row.ClientName,
    clientLogo: row.ClientLogo,
    clientProjectNum: Number(row.ClientProjNum),
    clientDocNum: Number(row.ClientDocNum),
    companyDocNum: Number(row.CompanyDocNum),
    companyProjectNum: Number(row.CompanyProjNum),
    areaId: row.AreaID,
    areaName: row.AreaName,
    packageName: row.PackageName,
    revisionNum: Array.isArray(row.RevisionNum) ? row.RevisionNum[0] : row.RevisionNum,
    revisionDate,
    engineeringRevision: row.EngineeringRevision ?? undefined,
    clientRevisionCode: row.ClientRevisionCode ?? undefined,
    preparedById: row.PreparedByID,
    preparedByName: row.preparedByName,
    preparedByDate,
    verifiedById: row.VerifiedByID,
    verifiedByName: row.verifiedByName ?? undefined,
    verifiedDate,
    approvedById: row.ApprovedByID,
    approvedByName: row.approvedByName ?? undefined,
    approvedDate,
    rejectedById: row.RejectedByID ?? undefined,
    rejectedByName: row.rejectedByName ?? undefined,
    rejectedByDate: rejectedDate,
    modifiedById: row.ModifiedByID ?? undefined,
    modifiedByName: row.modifiedByName ?? undefined,
    modifiedByDate: modifiedDate,
    isTemplate: row.IsTemplate,
    isLatest: row.IsLatest,
    status,
    rejectComment: row.RejectComment ?? undefined,
    itemLocation: row.ItemLocation,
    requiredQty: row.RequiredQty,
    equipmentName: row.EquipmentName,
    equipmentTagNum: row.EquipmentTagNum,
    serviceName: row.ServiceName,
    manuId: row.ManuID,
    manuName: row.manuName,
    suppId: row.SuppID,
    suppName: row.suppName,
    installPackNum: row.InstallPackNum,
    equipSize: Number(row.EquipSize),
    modelNum: row.ModelNum,
    driver: row.Driver,
    locationDwg: row.LocationDwg,
    pid: Number(row.PID),
    installDwg: row.InstallDwg,
    codeStd: row.CodeStd,
    categoryId: row.CategoryID,
    categoryName: row.CategoryName,
    projectId: row.ProjectID,
    projectName: row.projectName,
    templateId: row.TemplateID,
    parentSheetId: row.ParentSheetID,
    disciplineId: row.DisciplineID ?? null,
    disciplineName: row.disciplineName ?? null,
    subtypeId: row.SubtypeID ?? null,
    subtypeName: row.subtypeName ?? null,
    sourceFilePath: null,
    subsheets: [],
  }
}

/* ──────────────────────────────────────────────────────────────
   Update flow for filled sheets (values + change log)
   ────────────────────────────────────────────────────────────── */

const FILLED_EDITABLE_STATUSES = ['Draft', 'Modified Draft', 'Rejected'] as const
const FILLED_VERIFIABLE_STATUSES = ['Draft', 'Modified Draft'] as const

/**
 * If filled sheet is Rejected, transition to Modified Draft and clear rejection fields.
 * Call after a successful filled-sheet edit (metadata, values, notes, attachments). No-op if status is not Rejected.
 */
export async function bumpRejectedToModifiedDraftFilled(
  sheetId: number,
  userId: number
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('ModifiedByID', sql.Int, userId)
    .query(`
      UPDATE Sheets
      SET Status = 'Modified Draft',
          RejectedByID = NULL,
          RejectedByDate = NULL,
          RejectComment = NULL,
          ModifiedByID = @ModifiedByID,
          ModifiedByDate = SYSDATETIME()
      WHERE SheetID = @SheetID AND IsTemplate = 0 AND Status = 'Rejected'
    `)
}

/** Header fields that are read-only on filled sheet edit (values-only mode). */
const FILLED_HEADER_GUARD_FIELDS: ReadonlyArray<keyof UnifiedSheet> = [
  'sheetName',
  'sheetDesc',
  'sheetDesc2',
  'clientDocNum',
  'clientProjectNum',
  'companyDocNum',
  'companyProjectNum',
  'areaId',
  'packageName',
  'revisionNum',
  'revisionDate',
  'itemLocation',
  'requiredQty',
  'equipmentName',
  'equipmentTagNum',
  'serviceName',
  'manuId',
  'suppId',
  'installPackNum',
  'equipSize',
  'modelNum',
  'driver',
  'locationDwg',
  'pid',
  'installDwg',
  'codeStd',
  'categoryId',
  'clientId',
  'projectId',
]

function normalizeHeaderValueForCompare(value: unknown, key: string): string {
  if (value === null || value === undefined) return ''
  if (key === 'revisionDate' || key.endsWith('Date')) return String(value).trim()
  if (typeof value === 'number') return Number.isNaN(value) ? '' : String(value)
  return String(value).trim()
}

export const updateFilledSheet = async (
  sheetId: number,
  input: UnifiedSheet,
  updatedBy: number,
  options?: { skipRevisionCreation?: boolean; allowHeaderUpdate?: boolean }
): Promise<{ sheetId: number }> => {
  const pool = await poolPromise

  const sheetStatusResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ Status: string }>(`
      SELECT Status FROM Sheets WHERE SheetID = @SheetID AND IsTemplate = 0
    `)
  const sheetRow = sheetStatusResult.recordset[0]
  if (!sheetRow) {
    throw new AppError('Filled sheet not found', 404)
  }
  if (!FILLED_EDITABLE_STATUSES.includes(sheetRow.Status as (typeof FILLED_EDITABLE_STATUSES)[number])) {
    throw new AppError(
      `Filled sheet can only be edited when status is Draft, Modified Draft, or Rejected. Current status: ${sheetRow.Status}.`,
      409
    )
  }

  const transaction = new sql.Transaction(pool)
  let didBegin = false
  let didCommit = false

  try {
    await transaction.begin()
    didBegin = true

    const valueSetId = await ensureRequirementValueSet(sheetId, updatedBy)
    const status = await getValueSetStatus(valueSetId)
    if (status !== 'Draft') {
      throw new AppError(
        `Cannot update values: ValueSet status is ${status ?? 'unknown'}. Only Draft can be edited.`,
        409
      )
    }

    const updateTemplateIds: number[] = []
    const updateValues: Record<string, string> = {}
    for (const subsheet of input.subsheets) {
      for (const field of subsheet.fields) {
        if (field.id != null) {
          updateTemplateIds.push(field.id)
          updateValues[String(field.id)] = String(field.value ?? '')
        }
      }
    }
    const updateFieldMeta = await fetchFieldMetaByInfoTemplateIds(transaction, updateTemplateIds)
    const updateValueErrors = validateFilledValues(updateFieldMeta, updateValues)
    if (updateValueErrors.length > 0) {
      throw new AppError('Validation failed', 400, true, { fieldErrors: updateValueErrors })
    }

    const allowHeaderUpdate = options?.allowHeaderUpdate === true

    if (!allowHeaderUpdate && process.env.STRICT_FILLED_HEADER_GUARD === '1') {
      const currentRowResult = await transaction
        .request()
        .input('SheetID', sql.Int, sheetId)
        .query<{
          SheetName: string | null
          SheetDesc: string | null
          SheetDesc2: string | null
          ClientDocNum: number | null
          ClientProjNum: number | null
          CompanyDocNum: number | null
          CompanyProjNum: number | null
          AreaID: number | null
          PackageName: string | null
          RevisionNum: number | null
          RevisionDate: string | null
          ItemLocation: string | null
          RequiredQty: number | null
          EquipmentName: string | null
          EquipmentTagNum: string | null
          ServiceName: string | null
          ManuID: number | null
          SuppID: number | null
          InstallPackNum: string | null
          EquipSize: number | null
          ModelNum: string | null
          Driver: string | null
          LocationDWG: string | null
          PID: number | null
          InstallDWG: string | null
          CodeStd: string | null
          CategoryID: number | null
          ClientID: number | null
          ProjectID: number | null
        }>(`
          SELECT
            SheetName, SheetDesc, SheetDesc2,
            ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
            AreaID, PackageName, RevisionNum, RevisionDate,
            ItemLocation, RequiredQty, EquipmentName, EquipmentTagNum, ServiceName,
            ManuID, SuppID, InstallPackNum, EquipSize, ModelNum, Driver,
            LocationDWG, PID, InstallDWG, CodeStd,
            CategoryID, ClientID, ProjectID
          FROM Sheets WHERE SheetID = @SheetID
        `)
      const currentRow = currentRowResult.recordset[0]
      if (currentRow) {
        const currentHeader: Record<string, unknown> = {
          sheetName: currentRow.SheetName,
          sheetDesc: currentRow.SheetDesc,
          sheetDesc2: currentRow.SheetDesc2,
          clientDocNum: currentRow.ClientDocNum,
          clientProjectNum: currentRow.ClientProjNum,
          companyDocNum: currentRow.CompanyDocNum,
          companyProjectNum: currentRow.CompanyProjNum,
          areaId: currentRow.AreaID,
          packageName: currentRow.PackageName,
          revisionNum: currentRow.RevisionNum,
          revisionDate: currentRow.RevisionDate,
          itemLocation: currentRow.ItemLocation,
          requiredQty: currentRow.RequiredQty,
          equipmentName: currentRow.EquipmentName,
          equipmentTagNum: currentRow.EquipmentTagNum,
          serviceName: currentRow.ServiceName,
          manuId: currentRow.ManuID,
          suppId: currentRow.SuppID,
          installPackNum: currentRow.InstallPackNum,
          equipSize: currentRow.EquipSize,
          modelNum: currentRow.ModelNum,
          driver: currentRow.Driver,
          locationDwg: currentRow.LocationDWG,
          pid: currentRow.PID,
          installDwg: currentRow.InstallDWG,
          codeStd: currentRow.CodeStd,
          categoryId: currentRow.CategoryID,
          clientId: currentRow.ClientID,
          projectId: currentRow.ProjectID,
        }
        const headerFieldErrors: Array<{ field: string; message: string }> = []
        for (const key of FILLED_HEADER_GUARD_FIELDS) {
          const a = normalizeHeaderValueForCompare(input[key], key)
          const b = normalizeHeaderValueForCompare(currentHeader[key], key)
          if (a !== b) {
            headerFieldErrors.push({
              field: key,
              message: 'Header fields are read-only on filled sheet edit.',
            })
          }
        }
        if (headerFieldErrors.length > 0) {
          throw new AppError(
            'Header fields are read-only for filled sheet edit. Changes are not allowed.',
            400,
            true,
            { headerFieldErrors }
          )
        }
      }
    }

    if (allowHeaderUpdate) {
      const request = transaction.request()
      request.input('SheetID', sheetId)
      request.input('SheetName', input.sheetName)
      request.input('SheetDesc', input.sheetDesc)
      request.input('SheetDesc2', input.sheetDesc2)
      request.input('ClientDocNum', input.clientDocNum)
      request.input('ClientProjNum', input.clientProjectNum)
      request.input('CompanyDocNum', input.companyDocNum)
      request.input('CompanyProjNum', input.companyProjectNum)
      request.input('AreaID', input.areaId)
      request.input('PackageName', input.packageName)
      request.input('RevisionNum', input.revisionNum)
      request.input('RevisionDate', input.revisionDate)
      request.input('ItemLocation', input.itemLocation)
      request.input('RequiredQty', input.requiredQty)
      request.input('EquipmentName', input.equipmentName)
      request.input('EquipmentTagNum', input.equipmentTagNum)
      request.input('ServiceName', input.serviceName)
      request.input('ManuID', input.manuId)
      request.input('SuppID', input.suppId)
      request.input('InstallPackNum', input.installPackNum)
      request.input('EquipSize', input.equipSize)
      request.input('ModelNum', input.modelNum)
      request.input('Driver', input.driver)
      request.input('LocationDWG', input.locationDwg)
      request.input('PID', input.pid)
      request.input('InstallDWG', input.installDwg)
      request.input('CodeStd', input.codeStd)
      request.input('CategoryID', input.categoryId)
      request.input('ClientID', input.clientId)
      request.input('ProjectID', input.projectId)
      request.input('ModifiedByID', updatedBy)

      await request.query(`
        UPDATE Sheets SET
          SheetName = @SheetName,
          SheetDesc = @SheetDesc,
          SheetDesc2 = @SheetDesc2,
          ClientDocNum = @ClientDocNum,
          ClientProjNum = @ClientProjNum,
          CompanyDocNum = @CompanyDocNum,
          CompanyProjNum = @CompanyProjNum,
          AreaID = @AreaID,
          PackageName = @PackageName,
          RevisionNum = @RevisionNum,
          RevisionDate = @RevisionDate,
          ItemLocation = @ItemLocation,
          RequiredQty = @RequiredQty,
          EquipmentName = @EquipmentName,
          EquipmentTagNum = @EquipmentTagNum,
          ServiceName = @ServiceName,
          ManuID = @ManuID,
          SuppID = @SuppID,
          InstallPackNum = @InstallPackNum,
          EquipSize = @EquipSize,
          ModelNum = @ModelNum,
          Driver = @Driver,
          LocationDWG = @LocationDWG,
          PID = @PID,
          InstallDWG = @InstallDWG,
          CodeStd = @CodeStd,
          CategoryID = @CategoryID,
          ClientID = @ClientID,
          ProjectID = @ProjectID,
          ModifiedByID = @ModifiedByID,
          ModifiedByDate = GETDATE(),
          Status = 'Modified Draft',
          RejectedByID = NULL,
          RejectedByDate = NULL,
          RejectComment = NULL
        WHERE SheetID = @SheetID
      `)
    } else {
      const request = transaction.request()
      request.input('SheetID', sheetId)
      request.input('ModifiedByID', updatedBy)

      await request.query(`
        UPDATE Sheets SET
          ModifiedByID = @ModifiedByID,
          ModifiedByDate = GETDATE(),
          Status = 'Modified Draft',
          RejectedByID = NULL,
          RejectedByDate = NULL,
          RejectComment = NULL
        WHERE SheetID = @SheetID
      `)
    }

    const oldValuesResult = await transaction.request()
      .input('SheetID', sql.Int, sheetId)
      .input('ValueSetID', sql.Int, valueSetId)
      .query(`
        SELECT IV.InfoTemplateID, IV.InfoValue, IV.ValueSetID, IT.Label, IT.UOM
        FROM InformationValues IV
        JOIN InformationTemplates IT ON IV.InfoTemplateID = IT.InfoTemplateID
        WHERE IV.SheetID = @SheetID AND (IV.ValueSetID = @ValueSetID OR IV.ValueSetID IS NULL)
      `)

    const oldValuesMap = new Map<number, { value: string; label: string; uom: string | null }>()
    const rowsWithValueSetFirst = [...oldValuesResult.recordset].sort(
      (a, b) => (a.ValueSetID != null ? 0 : 1) - (b.ValueSetID != null ? 0 : 1)
    )
    for (const row of rowsWithValueSetFirst) {
      if (!oldValuesMap.has(row.InfoTemplateID)) {
        oldValuesMap.set(row.InfoTemplateID, {
          value: row.InfoValue,
          label: row.Label,
          uom: row.UOM,
        })
      }
    }

    const existingRowsResult = await transaction.request()
      .input('SheetID', sql.Int, sheetId)
      .input('ValueSetID', sql.Int, valueSetId)
      .query<{ InfoTemplateID: number; ValueSetID: number | null }>(`
        SELECT InfoTemplateID, ValueSetID
        FROM InformationValues
        WHERE SheetID = @SheetID AND (ValueSetID = @ValueSetID OR ValueSetID IS NULL)
      `)

    const existingRowKind = new Map<number, 'valueSet' | 'legacy'>()
    for (const row of existingRowsResult.recordset) {
      if (row.ValueSetID != null && row.ValueSetID === valueSetId) {
        existingRowKind.set(row.InfoTemplateID, 'valueSet')
      }
    }
    for (const row of existingRowsResult.recordset) {
      if (row.ValueSetID == null && !existingRowKind.has(row.InfoTemplateID)) {
        existingRowKind.set(row.InfoTemplateID, 'legacy')
      }
    }

    const templateIds = new Set<number>()
    for (const subsheet of input.subsheets) {
      for (const field of subsheet.fields) {
        if (field.id != null) templateIds.add(field.id)
      }
    }
    const templateIdsToUom = new Map<number, string | null>()
    if (templateIds.size > 0) {
      const templateIdsArr = Array.from(templateIds)
      const uomReq = transaction.request()
      for (let i = 0; i < templateIdsArr.length; i += 1) {
        uomReq.input(`p${i}`, sql.Int, templateIdsArr[i])
      }
      const uomRes = await uomReq.query<{ InfoTemplateID: number; UOM: string | null }>(`
        SELECT InfoTemplateID, UOM FROM InformationTemplates
        WHERE InfoTemplateID IN (${templateIdsArr.map((_, i) => `@p${i}`).join(',')})
      `)
      for (const r of uomRes.recordset) {
        templateIdsToUom.set(r.InfoTemplateID, r.UOM ?? null)
      }
    }

    const processedTemplateIds = new Set<number>()

    for (const subsheet of input.subsheets) {
      for (const field of subsheet.fields) {
        const templateId = field.id

        if (!templateId || processedTemplateIds.has(templateId)) {
          continue
        }

        processedTemplateIds.add(templateId)
        const newValue = field.value ?? ''
        const uomFromTemplate = templateIdsToUom.get(templateId) ?? null
        const uomStr = uomFromTemplate ?? ''

        const kind = existingRowKind.get(templateId)

        if (kind === 'valueSet') {
          await transaction.request()
            .input('ValueSetID', sql.Int, valueSetId)
            .input('InfoTemplateID', sql.Int, templateId)
            .input('InfoValue', sql.VarChar(sql.MAX), newValue)
            .input('UOM', sql.NVarChar(50), uomStr)
            .query(`
              UPDATE InformationValues
              SET InfoValue = @InfoValue, UOM = @UOM
              WHERE ValueSetID = @ValueSetID AND InfoTemplateID = @InfoTemplateID
            `)
        } else if (kind === 'legacy') {
          await transaction.request()
            .input('SheetID', sql.Int, sheetId)
            .input('InfoTemplateID', sql.Int, templateId)
            .input('InfoValue', sql.VarChar(sql.MAX), newValue)
            .input('UOM', sql.NVarChar(50), uomStr)
            .input('ValueSetID', sql.Int, valueSetId)
            .query(`
              UPDATE InformationValues
              SET InfoValue = @InfoValue, UOM = @UOM, ValueSetID = @ValueSetID
              WHERE SheetID = @SheetID AND InfoTemplateID = @InfoTemplateID AND ValueSetID IS NULL
            `)
        } else {
          await transaction.request()
            .input('InfoTemplateID', sql.Int, templateId)
            .input('SheetID', sql.Int, sheetId)
            .input('InfoValue', sql.VarChar(sql.MAX), newValue)
            .input('ValueSetID', sql.Int, valueSetId)
            .input('UOM', sql.NVarChar(50), uomStr)
            .query(`
              INSERT INTO InformationValues (InfoTemplateID, SheetID, InfoValue, ValueSetID, UOM)
              VALUES (@InfoTemplateID, @SheetID, @InfoValue, @ValueSetID, @UOM)
            `)
        }

        const previous = oldValuesMap.get(templateId)
        if (previous && previous.value !== newValue) {
          await transaction.request()
            .input('SheetID', sql.Int, sheetId)
            .input('ChangedBy', sql.Int, updatedBy)
            .input('InfoTemplateID', sql.Int, templateId)
            .input('OldValue', sql.VarChar(sql.MAX), previous.value)
            .input('NewValue', sql.VarChar(sql.MAX), newValue)
            .input('UOM', sql.VarChar(100), previous.uom)
            .query(`
              INSERT INTO ChangeLogs (
                SheetID, ChangedBy, InfoTemplateID,
                OldValue, NewValue, UOM, ChangeDate
              ) VALUES (
                @SheetID, @ChangedBy, @InfoTemplateID,
                @OldValue, @NewValue, @UOM, GETDATE()
              )
            `)
        }
      }
    }

    // Create revision snapshot (unless skipped, e.g., during restore to avoid recursion)
    if (!options?.skipRevisionCreation) {
      const snapshotStatus = input.status ?? 'Modified Draft'
      const snapshotJson = JSON.stringify(input)

      await createRevision(transaction, {
        sheetId,
        snapshotJson,
        createdById: updatedBy,
        createdByDate: new Date(),
        status: snapshotStatus,
        notes: null,
      })
    }

    await transaction.commit()
    didCommit = true

    await notifyUsers({
      recipientRoleIds: [1, 2],
      sheetId,
      title: 'Filled Datasheet Updated',
      message: `Sheet #${sheetId} has been updated.`,
      category: 'Datasheet',
      createdBy: updatedBy,
    }).catch((e: unknown) => {
      console.error('notifyUsers failed', e)
    })

    return { sheetId }
  } catch (error) {
    if (didBegin && !didCommit) {
      try {
        await transaction.rollback()
      } catch (rollbackErr: unknown) {
        console.error('rollback failed', rollbackErr)
      }
    }
    throw error
  }
}

/* ──────────────────────────────────────────────────────────────
   Verify / reject / approve flows
   ────────────────────────────────────────────────────────────── */

export async function verifyFilledSheet(
  sheetId: number,
  action: 'verify' | 'reject',
  rejectionComment: string | undefined,
  verifierId: number
) {
  const pool = await poolPromise

  const statusResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ Status: string }>(`
      SELECT Status FROM Sheets WHERE SheetID = @SheetID AND IsTemplate = 0
    `)
  const row = statusResult.recordset[0]
  if (!row) {
    throw new AppError('Filled sheet not found', 404)
  }
  if (!FILLED_VERIFIABLE_STATUSES.includes(row.Status as (typeof FILLED_VERIFIABLE_STATUSES)[number])) {
    throw new AppError(
      `Filled sheet can only be verified or rejected when status is Draft or Modified Draft. Current status: ${row.Status}.`,
      409
    )
  }

  const status = action === 'verify' ? 'Verified' : 'Rejected'

  const userResult = await pool
    .request()
    .input('UserID', sql.Int, verifierId)
    .query('SELECT FirstName FROM Users WHERE UserID = @UserID')

  const verifierName = userResult.recordset[0]?.FirstName || `User #${verifierId}`

  const request = pool.request()
    .input('SheetID', sql.Int, sheetId)
    .input('Status', sql.VarChar, status)

  if (action === 'verify') {
    request
      .input('VerifiedByID', sql.Int, verifierId)
      .input('VerifiedByDate', sql.DateTime, new Date())

    await request.query(`
      UPDATE Sheets
      SET 
        Status = @Status,
        VerifiedByID = @VerifiedByID,
        VerifiedByDate = @VerifiedByDate
      WHERE SheetID = @SheetID
    `)
  } else {
    request
      .input('RejectedByID', sql.Int, verifierId)
      .input('RejectedByDate', sql.DateTime, new Date())
      .input('RejectComment', sql.NVarChar, rejectionComment || null)

    await request.query(`
      UPDATE Sheets
      SET 
        Status = @Status,
        RejectedByID = @RejectedByID,
        RejectedByDate = @RejectedByDate,
        RejectComment = @RejectComment
      WHERE SheetID = @SheetID
    `)
  }

  await notifyUsers({
    recipientRoleIds: [1],
    sheetId,
    title: `Filled Sheet ${status}`,
    message: `Filled sheet #${sheetId} has been ${status.toLowerCase()} by ${verifierName}.`,
    category: 'Datasheet',
    createdBy: verifierId,
  })

  const engineerResult = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .query('SELECT PreparedByID FROM Sheets WHERE SheetID = @SheetID')

  const preparedById = engineerResult.recordset[0]?.PreparedByID

  if (preparedById) {
    await notifyUsers({
      recipientUserIds: [preparedById],
      sheetId,
      title: `Your filled sheet was ${status.toLowerCase()}`,
      message: `Your filled sheet #${sheetId} has been ${status.toLowerCase()} by ${verifierName}.`,
      category: 'Datasheet',
      createdBy: verifierId,
    })
  }

  const auditActionLabel = action === 'verify' ? 'Verify Filled Sheet' : 'Reject Filled Sheet'
  await insertAuditLog({
    PerformedBy: verifierId,
    TableName: 'Sheets',
    RecordID: sheetId,
    Action: auditActionLabel,
    Route: undefined,
    Method: 'POST',
    StatusCode: 200,
    Changes: JSON.stringify({
      action,
      rejectionComment: action === 'reject' ? rejectionComment : undefined,
    }).slice(0, 1000),
  }).catch((e: unknown) => {
    console.error('insertAuditLog failed', e)
  })
}

export async function approveFilledSheet(
  sheetId: number,
  action: 'approve' | 'reject',
  rejectionComment: string | undefined,
  approvedById: number
): Promise<number> {
  const pool = await poolPromise

  const statusResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ Status: string }>(`
      SELECT Status FROM Sheets WHERE SheetID = @SheetID AND IsTemplate = 0
    `)
  const row = statusResult.recordset[0]
  if (!row) {
    throw new AppError('Filled sheet not found', 404)
  }
  if (row.Status !== 'Verified') {
    throw new AppError(
      `Filled sheet can only be approved or rejected when status is Verified. Current status: ${row.Status}.`,
      409
    )
  }

  if (action === 'approve') {
    await pool
      .request()
      .input('SheetID', sql.Int, sheetId)
      .input('ApprovedByID', sql.Int, approvedById)
      .input('ApprovedByDate', sql.DateTime, new Date())
      .input('Status', sql.VarChar(50), 'Approved')
      .query(`
        UPDATE Sheets
        SET Status = @Status,
            ApprovedByID = @ApprovedByID,
            ApprovedByDate = @ApprovedByDate,
            RejectedByID = NULL,
            RejectedByDate = NULL,
            RejectComment = NULL
        WHERE SheetID = @SheetID AND IsTemplate = 0 AND Status = 'Verified'
      `)
  } else {
    await pool
      .request()
      .input('SheetID', sql.Int, sheetId)
      .input('RejectedByID', sql.Int, approvedById)
      .input('RejectedByDate', sql.DateTime, new Date())
      .input('RejectComment', sql.NVarChar, rejectionComment ?? null)
      .input('Status', sql.VarChar(50), 'Rejected')
      .query(`
        UPDATE Sheets
        SET Status = @Status,
            RejectedByID = @RejectedByID,
            RejectedByDate = @RejectedByDate,
            RejectComment = @RejectComment,
            ApprovedByID = NULL,
            ApprovedByDate = NULL
        WHERE SheetID = @SheetID AND IsTemplate = 0 AND Status = 'Verified'
      `)
  }

  const creatorResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ PreparedByID: number | null }>('SELECT PreparedByID FROM Sheets WHERE SheetID = @SheetID')

  const preparedById = creatorResult.recordset[0]?.PreparedByID

  if (preparedById != null) {
    try {
      await notifyUsers({
        recipientUserIds: [preparedById],
        sheetId,
        createdBy: approvedById,
        category: 'Datasheet',
        title: action === 'approve' ? 'Filled Sheet Approved' : 'Filled Sheet Rejected',
        message:
          action === 'approve'
            ? `Your filled sheet #${sheetId} has been approved.`
            : `Your filled sheet #${sheetId} has been rejected.`,
      })
    } catch (error) {
      console.error('Failed to send approval/rejection notification:', error)
    }
  }

  const auditActionLabel = action === 'approve' ? 'Approve Filled Sheet' : 'Reject Filled Sheet'
  await insertAuditLog({
    PerformedBy: approvedById,
    TableName: 'Sheets',
    RecordID: sheetId,
    Action: auditActionLabel,
    Route: undefined,
    Method: 'POST',
    StatusCode: 200,
    Changes: JSON.stringify({
      action,
      rejectionComment: action === 'reject' ? rejectionComment : undefined,
    }).slice(0, 1000),
  }).catch((e: unknown) => {
    console.error('insertAuditLog failed', e)
  })

  return sheetId
}

/* ──────────────────────────────────────────────────────────────
   Reference lookups for UI dropdowns
   ────────────────────────────────────────────────────────────── */

export const fetchReferenceOptions = async () => {
  const pool = await poolPromise

  const [categories, users] = await Promise.all([
    pool.query('SELECT CategoryID, CategoryName FROM Categories ORDER BY CategoryName'),
    pool.query('SELECT UserID, FirstName, LastName FROM Users ORDER BY FirstName, LastName'),
  ])

  return {
    categories: categories.recordset,
    users: users.recordset,
  }
}

/* ──────────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────────── */

export async function doesEquipmentTagExist(tag: string, projectId: number): Promise<boolean> {
  const pool = await poolPromise
  const req = pool.request()
  req.input('ProjectID', sql.Int, projectId)
  req.input('Tag', sql.NVarChar, tag)

  const rs = await req.query<{ Exists: number }>(`
    SELECT TOP 1 1 AS [Exists]
    FROM Sheets
    WHERE IsTemplate = 0 AND ProjectID = @ProjectID AND EquipmentTagNum = @Tag
  `)

  const hasRow = (rs.recordset?.length ?? 0) > 0
  return hasRow
}

/* ──────────────────────────────────────────────────────────────
   Attachments (legacy Attachments table, non-SheetAttachments)
   ────────────────────────────────────────────────────────────── */

export async function saveAttachmentMeta(
  meta: AttachmentMeta
): Promise<AttachmentMeta & { attachmentId: number }> {
  const pool = await poolPromise
  const req = pool.request()
  req.input('SheetID', sql.Int, meta.sheetId)
  req.input('FileName', sql.NVarChar, meta.originalName)
  req.input('FileUrl', sql.NVarChar, meta.relativePath)
  req.input('MimeType', sql.NVarChar, meta.mimeType)
  req.input('Size', sql.BigInt, meta.size)
  req.input('StorageKey', sql.NVarChar, null)
  req.input('UploadedBy', sql.Int, meta.uploadedBy)

  const rs = await req.query<{ AttachmentID: number }>(`
    INSERT INTO Attachments (
      SheetID, FileName, FileUrl, MimeType, Size, StorageKey, UploadedBy, UploadedAt, IsReference
    )
    VALUES (
      @SheetID, @FileName, @FileUrl, @MimeType, @Size, @StorageKey, @UploadedBy, GETDATE(), 0
    );
    SELECT CAST(SCOPE_IDENTITY() AS int) AS AttachmentID;
  `)

  const attachmentId = rs.recordset?.[0]?.AttachmentID ?? 0
  return { ...meta, attachmentId }
}

export async function getAttachmentsForSheet(
  sheetId: number
): Promise<Array<AttachmentMeta & { attachmentId: number }>> {
  const pool = await poolPromise
  const req = pool.request()
  req.input('SheetID', sql.Int, sheetId)

  const rs = await req.query<{
    AttachmentID: number
    SheetID: number
    FileName: string
    FileUrl: string
    MimeType: string | null
    Size: number | null
    UploadedBy: number | null
    UploadedAt: Date | null
  }>(`
    SELECT AttachmentID, SheetID, FileName, FileUrl, MimeType, Size, UploadedBy, UploadedAt
    FROM Attachments
    WHERE SheetID = @SheetID
    ORDER BY UploadedAt DESC, AttachmentID DESC
  `)

  const items = (rs.recordset ?? []).map(row => ({
    attachmentId: row.AttachmentID,
    sheetId: row.SheetID,
    originalName: row.FileName,
    storedName: path.basename(row.FileUrl || ''),
    size: Number(row.Size ?? 0),
    mimeType: row.MimeType ?? 'application/octet-stream',
    relativePath: row.FileUrl || '',
    uploadedBy: Number(row.UploadedBy ?? 0),
    createdAt: row.UploadedAt ? new Date(row.UploadedAt).toISOString() : undefined,
  }))

  return items
}

export async function deleteAttachmentById(
  sheetId: number,
  attachmentId: number,
  userId: number
): Promise<void> {
  const pool = await poolPromise
  const req = pool.request()
  req.input('SheetID', sql.Int, sheetId)
  req.input('AttachmentID', sql.Int, attachmentId)

  await req.query(`
    DELETE FROM Attachments WHERE AttachmentID = @AttachmentID AND SheetID = @SheetID
  `)
  await bumpRejectedToModifiedDraftFilled(sheetId, userId)
}

type SheetAttachmentRow = {
  sheetAttachmentId: number
  orderIndex: number | null
  isFromTemplate: boolean | number | null
  linkedFromSheetId: number | null
  cloneOnCreate: boolean | number | null

  id: number
  originalName: string | null
  storedName: string | null
  contentType: string | null
  fileSizeBytes: number | null
  storageProvider: string | null
  storagePath: string | null
  sha256: string | null
  uploadedBy: number | null
  uploadedAt: Date | string | null
  isViewable: boolean | number | null
  uploadedByName: string | null
}

function mapAttachmentRowsToDto(rows: SheetAttachmentRow[]): SheetAttachmentDTO[] {
  return rows.map(att => {
    const isFromTemplateBool =
      typeof att.isFromTemplate === 'boolean' ? att.isFromTemplate : att.isFromTemplate === 1
    const cloneOnCreateBool =
      typeof att.cloneOnCreate === 'boolean' ? att.cloneOnCreate : att.cloneOnCreate === 1
    const isViewableBool =
      typeof att.isViewable === 'boolean' ? att.isViewable : att.isViewable === 1

    const dto: SheetAttachmentDTO = {
      sheetAttachmentId: att.sheetAttachmentId,
      orderIndex: Number(att.orderIndex ?? 0),
      isFromTemplate: isFromTemplateBool,
      linkedFromSheetId: att.linkedFromSheetId ?? null,
      cloneOnCreate: cloneOnCreateBool,

      id: att.id,
      originalName: att.originalName ?? '',
      storedName: att.storedName ?? '',
      contentType: att.contentType ?? '',
      fileSizeBytes: Number(att.fileSizeBytes ?? 0),
      storageProvider: att.storageProvider ?? '',
      storagePath: att.storagePath ?? '',
      sha256: att.sha256 ?? null,
      uploadedBy: att.uploadedBy ?? null,
      uploadedAt: att.uploadedAt ? new Date(att.uploadedAt as unknown as string).toISOString() : '',
      uploadedByName: att.uploadedByName ?? null,
      isViewable: isViewableBool,
      fileUrl: '',
    }

    dto.fileUrl = buildAttachmentUrl(dto)
    return dto
  })
}

export const listSheetAttachments = async (
  sheetId: number
): Promise<SheetAttachmentDTO[]> => {
  const pool = await poolPromise

  const rs = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .query<SheetAttachmentRow>(`
      SELECT
        sa.SheetAttachmentID           AS sheetAttachmentId,
        sa.OrderIndex                  AS orderIndex,
        sa.IsFromTemplate              AS isFromTemplate,
        sa.LinkedFromSheetID           AS linkedFromSheetId,
        sa.CloneOnCreate               AS cloneOnCreate,
        sa.CreatedAt                   AS linkedCreatedAt,

        a.AttachmentID                 AS id,
        a.OriginalName                 AS originalName,
        a.StoredName                   AS storedName,
        a.ContentType                  AS contentType,
        a.FileSizeBytes                AS fileSizeBytes,
        a.StorageProvider              AS storageProvider,
        a.StoragePath                  AS storagePath,
        a.Sha256                       AS sha256,
        a.UploadedBy                   AS uploadedBy,
        a.UploadedAt                   AS uploadedAt,
        a.IsViewable                   AS isViewable,
        u.FirstName + ' ' + u.LastName AS uploadedByName
      FROM SheetAttachments sa
      INNER JOIN Attachments a
        ON a.AttachmentID = sa.AttachmentID
      LEFT JOIN Users u
        ON u.UserID = a.UploadedBy
      WHERE sa.SheetID = @SheetID
      ORDER BY sa.OrderIndex ASC, a.UploadedAt DESC
    `)

  const rows = rs.recordset as SheetAttachmentRow[]
  return mapAttachmentRowsToDto(rows)
}

export const deleteSheetAttachmentLink = async (
  sheetId: number,
  attachmentId: number
): Promise<boolean> => {
  const pool = await poolPromise

  const rs = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .input('AttachmentID', sql.Int, attachmentId)
    .query(`
      DELETE FROM SheetAttachments
      WHERE SheetID = @SheetID AND AttachmentID = @AttachmentID
    `)

  const affected = rs.rowsAffected?.[0] ?? 0
  return affected > 0
}

/* ──────────────────────────────────────────────────────────────
   Simple SheetNotes helpers (text-only notes)
   ────────────────────────────────────────────────────────────── */

export async function getNotesForSheet(sheetId: number): Promise<Array<{
  noteId: number
  sheetId: number
  text: string
  createdBy: number
  createdAt: string
  updatedBy?: number
  updatedAt?: string
}>> {
  const pool = await poolPromise
  const req = pool.request()
  req.input('SheetID', sql.Int, sheetId)

  const rs = await req.query<{
    NoteID: number
    SheetID: number
    NoteText: string
    CreatedBy: number
    CreatedAt: Date
    UpdatedBy: number | null
    UpdatedAt: Date | null
  }>(`
    SELECT NoteID, SheetID, NoteText, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
    FROM SheetNotes
    WHERE SheetID = @SheetID
    ORDER BY CreatedAt DESC, NoteID DESC
  `)

  return (rs.recordset ?? []).map(row => ({
    noteId: row.NoteID,
    sheetId: row.SheetID,
    text: row.NoteText,
    createdBy: row.CreatedBy,
    createdAt: new Date(row.CreatedAt).toISOString(),
    updatedBy: row.UpdatedBy ?? undefined,
    updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt).toISOString() : undefined,
  }))
}

export async function createNoteForSheet(
  sheetId: number,
  payload: NoteCreatePayload,
  userId: number
): Promise<{
  noteId: number
  sheetId: number
  text: string
  createdBy: number
  createdAt: string
}> {
  const pool = await poolPromise
  const req = pool.request()
  req.input('SheetID', sql.Int, sheetId)
  req.input('NoteText', sql.NVarChar, payload.text)
  req.input('CreatedBy', sql.Int, userId)

  const rs = await req.query<{ NoteID: number; CreatedAt: Date }>(`
    INSERT INTO SheetNotes (SheetID, NoteText, CreatedBy, CreatedAt)
    VALUES (@SheetID, @NoteText, @CreatedBy, GETDATE());
    SELECT CAST(SCOPE_IDENTITY() AS int) AS NoteID, GETDATE() AS CreatedAt;
  `)

  const row = rs.recordset?.[0]

  const createdAtIso = row?.CreatedAt
    ? new Date(row.CreatedAt).toISOString()
    : new Date().toISOString()

  await bumpRejectedToModifiedDraftFilled(sheetId, userId)
  return {
    noteId: row?.NoteID ?? 0,
    sheetId,
    text: payload.text,
    createdBy: userId,
    createdAt: createdAtIso,
  }
}

export async function updateNoteForSheet(
  sheetId: number,
  noteId: number,
  payload: NoteUpdatePayload,
  userId: number
): Promise<{
  noteId: number
  sheetId: number
  text: string
  updatedBy: number
  updatedAt: string
}> {
  const pool = await poolPromise
  const req = pool.request()
  req.input('SheetID', sql.Int, sheetId)
  req.input('NoteID', sql.Int, noteId)
  req.input('NoteText', sql.NVarChar, payload.text ?? '')
  req.input('UpdatedBy', sql.Int, userId)

  const rs = await req.query<{ UpdatedAt: Date }>(`
    UPDATE SheetNotes
    SET NoteText = @NoteText, UpdatedBy = @UpdatedBy, UpdatedAt = GETDATE()
    WHERE NoteID = @NoteID AND SheetID = @SheetID;

    SELECT GETDATE() AS UpdatedAt;
  `)

  const row = rs.recordset?.[0]

  const updatedAtIso = row?.UpdatedAt
    ? new Date(row.UpdatedAt).toISOString()
    : new Date().toISOString()

  await bumpRejectedToModifiedDraftFilled(sheetId, userId)
  return {
    noteId,
    sheetId,
    text: payload.text ?? '',
    updatedBy: userId,
    updatedAt: updatedAtIso,
  }
}

export async function deleteNoteForSheet(
  sheetId: number,
  noteId: number,
  userId: number
): Promise<void> {
  const pool = await poolPromise
  const req = pool.request()
  req.input('SheetID', sql.Int, sheetId)
  req.input('NoteID', sql.Int, noteId)

  await req.query(`
    DELETE FROM SheetNotes WHERE NoteID = @NoteID AND SheetID = @SheetID
  `)
  await bumpRejectedToModifiedDraftFilled(sheetId, userId)
}

/* ──────────────────────────────────────────────────────────────
   Export helpers (return absolute file path)
   ────────────────────────────────────────────────────────────── */

export async function exportPDF(
  sheetId: number,
  lang: string = 'eng',
  uom: UOM = 'SI',
  accountId: number
): Promise<{ filePath: string; fileName: string }> {
  const dir = path.resolve(process.cwd(), 'public', 'exports')
  await ensureDir(dir)

  const details = await getFilledSheetDetailsById(sheetId, lang, uom, accountId)
  if (!details) {
    throw new AppError('Sheet not found', 404)
  }

  const { datasheet } = details
  const result = await generateDatasheetPDF(datasheet, lang, uom)

  const outPath = path.join(dir, result.fileName)
  await fs.writeFile(outPath, result.buffer)

  return { filePath: outPath, fileName: result.fileName }
}

export async function exportExcel(
  sheetId: number,
  lang: string = 'eng',
  uom: UOM = 'SI',
  accountId: number
): Promise<{ filePath: string; fileName: string }> {
  const dir = path.resolve(process.cwd(), 'public', 'exports')
  await ensureDir(dir)

  const details = await getFilledSheetDetailsById(sheetId, lang, uom, accountId)
  if (!details) {
    throw new AppError('Sheet not found', 404)
  }

  const { datasheet } = details
  const result = await generateDatasheetExcel(datasheet, lang, uom)

  const outPath = path.join(dir, result.fileName)
  await fs.writeFile(outPath, result.buffer)

  return { filePath: outPath, fileName: result.fileName }
}
