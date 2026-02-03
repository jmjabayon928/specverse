// src/backend/controllers/layoutController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { poolPromise } from '../config/db'
import * as svc from '@/backend/services/layoutService'
import { sheetBelongsToAccount } from '@/backend/services/filledSheetService'
import { AppError } from '../errors/AppError'
import type {
  PaperSize,
  Orientation,
  LayoutBundle,
  UomSystem,
  LangCode,
} from '@/domain/layouts/layoutTypes'

type BodySlotRow = Readonly<{
  slotIndex: number
  subsheetId: number
  columnNumber: 1 | 2
  rowNumber: number
  width: 1 | 2
}>

// ───────────────────────── Zod schemas ─────────────────────────

const listLayoutsQuerySchema = z.object({
  templateId: z.coerce.number().int().positive().optional(),
  clientId: z.coerce.number().int().positive().optional(),
})

const createLayoutBodySchema = z
  .object({
    templateId: z.coerce.number().int().positive().nullable().optional(),
    clientId: z.coerce.number().int().positive().nullable().optional(),
    paperSize: z.string().optional(), // keep loose to avoid changing behavior
    orientation: z.string().optional(), // same here
  })
  .passthrough()

const subsheetSlotsBodySchema = z
  .object({
    merged: z.boolean().optional(),
    left: z
      .array(
        z
          .object({
            index: z.coerce.number().int().nonnegative(),
            infoTemplateId: z.coerce.number().int().positive(),
          })
          .passthrough(),
      )
      .optional(),
    right: z
      .array(
        z
          .object({
            index: z.coerce.number().int().nonnegative(),
            infoTemplateId: z.coerce.number().int().positive(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough()

const bodySlotSchema = z.object({
  slotIndex: z.coerce.number().int().nonnegative(),
  subsheetId: z.coerce.number().int().positive(),
  columnNumber: z
    .coerce
    .number()
    .pipe(z.union([z.literal(1), z.literal(2)])),
  rowNumber: z.coerce.number().int().positive(),
  width: z
    .coerce
    .number()
    .pipe(z.union([z.literal(1), z.literal(2)])),
})

const saveLayoutBodySlotsBodySchema = z.object({
  slots: z.array(bodySlotSchema).default([]),
})

// ───────────────────────── small helpers ─────────────────────────

function parseStringParam(input: unknown): string | undefined {
  if (typeof input === 'string') {
    return input
  }

  if (Array.isArray(input) && input.length > 0 && typeof input[0] === 'string') {
    return input[0]
  }

  return undefined
}

function parseNumberParam(input: unknown): number | undefined {
  const asString = parseStringParam(input)
  if (asString === undefined) {
    return undefined
  }

  const numeric = Number(asString)
  if (!Number.isFinite(numeric)) {
    return undefined
  }

  return numeric
}

function parseUomParam(input: unknown): UomSystem | undefined {
  const asString = parseStringParam(input)
  if (!asString) {
    return undefined
  }

  const upper = asString.toUpperCase()
  if (upper === 'SI' || upper === 'USC') {
    return upper as UomSystem
  }

  return undefined
}

/** Accepts 'en' or 'eng'; normalizes to 'eng' to match template/filled controllers. */
function parseLangParam(input: unknown): LangCode | undefined {
  const asString = parseStringParam(input)
  if (asString === 'en' || asString === 'eng') {
    return 'eng'
  }

  // extend when you add more locales
  return undefined
}

function buildZodErrorPayload(error: z.ZodError) {
  return {
    error: 'Invalid request payload',
    details: error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
    })),
  }
}

function toBodySlotRow(raw: unknown): BodySlotRow | { error: string } {
  const result = bodySlotSchema.safeParse(raw)

  if (!result.success) {
    const first = result.error.errors[0]
    const message = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid slot payload'
    return { error: message }
  }

  const data = result.data

  return {
    slotIndex: data.slotIndex,
    subsheetId: data.subsheetId,
    columnNumber: data.columnNumber,
    rowNumber: data.rowNumber,
    width: data.width,
  }
}

// ───────────────────────── controllers ─────────────────────────

export const listLayouts: RequestHandler = async (req, res, next) => {
  const parsed = listLayoutsQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    return res.status(400).json(buildZodErrorPayload(parsed.error))
  }

  const { templateId = null, clientId = null } = parsed.data
  const accountId = req.user!.accountId!

  if (templateId !== null) {
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }
  }

  const rows = await svc.listLayouts(accountId, { templateId, clientId })
  res.json(rows)
}

export const getSubsheetInfoTemplates: RequestHandler = async (req, res, next) => {
  const subIdNumeric = Number(req.params.subId)
  const hasValidSubId = Number.isFinite(subIdNumeric) && subIdNumeric > 0

  if (!hasValidSubId) {
    return res.status(400).json({ error: 'Invalid subId' })
  }

  const sheetId = await svc.getSheetIdBySubId(subIdNumeric)
  if (sheetId == null) {
    next(new AppError('Not found', 404))
    return
  }
  const accountId = req.user!.accountId!
  const belongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!belongs) {
    next(new AppError('Sheet not found', 404))
    return
  }

  try {
    const db = await poolPromise
    const templates = await svc.listInfoTemplatesBySubId(db, subIdNumeric)
    return res.json({ templates })
  } catch (error) {
    let message = 'Unknown error'

    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    }

    console.error(`[getSubsheetInfoTemplates] subId=${subIdNumeric} failed: ${message}`, error)
    return res.status(500).json({ error: 'Failed to load info templates' })
  }
}

