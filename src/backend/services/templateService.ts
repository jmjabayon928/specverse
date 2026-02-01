// src/backend/services/templateService.ts

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { poolPromise, sql } from '../config/db'
import { AppError } from '../errors/AppError'

import type {
  UnifiedSheet,
  UnifiedSubsheet,
  InfoField,
  SheetNoteDTO,
  NoteType,
  NoteUpdatePayload,
  SheetAttachmentDTO,
  AddSheetAttachmentArgs,
  AddSheetAttachmentResult,
  TemplateStructure,
  TemplateSubsheet,
  TemplateField,
} from '@/domain/datasheets/sheetTypes'
import { insertAuditLog } from '../database/auditQueries'
import { notifyUsers } from '../utils/notifyUsers'
import { getSheetTranslations } from '@/backend/services/translationService'
import { applySheetTranslations } from '@/utils/applySheetTranslations'
import { convertToUSC } from '@/utils/unitConversionTable'
import { generateDatasheetPDF } from '@/utils/generateDatasheetPDF'
import { generateDatasheetExcel } from '@/utils/generateDatasheetExcel'

type Uom = 'SI' | 'USC'

// Normalizes SQL bit/boolean fields that can come as 0/1/true/false/null
type SqlBit = boolean | number | null

type TemplateDetailsWithDatasheet = { datasheet: UnifiedSheet }

function hasDatasheet(obj: unknown): obj is TemplateDetailsWithDatasheet {
  if (obj == null || typeof obj !== 'object') {
    return false
  }

  return 'datasheet' in obj
}


function isUnifiedSheetLike(obj: unknown): obj is UnifiedSheet {
  if (obj == null || typeof obj !== 'object') {
    return false
  }

  const o = obj as Record<string, unknown>
  const subs = (o as { subsheets?: unknown }).subsheets
  return Array.isArray(subs)
}

function toDatasheetLikeFromTemplate(template: unknown): UnifiedSheet {
  if (isUnifiedSheetLike(template)) {
    return template
  }

  throw new Error('Template export expected a datasheet-like payload but none was found.')
}

// ───────────────────────────────────────────
// Small coercers
// ───────────────────────────────────────────

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

const nv = (v: unknown): string | null => {
  if (isBlank(v)) {
    return null
  }

  return String(v)
}

const iv = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') {
    return null
  }

  const n = Number(v)
  if (!Number.isFinite(n)) {
    return null
  }

  return n
}

function isViewableMime(mime: string): boolean {
  const m = mime.toLowerCase()
  if (m.startsWith('image/')) {
    return true
  }

  if (m === 'application/pdf') {
    return true
  }

  return false
}

async function sha256File(absPath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(absPath)
    const hash = crypto.createHash('sha256').update(buf).digest('hex')
    return hash
  } catch {
    return null
  }
}

const parseIntish = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.trunc(v)
  }

  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) {
      return Math.trunc(n)
    }
  }

  return undefined
}

const asNonEmptyString = (v: unknown): string | undefined => {
  if (typeof v === 'string' && v.trim() !== '') {
    return v
  }

  return undefined
}

// ───────────────────────────────────────────
// Attachment URL helper
// ───────────────────────────────────────────

export function buildAttachmentUrl(
  a: Pick<SheetAttachmentDTO, 'storageProvider' | 'storedName' | 'storagePath'>
): string {
  const provider = a.storageProvider?.toLowerCase()

  switch (provider) {
    case 'local':
      return `/api/backend/files/${encodeURIComponent(a.storedName)}`

    case 's3':
      return `/api/backend/files/s3/${encodeURIComponent(a.storagePath)}`

    default:
      return a.storagePath ?? ''
  }
}

// ───────────────────────────────────────────
// Template structure for builder
// ───────────────────────────────────────────

export async function fetchTemplateStructure(sheetId: number): Promise<TemplateStructure> {
  const pool = await poolPromise

  // SubSheets
  const subsheetsRs = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT
        s.SubID   AS id,
        s.SubName AS name
      FROM SubSheets s
      WHERE s.SheetID = @SheetID
      ORDER BY s.OrderIndex, s.SubID
    `)

  const subsheets: TemplateSubsheet[] = []

  for (const row of subsheetsRs.recordset as unknown[]) {
    const rec = (row ?? {}) as Record<string, unknown>
    const id = parseIntish(rec.id)
    let name = asNonEmptyString(rec.name)

    if (name == null && id !== undefined) {
      name = `Subsheet ${id}`
    }

    if (id !== undefined && name !== undefined) {
      subsheets.push({ id, name })
    }
  }

  // Fields
  const fieldsRs = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT
        it.InfoTemplateID AS id,
        it.Label          AS label,
        it.SubID          AS subId
      FROM InformationTemplates it
      INNER JOIN SubSheets s ON s.SubID = it.SubID
      WHERE s.SheetID = @SheetID
      ORDER BY it.OrderIndex, it.InfoTemplateID
    `)

  const fields: TemplateField[] = []

  for (const row of fieldsRs.recordset as unknown[]) {
    const rec = (row ?? {}) as Record<string, unknown>
    const id = parseIntish(rec.id)
    let label = asNonEmptyString(rec.label)
    const subIdRaw = parseIntish(rec.subId)
    const subId = subIdRaw ?? null

    if (label == null && id !== undefined) {
      label = `Field ${id}`
    }

    if (id !== undefined && label !== undefined) {
      fields.push({ id, label, subId })
    }
  }

  return { subsheets, fields }
}

// ───────────────────────────────────────────
// Insert / update helpers for Sheets
// ───────────────────────────────────────────

function applySheetInputsForInsert(
  req: sql.Request,
  data: UnifiedSheet,
  userId: number
): sql.Request {
  return req
    .input('SheetName', sql.VarChar(255), nv(data.sheetName) ?? '')
    .input('SheetDesc', sql.VarChar(255), nv(data.sheetDesc) ?? '')
    .input('SheetDesc2', sql.VarChar(255), nv(data.sheetDesc2) ?? '')
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
    .input('IsTemplate', sql.Bit, 1)
    .input('AutoCADImport', sql.Bit, 0)
}

function applySheetInputsForUpdate(
  req: sql.Request,
  data: UnifiedSheet,
  userId: number
): sql.Request {
  return req
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
    .input('ModifiedByID', sql.Int, userId)
}

// ───────────────────────────────────────────
// Subsheet + field tree
// ───────────────────────────────────────────

async function insertSubsheetTree(
  tx: sql.Transaction,
  sheetId: number,
  data: UnifiedSheet
): Promise<void> {
  for (let i = 0; i < data.subsheets.length; i += 1) {
    const sub = data.subsheets[i]
    const templateSubId =
      typeof sub.originalId === 'number' && Number.isFinite(sub.originalId)
        ? sub.originalId
        : null

    const subRs = await tx
      .request()
      .input('SubName', sql.VarChar(150), nv(sub.name))
      .input('SheetID', sql.Int, sheetId)
      .input('OrderIndex', sql.Int, i)
      .input('TemplateSubID', sql.Int, templateSubId)
      .query<{ SubID: number }>(`
        INSERT INTO SubSheets (SubName, SheetID, OrderIndex, TemplateSubID)
        OUTPUT INSERTED.SubID
        VALUES (@SubName, @SheetID, @OrderIndex, @TemplateSubID)
      `)

    const newSubId = subRs.recordset[0].SubID

    for (let j = 0; j < sub.fields.length; j += 1) {
      const f = sub.fields[j]

      const infoRs = await tx
        .request()
        .input('SubID', sql.Int, newSubId)
        .input('Label', sql.VarChar(150), nv(f.label))
        .input('InfoType', sql.VarChar(30), nv(f.infoType))
        .input('OrderIndex', sql.Int, f.sortOrder ?? j)
        .input('UOM', sql.VarChar(50), nv(f.uom ?? ''))
        .input('Required', sql.Bit, f.required ? 1 : 0)
        .input('TemplateInfoTemplateID', sql.Int, iv(f.originalId ?? f.id))
        .query<{ InfoTemplateID: number }>(`
          INSERT INTO InformationTemplates
            (SubID, Label, InfoType, OrderIndex, UOM, Required, TemplateInfoTemplateID)
          OUTPUT INSERTED.InfoTemplateID
          VALUES (@SubID, @Label, @InfoType, @OrderIndex, @UOM, @Required, @TemplateInfoTemplateID)
        `)

      const newInfoId = infoRs.recordset[0].InfoTemplateID

      if (Array.isArray(f.options) && f.options.length > 0) {
        for (let k = 0; k < f.options.length; k += 1) {
          await tx
            .request()
            .input('InfoTemplateID', sql.Int, newInfoId)
            .input('OptionValue', sql.VarChar(100), nv(f.options[k]))
            .input('SortOrder', sql.Int, k)
            .query(`
              INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
              VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
            `)
        }
      }
    }
  }
}

