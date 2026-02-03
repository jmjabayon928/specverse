// src/backend/controllers/suppliersController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import {
  listSuppliers as listSuppliersService,
  getSupplierById as getSupplierByIdService,
  createSupplier as createSupplierService,
  updateSupplier as updateSupplierService,
  deleteSupplier as deleteSupplierService,
  type ListSuppliersResult,
  type ListSuppliersParams,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from '../services/suppliersService'

// ----------------------------- Zod Schemas -----------------------------

const supplierCreateSchema = z.object({
  SuppName: z
    .string()
    .trim()
    .min(1, 'SuppName is required')
    .max(255, 'SuppName too long (max 255)'),
  SuppAddress: z.string().trim().max(4000).nullable().optional(),
  SuppCode: z.string().trim().max(50, 'SuppCode too long (max 50)').nullable().optional(),
  SuppContact: z
    .string()
    .trim()
    .max(255, 'SuppContact too long (max 255)')
    .nullable()
    .optional(),
  SuppEmail: z
    .string()
    .trim()
    .max(255, 'SuppEmail too long (max 255)')
    .nullable()
    .optional(),
  SuppPhone: z.string().trim().max(50, 'SuppPhone too long (max 50)').nullable().optional(),
  Notes: z.string().nullable().optional(),
})

const supplierUpdateSchema = supplierCreateSchema.partial()

type SupplierCreateBody = z.infer<typeof supplierCreateSchema>
type SupplierUpdateBody = z.infer<typeof supplierUpdateSchema>

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

const buildUpdatePayload = (body: SupplierUpdateBody): UpdateSupplierInput => {
  const payload: Partial<Record<keyof UpdateSupplierInput, string | null>> = {}

  const keys = Object.keys(body) as (keyof SupplierUpdateBody)[]

  for (const key of keys) {
    const castKey = key as keyof UpdateSupplierInput
    const raw = body[castKey]
    const normalized = normalizeNullable(raw)

    if (normalized !== null) {
      payload[castKey] = normalized
      continue
    }

    payload[castKey] = null
  }

  return payload as UpdateSupplierInput
}

const ensureHasUpdatableFields = (payload: UpdateSupplierInput): void => {
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

  return 'Invalid supplier payload'
}

// ----------------------------- List / Get ------------------------------

/** GET /api/backend/settings/suppliers */
export const listSuppliers: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const page = Math.max(qint(req.query.page, 1), 1)
    const pageSize = Math.min(Math.max(qint(req.query.pageSize, 20), 1), 100)
    const search = qstr(req.query.search, '').trim()

    const params: ListSuppliersParams = {
      accountId,
      page,
      pageSize,
      search,
    }

    const result: ListSuppliersResult = await listSuppliersService(params)

    res.status(200).json(result)
  } catch (error) {
    console.error('listSuppliers error:', error)
    next(new AppError('Failed to fetch suppliers', 500))
  }
}

/** GET /api/backend/settings/suppliers/:id */
export const getSupplier: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const id = Number(req.params.id)

    // Original code only checked Number.isFinite
    if (!Number.isFinite(id)) {
      throw new AppError('Invalid id', 400)
    }

    const row = await getSupplierByIdService(accountId, id)

    if (!row) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json(row)
  } catch (error) {
    console.error('getSupplier error:', error)

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(new AppError('Failed to fetch supplier', 500))
  }
}

// ----------------------------- Create ---------------------------------

/** POST /api/backend/settings/suppliers */
export const createSupplier: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const parsed = supplierCreateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      const message = firstIssueMessage(parsed)
      throw new AppError(message === 'Invalid supplier payload' ? 'SuppName is required' : message, 400)
    }

    const body: SupplierCreateBody = parsed.data

    const input: CreateSupplierInput = {
      SuppName: body.SuppName.trim(),
      SuppAddress: normalizeNullable(body.SuppAddress) ?? null,
      SuppCode: normalizeNullable(body.SuppCode) ?? null,
      SuppContact: normalizeNullable(body.SuppContact) ?? null,
      SuppEmail: normalizeNullable(body.SuppEmail) ?? null,
      SuppPhone: normalizeNullable(body.SuppPhone) ?? null,
      Notes: body.Notes ?? null,
    }

    const newId = await createSupplierService(accountId, input)

    res.status(201).json({ SuppID: newId })
  } catch (error) {
    if (error instanceof Error && error.name === 'SUPPCODE_CONFLICT') {
      next(new AppError('SuppCode already exists', 409))
      return
    }

    console.error('createSupplier error:', error)
    next(new AppError('Failed to create supplier', 500))
  }
}

// ----------------------------- Update ---------------------------------

/** PATCH /api/backend/settings/suppliers/:id */
export const updateSupplier: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const id = Number(req.params.id)

    if (!Number.isFinite(id)) {
      throw new AppError('Invalid id', 400)
    }

    const parsed = supplierUpdateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      const message = firstIssueMessage(parsed)
      throw new AppError(message, 400)
    }

    const payload = buildUpdatePayload(parsed.data)
    ensureHasUpdatableFields(payload)

    const updated = await updateSupplierService(accountId, id, payload)

    if (!updated) {
      throw new AppError('Not found', 404)
    }

    // Original shape: { ok: true }
    res.status(200).json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.name === 'SUPPCODE_CONFLICT') {
      next(new AppError('SuppCode already exists', 409))
      return
    }

    console.error('updateSupplier error:', error)
    next(new AppError('Failed to update supplier', 500))
  }
}

// ----------------------------- Delete ---------------------------------

/** DELETE /api/backend/settings/suppliers/:id */
export const deleteSupplier: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const id = Number(req.params.id)

    if (!Number.isFinite(id)) {
      throw new AppError('Invalid id', 400)
    }

    const ok = await deleteSupplierService(accountId, id)

    if (!ok) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('deleteSupplier error:', error)

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(new AppError('Failed to delete supplier', 500))
  }
}
