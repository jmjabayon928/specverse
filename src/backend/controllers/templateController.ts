// src/backend/controllers/templateController.ts

import type { Request, NextFunction, RequestHandler } from 'express'
import { z } from 'zod'

import type { UserSession } from '@/domain/auth/sessionTypes'
import type {
  UnifiedSheet,
  NoteUpdatePayload,
} from '@/domain/datasheets/sheetTypes'

import { sheetBelongsToAccount } from '@/backend/services/sheetAccessService'
import { mustGetAccountId } from '@/backend/utils/authGuards'
import {
  // lists & references
  fetchAllTemplates,
  fetchTemplateReferenceOptions,

  // core template operations
  getTemplateDetailsById,
  createTemplate,
  updateTemplate,
  verifyTemplate,
  approveTemplate,

  // notes
  listTemplateNotes,
  addSheetNote,
  updateTemplateNote,
  deleteTemplateNote,
  getAllNoteTypes,

  // attachments
  listTemplateAttachments,
  addSheetAttachment,
  deleteTemplateAttachment,

  // clone
  cloneTemplateFrom,

  // datasheet builder
  fetchTemplateStructure,

  // template structure (subsheets + fields)
  createSubsheet,
  updateSubsheet,
  deleteSubsheet,
  reorderSubsheets,
  createField,
  updateField,
  deleteField,
  reorderFields,

  // export
  exportTemplatePDF as exportTemplatePDFService,
  exportTemplateExcel as exportTemplateExcelService,

  // optional equipment-tag check
  doesTemplateEquipmentTagExist,
} from '@/backend/services/templateService'

import { AppError } from '@/backend/errors/AppError'
import { parseLang } from '@/backend/utils/parseLang'

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */

function asUser(req: Request): UserSession | null {
  const maybeUser = req.user as UserSession | undefined
  if (maybeUser == null) {
    return null
  }
  return maybeUser
}

function parseUom(q: unknown): 'SI' | 'USC' {
  const value = Array.isArray(q) ? q[0] : q
  if (value === 'USC') {
    return 'USC'
  }
  return 'SI'
}

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') {
    return null
  }

  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function normalizeQueryStringParam(v: unknown): string {
  if (typeof v === 'string') {
    return v.trim()
  }

  if (Array.isArray(v)) {
    const first = v[0]
    if (typeof first === 'string') {
      return first.trim()
    }
  }

  return ''
}

function normalizeQueryNumberParam(v: unknown): number {
  if (typeof v === 'number') {
    return v
  }

  if (typeof v === 'string') {
    return Number(v)
  }

  if (Array.isArray(v)) {
    const first = v[0]
    if (typeof first === 'number') {
      return first
    }
    if (typeof first === 'string') {
      return Number(first)
    }
  }

  return Number.NaN
}

const handleError = (next: NextFunction, err: unknown, fallbackMessage: string): void => {
  if (err instanceof AppError) {
    next(err)
    return
  }

  if (err instanceof z.ZodError) {
    next(
      new AppError('Invalid request payload', 400, true, {
        issues: err.errors.map((e) => ({
          path: e.path.length > 0 ? e.path.join('.') : undefined,
          message: e.message,
        })),
      })
    )
    return
  }

  console.error(fallbackMessage, err)
  next(new AppError(fallbackMessage, 500))
}

/* ───────────────────────────────────────────
   Zod schemas
   ─────────────────────────────────────────── */

const idParamsSchema = z.object({
  id: z.string().optional(),
})

const noteParamsSchema = z.object({
  id: z.string().optional(),
  noteId: z.string().optional(),
})

const attachmentParamsSchema = z.object({
  id: z.string().optional(),
  attachmentId: z.string().optional(),
})

const structureSubIdParamsSchema = z.object({
  id: z.string().optional(),
  subId: z.string().optional(),
})

const structureFieldIdParamsSchema = z.object({
  id: z.string().optional(),
  subId: z.string().optional(),
  fieldId: z.string().optional(),
})

const createSubsheetBodySchema = z.object({
  subName: z.string().min(1),
})

const updateSubsheetBodySchema = z.object({
  subName: z.string().min(1).optional(),
})