// full replace flag retained for now; still off
const SYNC_SUBSHEETS_ON_UPDATE = false

async function syncSubsheetTree(
  tx: sql.Transaction,
  sheetId: number,
  data: UnifiedSheet
): Promise<void> {
  if (!SYNC_SUBSHEETS_ON_UPDATE) {
    return
  }

  await tx
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query(`
      DELETE O FROM InformationTemplateOptions O
      WHERE O.InfoTemplateID IN (
        SELECT IT.InfoTemplateID
        FROM InformationTemplates IT
        JOIN SubSheets SS ON SS.SubID = IT.SubID
        WHERE SS.SheetID = @SheetID
      );

      DELETE IT FROM InformationTemplates IT
      WHERE IT.SubID IN (SELECT SS.SubID FROM SubSheets SS WHERE SS.SheetID = @SheetID);

      DELETE FROM SubSheets WHERE SheetID = @SheetID;
    `)

  await insertSubsheetTree(tx, sheetId, data)
}

// ───────────────────────────────────────────
// Template structure editing guard
// ───────────────────────────────────────────

const TEMPLATE_EDITABLE_STATUSES = ['Draft', 'Modified Draft', 'Rejected'] as const

/**
 * Throws if template is missing, not a template, not editable (status), or user not allowed.
 * Call before any structure mutation. Mirrors updateTemplate status check and frontend creator policy.
 * - 404: sheet not found
 * - 400: sheet is not a template (IsTemplate != 1)
 * - 403: user is not the template creator (PreparedByID !== userId when set)
 * - 409: status not Draft/Modified Draft/Rejected
 */
export async function assertTemplateStructureEditable(
  sheetId: number,
  userId: number
): Promise<void> {
  const pool = await poolPromise
  const statusResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ Status: string; IsTemplate: boolean | number; PreparedByID: number | null }>(`
      SELECT Status, IsTemplate, PreparedByID FROM Sheets WHERE SheetID = @SheetID
    `)
  const row = statusResult.recordset[0]
  if (!row) {
    throw new AppError('Template not found', 404)
  }
  const isTemplate = row.IsTemplate === true || row.IsTemplate === 1
  if (!isTemplate) {
    throw new AppError('Sheet is not a template', 400)
  }
  const preparedById = row.PreparedByID != null ? Number(row.PreparedByID) : null
  if (preparedById != null && preparedById !== userId) {
    throw new AppError('Forbidden', 403)
  }
  if (!TEMPLATE_EDITABLE_STATUSES.includes(row.Status as (typeof TEMPLATE_EDITABLE_STATUSES)[number])) {
    throw new AppError(
      `Template can only be edited when status is Draft, Modified Draft, or Rejected. Current status: ${row.Status}.`,
      409
    )
  }
}

// ───────────────────────────────────────────
// Subsheet CRUD + reorder
// ───────────────────────────────────────────

export type CreateSubsheetResult = { subId: number; subName: string; orderIndex: number }
export type UpdateSubsheetResult = { subId: number; subName: string; orderIndex: number }
export type DeleteSubsheetResult = { deletedSubId: number }
export type ReorderSubsheetsResult = { updated: number }

export async function createSubsheet(
  sheetId: number,
  subName: string,
  userId: number
): Promise<CreateSubsheetResult> {
  await assertTemplateStructureEditable(sheetId, userId)
  const pool = await poolPromise
  const nextResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ NextIndex: number }>(`
      SELECT ISNULL(MAX(OrderIndex), 0) + 1 AS NextIndex
      FROM SubSheets WHERE SheetID = @SheetID
    `)
  const orderIndex = nextResult.recordset[0]?.NextIndex ?? 1
  const insertResult = await pool
    .request()
    .input('SubName', sql.VarChar(150), nv(subName) ?? '')
    .input('SheetID', sql.Int, sheetId)
    .input('OrderIndex', sql.Int, orderIndex)
    .query<{ SubID: number }>(`
      INSERT INTO SubSheets (SubName, SheetID, OrderIndex, TemplateSubID)
      OUTPUT INSERTED.SubID
      VALUES (@SubName, @SheetID, @OrderIndex, NULL)
    `)
  const subId = insertResult.recordset[0].SubID
  return { subId, subName: subName.trim() || 'Subsheet', orderIndex }
}

export async function updateSubsheet(
  sheetId: number,
  subId: number,
  body: { subName?: string },
  userId: number
): Promise<UpdateSubsheetResult> {
  await assertTemplateStructureEditable(sheetId, userId)
  const pool = await poolPromise
  const subName = body.subName != null ? String(body.subName).trim() : undefined
  if (subName === undefined) {
    const rowResult = await pool
      .request()
      .input('SheetID', sql.Int, sheetId)
      .input('SubID', sql.Int, subId)
      .query<{ SubName: string; OrderIndex: number }>(`
        SELECT SubName, OrderIndex FROM SubSheets WHERE SheetID = @SheetID AND SubID = @SubID
      `)
    const row = rowResult.recordset[0]
    if (!row) throw new AppError('Subsheet not found', 404)
    return { subId, subName: row.SubName, orderIndex: row.OrderIndex ?? 0 }
  }
  await pool
    .request()
    .input('SubName', sql.VarChar(150), subName)
    .input('SheetID', sql.Int, sheetId)
    .input('SubID', sql.Int, subId)
    .query(`
      UPDATE SubSheets SET SubName = @SubName WHERE SheetID = @SheetID AND SubID = @SubID
    `)
  const orderResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('SubID', sql.Int, subId)
    .query<{ OrderIndex: number }>(`SELECT OrderIndex FROM SubSheets WHERE SheetID = @SheetID AND SubID = @SubID`)
  const orderIndex = orderResult.recordset[0]?.OrderIndex ?? 0
  return { subId, subName, orderIndex }
}

export async function deleteSubsheet(
  sheetId: number,
  subId: number,
  userId: number
): Promise<DeleteSubsheetResult> {
  await assertTemplateStructureEditable(sheetId, userId)
  const pool = await poolPromise
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()
    const subCheck = await tx.request().input('SheetID', sql.Int, sheetId).input('SubID', sql.Int, subId)
      .query<{ SubID: number }>(`SELECT SubID FROM SubSheets WHERE SheetID = @SheetID AND SubID = @SubID`)
    if (!subCheck.recordset[0]) {
      await tx.rollback()
      throw new AppError('Subsheet not found', 404)
    }
    await tx.request().input('SubID', sql.Int, subId).query(`
      DELETE O FROM InformationTemplateOptions O
      INNER JOIN InformationTemplates IT ON IT.InfoTemplateID = O.InfoTemplateID
      WHERE IT.SubID = @SubID
    `)
    await tx.request().input('SubID', sql.Int, subId).query(`
      DELETE FROM InformationTemplates WHERE SubID = @SubID
    `)
    await tx.request().input('SubID', sql.Int, subId).query(`
      DELETE FROM SubSheets WHERE SubID = @SubID
    `)
    await tx.commit()
    return { deletedSubId: subId }
  } catch (err) {
    try {
      await tx.rollback()
    } catch {
      /* ignore */
    }
    throw err
  }
}

