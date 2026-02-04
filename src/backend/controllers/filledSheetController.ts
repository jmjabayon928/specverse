// src/backend/controllers/filledSheetController.ts
import type { Request, NextFunction, RequestHandler } from "express"
import { z } from "zod"

import type { UserSession } from "../../domain/auth/sessionTypes"
import type {
  CreateFilledSheetBody,
  UpdateFilledSheetBody,
  CloneFilledSheetBody,
  CreateFilledSheetResult,
  NoteCreatePayload,
  NoteUpdatePayload,
  UnifiedSheet,
} from "../../domain/datasheets/sheetTypes"

import {
  // lists & references
  fetchAllFilled,
  fetchReferenceOptions,

  // core CRUD
  getFilledSheetDetailsById,
  createFilledSheet,
  updateFilledSheet,
  verifyFilledSheet,
  approveFilledSheet,

  // utils / business rules
  bumpRejectedToModifiedDraftFilled,
  doesEquipmentTagExist,
  getFilledSheetTemplateId,
  getLatestApprovedTemplateId,

  // attachments (canonical + legacy helpers)
  getAttachmentsForSheet,
  deleteAttachmentById,
  listSheetAttachments,
  deleteSheetAttachmentLink,

  // notes
  getNotesForSheet,
  createNoteForSheet,
  updateNoteForSheet,
  deleteNoteForSheet,

  // export
  exportPDF,
  exportExcel,
} from "../services/filledSheetService"
import { sheetBelongsToAccount } from "../services/sheetAccessService"
import { mustGetAccountId } from '@/backend/utils/authGuards'
import { addSheetAttachment } from "../services/templateService"

import { AppError } from "../errors/AppError"
import { REVISION_SNAPSHOT_INVALID_MESSAGE } from "../database/sheetRevisionQueries"
import { parseLang } from "../utils/parseLang"

/* ───────────────────────────────────────────
   Local helpers
   ─────────────────────────────────────────── */

function parseUom(q: unknown): "SI" | "USC" {
  const value = Array.isArray(q) ? q[0] : q
  return value === "USC" ? "USC" : "SI"
}

function asUser(req: Request): UserSession | null {
  const maybeUser = req.user as UserSession | undefined
  if (maybeUser == null) {
    return null
  }
  return maybeUser
}

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string") {
    return null
  }

  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function normalizeQueryStringParam(v: unknown): string {
  if (typeof v === "string") {
    return v.trim()
  }

  if (Array.isArray(v)) {
    const first = v[0]
    if (typeof first === "string") {
      return first.trim()
    }
  }

  return ""
}