const reorderSubsheetsBodySchema = z.object({
  order: z.array(z.object({ subId: z.number().int().positive(), orderIndex: z.number().int().min(0) })),
})

const infoTypeSchema = z.enum(['int', 'decimal', 'varchar'])

const createFieldBodySchema = z.object({
  label: z.string().min(1),
  infoType: infoTypeSchema.default('varchar'),
  uom: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
})

const updateFieldBodySchema = z.object({
  label: z.string().min(1).optional(),
  infoType: infoTypeSchema.optional(),
  uom: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  orderIndex: z.number().int().min(0).optional(),
})

const reorderFieldsBodySchema = z.object({
  order: z.array(z.object({ fieldId: z.number().int().positive(), orderIndex: z.number().int().min(0) })),
})

// allow extra fields, but ensure fieldValues (if present) is a string map
const createTemplateBodySchema = z
  .object({
    fieldValues: z.record(z.string(), z.string()).optional(),
    disciplineId: z.number().int().positive(),
    subtypeId: z.number().int().positive().nullable().optional(),
  })
  .passthrough()

const updateTemplateBodySchema = z
  .object({
    fieldValues: z.record(z.string(), z.string()).optional(),
    disciplineId: z.number().int().positive().nullable().optional(),
    subtypeId: z.number().int().positive().nullable().optional(),
  })
  .passthrough()

const verifyTemplateBodySchema = z
  .object({
    action: z.enum(['verify', 'reject']).optional(),
    rejectionComment: z.string().optional(),
  })
  .transform((value): { action: 'verify' | 'reject'; rejectionComment?: string } => ({
    action: value.action ?? 'verify',
    rejectionComment: value.rejectionComment,
  }))

const approveTemplateBodySchema = z
  .object({
    action: z.enum(['approve', 'reject']).optional(),
    rejectComment: z.string().optional(),
  })
  .transform((value): { action: 'approve' | 'reject'; rejectComment?: string } => ({
    action: value.action ?? 'approve',
    rejectComment: value.rejectComment,
  }))

const noteCreateSchema = z.object({
  text: z.string().min(1),
})

const noteUpdateSchema = z.object({
  text: z.string().min(1).optional(),
})

const checkTagQuerySchema = z.object({
  tag: z.unknown(),
  projectId: z.unknown(),
})

/* ───────────────────────────────────────────
   Health
   ─────────────────────────────────────────── */

export const templateHealth: RequestHandler = (_req, res) => {
  res.status(200).json({ ok: true })
}

/* ───────────────────────────────────────────
   Structure (builder)
   ─────────────────────────────────────────── */

export const getTemplateStructure: RequestHandler = async (req, res, next) => {
  try {
    // support /:sheetId/structure or /:templateId/structure or /:id/structure
    const raw =
      (req.params as Record<string, string | undefined>).sheetId ??
      (req.params as Record<string, string | undefined>).templateId ??
      (req.params as Record<string, string | undefined>).id

    const templateId = parseId(raw)
    if (templateId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }

    const structure = await fetchTemplateStructure(templateId)
    res.status(200).json(structure)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to fetch template structure')
  }
}

/* ───────────────────────────────────────────
   Lists + reference
   ─────────────────────────────────────────── */

export const getAllTemplatesHandler: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const rows = await fetchAllTemplates(accountId)
    res.status(200).json(rows)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to fetch templates')
  }
}

export const getTemplateReferenceOptionsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const data = await fetchTemplateReferenceOptions()
    res.status(200).json(data)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to fetch template reference options')
  }
}

/* ───────────────────────────────────────────
   Get by ID
   ─────────────────────────────────────────── */

export const getTemplateById: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const parsedParams = idParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)

    if (templateId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const lang = parseLang(req.query.lang)

    res.set('Cache-Control', 'private, no-store')
    res.set('Vary', 'Accept-Language, Cookie')

    const data = await getTemplateDetailsById(templateId, lang, 'SI', accountId)
    if (data == null) {
      next(new AppError('Template not found', 404))
      return
    }
    res.status(200).json(data)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to get template')
  }
}

