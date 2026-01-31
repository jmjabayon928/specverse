// src/backend/controllers/valueSetController.ts
import type { Request, RequestHandler } from 'express'
import type { UserSession } from '../../domain/auth/sessionTypes'
import {
  getValueSetIdSafe,
  createValueSet,
  createOfferedValueSet,
  createAsBuiltValueSet,
  listValueSets,
  patchVariance,
  transitionValueSetStatus,
  getCompareData,
  type ValueContextCode,
  type VarianceStatus,
  type StatusTransition,
} from '../services/valueSetService'
import { AppError } from '../errors/AppError'

const CONTEXT_CODES: ValueContextCode[] = ['Requirement', 'Offered', 'AsBuilt']
const VARIANCE_STATUSES: VarianceStatus[] = ['DeviatesAccepted', 'DeviatesRejected']
const STATUS_TRANSITIONS: StatusTransition[] = ['Locked', 'Verified']

function parseSheetId(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseValueSetId(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseContext(raw: unknown): ValueContextCode | null {
  const s = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? String(raw[0] ?? '').trim() : ''
  if (CONTEXT_CODES.includes(s as ValueContextCode)) return s as ValueContextCode
  return null
}

function parsePartyId(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'string' && raw.trim() === '') return undefined
  const n = Number(typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) ? n : undefined
}

function parseInfoTemplateId(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null
  const n = Number(typeof raw === 'string' ? raw : raw)
  return Number.isFinite(n) ? n : null
}

export const getSheetValueSets: RequestHandler = async (req, res, next) => {
  try {
    const sheetId = parseSheetId(req.params.sheetId)
    if (sheetId == null) {
      next(new AppError('Invalid sheetId', 400))
      return
    }

    const context = parseContext(req.query.context)
    const partyId = parsePartyId(req.query.partyId)

    if (context != null) {
      const valueSetId = await getValueSetIdSafe(sheetId, context, partyId ?? undefined)
      res.json({ valueSetId, context, partyId: partyId ?? null })
      return
    }

    const items = await listValueSets(sheetId)
    res.json({ items })
  } catch (err) {
    next(err)
  }
}

export const postSheetValueSet: RequestHandler = async (req, res, next) => {
  try {
    const sheetId = parseSheetId(req.params.sheetId)
    if (sheetId == null) {
      next(new AppError('Invalid sheetId', 400))
      return
    }

    const body = req.body as { context?: unknown; partyId?: unknown }
    const context = parseContext(body?.context)
    if (context == null) {
      next(new AppError('Missing or invalid context (Requirement, Offered, AsBuilt)', 400))
      return
    }

    const partyId = parsePartyId(body?.partyId)
    const user = (req as Request & { user?: UserSession }).user
    const userId = user?.userId

    if (context === 'Offered' && partyId != null) {
      const valueSetId = await createOfferedValueSet(sheetId, partyId, userId)
      res.status(201).json({ valueSetId, context, partyId })
      return
    }

    if (context === 'AsBuilt') {
      const valueSetId = await createAsBuiltValueSet(sheetId, userId)
      res.status(201).json({ valueSetId, context, partyId: null })
      return
    }

    const valueSetId = await createValueSet(sheetId, context, partyId ?? undefined, userId)
    res.status(201).json({ valueSetId, context, partyId: partyId ?? null })
  } catch (err) {
    next(err)
  }
}

export const patchSheetValueSetVariances: RequestHandler = async (req, res, next) => {
  try {
    const sheetId = parseSheetId(req.params.sheetId)
    const valueSetId = parseValueSetId(req.params.valueSetId)
    if (sheetId == null || valueSetId == null) {
      next(new AppError('Invalid sheetId or valueSetId', 400))
      return
    }

    const body = req.body as { infoTemplateId?: unknown; status?: unknown }
    const infoTemplateId = parseInfoTemplateId(body?.infoTemplateId)
    if (infoTemplateId == null) {
      next(new AppError('Missing or invalid infoTemplateId', 400))
      return
    }

    const rawStatus = body?.status
    const status: VarianceStatus | null =
      rawStatus === null || rawStatus === undefined
        ? null
        : VARIANCE_STATUSES.includes(rawStatus as VarianceStatus)
          ? (rawStatus as VarianceStatus)
          : null
    if (rawStatus !== null && rawStatus !== undefined && status === null) {
      next(new AppError('Invalid status (DeviatesAccepted, DeviatesRejected, or null)', 400))
      return
    }

    const user = (req as Request & { user?: UserSession }).user
    await patchVariance(sheetId, valueSetId, infoTemplateId, status, user?.userId ?? null)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const postSheetValueSetStatus: RequestHandler = async (req, res, next) => {
  try {
    const sheetId = parseSheetId(req.params.sheetId)
    const valueSetId = parseValueSetId(req.params.valueSetId)
    if (sheetId == null || valueSetId == null) {
      next(new AppError('Invalid sheetId or valueSetId', 400))
      return
    }

    const body = req.body as { status?: unknown }
    const status = typeof body?.status === 'string' && STATUS_TRANSITIONS.includes(body.status as StatusTransition)
      ? (body.status as StatusTransition)
      : null
    if (status == null) {
      next(new AppError('Missing or invalid status (Locked, Verified)', 400))
      return
    }

    await transitionValueSetStatus(sheetId, valueSetId, status)
    res.status(200).json({ valueSetId, status })
  } catch (err) {
    next(err)
  }
}

export const getSheetCompare: RequestHandler = async (req, res, next) => {
  try {
    const sheetId = parseSheetId(req.params.sheetId)
    if (sheetId == null) {
      next(new AppError('Invalid sheetId', 400))
      return
    }

    const offeredPartyId = parsePartyId(req.query.offeredPartyId)
    const data = await getCompareData(sheetId, offeredPartyId ?? undefined)
    res.json(data)
  } catch (err) {
    next(err)
  }
}