export async function reorderSubsheets(
  sheetId: number,
  order: Array<{ subId: number; orderIndex: number }>,
  userId: number
): Promise<ReorderSubsheetsResult> {
  await assertTemplateStructureEditable(sheetId, userId)
  const pool = await poolPromise
  const subIdsInSheet = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ SubID: number }>(`SELECT SubID FROM SubSheets WHERE SheetID = @SheetID`)
  const allowed = new Set((subIdsInSheet.recordset ?? []).map((r) => r.SubID))
  for (const { subId } of order) {
    if (!allowed.has(subId)) {
      throw new AppError('Subsheet not found', 404)
    }
  }
  const tx = new sql.Transaction(pool)
  let updated = 0
  try {
    await tx.begin()
    for (const { subId, orderIndex } of order) {
      const result = await tx
        .request()
        .input('SheetID', sql.Int, sheetId)
        .input('SubID', sql.Int, subId)
        .input('OrderIndex', sql.Int, orderIndex)
        .query(`
          UPDATE SubSheets SET OrderIndex = @OrderIndex WHERE SheetID = @SheetID AND SubID = @SubID
        `)
      updated += result.rowsAffected[0] ?? 0
    }
    await tx.commit()
    return { updated }
  } catch (err) {
    try {
      await tx.rollback()
    } catch {
      /* ignore */
    }
    throw err
  }
}

// ───────────────────────────────────────────
// Field (InformationTemplate) CRUD + reorder
// ───────────────────────────────────────────

export type CreateFieldResult = {
  fieldId: number
  label: string
  infoType: string
  uom: string
  required: boolean
  orderIndex: number
  options: string[]
}
export type UpdateFieldResult = CreateFieldResult
export type DeleteFieldResult = { deletedFieldId: number }
export type ReorderFieldsResult = { updated: number }

function assertSubsheetBelongsToTemplate(
  pool: sql.ConnectionPool,
  sheetId: number,
  subId: number
): Promise<void> {
  return pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('SubID', sql.Int, subId)
    .query<{ SubID: number }>(`SELECT SubID FROM SubSheets WHERE SheetID = @SheetID AND SubID = @SubID`)
    .then((r) => {
      if (!r.recordset[0]) throw new AppError('Subsheet not found', 404)
    })
}

export async function createField(
  sheetId: number,
  subId: number,
  body: {
    label: string
    infoType: 'int' | 'decimal' | 'varchar'
    uom?: string
    required: boolean
    options?: string[]
  },
  userId: number
): Promise<CreateFieldResult> {
  await assertTemplateStructureEditable(sheetId, userId)
  const pool = await poolPromise
  await assertSubsheetBelongsToTemplate(pool, sheetId, subId)
  const nextResult = await pool
    .request()
    .input('SubID', sql.Int, subId)
    .query<{ NextIndex: number }>(`
      SELECT ISNULL(MAX(OrderIndex), 0) + 1 AS NextIndex
      FROM InformationTemplates WHERE SubID = @SubID
    `)
  const orderIndex = nextResult.recordset[0]?.NextIndex ?? 1
  const label = (body.label ?? '').trim() || 'Field'
  const infoType = body.infoType ?? 'varchar'
  const uom = (body.uom ?? '').trim()
  const required = Boolean(body.required)
  const options = Array.isArray(body.options) ? body.options : []
  const insertResult = await pool
    .request()
    .input('SubID', sql.Int, subId)
    .input('Label', sql.VarChar(150), label)
    .input('InfoType', sql.VarChar(30), infoType)
    .input('OrderIndex', sql.Int, orderIndex)
    .input('UOM', sql.VarChar(50), uom)
    .input('Required', sql.Bit, required ? 1 : 0)
    .query<{ InfoTemplateID: number }>(`
      INSERT INTO InformationTemplates (SubID, Label, InfoType, OrderIndex, UOM, Required, TemplateInfoTemplateID)
      OUTPUT INSERTED.InfoTemplateID
      VALUES (@SubID, @Label, @InfoType, @OrderIndex, @UOM, @Required, NULL)
    `)
  const fieldId = insertResult.recordset[0].InfoTemplateID
  for (let k = 0; k < options.length; k += 1) {
    await pool
      .request()
      .input('InfoTemplateID', sql.Int, fieldId)
      .input('OptionValue', sql.VarChar(100), nv(options[k]) ?? '')
      .input('SortOrder', sql.Int, k)
      .query(`
        INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
        VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
      `)
  }
  return { fieldId, label, infoType, uom, required, orderIndex, options }
}

export async function updateField(
  sheetId: number,
  subId: number,
  fieldId: number,
  body: {
    label?: string
    infoType?: 'int' | 'decimal' | 'varchar'
    uom?: string
    required?: boolean
    options?: string[]
    orderIndex?: number
  },
  userId: number
): Promise<UpdateFieldResult> {
  await assertTemplateStructureEditable(sheetId, userId)
  const pool = await poolPromise
  await assertSubsheetBelongsToTemplate(pool, sheetId, subId)
  const fieldCheck = await pool
    .request()
    .input('SubID', sql.Int, subId)
    .input('InfoTemplateID', sql.Int, fieldId)
    .query<{ InfoTemplateID: number }>(`
      SELECT InfoTemplateID FROM InformationTemplates WHERE SubID = @SubID AND InfoTemplateID = @InfoTemplateID
    `)
  if (!fieldCheck.recordset[0]) throw new AppError('Field not found', 404)
  const updates: string[] = []
  const req = pool.request().input('InfoTemplateID', sql.Int, fieldId).input('SubID', sql.Int, subId)
  if (body.label !== undefined) {
    const label = String(body.label).trim() || 'Field'
    req.input('Label', sql.VarChar(150), label)
    updates.push('Label = @Label')
  }
  if (body.infoType !== undefined) {
    req.input('InfoType', sql.VarChar(30), body.infoType)
    updates.push('InfoType = @InfoType')
  }
  if (body.uom !== undefined) {
    req.input('UOM', sql.VarChar(50), String(body.uom).trim())
    updates.push('UOM = @UOM')
  }
  if (body.required !== undefined) {
    req.input('Required', sql.Bit, body.required ? 1 : 0)
    updates.push('Required = @Required')
  }
  if (body.orderIndex !== undefined) {
    req.input('OrderIndex', sql.Int, body.orderIndex)
    updates.push('OrderIndex = @OrderIndex')
  }
  if (updates.length > 0) {
    await req.query(`
      UPDATE InformationTemplates SET ${updates.join(', ')} WHERE SubID = @SubID AND InfoTemplateID = @InfoTemplateID
    `)
  }
  if (body.options !== undefined) {
    const tx = new sql.Transaction(pool)
    await tx.begin()
    await tx.request().input('InfoTemplateID', sql.Int, fieldId).query(`
      DELETE FROM InformationTemplateOptions WHERE InfoTemplateID = @InfoTemplateID
    `)
    const opts = Array.isArray(body.options) ? body.options : []
    for (let k = 0; k < opts.length; k += 1) {
      await tx
        .request()
        .input('InfoTemplateID', sql.Int, fieldId)
        .input('OptionValue', sql.VarChar(100), nv(opts[k]) ?? '')
        .input('SortOrder', sql.Int, k)
        .query(`
          INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
          VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
        `)
    }
    await tx.commit()
  }
  const rowResult = await pool
    .request()
    .input('SubID', sql.Int, subId)
    .input('InfoTemplateID', sql.Int, fieldId)
    .query<{ Label: string; InfoType: string; UOM: string; Required: boolean | number; OrderIndex: number }>(`
      SELECT Label, InfoType, UOM, Required, OrderIndex FROM InformationTemplates WHERE SubID = @SubID AND InfoTemplateID = @InfoTemplateID
    `)
  const row = rowResult.recordset[0]
  const optResult = await pool
    .request()
    .input('InfoTemplateID', sql.Int, fieldId)
    .query<{ OptionValue: string }>(`SELECT OptionValue FROM InformationTemplateOptions WHERE InfoTemplateID = @InfoTemplateID ORDER BY SortOrder`)
  const options = (optResult.recordset ?? []).map((r) => r.OptionValue)
  const required = row?.Required === true || row?.Required === 1
  return {
    fieldId,
    label: row?.Label ?? '',
    infoType: row?.InfoType ?? 'varchar',
    uom: row?.UOM ?? '',
    required: Boolean(required),
    orderIndex: row?.OrderIndex ?? 0,
    options,
  }
}

