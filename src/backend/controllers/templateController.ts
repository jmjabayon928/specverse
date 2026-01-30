// src/backend/controllers/templateController.ts

import type { Request, NextFunction, RequestHandler } from 'express'
import { z } from 'zod'

import type { UserSession } from '@/domain/auth/sessionTypes'
import type {
  UnifiedSheet,
  NoteUpdatePayload,
} from '@/domain/datasheets/sheetTypes'

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

  // export
  exportTemplatePDF as exportTemplatePDFService,
  exportTemplateExcel as exportTemplateExcelService,

  // optional equipment-tag check
  doesTemplateEquipmentTagExist,
} from '@/backend/services/templateService'

import { AppError } from '@/backend/errors/AppError'

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

function parseLang(q: unknown): string {
  if (typeof q === 'string' && q.trim().length > 0) {
    return q.trim()
  }

  if (Array.isArray(q)) {
    const first = q[0]
    if (typeof first === 'string' && first.trim().length > 0) {
      return first.trim()
    }
  }

  return 'eng'
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
    next(new AppError('Invalid request payload', 400))
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

    const structure = await fetchTemplateStructure(templateId)
    res.status(200).json(structure)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to fetch template structure')
  }
}

/* ───────────────────────────────────────────
   Lists + reference
   ─────────────────────────────────────────── */

export const getAllTemplatesHandler: RequestHandler = async (_req, res, next) => {
  try {
    const rows = await fetchAllTemplates()
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
    const parsedParams = idParamsSchema.parse(req.params)
    const templateId = parseId(parsedParams.id)

    if (templateId == null) {
      next(new AppError('Invalid template ID', 400))
      return
    }

    const lang = parseLang(req.query.lang)

    res.set('Cache-Control', 'private, no-store')
    res.set('Vary', 'Accept-Language, Cookie')

    const data = await getTemplateDetailsById(templateId, lang)
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

    const newId = await createTemplate(payload, user.userId)
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

    const updatedId = await approveTemplate(sheetId, userId)
    res.status(200).json({ sheetId: updatedId })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to approve template')
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

    const overrides = req.body as Partial<UnifiedSheet>

    const result = await cloneTemplateFrom(sourceId, overrides, user.userId)
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

    const payloadParsed = noteUpdateSchema.parse(req.body)
    const text = payloadParsed.text?.trim() ?? ''

    if (text.length === 0) {
      next(new AppError('Note text is required', 400))
      return
    }

    const user = asUser(req)
    const userId = user?.userId
    if (userId == null) {
      next(new AppError('Unauthorized', 401))
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

    const { filePath, fileName } = await exportTemplatePDFService(templateId, lang, uom)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    res.status(200).sendFile(filePath)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to export template PDF')
  }
}

export const exportTemplateExcel: RequestHandler = async (req, res, next) => {
  try {
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

    const { filePath, fileName } = await exportTemplateExcelService(templateId, lang, uom)
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
    const parsed = checkTagQuerySchema.parse(req.query)
    const tag = normalizeQueryStringParam(parsed.tag)
    const projectId = normalizeQueryNumberParam(parsed.projectId)

    const hasRequiredInputs = tag.length > 0 && projectId > 0
    if (!hasRequiredInputs) {
      next(new AppError('tag and projectId are required', 400))
      return
    }

    const exists = await doesTemplateEquipmentTagExist(tag, projectId)
    res.status(200).json({ exists })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to check template equipment tag')
  }
}