/* ───────────────────────────────────────────
   Create
   ─────────────────────────────────────────── */

export const createTemplateHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }

    createTemplateBodySchema.parse(req.body)
    const body = req.body as UnifiedSheet

    const payload: UnifiedSheet = {
      ...body,
      isTemplate: true,
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const newId = await createTemplate(payload, user.userId, accountId)
    res.status(201).json({ sheetId: newId })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to create template')
  }
}

/* ───────────────────────────────────────────
   Update
   ─────────────────────────────────────────── */

export const updateTemplateHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }

    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }

    updateTemplateBodySchema.parse(req.body)
    const data = req.body as UnifiedSheet

    const payload: UnifiedSheet = {
      ...data,
      isTemplate: true,
    }

    const updatedId = await updateTemplate(sheetId, payload, user.userId)
    res.status(200).json({ sheetId: updatedId })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to update template')
  }
}

/* ───────────────────────────────────────────
   Template structure (subsheets + fields)
   ─────────────────────────────────────────── */

export const createSubsheetHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }
    const parsedParams = idParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)
    if (templateId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }
    const body = createSubsheetBodySchema.parse(req.body ?? {})
    const result = await createSubsheet(templateId, body.subName, user.userId)
    res.status(201).json(result)
    return
  } catch (err: unknown) {
    handleError(next, err, 'Failed to create subsheet')
  }
}

export const updateSubsheetHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }
    const parsedParams = structureSubIdParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)
    const subId = parseId(parsedParams.subId)
    if (templateId == null || subId == null) {
      next(new AppError('Invalid template or subsheet ID', 400))
      return
    }
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }
    const body = updateSubsheetBodySchema.parse(req.body ?? {})
    const result = await updateSubsheet(templateId, subId, body, user.userId)
    res.status(200).json(result)
    return
  } catch (err: unknown) {
    handleError(next, err, 'Failed to update subsheet')
  }
}

export const deleteSubsheetHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }
    const parsedParams = structureSubIdParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)
    const subId = parseId(parsedParams.subId)
    if (templateId == null || subId == null) {
      next(new AppError('Invalid template or subsheet ID', 400))
      return
    }
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }
    const result = await deleteSubsheet(templateId, subId, user.userId)
    res.status(200).json(result)
    return
  } catch (err: unknown) {
    handleError(next, err, 'Failed to delete subsheet')
  }
}

export const reorderSubsheetsHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }
    const parsedParams = idParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)
    if (templateId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }
    const body = reorderSubsheetsBodySchema.parse(req.body ?? {})
    const result = await reorderSubsheets(templateId, body.order, user.userId)
    res.status(200).json(result)
    return
  } catch (err: unknown) {
    handleError(next, err, 'Failed to reorder subsheets')
  }
}

export const createFieldHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }
    const parsedParams = structureSubIdParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)
    const subId = parseId(parsedParams.subId)
    if (templateId == null || subId == null) {
      next(new AppError('Invalid template or subsheet ID', 400))
      return
    }
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }
    const body = createFieldBodySchema.parse(req.body ?? {})
    const result = await createField(
      templateId,
      subId,
      {
        label: body.label,
        infoType: body.infoType as 'int' | 'decimal' | 'varchar',
        uom: body.uom,
        required: body.required,
        options: body.options,
      },
      user.userId
    )
    res.status(201).json(result)
    return
  } catch (err: unknown) {
    handleError(next, err, 'Failed to create field')
  }
}

export const updateFieldHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }
    const parsedParams = structureFieldIdParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)
    const subId = parseId(parsedParams.subId)
    const fieldId = parseId(parsedParams.fieldId)
    if (templateId == null || subId == null || fieldId == null) {
      next(new AppError('Invalid template, subsheet, or field ID', 400))
      return
    }
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }
    const body = updateFieldBodySchema.parse(req.body ?? {})
    const result = await updateField(
      templateId,
      subId,
      fieldId,
      {
        label: body.label,
        infoType: body.infoType as 'int' | 'decimal' | 'varchar' | undefined,
        uom: body.uom,
        required: body.required,
        options: body.options,
        orderIndex: body.orderIndex,
      },
      user.userId
    )
    res.status(200).json(result)
    return
  } catch (err: unknown) {
    handleError(next, err, 'Failed to update field')
  }
}