export async function deleteField(
  sheetId: number,
  subId: number,
  fieldId: number,
  userId: number
): Promise<DeleteFieldResult> {
  await assertTemplateStructureEditable(sheetId, userId)
  const pool = await poolPromise
  await assertSubsheetBelongsToTemplate(pool, sheetId, subId)
  const fieldCheck = await pool
    .request()
    .input('SubID', sql.Int, subId)
    .input('InfoTemplateID', sql.Int, fieldId)
    .query<{ InfoTemplateID: number }>(`
      SELECT InfoTemplateID FROM InformationTemplates WHERE SubID = @SubID AND InfoTemplateID = @InfoTemplateID
    `)
  if (!fieldCheck.recordset[0]) throw new AppError('Field not found', 404)
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()
    await tx.request().input('InfoTemplateID', sql.Int, fieldId).query(`
      DELETE FROM InformationTemplateOptions WHERE InfoTemplateID = @InfoTemplateID
    `)
    await tx.request().input('InfoTemplateID', sql.Int, fieldId).input('SubID', sql.Int, subId).query(`
      DELETE FROM InformationTemplates WHERE SubID = @SubID AND InfoTemplateID = @InfoTemplateID
    `)
    await tx.commit()
    return { deletedFieldId: fieldId }
  } catch (err) {
    try {
      await tx.rollback()
    } catch {
      /* ignore */
    }
    throw err
  }
}

export async function reorderFields(
  sheetId: number,
  subId: number,
  order: Array<{ fieldId: number; orderIndex: number }>,
  userId: number
): Promise<ReorderFieldsResult> {
  await assertTemplateStructureEditable(sheetId, userId)
  const pool = await poolPromise
  await assertSubsheetBelongsToTemplate(pool, sheetId, subId)
  const fieldIdsInSub = await pool
    .request()
    .input('SubID', sql.Int, subId)
    .query<{ InfoTemplateID: number }>(`SELECT InfoTemplateID FROM InformationTemplates WHERE SubID = @SubID`)
  const allowed = new Set((fieldIdsInSub.recordset ?? []).map((r) => r.InfoTemplateID))
  for (const { fieldId } of order) {
    if (!allowed.has(fieldId)) {
      throw new AppError('Field not found', 404)
    }
  }
  const tx = new sql.Transaction(pool)
  let updated = 0
  try {
    await tx.begin()
    for (const { fieldId, orderIndex } of order) {
      const result = await tx
        .request()
        .input('SubID', sql.Int, subId)
        .input('InfoTemplateID', sql.Int, fieldId)
        .input('OrderIndex', sql.Int, orderIndex)
        .query(`
          UPDATE InformationTemplates SET OrderIndex = @OrderIndex WHERE SubID = @SubID AND InfoTemplateID = @InfoTemplateID
        `)
      updated += result.rowsAffected[0] ?? 0
    }
    await tx.commit()
    return { updated }
  } catch (err) {
    try {
      await tx.rollback()
    } catch {
      /* ignore */
    }
    throw err
  }
}

// ───────────────────────────────────────────
// Lightweight caches (memoization)
// ───────────────────────────────────────────

type Cached<T> = {
  value: T
  expiresAt: number
}

const REFERENCE_TTL_MS = 5 * 60_000
const NOTE_TYPES_TTL_MS = 5 * 60_000

let cachedReferenceOptions: Cached<{
  categories: unknown[]
  users: unknown[]
}> | null = null

let cachedNoteTypes: Cached<NoteType[]> | null = null

// ───────────────────────────────────────────
// Reference options
// ───────────────────────────────────────────

export const fetchTemplateReferenceOptions = async () => {
  const now = Date.now()
  if (cachedReferenceOptions != null && cachedReferenceOptions.expiresAt > now) {
    return cachedReferenceOptions.value
  }

  const pool = await poolPromise

  const [categories, users, disciplinesRs, subtypesRs] = await Promise.all([
    pool.query(`
      SELECT CategoryID, CategoryName
      FROM Categories
      ORDER BY CategoryName
    `),
    pool.query(`
      SELECT UserID, FirstName, LastName
      FROM Users
      ORDER BY FirstName, LastName
    `),
    pool.query(`
      SELECT DisciplineID AS id, Code AS code, Name AS name
      FROM dbo.Disciplines
      ORDER BY Name
    `),
    pool.query(`
      SELECT SubtypeID AS id, DisciplineID AS disciplineId, Code AS code, Name AS name
      FROM dbo.DatasheetSubtypes
      ORDER BY DisciplineID, Name
    `),
  ])

  const value = {
    categories: categories.recordset,
    users: users.recordset,
    disciplines: disciplinesRs.recordset ?? [],
    subtypes: subtypesRs.recordset ?? [],
  }

  cachedReferenceOptions = {
    value,
    expiresAt: now + REFERENCE_TTL_MS,
  }

  return value
}

// ───────────────────────────────────────────
// Template list
// ───────────────────────────────────────────

export const fetchAllTemplates = async () => {
  const pool = await poolPromise

  const result = await pool.query(`
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
    WHERE s.IsTemplate = 1
    ORDER BY s.SheetID DESC
  `)

  return result.recordset ?? []
}

// ───────────────────────────────────────────
// Note types (with cache)
// ───────────────────────────────────────────

export const getAllNoteTypes = async (): Promise<NoteType[]> => {
  const now = Date.now()
  if (cachedNoteTypes != null && cachedNoteTypes.expiresAt > now) {
    return cachedNoteTypes.value
  }

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

  const noteTypes: NoteType[] = result.recordset.map((r) => ({
    noteTypeId: r.NoteTypeID,
    noteType: r.NoteType,
    description: r.Description,
  }))

  cachedNoteTypes = {
    value: noteTypes,
    expiresAt: now + NOTE_TYPES_TTL_MS,
  }

  return noteTypes
}

// ───────────────────────────────────────────
// Notes (create / list / update / delete)
// ───────────────────────────────────────────

export async function addSheetNote(args: {
  sheetId: number
  noteTypeId: number
  noteText: string
  createdBy: number | null
  ensureTemplate?: boolean
}): Promise<{ noteId: number; orderIndex: number; createdAt: string }> {
  const { sheetId, noteTypeId, noteText, createdBy, ensureTemplate } = args

  const pool = await poolPromise
  const tx = new sql.Transaction(pool)
  let didBegin = false
  let didCommit = false

  try {
    await tx.begin()
    didBegin = true

    const checkReq = new sql.Request(tx).input('SheetID', sql.Int, sheetId)
    const where = ensureTemplate === true
      ? 'WHERE SheetID=@SheetID AND IsTemplate=1'
      : 'WHERE SheetID=@SheetID'

    const chk = await checkReq.query<{ SheetID: number }>(`
      SELECT TOP (1) SheetID
      FROM dbo.Sheets
      ${where}
    `)

    if (chk.recordset.length === 0) {
      throw new Error(ensureTemplate === true ? 'Template not found' : 'Sheet not found')
    }

    const idxReq = new sql.Request(tx)
      .input('SheetID', sql.Int, sheetId)
      .input('NoteTypeID', sql.Int, noteTypeId)

    const idxRes = await idxReq.query<{ NextIndex: number }>(`
      SELECT ISNULL(MAX(OrderIndex), 0) + 1 AS NextIndex
      FROM dbo.SheetNotes
      WHERE SheetID = @SheetID AND NoteTypeID = @NoteTypeID
    `)

    const orderIndex = idxRes.recordset[0]?.NextIndex ?? 1

    const insReq = new sql.Request(tx)
      .input('SheetID', sql.Int, sheetId)
      .input('NoteTypeID', sql.Int, noteTypeId)
      .input('NoteText', sql.NVarChar(sql.MAX), noteText)
      .input('OrderIndex', sql.Int, orderIndex)
      .input('CreatedBy', sql.Int, createdBy ?? null)

    const insRes = await insReq.query<{ NoteID: number; CreatedAt: Date }>(`
      INSERT INTO dbo.SheetNotes
        (SheetID, NoteTypeID, NoteText, OrderIndex, CreatedBy, CreatedAt)
      OUTPUT INSERTED.NoteID, INSERTED.CreatedAt
      VALUES
        (@SheetID, @NoteTypeID, @NoteText, @OrderIndex, @CreatedBy, SYSDATETIME())
    `)

    await tx.commit()
    didCommit = true

    return {
      noteId: insRes.recordset[0].NoteID,
      orderIndex,
      createdAt: insRes.recordset[0].CreatedAt.toISOString(),
    }
  } catch (err) {
    if (didBegin && !didCommit) {
      try {
        await tx.rollback()
      } catch (rollbackErr: unknown) {
        console.error('rollback failed', rollbackErr)
      }
    }
    throw err
  }
}

