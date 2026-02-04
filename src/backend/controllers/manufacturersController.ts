// src/backend/controllers/manufacturersController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import {
  listManufacturers as listManufacturersService,
  getManufacturerById as getManufacturerByIdService,
  createManufacturer as createManufacturerService,
  updateManufacturer as updateManufacturerService,
  deleteManufacturer as deleteManufacturerService,
  type ListManufacturersResult,
  type ListManufacturersParams,
  type CreateManufacturerInput,
  type UpdateManufacturerInput,
} from '../services/manufacturersService'

// ----------------------------- Zod Schemas -----------------------------

const manufacturerCreateSchema = z.object({
  ManuName: z
    .string()
    .trim()
    .min(1, 'ManuName and ManuAddress are required')
    .max(150, 'ManuName too long (max 150)'),
  ManuAddress: z
    .string()
    .trim()
    .min(1, 'ManuName and ManuAddress are required')
    .max(255, 'ManuAddress too long (max 255)'),
})

const manufacturerUpdateSchema = manufacturerCreateSchema.partial()

type ManufacturerCreateBody = z.infer<typeof manufacturerCreateSchema>
type ManufacturerUpdateBody = z.infer<typeof manufacturerUpdateSchema>

// --------------------------- Helper functions --------------------------

const qstr = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }

  return fallback
}

const qint = (value: unknown, fallback: number): number => {
  const asString = qstr(value, String(fallback))
  const parsed = Number.parseInt(asString, 10)

  if (Number.isFinite(parsed)) {
    return parsed
  }

  return fallback
}

const normalizeNullable = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  return trimmed
}

const buildUpdatePayload = (body: ManufacturerUpdateBody): UpdateManufacturerInput => {
  const payload: UpdateManufacturerInput = {}

  const keys = Object.keys(body) as (keyof ManufacturerUpdateBody)[]

  for (const key of keys) {
    const castKey = key as keyof UpdateManufacturerInput
    const raw = body[castKey]
    const normalized = normalizeNullable(raw)

    if (normalized !== null) {
      payload[castKey] = normalized
      continue
    }

    payload[castKey] = null
  }

  return payload
}

const ensureHasUpdatableFields = (payload: UpdateManufacturerInput): void => {
  if (Object.keys(payload).length > 0) {
    return
  }

  throw new AppError('No updatable fields provided', 400)
}

const firstIssueMessage = (result: z.SafeParseError<unknown>): string => {
  const firstIssue = result.error.issues[0]

  if (firstIssue && firstIssue.message) {
    return firstIssue.message
  }

  return 'Invalid manufacturer payload'
}

// ----------------------------- List / Get ------------------------------

/** GET /api/backend/settings/manufacturers */
export const listManufacturers: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const page = Math.max(qint(req.query.page, 1), 1)
    const pageSize = Math.min(Math.max(qint(req.query.pageSize, 20), 1), 100)
    const search = qstr(req.query.search, '').trim()

    const params: ListManufacturersParams = {
      accountId,
      page,
      pageSize,
      search,
    }

    const result: ListManufacturersResult = await listManufacturersService(params)

    res.status(200).json(result)
  } catch (error) {
    // Previous code logged and sent a 500 here
    // We keep the logging but pass a controlled error to the global handler
    // so the behavior from the client's point of view stays the same.
    console.error('listManufacturers error:', error)
    next(new AppError('Failed to fetch manufacturers', 500))
  }
}

/** GET /api/backend/settings/manufacturers/:id */
export const getManufacturer: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const id = Number(req.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid id', 400)
    }

    const row = await getManufacturerByIdService(accountId, id)

    if (!row) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json(row)
  } catch (error) {
    console.error('getManufacturer error:', error)

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(new AppError('Failed to fetch manufacturer', 500))
  }
}

/** POST /api/backend/settings/manufacturers */
export const createManufacturer: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const parsed = manufacturerCreateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      const message = firstIssueMessage(parsed)
      throw new AppError(message, 400)
    }

    const body: ManufacturerCreateBody = parsed.data

    const input: CreateManufacturerInput = {
      ManuName: body.ManuName.trim(),
      ManuAddress: body.ManuAddress.trim(),
    }

    const newId = await createManufacturerService(accountId, input)

    res.status(201).json({ ManuID: newId })
  } catch (error) {
    if (error instanceof Error && error.name === 'MANUNAME_CONFLICT') {
      next(new AppError('ManuName already exists', 409))
      return
    }

    console.error('createManufacturer error:', error)
    next(new AppError('Failed to create manufacturer', 500))
  }
}

/** PATCH /api/backend/settings/manufacturers/:id */
export const updateManufacturer: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const id = Number(req.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid id', 400)
    }

    const parsed = manufacturerUpdateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      const message = firstIssueMessage(parsed)
      throw new AppError(message, 400)
    }

    const payload = buildUpdatePayload(parsed.data)
    ensureHasUpdatableFields(payload)

    const updated = await updateManufacturerService(accountId, id, payload)

    if (!updated) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.name === 'MANUNAME_CONFLICT') {
      next(new AppError('ManuName already exists', 409))
      return
    }

    console.error('updateManufacturer error:', error)
    next(new AppError('Failed to update manufacturer', 500))
  }
}

/** DELETE /api/backend/settings/manufacturers/:id */
export const deleteManufacturer: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const id = Number(req.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid id', 400)
    }

    const ok = await deleteManufacturerService(accountId, id)

    if (!ok) {
      throw new AppError('Not found', 404)
    }

    // Keep original shape: { ok: true }
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('deleteManufacturer error:', error)

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(new AppError('Failed to delete manufacturer', 500))
  }
}