export const deleteFieldHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }
    const parsedParams = structureFieldIdParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)
    const subId = parseId(parsedParams.subId)
    const fieldId = parseId(parsedParams.fieldId)
    if (templateId == null || subId == null || fieldId == null) {
      next(new AppError('Invalid template, subsheet, or field ID', 400))
      return
    }
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }
    const result = await deleteField(templateId, subId, fieldId, user.userId)
    res.status(200).json(result)
    return
  } catch (err: unknown) {
    handleError(next, err, 'Failed to delete field')
  }
}

export const reorderFieldsHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }
    const parsedParams = structureSubIdParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)
    const subId = parseId(parsedParams.subId)
    if (templateId == null || subId == null) {
      next(new AppError('Invalid template or subsheet ID', 400))
      return
    }
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }
    const body = reorderFieldsBodySchema.parse(req.body ?? {})
    const result = await reorderFields(templateId, subId, body.order, user.userId)
    res.status(200).json(result)
    return
  } catch (err: unknown) {
    handleError(next, err, 'Failed to reorder fields')
  }
}

/* ───────────────────────────────────────────
   Verify / Reject
   ─────────────────────────────────────────── */

export const verifyTemplateHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const user = asUser(req)
    const userId = user?.userId
    if (userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }

    const { action, rejectionComment } = verifyTemplateBodySchema.parse(req.body)

    await verifyTemplate(sheetId, action, rejectionComment, userId)
    res.status(200).json({ sheetId, action, rejectionComment })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to verify or reject template')
  }
}

/* ───────────────────────────────────────────
   Approve
   ─────────────────────────────────────────── */

export const approveTemplateHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const user = asUser(req)
    const userId = user?.userId
    if (userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Template not found', 404))
      return
    }

    const body = approveTemplateBodySchema.parse(req.body ?? {})
    if (body.action === 'reject') {
      const trimmed = body.rejectComment?.trim() ?? ''
      if (trimmed.length === 0) {
        next(new AppError('Rejection reason is required when rejecting.', 400))
        return
      }
    }

    const updatedId = await approveTemplate(
      sheetId,
      body.action,
      body.action === 'reject' ? (body.rejectComment?.trim() ?? '') : undefined,
      userId
    )
    res.status(200).json({ sheetId: updatedId })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to approve or reject template')
  }
}

/* ───────────────────────────────────────────
   Clone
   ─────────────────────────────────────────── */

export const cloneTemplateHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }

    const parsedParams = idParamsSchema.parse(req.params)
    const sourceId = parseId(parsedParams.id)

    if (sourceId == null) {
      next(new AppError('Invalid source template ID', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const overrides = req.body as Partial<UnifiedSheet>

    const result = await cloneTemplateFrom(sourceId, overrides, user.userId, accountId)
    res.status(201).json(result)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to clone template')
  }
}

/* ───────────────────────────────────────────
   Notes
   ─────────────────────────────────────────── */

export const listTemplateNotesHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    const notes = await listTemplateNotes(sheetId)
    res.status(200).json(notes)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to list template notes')
  }
}

export const createTemplateNoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }

    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    const payload = noteCreateSchema.parse(req.body)
    const text = payload.text.trim()
    if (text.length === 0) {
      next(new AppError('Note text is required', 400))
      return
    }

    const rawNoteType = (req.body as { noteTypeId?: unknown }).noteTypeId
    let noteTypeId: number | null = null

    if (typeof rawNoteType === 'number' && Number.isFinite(rawNoteType)) {
      noteTypeId = rawNoteType
    } else if (typeof rawNoteType === 'string') {
      const parsed = Number(rawNoteType)
      if (Number.isFinite(parsed)) {
        noteTypeId = parsed
      }
    }

    // keep legacy behavior: 0 means "no type" and service/SQL maps it to NULL
    const resolvedNoteTypeId = noteTypeId ?? 0

    const note = await addSheetNote({
      sheetId,
      noteTypeId: resolvedNoteTypeId,
      noteText: text,
      createdBy: user.userId,
      ensureTemplate: true,
    })

    res.status(201).json(note)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to create template note')
  }
}