export async function listTemplateNotes(sheetId: number): Promise<SheetNoteDTO[]> {
  const pool = await poolPromise

  const rs = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .query<{
      NoteID: number
      SheetID: number
      NoteTypeID: number
      NoteText: string
      OrderIndex: number | null
      CreatedBy: number | null
      CreatedAt: Date
      UpdatedBy: number | null
      UpdatedAt: Date | null
    }>(`
      SELECT
        NoteID,
        SheetID,
        NoteTypeID,
        NoteText,
        OrderIndex,
        CreatedBy,
        CreatedAt,
        UpdatedBy,
        UpdatedAt
      FROM dbo.SheetNotes
      WHERE SheetID = @SheetID
      ORDER BY CreatedAt DESC, NoteID DESC
    `)

  return rs.recordset.map<SheetNoteDTO>(row => ({
    id: row.NoteID,
    noteTypeId: row.NoteTypeID,
    noteTypeName: null,
    orderIndex: row.OrderIndex ?? 0,
    body: row.NoteText,
    createdAt: row.CreatedAt.toISOString(),
    createdBy: row.CreatedBy,
    createdByName: null
  }))
}

export async function updateTemplateNote(
  sheetId: number,
  noteId: number,
  payload: NoteUpdatePayload,
  userId: number
): Promise<void> {
  const trimmed = payload.text?.trim()
  if (!trimmed) {
    throw new Error('Note text is required')
  }

  const pool = await poolPromise

  await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .input('NoteID', sql.Int, noteId)
    .input('NoteText', sql.NVarChar(sql.MAX), trimmed)
    .input('UpdatedBy', sql.Int, userId)
    .query(`
      UPDATE dbo.SheetNotes
      SET
        NoteText = @NoteText,
        UpdatedBy = @UpdatedBy,
        UpdatedAt = SYSDATETIME()
      WHERE NoteID = @NoteID
        AND SheetID = @SheetID
    `)
}

export async function deleteTemplateNote(sheetId: number, noteId: number): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('NoteID', sql.Int, noteId)
    .query(`
      DELETE FROM SheetNotes
      WHERE NoteID = @NoteID AND SheetID = @SheetID
    `)
}

// ───────────────────────────────────────────
// Attachments (add / list / delete)
// ───────────────────────────────────────────

async function assertSheetExists(
  sheetId: number,
  ensureTemplate: boolean,
  tx: sql.Transaction
): Promise<void> {
  const req = new sql.Request(tx).input('SheetID', sql.Int, sheetId)
  const where = ensureTemplate === true
    ? 'WHERE SheetID=@SheetID AND IsTemplate=1'
    : 'WHERE SheetID=@SheetID'

  const rs = await req.query<{ SheetID: number }>(`
    SELECT TOP (1) SheetID
    FROM dbo.Sheets
    ${where}
  `)

  if (rs.recordset.length === 0) {
    throw new Error(ensureTemplate === true ? 'Template not found' : 'Sheet not found')
  }
}

export async function addSheetAttachment(
  args: AddSheetAttachmentArgs
): Promise<AddSheetAttachmentResult> {
  const { sheetId, file, uploadedBy, ensureTemplate = false } = args

  const storedName = file.filename
  const originalName = file.originalname
  const contentType = file.mimetype
  const fileSizeBytes = file.size
  const storageProvider = 'local' as const

  const storagePath = path.posix.join('attachments', storedName)
  const absPath = path.join(process.cwd(), 'public', storagePath)
  const sha256 = await sha256File(absPath)
  const isViewable = isViewableMime(contentType)

  const pool = await poolPromise
  const tx = new sql.Transaction(pool)
  let didBegin = false
  let didCommit = false

  try {
    await tx.begin()
    didBegin = true

    await assertSheetExists(sheetId, ensureTemplate, tx)

    const aReq = new sql.Request(tx)
      .input('OriginalName', sql.NVarChar(255), originalName)
      .input('StoredName', sql.NVarChar(255), storedName)
      .input('ContentType', sql.VarChar(120), contentType)
      .input('FileSizeBytes', sql.BigInt, fileSizeBytes)
      .input('StorageProvider', sql.VarChar(30), storageProvider)
      .input('StoragePath', sql.NVarChar(500), storagePath)
      .input('Sha256', sql.Char(64), sha256 ?? null)
      .input('UploadedBy', sql.Int, uploadedBy)
      .input('IsViewable', sql.Int, isViewable ? 1 : 0)

    const aRes = await aReq.query<{ AttachmentID: number; UploadedAt: Date }>(`
      INSERT INTO dbo.Attachments
        (OriginalName, StoredName, ContentType, FileSizeBytes, StorageProvider, StoragePath,
         Sha256, UploadedBy, UploadedAt, Version, IsViewable)
      OUTPUT INSERTED.AttachmentID, INSERTED.UploadedAt
      VALUES
        (@OriginalName, @StoredName, @ContentType, @FileSizeBytes, @StorageProvider, @StoragePath,
         @Sha256, @UploadedBy, SYSDATETIME(), 1, @IsViewable)
    `)

    const attachmentId = aRes.recordset[0].AttachmentID
    const uploadedAtIso = aRes.recordset[0].UploadedAt.toISOString()

    const iReq = new sql.Request(tx).input('SheetID', sql.Int, sheetId)
    const iRes = await iReq.query<{ NextIndex: number }>(`
      SELECT ISNULL(MAX(OrderIndex), 0) + 1 AS NextIndex
      FROM dbo.SheetAttachments
      WHERE SheetID = @SheetID
    `)
    const orderIndex = iRes.recordset[0]?.NextIndex ?? 1

    const lReq = new sql.Request(tx)
      .input('SheetID', sql.Int, sheetId)
      .input('AttachmentID', sql.Int, attachmentId)
      .input('OrderIndex', sql.Int, orderIndex)
      .input('IsFromTemplate', sql.Bit, 0)
      .input('LinkedFromSheetID', sql.Int, null)
      .input('CloneOnCreate', sql.Bit, 0)

    const lRes = await lReq.query<{ SheetAttachmentID: number }>(`
      INSERT INTO dbo.SheetAttachments
        (SheetID, AttachmentID, OrderIndex, IsFromTemplate, LinkedFromSheetID, CloneOnCreate, CreatedAt)
      OUTPUT INSERTED.SheetAttachmentID
      VALUES
        (@SheetID, @AttachmentID, @OrderIndex, @IsFromTemplate, @LinkedFromSheetID, @CloneOnCreate, SYSDATETIME())
    `)

    await tx.commit()
    didCommit = true

    const fileUrl = `/api/backend/files/${encodeURIComponent(storedName)}`

    return {
      attachmentId,
      sheetAttachmentId: lRes.recordset[0].SheetAttachmentID,
      orderIndex,
      originalName,
      storedName,
      contentType,
      fileSizeBytes,
      storageProvider,
      storagePath,
      isViewable,
      uploadedAt: uploadedAtIso,
      fileUrl,
    }
  } catch (err) {
    if (didBegin && !didCommit) {
      try {
        await tx.rollback()
      } catch (rollbackErr: unknown) {
        console.error('rollback failed', rollbackErr)
      }
    }
    throw err
  }
}

