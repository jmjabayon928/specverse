// src/backend/controllers/permissionsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import {
  listPermissions as svcList,
  getPermissionById as svcGet,
  createPermission as svcCreate,
  updatePermission as svcUpdate,
  deletePermission as svcDelete,
  type ListPermissionsResult,
} from '../services/permissionsService'

const parsePositiveInt = (value: unknown, fallback: number, max?: number): number => {
  if (typeof value !== 'string') {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  if (typeof max === 'number' && parsed > max) {
    return max
  }

  return parsed
}

const parseSearch = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

// Zod schemas (kept broad so we do not change runtime behavior)
// They give us typed bodies but we still keep the same manual checks.
const createPermissionSchema = z.object({
  PermissionKey: z.string().optional().nullable(),
  Description: z.string().optional().nullable(),
})

const updatePermissionSchema = z.object({
  PermissionKey: z.string().optional().nullable(),
  Description: z.string().optional().nullable(),
})

/** GET /api/backend/settings/permissions */
export const listPermissions: RequestHandler = async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 1)
    const pageSize = parsePositiveInt(req.query.pageSize, 20, 100)
    const search = parseSearch(req.query.search)

    const result: ListPermissionsResult = await svcList({ page, pageSize, search })
    res.json(result)
  } catch (err) {
    console.error('listPermissions error:', err)
    next(new AppError('Failed to fetch permissions', 500))
  }
}

/** GET /api/backend/settings/permissions/:id */
export const getPermission: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      next(new AppError('Invalid id', 400))
      return
    }

    const row = await svcGet(id)
    if (!row) {
      next(new AppError('Not found', 404))
      return
    }

    res.json(row)
  } catch (err) {
    console.error('getPermission error:', err)
    next(new AppError('Failed to fetch permission', 500))
  }
}

/** POST /api/backend/settings/permissions */
export const createPermission: RequestHandler = async (req, res, next) => {
  try {
    const parsed = createPermissionSchema.safeParse(req.body ?? {})
    const body = parsed.success
      ? parsed.data
      : ((req.body ?? {}) as { PermissionKey?: string | null; Description?: string | null })

    const rawKey = body.PermissionKey
    if (!(rawKey?.trim())) {
      next(new AppError('PermissionKey is required', 400))
      return
    }

    const newId = await svcCreate({
      PermissionKey: rawKey.trim(),
      Description: (body.Description ?? '').trim() || null,
    })

    res.status(201).json({ PermissionID: newId })
  } catch (err) {
    const error = err as Error
    if (error.name === 'PERMISSIONKEY_CONFLICT') {
      next(new AppError('PermissionKey already exists', 409))
      return
    }

    console.error('createPermission error:', err)
    next(new AppError('Failed to create permission', 500))
  }
}

/** PATCH /api/backend/settings/permissions/:id */
export const updatePermission: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      next(new AppError('Invalid id', 400))
      return
    }

    const parsed = updatePermissionSchema.safeParse(req.body ?? {})
    const body = parsed.success
      ? parsed.data
      : ((req.body ?? {}) as { PermissionKey?: string | null; Description?: string | null })

    const ok = await svcUpdate(id, {
      PermissionKey: body.PermissionKey ?? null,
      Description: body.Description ?? null,
    })

    if (!ok) {
      next(new AppError('Not found', 404))
      return
    }

    res.json({ ok: true })
  } catch (err) {
    const error = err as Error
    if (error.name === 'PERMISSIONKEY_CONFLICT') {
      next(new AppError('PermissionKey already exists', 409))
      return
    }

    console.error('updatePermission error:', err)
    next(new AppError('Failed to update permission', 500))
  }
}

/** DELETE /api/backend/settings/permissions/:id */
export const deletePermission: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      next(new AppError('Invalid id', 400))
      return
    }

    const ok = await svcDelete(id)
    if (!ok) {
      next(new AppError('Not found', 404))
      return
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('deletePermission error:', err)
    next(new AppError('Failed to delete permission', 500))
  }
}
