// src/backend/controllers/instrumentsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import {
  listInstruments,
  getInstrument,
  createInstrument,
  updateInstrument,
  listInstrumentsLinkedToSheet,
  linkInstrumentToSheet,
  unlinkInstrumentFromSheet,
} from '../services/instrumentsService'
import { mustGetAccountId } from '@/backend/utils/authGuards'

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null
  return parsed
}

const createBodySchema = z.object({
  instrumentTag: z.string().trim().min(1, 'Instrument tag is required').max(255),
  instrumentType: z.string().max(100).nullable().optional(),
  service: z.string().max(255).nullable().optional(),
  system: z.string().max(255).nullable().optional(),
  area: z.string().max(255).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  status: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

const updateBodySchema = z.object({
  instrumentTag: z.string().trim().max(255).optional(),
  instrumentType: z.string().max(100).nullable().optional(),
  service: z.string().max(255).nullable().optional(),
  system: z.string().max(255).nullable().optional(),
  area: z.string().max(255).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  status: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

const linkBodySchema = z.object({
  linkRole: z.string().max(100).nullable().optional(),
})

export const listLinkedToSheet: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const sheetId = parseId(req.params.sheetId)
    if (!sheetId) throw new AppError('Invalid sheet id', 400)
    const list = await listInstrumentsLinkedToSheet(accountId, sheetId)
    res.status(200).json(list)
  } catch (error) {
    next(error)
  }
}

export const linkToSheet: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const sheetId = parseId(req.params.sheetId)
    const instrumentId = parseId(req.params.instrumentId)
    if (!sheetId) throw new AppError('Invalid sheet id', 400)
    if (!instrumentId) throw new AppError('Invalid instrument id', 400)
    const parsed = linkBodySchema.safeParse(req.body ?? {})
    const linkRole = parsed.success && parsed.data.linkRole !== undefined ? parsed.data.linkRole : null
    const userId = (req.user as { userId?: number })?.userId ?? null
    await linkInstrumentToSheet(accountId, sheetId, instrumentId, linkRole, userId)
    res.status(201).json({ linked: true })
  } catch (error) {
    next(error)
  }
}

export const unlinkFromSheet: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const sheetId = parseId(req.params.sheetId)
    const instrumentId = parseId(req.params.instrumentId)
    if (!sheetId) throw new AppError('Invalid sheet id', 400)
    if (!instrumentId) throw new AppError('Invalid instrument id', 400)
    const linkRole = (req.query.linkRole as string) ?? (req.body as { linkRole?: string } | undefined)?.linkRole
    await unlinkInstrumentFromSheet(accountId, sheetId, instrumentId, linkRole)
    res.status(200).json({ unlinked: true })
  } catch (error) {
    next(error)
  }
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const q = typeof req.query.q === 'string' ? req.query.q : undefined
    const list = await listInstruments(accountId, q)
    res.status(200).json(list)
  } catch (error) {
    next(error)
  }
}

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const instrumentId = parseId(req.params.instrumentId)
    if (!instrumentId) throw new AppError('Invalid instrument id', 400)
    const instrument = await getInstrument(accountId, instrumentId)
    if (!instrument) throw new AppError('Instrument not found', 404)
    res.status(200).json(instrument)
  } catch (error) {
    next(error)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const parsed = createBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) throw new AppError('Invalid payload', 400)
    const userId = (req.user as { userId?: number })?.userId ?? null
    const instrument = await createInstrument(accountId, { ...parsed.data, createdBy: userId })
    res.status(201).json(instrument)
  } catch (error) {
    next(error)
  }
}

export const updateOne: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const instrumentId = parseId(req.params.instrumentId)
    if (!instrumentId) throw new AppError('Invalid instrument id', 400)
    const parsed = updateBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) throw new AppError('Invalid payload', 400)
    const userId = (req.user as { userId?: number })?.userId ?? null
    const instrument = await updateInstrument(accountId, instrumentId, { ...parsed.data, updatedBy: userId })
    res.status(200).json(instrument)
  } catch (error) {
    next(error)
  }
}