function normalizeQueryNumberParam(v: unknown): number {
  if (typeof v === "number") {
    return v
  }

  if (typeof v === "string") {
    return Number(v)
  }

  if (Array.isArray(v)) {
    const first = v[0]
    if (typeof first === "number") {
      return first
    }
    if (typeof first === "string") {
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
    next(new AppError("Invalid request payload", 400))
    return
  }

  if (err instanceof Error && err.message.startsWith("VALIDATION:")) {
    const message = err.message.replace(/^VALIDATION:\s*/, "").trim()
    next(new AppError(message || "Validation failed", 400))
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

const attachmentParamsSchema = z.object({
  id: z.string().optional(),
  attachmentId: z.string().optional(),
})

const noteParamsSchema = z.object({
  id: z.string().optional(),
  noteId: z.string().optional(),
})

const createFilledSheetBodySchema = z
  .object({
    fieldValues: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()

const updateFilledSheetBodySchema = z
  .object({
    fieldValues: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()

const cloneFilledSheetBodySchema = z
  .object({
    equipmentTagNum: z.union([z.string(), z.null()]).optional(),
    projectId: z.union([z.string(), z.number()]).optional(),
    fieldValues: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()

const verifyFilledSheetBodySchema = z
  .object({
    action: z.enum(["verify", "reject"]).optional(),
    rejectionComment: z.string().optional(),
  })
  .transform(
    (value): { action: "verify" | "reject"; rejectionComment?: string } => ({
      action: value.action ?? "verify",
      rejectionComment: value.rejectionComment,
    })
  )

const approveFilledSheetBodySchema = z
  .object({
    action: z.enum(["approve", "reject"]).optional(),
    rejectComment: z.string().optional(),
  })
  .transform(
    (value): { action: "approve" | "reject"; rejectComment?: string } => ({
      action: value.action ?? "approve",
      rejectComment: value.rejectComment,
    })
  )

// Allow extra fields to pass through so we do not block future noteTypeId, etc.
const noteCreateSchema = z
  .object({
    text: z.string().min(1),
  })
  .passthrough()

const noteUpdateSchema = z
  .object({
    text: z.string().min(1).optional(),
  })
  .passthrough()

const checkTagQuerySchema = z.object({
  tag: z.unknown(),
  projectId: z.unknown(),
})

/* ───────────────────────────────────────────
   Lists & reference
   ─────────────────────────────────────────── */

export const getAllFilled: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const rows = await fetchAllFilled(accountId)
    res.status(200).json(rows)
  } catch (err: unknown) {
    handleError(next, err, "Failed to fetch filled sheets")
  }
}

export const getReferenceOptions: RequestHandler = async (_req, res, next) => {
  try {
    const data = await fetchReferenceOptions()
    res.status(200).json(data)
  } catch (err: unknown) {
    handleError(next, err, "Failed to fetch reference options")
  }
}

/* ───────────────────────────────────────────
   Core CRUD
   ─────────────────────────────────────────── */

export const getFilledSheetById: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const lang = parseLang(req.query.lang)

    res.set("Cache-Control", "private, no-store")
    res.set("Vary", "Accept-Language, Cookie")

    const data = await getFilledSheetDetailsById(sheetId, lang, "SI", accountId)
    if (data == null) {
      next(new AppError("Sheet not found", 404))
      return
    }
    res.status(200).json(data)
  } catch (err: unknown) {
    handleError(next, err, "Failed to get filled sheet")
  }
}

export const createFilledSheetHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    createFilledSheetBodySchema.parse(req.body)
    const body = req.body as CreateFilledSheetBody

    const createInput: UnifiedSheet & { fieldValues: Record<string, string> } = {
      ...(body as unknown as UnifiedSheet),
      fieldValues: body.fieldValues ?? {},
      isTemplate: false,
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const ctx = { userId: user.userId, route: req.originalUrl, method: req.method }
    const result = (await createFilledSheet(createInput, ctx, accountId)) as CreateFilledSheetResult

    res.status(201).json({ sheetId: result.sheetId })
  } catch (err: unknown) {
    handleError(next, err, "Failed to create filled sheet")
  }
}

export const updateFilledSheetHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    updateFilledSheetBodySchema.parse(req.body)
    const body = req.body as UpdateFilledSheetBody

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const current = await getFilledSheetDetailsById(sheetId, "eng", "SI", accountId)
    const existing = current?.datasheet
    if (existing == null) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const merged: UnifiedSheet = { ...existing, ...body }
    const updated = await updateFilledSheet(sheetId, merged, user.userId)

    res.status(200).json({ sheetId: updated.sheetId })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === REVISION_SNAPSHOT_INVALID_MESSAGE) {
      console.error('createRevision snapshot validation failed', err)
      next(new AppError('Unable to create a revision snapshot. Please try again or contact support.', 500))
      return
    }
    handleError(next, err, "Failed to update filled sheet")
  }
}

export const verifyFilledSheetHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const user = asUser(req)
    const userId = user?.userId
    if (userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const { action, rejectionComment } = verifyFilledSheetBodySchema.parse(req.body)

    await verifyFilledSheet(sheetId, action, rejectionComment, userId)
    res.status(200).json({ sheetId, action, rejectionComment })
  } catch (err: unknown) {
    handleError(next, err, "Failed to verify or reject filled sheet")
  }
}