export const createLayout: RequestHandler = async (req, res, next) => {
  const parsed = createLayoutBodySchema.safeParse(req.body ?? {})

  if (!parsed.success) {
    return res.status(400).json(buildZodErrorPayload(parsed.error))
  }

  const body = parsed.data
  const templateId = body.templateId ?? null
  if (templateId !== null) {
    const accountId = req.user!.accountId!
    const belongs = await sheetBelongsToAccount(templateId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }
  }

  const args: {
    templateId: number | null
    clientId: number | null
    paperSize: PaperSize
    orientation: Orientation
  } = {
    templateId,
    clientId: body.clientId ?? null,
    paperSize: (body.paperSize ?? 'A4') as PaperSize,
    orientation: (body.orientation ?? 'portrait') as Orientation,
  }

  const id = await svc.createLayout(args)
  res.status(201).json({ layoutId: id })
}

export const getLayout: RequestHandler = async (req, res, next) => {
  const layoutIdNumeric = Number(req.params.layoutId)
  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutIdNumeric, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }

  const bundle: LayoutBundle | null = await svc.getLayoutBundle(layoutIdNumeric)
  if (!bundle) {
    return res.status(404).json({ error: 'Layout not found' })
  }

  res.json(bundle)
}

export const getLayoutStructure: RequestHandler = async (req, res, next) => {
  const layoutIdNumeric = Number(req.params.layoutId)
  const hasValidId = Number.isFinite(layoutIdNumeric) && layoutIdNumeric > 0

  if (!hasValidId) {
    return res.status(400).json({ error: 'Invalid layoutId' })
  }

  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutIdNumeric, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }

  try {
    const data = await svc.getLayoutTemplateStructure(layoutIdNumeric)
    return res.json(data)
  } catch (error) {
    console.error('Failed to load layout template structure:', error)
    return res.status(500).json({ error: 'Failed to load layout template structure' })
  }
}

export const updateLayoutMeta: RequestHandler = async (req, res, next) => {
  const layoutIdNumeric = Number(req.params.layoutId)
  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutIdNumeric, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }
  await svc.updateLayoutMeta(layoutIdNumeric, req.body)
  res.json({ ok: true })
}