export async function listTemplateAttachments(sheetId: number): Promise<SheetAttachmentDTO[]> {
  const pool = await poolPromise

  const rs = await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .query<{
      sheetAttachmentId: number
      orderIndex: number | null
      isFromTemplate: SqlBit
      linkedFromSheetId: number | null
      cloneOnCreate: SqlBit
      createdAt: Date

      id: number
      originalName: string | null
      storedName: string | null
      contentType: string | null
      fileSizeBytes: number | null
      storageProvider: string | null
      storagePath: string | null
      sha256: string | null
      uploadedBy: number | null
      uploadedAt: Date | null
      isViewable: number | boolean | null
    }>(`
      SELECT
        sa.SheetAttachmentID AS sheetAttachmentId,
        sa.OrderIndex        AS orderIndex,
        sa.IsFromTemplate    AS isFromTemplate,
        sa.LinkedFromSheetID AS linkedFromSheetId,
        sa.CloneOnCreate     AS cloneOnCreate,
        sa.CreatedAt         AS createdAt,

        a.AttachmentID       AS id,
        a.OriginalName       AS originalName,
        a.StoredName         AS storedName,
        a.ContentType        AS contentType,
        a.FileSizeBytes      AS fileSizeBytes,
        a.StorageProvider    AS storageProvider,
        a.StoragePath        AS storagePath,
        a.Sha256             AS sha256,
        a.UploadedBy         AS uploadedBy,
        a.UploadedAt         AS uploadedAt,
        a.IsViewable         AS isViewable
      FROM dbo.SheetAttachments sa
      INNER JOIN dbo.Attachments a
        ON a.AttachmentID = sa.AttachmentID
      WHERE sa.SheetID = @SheetID
      ORDER BY sa.OrderIndex ASC, a.UploadedAt DESC
    `)

  return rs.recordset.map<SheetAttachmentDTO>(row => {
    const dto: SheetAttachmentDTO = {
      sheetAttachmentId: row.sheetAttachmentId,
      orderIndex: Number(row.orderIndex ?? 0),
      isFromTemplate: typeof row.isFromTemplate === 'boolean'
        ? row.isFromTemplate
        : row.isFromTemplate === 1,
      linkedFromSheetId: row.linkedFromSheetId ?? null,
      cloneOnCreate: typeof row.cloneOnCreate === 'boolean'
        ? row.cloneOnCreate
        : row.cloneOnCreate === 1,

      id: row.id,
      originalName: row.originalName ?? '',
      storedName: row.storedName ?? '',
      contentType: row.contentType ?? '',
      fileSizeBytes: Number(row.fileSizeBytes ?? 0),
      storageProvider: row.storageProvider ?? '',
      storagePath: row.storagePath ?? '',
      sha256: row.sha256 ?? null,
      uploadedBy: row.uploadedBy ?? null,
      uploadedAt: row.uploadedAt
        ? row.uploadedAt.toISOString()
        : '',
      isViewable: typeof row.isViewable === 'boolean'
        ? row.isViewable
        : row.isViewable === 1,
      fileUrl: ''
    }

    dto.fileUrl = buildAttachmentUrl(dto)
    return dto
  })
}

export async function deleteTemplateAttachment(sheetId: number, attachmentId: number): Promise<void> {
  const pool = await poolPromise

  await pool.request()
    .input('SheetID', sql.Int, sheetId)
    .input('AttachmentID', sql.Int, attachmentId)
    .query(`
      DELETE sa
      FROM dbo.SheetAttachments sa
      WHERE sa.SheetID = @SheetID
        AND sa.AttachmentID = @AttachmentID
    `)
}

// ───────────────────────────────────────────
// Create / update templates
// ───────────────────────────────────────────

export async function createTemplate(
  data: UnifiedSheet,
  userId: number
): Promise<number> {
  const pool = await poolPromise
  const tx = new sql.Transaction(pool)
  let didBegin = false
  let didCommit = false

  try {
    await tx.begin()
    didBegin = true

    const insertReq = applySheetInputsForInsert(tx.request(), data, userId)
    const sheetRs = await insertReq.query<{ SheetID: number }>(`
      INSERT INTO Sheets (
        SheetName, SheetDesc, SheetDesc2, ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
        AreaID, PackageName, RevisionNum, RevisionDate, PreparedByID, PreparedByDate,
        EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
        ManuID, SuppID, InstallPackNum, EquipSize, ModelNum, Driver, LocationDwg, PID, InstallDwg, CodeStd,
        CategoryID, ClientID, ProjectID, DisciplineID, SubtypeID, Status, IsLatest, IsTemplate, AutoCADImport
      )
      OUTPUT INSERTED.SheetID
      VALUES (
        @SheetName, @SheetDesc, @SheetDesc2, @ClientDocNum, @ClientProjNum, @CompanyDocNum, @CompanyProjNum,
        @AreaID, @PackageName, @RevisionNum, @RevisionDate, @PreparedByID, @PreparedByDate,
        @EquipmentName, @EquipmentTagNum, @ServiceName, @RequiredQty, @ItemLocation,
        @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNum, @Driver, @LocationDwg, @PID, @InstallDwg, @CodeStd,
        @CategoryID, @ClientID, @ProjectID, @DisciplineID, @SubtypeID, @Status, @IsLatest, @IsTemplate, @AutoCADImport
      );
    `)

    const sheetId = sheetRs.recordset[0].SheetID

    await insertSubsheetTree(tx, sheetId, data)

    await tx.commit()
    didCommit = true

    await insertAuditLog({
      PerformedBy: userId,
      TableName: 'Sheets',
      RecordID: sheetId,
      Action: 'Create Template',
      Route: undefined,
      Method: 'POST',
      StatusCode: 201,
      Changes: JSON.stringify({ ...data, sheetId }),
    }).catch((e: unknown) => {
      console.error('insertAuditLog failed', e)
    })

    try {
      await notifyUsers({
        recipientRoleIds: [1, 2],
        sheetId,
        title: 'New Template Created',
        message: `Template #${sheetId} was created by User #${userId}.`,
        category: 'Datasheet',
        createdBy: userId,
      })
    } catch (e) {
      console.error('notifyUsers failed', e)
    }

    return sheetId
  } catch (err) {
    if (didBegin && !didCommit) {
      try {
        await tx.rollback()
      } catch (rollbackErr: unknown) {
        console.error('rollback failed', rollbackErr)
      }
    }
    throw err
  }
}

const TEMPLATE_VERIFIABLE_STATUSES = ['Draft', 'Modified Draft'] as const

export async function updateTemplate(
  sheetId: number,
  data: UnifiedSheet,
  userId: number
): Promise<number> {
  const pool = await poolPromise

  const statusResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ Status: string }>(`
      SELECT Status FROM Sheets WHERE SheetID = @SheetID AND IsTemplate = 1
    `)
  const row = statusResult.recordset[0]
  if (!row) {
    throw new AppError('Template not found', 404)
  }
  if (!TEMPLATE_EDITABLE_STATUSES.includes(row.Status as (typeof TEMPLATE_EDITABLE_STATUSES)[number])) {
    throw new AppError(
      `Template can only be edited when status is Draft, Modified Draft, or Rejected. Current status: ${row.Status}.`,
      409
    )
  }

  const tx = new sql.Transaction(pool)
  let didBegin = false
  let didCommit = false

  try {
    await tx.begin()
    didBegin = true

    const updateReq = applySheetInputsForUpdate(tx.request(), data, userId)
      .input('SheetID', sql.Int, sheetId)

    await updateReq.query(`
      UPDATE Sheets
      SET SheetName = @SheetName, SheetDesc = @SheetDesc, SheetDesc2 = @SheetDesc2,
          ClientDocNum = @ClientDocNum, ClientProjNum = @ClientProjNum,
          CompanyDocNum = @CompanyDocNum, CompanyProjNum = @CompanyProjNum,
          AreaID = @AreaID, PackageName = @PackageName,
          RevisionNum = @RevisionNum, RevisionDate = @RevisionDate,
          EquipmentName = @EquipmentName, EquipmentTagNum = @EquipmentTagNum,
          ServiceName = @ServiceName, RequiredQty = @RequiredQty, ItemLocation = @ItemLocation,
          ManuID = @ManuID, SuppID = @SuppID, InstallPackNum = @InstallPackNum,
          EquipSize = @EquipSize, ModelNum = @ModelNum, Driver = @Driver, LocationDwg = @LocationDwg,
          PID = @PID, InstallDwg = @InstallDwg, CodeStd = @CodeStd,
          CategoryID = @CategoryID, ClientID = @ClientID, ProjectID = @ProjectID,
          DisciplineID = @DisciplineID, SubtypeID = @SubtypeID,
          ModifiedByID = @ModifiedByID, ModifiedByDate = SYSDATETIME()
      WHERE SheetID = @SheetID AND IsTemplate = 1
    `)

    await syncSubsheetTree(tx, sheetId, data)

    await tx.commit()
    didCommit = true

    try {
      await notifyUsers({
        recipientRoleIds: [1, 2],
        sheetId,
        title: 'Template Updated',
        message: `Template #${sheetId} was updated by User #${userId}.`,
        category: 'Datasheet',
        createdBy: userId,
      })
    } catch (e) {
      console.error('notifyUsers failed', e)
    }

    return sheetId
  } catch (err) {
    if (didBegin && !didCommit) {
      try {
        await tx.rollback()
      } catch (rollbackErr: unknown) {
        console.error('rollback failed', rollbackErr)
      }
    }
    throw err
  }
}