export const approveFilledSheetHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const user = asUser(req)
    const userId = user?.userId
    if (userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const body = approveFilledSheetBodySchema.parse(req.body ?? {})
    if (body.action === "reject") {
      const trimmed = body.rejectComment?.trim() ?? ""
      if (trimmed.length === 0) {
        next(new AppError("Rejection reason is required when rejecting.", 400))
        return
      }
    }

    await approveFilledSheet(
      sheetId,
      body.action,
      body.action === "reject" ? (body.rejectComment?.trim() ?? "") : undefined,
      userId
    )
    res.status(200).json({ sheetId })
  } catch (err: unknown) {
    handleError(next, err, "Failed to approve or reject filled sheet")
  }
}

/* ───────────────────────────────────────────
   Clone
   ─────────────────────────────────────────── */

export const cloneFilledSheetHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    const parsedParams = idParamsSchema.parse(req.params)
    const sourceId = parseId(parsedParams.id)
    if (sourceId == null) {
      next(new AppError("Invalid source sheet ID", 400))
      return
    }

    cloneFilledSheetBodySchema.parse(req.body)
    const body = req.body as CloneFilledSheetBody

    const rawTag = body.equipmentTagNum ?? ""
    const equipmentTagNum = rawTag.trim()

    const projectIdRaw = body.projectId
    let projectId = Number.NaN

    if (typeof projectIdRaw === "string") {
      projectId = Number(projectIdRaw)
    } else if (typeof projectIdRaw === "number") {
      projectId = projectIdRaw
    }

    if (equipmentTagNum.length === 0) {
      next(new AppError("equipmentTagNum is required", 400))
      return
    }

    if (Number.isNaN(projectId) || projectId <= 0) {
      next(new AppError("Valid projectId is required", 400))
      return
    }

    const exists = await doesEquipmentTagExist(equipmentTagNum, projectId)
    if (exists) {
      next(new AppError("Equipment tag already exists", 409))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const sourceBelongs = await sheetBelongsToAccount(sourceId, accountId)
    if (!sourceBelongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const sourceTemplateRow = await getFilledSheetTemplateId(sourceId)
    if (!sourceTemplateRow?.TemplateID) {
      next(new AppError("Source sheet is not a filled sheet or has no template.", 400))
      return
    }
    const resolvedTemplateId = await getLatestApprovedTemplateId(sourceTemplateRow.TemplateID)

    const ctx = { userId: user.userId, route: req.originalUrl, method: req.method }

    const createInput: UnifiedSheet & { fieldValues: Record<string, string> } = {
      ...(body as unknown as UnifiedSheet),
      templateId: resolvedTemplateId,
      equipmentTagNum,
      projectId,
      isTemplate: false,
      fieldValues: body.fieldValues ?? {},
    }

    const created = (await createFilledSheet(createInput, ctx, accountId)) as CreateFilledSheetResult
    res.status(201).json({ sheetId: created.sheetId })
  } catch (err: unknown) {
    handleError(next, err, "Failed to clone filled sheet")
  }
}

/* ───────────────────────────────────────────
   Attachments
   ─────────────────────────────────────────── */

export const uploadFilledSheetAttachmentHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file
    if (file == null) {
      next(new AppError("No file uploaded", 400))
      return
    }

    const saved = await addSheetAttachment({
      sheetId,
      file,
      uploadedBy: user.userId,
      ensureTemplate: false,
    })

    await bumpRejectedToModifiedDraftFilled(sheetId, user.userId)
    res.status(201).json(saved)
  } catch (err: unknown) {
    handleError(next, err, "Failed to upload attachment")
  }
}

export const listFilledSheetAttachmentsHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const sourceRaw = Array.isArray(req.query.source) ? req.query.source[0] : req.query.source
    const source = typeof sourceRaw === "string" ? sourceRaw.toLowerCase() : "canonical"

    if (source === "legacy") {
      const legacyItems = await getAttachmentsForSheet(sheetId)
      res.status(200).json(legacyItems)
      return
    }

    const items = await listSheetAttachments(sheetId)
    res.status(200).json(items)
  } catch (err: unknown) {
    handleError(next, err, "Failed to list attachments")
  }
}

export const deleteFilledSheetAttachmentHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = attachmentParamsSchema.parse(req.params)

    const sheetId = parseId(parsedParams.id)
    const attachmentId = parseId(parsedParams.attachmentId)

    if (sheetId == null || attachmentId == null) {
      next(new AppError("Invalid parameters", 400))
      return
    }

    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const deletedCanonical = await deleteSheetAttachmentLink(sheetId, attachmentId)
    if (deletedCanonical) {
      await bumpRejectedToModifiedDraftFilled(sheetId, user.userId)
      res.status(204).end()
      return
    }

    await deleteAttachmentById(sheetId, attachmentId, user.userId)
    res.status(204).end()
  } catch (err: unknown) {
    handleError(next, err, "Failed to delete attachment")
  }
}

/* ───────────────────────────────────────────
   Notes
   ─────────────────────────────────────────── */

export const listFilledSheetNotesHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const items = await getNotesForSheet(sheetId)
    res.status(200).json(items)
  } catch (err: unknown) {
    handleError(next, err, "Failed to list notes")
  }
}

export const createFilledSheetNoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const payload = noteCreateSchema.parse(req.body) as NoteCreatePayload
    const saved = await createNoteForSheet(sheetId, payload, user.userId)
    res.status(201).json(saved)
  } catch (err: unknown) {
    handleError(next, err, "Failed to create note")
  }
}

export const updateFilledSheetNoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = noteParamsSchema.parse(req.params)

    const sheetId = parseId(parsedParams.id)
    const noteId = parseId(parsedParams.noteId)

    if (sheetId == null || noteId == null) {
      next(new AppError("Invalid parameters", 400))
      return
    }

    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const payload = noteUpdateSchema.parse(req.body) as NoteUpdatePayload
    const saved = await updateNoteForSheet(sheetId, noteId, payload, user.userId)
    res.status(200).json(saved)
  } catch (err: unknown) {
    handleError(next, err, "Failed to update note")
  }
}

export const deleteFilledSheetNoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = noteParamsSchema.parse(req.params)

    const sheetId = parseId(parsedParams.id)
    const noteId = parseId(parsedParams.noteId)

    if (sheetId == null || noteId == null) {
      next(new AppError("Invalid parameters", 400))
      return
    }

    const user = asUser(req)
    const userId = user?.userId
    if (userId == null) {
      next(new AppError("Unauthorized", 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    await deleteNoteForSheet(sheetId, noteId, userId)
    res.status(204).end()
  } catch (err: unknown) {
    handleError(next, err, "Failed to delete note")
  }
}

/* ───────────────────────────────────────────
   Export
   ─────────────────────────────────────────── */

export const exportFilledSheetPDF: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const lang = parseLang(req.query.lang)
    const uom = parseUom(req.query.uom)

    const { filePath, fileName } = await exportPDF(sheetId, lang, uom, accountId)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    res.status(200).sendFile(filePath)
  } catch (err: unknown) {
    handleError(next, err, "Failed to export PDF")
  }
}

export const exportFilledSheetExcel: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError("Invalid sheet ID", 400))
      return
    }

    const lang = parseLang(req.query.lang)
    const uom = parseUom(req.query.uom)

    const { filePath, fileName } = await exportExcel(sheetId, lang, uom, accountId)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    res.status(200).sendFile(filePath)
  } catch (err: unknown) {
    handleError(next, err, "Failed to export Excel")
  }
}

/* ───────────────────────────────────────────
   Misc utilities
   ─────────────────────────────────────────── */

export const checkEquipmentTag: RequestHandler = async (req, res, next) => {
  try {
    const parsedQuery = checkTagQuerySchema.parse(req.query)
    const tag = normalizeQueryStringParam(parsedQuery.tag)
    const projectId = normalizeQueryNumberParam(parsedQuery.projectId)

    if (tag.length === 0 || Number.isNaN(projectId) || projectId <= 0) {
      next(new AppError("tag and projectId are required", 400))
      return
    }

    const exists = await doesEquipmentTagExist(tag, projectId)
    res.status(200).json({ exists })
  } catch (err: unknown) {
    handleError(next, err, "Failed to check equipment tag")
  }
}