export const addRegion: RequestHandler = async (req, res, next) => {
  const layoutIdNumeric = Number(req.params.layoutId)
  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutIdNumeric, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }
  const regionId = await svc.addRegion(layoutIdNumeric, req.body)
  res.status(201).json({ regionId })
}

export const updateRegion: RequestHandler = async (req, res, next) => {
  const regionIdNumeric = Number(req.params.regionId)
  const layoutId = await svc.getLayoutIdByRegionId(regionIdNumeric)
  if (layoutId == null) {
    next(new AppError('Not found', 404))
    return
  }
  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutId, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }
  await svc.updateRegion(regionIdNumeric, req.body)
  res.json({ ok: true })
}

export const addBlock: RequestHandler = async (req, res, next) => {
  const regionIdNumeric = Number(req.params.regionId)
  const layoutId = await svc.getLayoutIdByRegionId(regionIdNumeric)
  if (layoutId == null) {
    next(new AppError('Not found', 404))
    return
  }
  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutId, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }
  const blockId = await svc.addBlock(regionIdNumeric, req.body)
  res.status(201).json({ blockId })
}

export const updateBlock: RequestHandler = async (req, res, next) => {
  const blockIdNumeric = Number(req.params.blockId)
  const layoutId = await svc.getLayoutIdByBlockId(blockIdNumeric)
  if (layoutId == null) {
    next(new AppError('Not found', 404))
    return
  }
  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutId, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }
  await svc.updateBlock(blockIdNumeric, req.body)
  res.json({ ok: true })
}

export const saveSubsheetSlots: RequestHandler = async (req, res, next) => {
  const layoutIdNumeric = Number(req.params.layoutId)
  const subIdNumeric = Number(req.params.subId)

  const hasValidLayoutId = Number.isFinite(layoutIdNumeric)
  const hasValidSubId = Number.isFinite(subIdNumeric)

  if (!hasValidLayoutId || !hasValidSubId) {
    return res.status(400).json({ error: 'Invalid layoutId or subId' })
  }

  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutIdNumeric, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }

  const parsed = subsheetSlotsBodySchema.safeParse(req.body ?? {})

  if (!parsed.success) {
    return res.status(400).json(buildZodErrorPayload(parsed.error))
  }

  const payload = parsed.data

  try {
    const db = await poolPromise
    await svc.saveSubsheetSlots(db, layoutIdNumeric, subIdNumeric, payload)
    return res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}

export const saveLayoutBodySlots: RequestHandler = async (req, res, next) => {
  const layoutIdNumeric = Number(req.params.layoutId)
  const hasValidId = Number.isFinite(layoutIdNumeric) && layoutIdNumeric > 0

  if (!hasValidId) {
    return res.status(400).json({ error: 'Invalid layoutId' })
  }

  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutIdNumeric, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }

  const parsed = saveLayoutBodySlotsBodySchema.safeParse(req.body ?? {})

  if (!parsed.success) {
    return res.status(400).json(buildZodErrorPayload(parsed.error))
  }

  const { slots } = parsed.data

  const normalized: BodySlotRow[] = []
  for (const raw of slots) {
    const result = toBodySlotRow(raw)
    if ('error' in result) {
      return res.status(400).json({ error: result.error })
    }
    normalized.push(result)
  }

  const seen = new Set<number>()
  for (const slot of normalized) {
    const alreadySeen = seen.has(slot.slotIndex)
    if (alreadySeen) {
      return res.status(400).json({ error: `Duplicate slotIndex ${slot.slotIndex}` })
    }
    seen.add(slot.slotIndex)
  }

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        '[saveLayoutBodySlots] layoutId:',
        layoutIdNumeric,
        'rows:',
        normalized.length,
      )
    }

    await svc.saveLayoutBodySlots(layoutIdNumeric, normalized)
    return res.json({ ok: true, count: normalized.length })
  } catch (error) {
    const err = error as {
      message?: string
      stack?: string
      originalError?: { info?: unknown }
    }

    console.error('saveLayoutBodySlots failed:', {
      message: err?.message,
      info: err?.originalError?.info,
      stack: err?.stack,
      layoutId: layoutIdNumeric,
      rows: normalized,
    })

    return res.status(500).json({ error: 'Failed to save layout body slots' })
  }
}