// ───────────────────────────────────────────
// Get template details (sheet + subsheets + notes + attachments + translations)
// ───────────────────────────────────────────

export async function getTemplateDetailsById(
  templateId: number,
  lang: string = 'eng',
  uom: Uom = 'SI'
): Promise<{ datasheet: UnifiedSheet; translations: unknown } | null> {
  const pool = await poolPromise

  const sheetResult = await pool
    .request()
    .input('SheetID', sql.Int, templateId)
    .query(`
      SELECT 
        s.SheetID,
        s.SheetName,
        s.SheetDesc,
        s.SheetDesc2,
        s.PackageName,
        s.RevisionNum,
        s.RevisionDate,
        s.PreparedByID,
        u1.FirstName + ' ' + u1.LastName AS preparedByName,
        s.PreparedByDate,
        s.VerifiedByID,
        u2.FirstName + ' ' + u2.LastName AS verifiedByName,
        s.VerifiedByDate,
        s.ApprovedByID,
        u3.FirstName + ' ' + u3.LastName AS approvedByName,
        s.ApprovedByDate,
        s.ClientDocNum,
        s.ClientProjNum,
        s.CompanyDocNum,
        s.CompanyProjNum,
        s.AreaID,
        a.AreaName,
        s.ClientID,
        c.ClientName, 
        c.ClientLogo,
        s.ProjectID,
        p.ProjName AS projectName,
        s.EquipmentName,
        s.EquipmentTagNum,
        s.ServiceName,
        s.EquipSize,
        s.RequiredQty,
        s.ItemLocation,
        s.ManuID,
        m.ManuName AS manuName,
        s.SuppID,
        sup.SuppName AS suppName,
        s.InstallPackNum,
        s.ModelNum,
        s.Driver,
        s.LocationDwg,
        s.PID,
        s.InstallDwg,
        s.CodeStd,
        s.CategoryID,
        cat.CategoryName,
        s.Status,
        s.IsTemplate,
        s.IsLatest,
        s.AutoCADImport,
        s.SourceFilePath,
        s.RejectComment,
        s.ModifiedByID,
        u4.FirstName + ' ' + u4.LastName AS modifiedByName,
        s.ModifiedByDate,
        s.RejectedByID,
        u5.FirstName + ' ' + u5.LastName AS rejectedByName,
        s.RejectedByDate,
        s.TemplateID,
        s.ParentSheetID,
        s.DisciplineID,
        d.Name AS disciplineName,
        s.SubtypeID,
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
      WHERE s.SheetID = @SheetID
    `)

  const row = sheetResult.recordset[0]
  if (!row) {
    return null
  }

  const datasheet: UnifiedSheet = {
    sheetId: row.SheetID,
    sheetName: row.SheetName,
    sheetDesc: row.SheetDesc,
    sheetDesc2: row.SheetDesc2,
    clientId: row.ClientID,
    clientName: row.ClientName,
    clientLogo: row.ClientLogo,
    clientDocNum: row.ClientDocNum,
    clientProjectNum: row.ClientProjNum,
    companyDocNum: row.CompanyDocNum,
    companyProjectNum: row.CompanyProjNum,
    areaId: row.AreaID,
    areaName: row.AreaName,
    packageName: row.PackageName,
    revisionNum: row.RevisionNum,
    revisionDate: row.RevisionDate?.toISOString().split('T')[0] ?? '',
    preparedById: row.PreparedByID,
    preparedByName: row.preparedByName,
    preparedByDate: row.PreparedByDate?.toISOString().split('T')[0] ?? '',
    verifiedById: row.VerifiedByID,
    verifiedByName: row.verifiedByName,
    verifiedDate: row.VerifiedByDate?.toISOString().split('T')[0] ?? '',
    approvedById: row.ApprovedByID,
    approvedByName: row.approvedByName,
    approvedDate: row.ApprovedByDate?.toISOString().split('T')[0] ?? '',
    isLatest: row.IsLatest,
    isTemplate: row.IsTemplate,
    autoCADImport: row.AutoCADImport,
    status: row.Status,
    rejectComment: row.RejectComment,
    rejectedById: row.RejectedByID,
    rejectedByName: row.rejectedByName,
    rejectedByDate: row.RejectedByDate?.toISOString().split('T')[0] ?? '',
    modifiedById: row.ModifiedByID,
    modifiedByName: row.modifiedByName,
    modifiedByDate: row.ModifiedByDate?.toISOString().split('T')[0] ?? '',
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
    equipSize: row.EquipSize,
    modelNum: row.ModelNum,
    driver: row.Driver,
    locationDwg: row.LocationDwg,
    categoryId: row.CategoryID,
    categoryName: row.CategoryName,
    projectId: row.ProjectID,
    projectName: row.projectName,
    pid: row.PID,
    installDwg: row.InstallDwg,
    codeStd: row.CodeStd,
    templateId: row.TemplateID,
    parentSheetId: row.ParentSheetID,
    disciplineId: row.DisciplineID ?? null,
    disciplineName: row.disciplineName ?? null,
    subtypeId: row.SubtypeID ?? null,
    subtypeName: row.subtypeName ?? null,
    sourceFilePath: row.SourceFilePath,
    subsheets: [],
  }

  const subsheetResult = await pool
    .request()
    .input('SheetID', sql.Int, templateId)
    .query(`
      SELECT SubID, SubName, OrderIndex
      FROM SubSheets
      WHERE SheetID = @SheetID
      ORDER BY OrderIndex
    `)

  const subsheets: UnifiedSubsheet[] = []

  for (const sub of subsheetResult.recordset) {
    const templateResult = await pool
      .request()
      .input('SubID', sql.Int, sub.SubID)
      .query(`
        SELECT InfoTemplateID, Label, InfoType, UOM, Required, OrderIndex
        FROM InformationTemplates
        WHERE SubID = @SubID
        ORDER BY OrderIndex
      `)

    const fields: InfoField[] = await Promise.all(
      templateResult.recordset.map(async (t) => {
        const optionResult = await pool
          .request()
          .input('InfoTemplateID', sql.Int, t.InfoTemplateID)
          .query(`
            SELECT OptionValue
            FROM InformationTemplateOptions
            WHERE InfoTemplateID = @InfoTemplateID
            ORDER BY SortOrder
          `)

        let displayUom: string | undefined = t.UOM ?? undefined

        if (uom === 'USC' && t.UOM) {
          const result = convertToUSC('1', t.UOM)
          if (result != null) {
            displayUom = result.unit
          }
        }

        const options = optionResult.recordset.map((o) => o.OptionValue as string)

        const field: InfoField = {
          id: t.InfoTemplateID,
          label: t.Label,
          infoType: t.InfoType as 'int' | 'decimal' | 'varchar',
          uom: displayUom,
          sortOrder: t.OrderIndex ?? 1,
          required: t.Required === true || t.Required === 1,
          options,
        }

        return field
      })
    )

    subsheets.push({
      id: sub.SubID,
      name: sub.SubName,
      fields,
    })
  }

  datasheet.subsheets = subsheets

  // Notes
  const notes = await listTemplateNotes(templateId)
  ;(datasheet as UnifiedSheet & { notes: SheetNoteDTO[] }).notes = notes

  // Attachments
  const attachments = await listTemplateAttachments(templateId)
  ;(datasheet as UnifiedSheet & { attachments: SheetAttachmentDTO[] }).attachments =
    attachments

  const translations = await getSheetTranslations(templateId, lang)

  const translatedSheet = applySheetTranslations(
    datasheet,
    translations
  ) as UnifiedSheet & {
    notes: SheetNoteDTO[]
    attachments: SheetAttachmentDTO[]
  }

  translatedSheet.notes = notes
  translatedSheet.attachments = attachments

  return { datasheet: translatedSheet, translations }
}

