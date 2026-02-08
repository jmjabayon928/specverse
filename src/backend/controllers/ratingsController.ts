// src/backend/controllers/ratingsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { listForSheet, getById, create, update, remove, lock, unlock } from '../services/ratingsService'
import { mustGetAccountId } from '@/backend/utils/authGuards'

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

const entrySchema = z.object({
  key: z.string().trim().min(1, 'key required').max(100, 'key too long'),
  value: z.preprocess(
    v => (v === undefined ? null : v),
    z.union([z.null(), z.string().transform(s => s.trim()).pipe(z.string().max(1000))])
  ),
  uom: z.optional(
    z.union([z.null(), z.string().transform(s => (s ?? '').trim()).pipe(z.string().max(50))])
  ),
  orderIndex: z.number().int().min(0).nullable().optional(),
})

const MAX_ENTRIES = 200

const createBodySchema = z
  .object({
    sheetId: z.number().int().positive(),
    blockType: z.string().trim().min(1, 'blockType required').max(50, 'blockType too long'),
    notes: z
      .union([z.undefined(), z.null(), z.string().transform(s => (s ?? '').trim())])
      .optional()
      .transform(v => (v === '' ? null : v))
      .refine(v => v === undefined || v === null || v.length <= 2000, 'notes too long'),
    sourceValueSetId: z.number().int().positive().nullable().optional(),
    entries: z.array(entrySchema).default([]),
  })
  .refine(data => data.entries.length <= MAX_ENTRIES, 'too many entries')

const updateBodySchema = z
  .object({
    blockType: z.string().trim().min(1, 'blockType required').max(50, 'blockType too long').optional(),
    notes: z
      .union([z.undefined(), z.null(), z.string().transform(s => (s ?? '').trim())])
      .optional()
      .transform(v => (v === '' ? null : v))
      .refine(v => v === undefined || v === null || v.length <= 2000, 'notes too long'),
    sourceValueSetId: z.number().int().positive().nullable().optional(),
    entries: z.array(entrySchema).optional(),
  })
  .refine(data => !data.entries || data.entries.length <= MAX_ENTRIES, 'too many entries')

export const listRatingsBlocksForSheet: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const sheetId = parseId(req.params.sheetId)
    if (!sheetId) {
      throw new AppError('Invalid sheet id', 400)
    }

    const blocks = await listForSheet(accountId, sheetId)
    res.status(200).json(blocks)
  } catch (error) {
    next(error)
  }
}

export const getRatingsBlockById: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid ratings block id', 400)
    }

    const result = await getById(accountId, id)
    if (!result) {
      throw new AppError('Ratings block not found', 404)
    }

    res.status(200).json({ block: result.block, entries: result.entries })
  } catch (error) {
    next(error)
  }
}

export const createRatingsBlock: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const parsed = createBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid ratings payload', 400)
    }

    const userId = (req.user as { userId?: number })?.userId
    const block = await create(accountId, parsed.data, { userId })
    res.status(201).json(block)
  } catch (error) {
    next(error)
  }
}

export const updateRatingsBlock: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid ratings block id', 400)
    }

    const parsed = updateBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid ratings payload', 400)
    }

    const userId = (req.user as { userId?: number })?.userId
    const result = await update(accountId, id, parsed.data, { userId })
    res.status(200).json({ block: result.block, entries: result.entries })
  } catch (error) {
    next(error)
  }
}

export const deleteRatingsBlock: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid ratings block id', 400)
    }

    const userId = (req.user as { userId?: number })?.userId
    await remove(accountId, id, { userId })
    res.status(200).json({ deleted: true })
  } catch (error) {
    next(error)
  }
}

export const lockRatingsBlock: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid ratings block id', 400)
    }

    const userId = (req.user as { userId?: number })?.userId
    if (typeof userId !== 'number' || !Number.isFinite(userId)) {
      throw new AppError('Unauthorized', 401)
    }

    const result = await lock(accountId, id, userId, { userId })
    res.status(200).json({ block: result.block, entries: result.entries })
  } catch (error) {
    next(error)
  }
}

export const unlockRatingsBlock: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid ratings block id', 400)
    }

    const user = req.user as { roleId?: number; role?: string; isSuperadmin?: boolean } | undefined
    const isAdmin =
      user?.roleId === 1 ||
      (typeof user?.role === 'string' && user.role.trim().toLowerCase() === 'admin') ||
      user?.isSuperadmin === true
    if (!isAdmin) {
      throw new AppError('Only account admin or superadmin can unlock ratings blocks', 403)
    }

    const userId = (req.user as { userId?: number })?.userId
    const result = await unlock(accountId, id, { userId })
    res.status(200).json({ block: result.block, entries: result.entries })
  } catch (error) {
    next(error)
  }
}