export const getLayoutBodySlots: RequestHandler = async (req, res, next) => {
  const layoutIdNumeric = Number(req.params.layoutId)
  const hasValidId = Number.isFinite(layoutIdNumeric) && layoutIdNumeric > 0

  if (!hasValidId) {
    return res.status(400).json({ error: 'Invalid layoutId' })
  }

  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutIdNumeric, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }

  try {
    const rows = await svc.listLayoutBodySlots(layoutIdNumeric)
    return res.json({ slots: rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}

export const renderLayout: RequestHandler = async (req, res, next) => {
  const layoutIdMaybe = parseNumberParam(req.params?.layoutId)
  if (layoutIdMaybe === undefined) {
    return res
      .status(400)
      .json({ error: 'layoutId (param) is required and must be a number' })
  }
  const layoutId = layoutIdMaybe

  const sheetIdMaybe = parseNumberParam(req.query?.sheetId)
  if (sheetIdMaybe === undefined) {
    return res
      .status(400)
      .json({ error: 'sheetId (query) is required and must be a number' })
  }
  const sheetId = sheetIdMaybe

  const accountId = req.user!.accountId!
  const sheetBelongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!sheetBelongs) {
    next(new AppError('Sheet not found', 404))
    return
  }
  const layoutBelongs = await svc.layoutBelongsToAccount(layoutId, accountId)
  if (!layoutBelongs) {
    next(new AppError('Layout not found', 404))
    return
  }

  const uom: UomSystem = parseUomParam(req.query?.uom) ?? 'SI'
  const lang: LangCode = parseLangParam(req.query?.lang) ?? 'eng'

  if (uom !== 'SI' && uom !== 'USC') {
    return res.status(400).json({ error: 'uom must be SI or USC' })
  }

  try {
    const payload = await svc.renderLayout({ layoutId, sheetId, uom, lang })
    return res.json(payload)
  } catch (error) {
    console.error('renderLayout failed:', error)

    const isDev = process.env.NODE_ENV !== 'production'
    const base = { error: 'Failed to render layout' }

    if (isDev && error instanceof Error) {
      return res.status(500).json({ ...base, message: error.message })
    }

    return res.status(500).json(base)
  }
}

export const getStructure: RequestHandler = async (req, res) => {
  const layoutIdNumeric = Number(req.params.layoutId)
  const hasValidId = Number.isFinite(layoutIdNumeric) && layoutIdNumeric > 0

  if (!hasValidId) {
    res.status(400).json({ error: 'Invalid layoutId' })
    return
  }

  try {
    const data = await svc.getLayoutStructureData(layoutIdNumeric)
    res.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load structure'
    res.status(500).json({ error: message })
  }
}

export const getSubsheetSlots: RequestHandler = async (req, res, next) => {
  const layoutIdNumeric = Number(req.params.layoutId)
  const subIdNumeric = Number(req.params.subId)

  const hasValidLayoutId = Number.isFinite(layoutIdNumeric)
  const hasValidSubId = Number.isFinite(subIdNumeric)

  if (!hasValidLayoutId || !hasValidSubId) {
    res.status(400).json({ error: 'Invalid layoutId or subId' })
    return
  }

  const accountId = req.user!.accountId!
  const belongs = await svc.layoutBelongsToAccount(layoutIdNumeric, accountId)
  if (!belongs) {
    next(new AppError('Layout not found', 404))
    return
  }

  try {
    const config = await svc.getSubsheetSlots(layoutIdNumeric, subIdNumeric)
    res.json(config)
  } catch (error) {
    console.error('Failed to load subsheet slots:', error)
    res.status(500).json({ error: 'Failed to load subsheet slots' })
  }
}