// ───────────────────────────────────────────
// Verify / approve
// ───────────────────────────────────────────

export async function verifyTemplate(
  sheetId: number,
  action: 'verify' | 'reject',
  rejectionComment: string | undefined,
  verifiedById: number
): Promise<void> {
  const pool = await poolPromise

  const statusResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query<{ Status: string }>(`
      SELECT Status FROM Sheets WHERE SheetID = @SheetID AND IsTemplate = 1
    `)
  const row = statusResult.recordset[0]
  if (!row) {
    throw new AppError('Template not found', 404)
  }
  if (!TEMPLATE_VERIFIABLE_STATUSES.includes(row.Status as (typeof TEMPLATE_VERIFIABLE_STATUSES)[number])) {
    throw new AppError(
      `Template can only be verified or rejected when status is Draft or Modified Draft. Current status: ${row.Status}.`,
      409
    )
  }

  const status = action === 'verify' ? 'Verified' : 'Rejected'

  const userResult = await pool
    .request()
    .input('UserID', sql.Int, verifiedById)
    .query(`
      SELECT FirstName
      FROM Users
      WHERE UserID = @UserID
    `)

  const verifiedByName = userResult.recordset[0]?.FirstName ?? `User #${verifiedById}`

  const request = pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('Status', sql.VarChar, status)

  if (action === 'verify') {
    request
      .input('VerifiedByID', sql.Int, verifiedById)
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
      .input('RejectedByID', sql.Int, verifiedById)
      .input('RejectedByDate', sql.DateTime, new Date())
      .input('RejectComment', sql.NVarChar, rejectionComment ?? null)

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
    title: `Template ${status}`,
    message: `Template #${sheetId} has been ${status.toLowerCase()} by ${verifiedByName}.`,
    category: 'Template',
    createdBy: verifiedById,
  })

  const preparedByResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT PreparedByID
      FROM Sheets
      WHERE SheetID = @SheetID
    `)

  const preparedById = preparedByResult.recordset[0]?.PreparedByID

  if (preparedById != null) {
    await notifyUsers({
      recipientUserIds: [preparedById],
      sheetId,
      title: `Your template was ${status.toLowerCase()}`,
      message: `Your template #${sheetId} has been ${status.toLowerCase()} by ${verifiedByName}.`,
      category: 'Template',
      createdBy: verifiedById,
    })
  }
}

export async function approveTemplate(
  sheetId: number,
  approvedById: number
): Promise<number> {
  const pool = await poolPromise

  const updateResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .input('ApprovedByID', sql.Int, approvedById)
    .input('ApprovedByDate', sql.DateTime, new Date())
    .input('Status', sql.VarChar(50), 'Approved')
    .query(`
      UPDATE Sheets
      SET Status = @Status,
          ApprovedByID = @ApprovedByID,
          ApprovedByDate = @ApprovedByDate
      WHERE SheetID = @SheetID AND IsTemplate = 1 AND Status = 'Verified'
    `)

  if (updateResult.rowsAffected[0] === 0) {
    const currentResult = await pool
      .request()
      .input('SheetID', sql.Int, sheetId)
      .query<{ Status: string }>(`SELECT Status FROM Sheets WHERE SheetID = @SheetID AND IsTemplate = 1`)
    const current = currentResult.recordset[0]
    if (!current) {
      throw new AppError('Template not found', 404)
    }
    throw new AppError(
      `Template can only be approved when status is Verified. Current status: ${current.Status}.`,
      409
    )
  }

  const creatorResult = await pool
    .request()
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT PreparedByID
      FROM Sheets
      WHERE SheetID = @SheetID
    `)

  const preparedById = creatorResult.recordset[0]?.PreparedByID

  if (preparedById != null) {
    try {
      await notifyUsers({
        recipientUserIds: [preparedById],
        sheetId,
        createdBy: approvedById,
        category: 'Template',
        title: 'Template Approved',
        message: `Your template #${sheetId} has been approved.`,
      })
    } catch (err) {
      // log only; do not break the approval
      console.error('Failed to send approval notification', err)
    }
  }

  return sheetId
}

// ───────────────────────────────────────────
// Clone template
// ───────────────────────────────────────────

function toSheetId(result: unknown): number {
  if (typeof result === 'number') {
    return result
  }

  if (result != null && typeof result === 'object' && 'sheetId' in result) {
    const id = (result as { sheetId: unknown }).sheetId
    if (typeof id === 'number') {
      return id
    }
  }

  throw new Error('createTemplate returned an unexpected type')
}

export async function cloneTemplateFrom(
  sourceTemplateId: number,
  overrides: Partial<UnifiedSheet>,
  userId: number
): Promise<{ sheetId: number }> {
  const details = await getTemplateDetailsById(sourceTemplateId)
  if (details?.datasheet == null) {
    throw new Error('Source template not found')
  }

  const src = details.datasheet

  const payload: UnifiedSheet = {
    ...src,
    ...overrides,
    sheetId: undefined,
    isTemplate: true,
    status: 'Draft',
    preparedById: userId,
    preparedByDate: new Date().toISOString(),
    verifiedById: null,
    verifiedDate: null,
    approvedById: null,
    approvedDate: null,
  }

  const created = (await createTemplate(payload, userId)) as unknown
  const newId = toSheetId(created)
  return { sheetId: newId }
}

// ───────────────────────────────────────────
// Export (PDF / Excel)
// ───────────────────────────────────────────

export async function exportTemplatePDF(
  templateId: number,
  lang: string = 'eng',
  uom: Uom = 'SI'
): Promise<{ filePath: string; fileName: string }> {
  const dir = path.resolve(process.cwd(), 'public', 'exports')
  await fs.mkdir(dir, { recursive: true })

  const templateDetails = await getTemplateDetailsById(templateId, lang, uom)
  if (templateDetails == null) {
    throw new Error(`Template ${templateId} not found`)
  }

  const datasheetLike: UnifiedSheet = hasDatasheet(templateDetails)
    ? templateDetails.datasheet
    : toDatasheetLikeFromTemplate(templateDetails)

  const result = await generateDatasheetPDF(datasheetLike, lang, uom)
  const outPath = path.join(dir, result.fileName)
  await fs.writeFile(outPath, result.buffer)

  return { filePath: outPath, fileName: result.fileName }
}

export async function exportTemplateExcel(
  templateId: number,
  lang: string = 'eng',
  uom: Uom = 'SI'
): Promise<{ filePath: string; fileName: string }> {
  const dir = path.resolve(process.cwd(), 'public', 'exports')
  await fs.mkdir(dir, { recursive: true })

  const templateDetails = await getTemplateDetailsById(templateId, lang, uom)
  if (templateDetails == null) {
    throw new Error(`Template ${templateId} not found`)
  }

  const datasheetLike: UnifiedSheet = hasDatasheet(templateDetails)
    ? templateDetails.datasheet
    : toDatasheetLikeFromTemplate(templateDetails)

  const result = await generateDatasheetExcel(datasheetLike, lang, uom)
  const outPath = path.join(dir, result.fileName)
  await fs.writeFile(outPath, result.buffer)

  return { filePath: outPath, fileName: result.fileName }
}

// ───────────────────────────────────────────
// Equipment tag check
// ───────────────────────────────────────────

export async function doesTemplateEquipmentTagExist(
  tag: string,
  projectId: number
): Promise<boolean> {
  const pool = await poolPromise
  const req = pool.request()

  req.input('ProjectID', sql.Int, projectId)
  req.input('Tag', sql.NVarChar, tag)

  const rs = await req.query<{ Exists: number }>(`
    SELECT TOP 1 1 AS [Exists]
    FROM Sheets
    WHERE IsTemplate = 1
      AND ProjectID = @ProjectID
      AND EquipmentTagNum = @Tag
  `)

  const recordCount = rs.recordset?.length ?? 0
  const hasExistingTag = recordCount > 0
  return hasExistingTag
}