export const updateTemplateNoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = noteParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)
    const noteId = parseId(parsedParams.noteId)

    if (sheetId == null || noteId == null) {
      next(new AppError('Invalid parameters', 400))
      return
    }

    const user = asUser(req)
    const userId = user?.userId
    if (userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    const payloadParsed = noteUpdateSchema.parse(req.body)
    const text = payloadParsed.text?.trim() ?? ''

    if (text.length === 0) {
      next(new AppError('Note text is required', 400))
      return
    }

    const payload: NoteUpdatePayload = { text }
    await updateTemplateNote(sheetId, noteId, payload, userId)

    res.status(200).json({ sheetId, noteId })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to update template note')
  }
}

export const deleteTemplateNoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = noteParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)
    const noteId = parseId(parsedParams.noteId)

    if (sheetId == null || noteId == null) {
      next(new AppError('Invalid parameters', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    await deleteTemplateNote(sheetId, noteId)
    // keep legacy behavior: 200 with a body
    res.status(200).json({ ok: true })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to delete template note')
  }
}

export const getNoteTypesHandler: RequestHandler = async (_req, res, next) => {
  try {
    const rows = await getAllNoteTypes()
    res.status(200).json(rows)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to fetch note types')
  }
}

/* ───────────────────────────────────────────
   Attachments
   ─────────────────────────────────────────── */

export const listTemplateAttachmentsHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    const items = await listTemplateAttachments(sheetId)
    res.status(200).json(items)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to list template attachments')
  }
}

export const uploadTemplateAttachmentHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }

    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file
    if (file == null) {
      next(new AppError('No file uploaded', 400))
      return
    }

    const saved = await addSheetAttachment({
      sheetId,
      file,
      uploadedBy: user.userId,
      ensureTemplate: true,
    })

    res.status(201).json(saved)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to upload template attachment')
  }
}

export const deleteTemplateAttachmentHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = attachmentParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)
    const attachmentId = parseId(parsedParams.attachmentId)

    if (sheetId == null || attachmentId == null) {
      next(new AppError('Invalid parameters', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    await deleteTemplateAttachment(sheetId, attachmentId)
    // keep legacy behavior: 200 with a body
    res.status(200).json({ ok: true })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to delete template attachment')
  }
}

/* ───────────────────────────────────────────
   Export
   ─────────────────────────────────────────── */

export const exportTemplatePDF: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const parsedParams = idParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)

    if (templateId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const lang = parseLang(req.query.lang)
    const uom = parseUom(req.query.uom)

    res.set('Cache-Control', 'private, no-store')
    res.set('Vary', 'Accept-Language, Cookie')

    const { filePath, fileName } = await exportTemplatePDFService(templateId, lang, uom, accountId)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    res.status(200).sendFile(filePath)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to export template PDF')
  }
}

export const exportTemplateExcel: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const parsedParams = idParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)

    if (templateId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const lang = parseLang(req.query.lang)
    const uom = parseUom(req.query.uom)

    res.set('Cache-Control', 'private, no-store')
    res.set('Vary', 'Accept-Language, Cookie')

    const { filePath, fileName } = await exportTemplateExcelService(templateId, lang, uom, accountId)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    res.status(200).sendFile(filePath)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to export template Excel')
  }
}

/* ───────────────────────────────────────────
   Equipment tag check (optional)
   ─────────────────────────────────────────── */

export const checkTemplateEquipmentTagHandler: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const parsed = checkTagQuerySchema.parse(req.query)
    const tag = normalizeQueryStringParam(parsed.tag)
    const projectId = normalizeQueryNumberParam(parsed.projectId)

    const hasRequiredInputs = tag.length > 0 && projectId > 0
    if (!hasRequiredInputs) {
      next(new AppError('tag and projectId are required', 400))
      return
    }

    const exists = await doesTemplateEquipmentTagExist(tag, projectId, accountId)
    res.status(200).json({ exists })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to check template equipment tag')
  }
}
