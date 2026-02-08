// src/backend/controllers/schedulesController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { mustGetAccountId } from '@/backend/utils/authGuards'
import * as schedulesService from '../services/schedulesService'

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

const COLUMN_KEY_MAX_LENGTH = 64

function normalizeColumnKey(input: string): string {
  const trimmed = input.trim()
  const lower = trimmed.toLowerCase()
  const withUnderscores = lower.replace(/[^a-z0-9]+/g, '_')
  const collapsed = withUnderscores.replace(/_+/g, '_')
  const trimmedEdges = collapsed.replace(/^_+|_+$/g, '')
  return trimmedEdges
}

const columnKeySchema = z
  .string()
  .trim()
  .transform(normalizeColumnKey)
  .refine(
    s => s.length >= 1 && s.length <= COLUMN_KEY_MAX_LENGTH,
    { message: 'columnKey must contain letters/numbers and normalize to 1-64 chars' }
  )

const listQuerySchema = z.object({
  clientId: z.string().optional().transform(s => (s ? Number(s) : undefined)),
  projectId: z.string().optional().transform(s => (s ? Number(s) : undefined)),
  disciplineId: z.string().optional().transform(s => (s ? Number(s) : undefined)),
  subtypeId: z.string().optional().transform(s => (s ? Number(s) : undefined)),
})

const createBodySchema = z.object({
  name: z.string().trim().min(1, 'name required'),
  scope: z.union([z.string(), z.null()]).optional(),
  disciplineId: z.number().int().positive(),
  subtypeId: z.number().int().positive(),
  clientId: z.number().int().positive().nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
})

const patchBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  scope: z.union([z.string(), z.null()]).optional(),
})

const enumOptionsJsonSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform(v => (v === undefined ? null : v))
  .refine(
    v => {
      if (v == null || v === '') return true
      try {
        JSON.parse(v)
        return true
      } catch {
        return false
      }
    },
    { message: 'enumOptionsJson must be valid JSON' }
  )

const columnItemSchema = z.object({
  scheduleColumnId: z.number().int().positive().optional(),
  columnKey: columnKeySchema,
  columnLabel: z.string().trim().min(1).max(255),
  dataType: z.string().trim().max(50),
  enumOptionsJson: enumOptionsJsonSchema,
  displayOrder: z.number().int().min(0),
  isRequired: z.boolean(),
  isEditable: z.boolean(),
})

const putColumnsBodySchema = z.object({
  columns: z.array(columnItemSchema),
})

const valueItemSchema = z.object({
  columnKey: columnKeySchema,
  valueString: z.string().nullable().optional(),
  valueNumber: z.number().nullable().optional(),
  valueBool: z.boolean().nullable().optional(),
  valueDate: z.string().nullable().optional(),
  valueJson: z.string().nullable().optional(),
}).refine(
  data => {
    const count = [
      data.valueString != null && data.valueString !== '',
      data.valueNumber != null,
      data.valueBool != null,
      data.valueDate != null && data.valueDate !== '',
      data.valueJson != null && data.valueJson !== '',
    ].filter(Boolean).length
    return count <= 1
  },
  { message: 'Only one typed value per cell' }
)

const entryItemSchema = z.object({
  scheduleEntryId: z.number().int().positive().optional(),
  assetId: z.number().int().positive(),
  sheetId: z.number().int().positive().nullable().optional(),
  rowDataJson: z.string().nullable().optional(),
  values: z.array(valueItemSchema),
})

const putEntriesBodySchema = z.object({
  entries: z.array(entryItemSchema),
})

export const listSchedules: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('Invalid query parameters', 400)
    }
    const filters = {
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      disciplineId: parsed.data.disciplineId,
      subtypeId: parsed.data.subtypeId,
    }
    const list = await schedulesService.list(accountId, filters)
    res.status(200).json(list)
  } catch (error) {
    next(error)
  }
}

export const createSchedule: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsed = createBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid request body', 400)
    }
    const userId = (req.user as { userId?: number })?.userId
    if (userId == null || !Number.isFinite(userId)) {
      throw new AppError('Unauthorized', 401)
    }
    const schedule = await schedulesService.createSchedule(accountId, parsed.data, userId)
    res.status(201).json(schedule)
  } catch (error) {
    next(error)
  }
}

export const getScheduleById: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const scheduleId = parseId(req.params.scheduleId)
    if (scheduleId == null) {
      throw new AppError('Invalid schedule id', 400)
    }

    const detail = await schedulesService.getDetail(accountId, scheduleId)
    if (!detail) {
      throw new AppError('Schedule not found', 404)
    }
    res.status(200).json(detail)
  } catch (error) {
    next(error)
  }
}

export const patchSchedule: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const scheduleId = parseId(req.params.scheduleId)
    if (scheduleId == null) {
      throw new AppError('Invalid schedule id', 400)
    }

    const parsed = patchBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid request body', 400)
    }
    const userId = (req.user as { userId?: number })?.userId
    if (userId == null || !Number.isFinite(userId)) {
      throw new AppError('Unauthorized', 401)
    }
    await schedulesService.patchSchedule(accountId, scheduleId, parsed.data, userId)
    res.status(200).json({ ok: true })
  } catch (error) {
    next(error)
  }
}

export const putScheduleColumns: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const scheduleId = parseId(req.params.scheduleId)
    if (scheduleId == null) {
      throw new AppError('Invalid schedule id', 400)
    }

    const parsed = putColumnsBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid request body', 400)
    }
    const keys = parsed.data.columns.map(c => c.columnKey)
    if (new Set(keys).size !== keys.length) {
      throw new AppError('Duplicate columnKey in columns.', 400)
    }
    const userId = (req.user as { userId?: number })?.userId
    if (userId == null || !Number.isFinite(userId)) {
      throw new AppError('Unauthorized', 401)
    }
    const columns = parsed.data.columns.map(c => ({
      scheduleColumnId: c.scheduleColumnId,
      columnKey: c.columnKey,
      columnLabel: c.columnLabel,
      dataType: c.dataType,
      enumOptionsJson: c.enumOptionsJson ?? null,
      displayOrder: c.displayOrder,
      isRequired: c.isRequired,
      isEditable: c.isEditable,
    }))
    const result = await schedulesService.replaceColumns(accountId, scheduleId, columns, userId)
    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

export const putScheduleEntries: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const scheduleId = parseId(req.params.scheduleId)
    if (scheduleId == null) {
      throw new AppError('Invalid schedule id', 400)
    }

    const parsed = putEntriesBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid request body', 400)
    }
    const userId = (req.user as { userId?: number })?.userId
    if (userId == null || !Number.isFinite(userId)) {
      throw new AppError('Unauthorized', 401)
    }
    const entries = parsed.data.entries.map(e => ({
      scheduleEntryId: e.scheduleEntryId,
      assetId: e.assetId,
      sheetId: e.sheetId ?? null,
      rowDataJson: e.rowDataJson ?? null,
      values: e.values.map(v => ({
        columnKey: v.columnKey,
        valueString: v.valueString ?? null,
        valueNumber: v.valueNumber ?? null,
        valueBool: v.valueBool ?? null,
        valueDate: v.valueDate ?? null,
        valueJson: v.valueJson ?? null,
      })),
    }))
    await schedulesService.replaceEntries(accountId, scheduleId, entries, userId)
    res.status(200).json({ ok: true })
  } catch (error) {
    next(error)
  }
}
