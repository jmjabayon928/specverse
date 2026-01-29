// src/backend/controllers/usersController.ts
import type { RequestHandler } from 'express'
import { z, ZodError } from 'zod'
import { poolPromise } from '../config/db'
import { AppError } from '../errors/AppError'
import {
  listUsers as svcList,
  getUserById as svcGet,
  createUser as svcCreate,
  updateUser as svcUpdate,
  deleteUser as svcDelete,
  resetUserPassword as svcResetPassword,
  type ListUsersResult,
  type CreateUserInput,
  type UpdateUserInput,
} from '../services/usersService'
import { asSingleString, parseIntParam } from '../utils/requestParam'

const createUserSchema = z.object({
  FirstName: z.string().optional(),
  LastName: z.string().optional(),
  Email: z.string(),
  Password: z.string(),
  RoleID: z.number().int().optional(),
  ProfilePic: z.string().nullish().optional(),
  IsActive: z.boolean().optional(),
})

const updateUserSchema = z.object({
  FirstName: z.string().optional(),
  LastName: z.string().optional(),
  Email: z.string().optional(),
  Password: z.string().optional(),
  RoleID: z.number().int().optional(),
  ProfilePic: z.string().nullish().optional(),
  IsActive: z.boolean().optional(),
})

const resetPasswordSchema = z.object({
  newPassword: z.string().optional(),
})

/**
 * Legacy: GET /users
 * Direct query to Users table. No pagination.
 * Now protected by auth at the route level.
 */
export const getUsers: RequestHandler = async (_req, res, next) => {
  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .query('USE DataSheets; SELECT * FROM dbo.Users')

    res.status(200).json(result.recordset)
  } catch (err) {
    console.error('getUsers error:', err)
    next(new AppError('Server error', 500))
  }
}

/**
 * GET /api/backend/settings/users
 * Supports pagination and optional search.
 */
export const listUsers: RequestHandler = async (req, res, next) => {
  try {
    const pageRaw = asSingleString(req.query.page as string | string[] | undefined)
    const pageSizeRaw = asSingleString(req.query.pageSize as string | string[] | undefined)
    const searchRaw = asSingleString(req.query.search as string | string[] | undefined)

    const pageParsed = pageRaw === undefined ? 1 : Number.parseInt(pageRaw, 10)
    const page = Math.max(Number.isFinite(pageParsed) ? pageParsed : 1, 1)

    const pageSizeParsed =
      pageSizeRaw === undefined ? 20 : Number.parseInt(pageSizeRaw, 10)
    const safePageSize = Number.isFinite(pageSizeParsed) ? pageSizeParsed : 20
    const pageSize = Math.min(Math.max(safePageSize, 1), 100)

    const search = (searchRaw ?? '').trim()

    const out: ListUsersResult = await svcList({ page, pageSize, search })
    res.json(out)
  } catch (err) {
    console.error('listUsers error:', err)
    next(new AppError('Failed to fetch users', 500))
  }
}

/**
 * GET /api/backend/settings/users/:id
 * Returns a single user row or 404.
 */
export const getUser: RequestHandler = async (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id)
    if (id == null) {
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
    console.error('getUser error:', err)
    next(new AppError('Failed to fetch user', 500))
  }
}

/**
 * POST /api/backend/settings/users
 * Creates a new user and returns its id.
 */
export const createUser: RequestHandler = async (req, res, next) => {
  try {
    const rawBody = req.body ?? {}

    // Preserve old behavior and message for missing required fields
    if (!rawBody.Email || !rawBody.Password) {
      next(new AppError('Email and Password are required', 400))
      return
    }

    const bodyParsed = createUserSchema.parse(rawBody)
    const body = bodyParsed as CreateUserInput

    const newId = await svcCreate({
      FirstName: body.FirstName ?? null,
      LastName: body.LastName ?? null,
      Email: body.Email,
      Password: body.Password,
      RoleID: body.RoleID ?? null,
      ProfilePic: body.ProfilePic ?? null,
      IsActive:
        typeof body.IsActive === 'boolean' ? body.IsActive : true,
    })

    res.status(201).json({ id: newId })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      console.error('createUser validation error:', err)
      next(new AppError('Invalid user payload', 400))
      return
    }

    const error = err as Error

    if (error.name === 'EMAIL_CONFLICT') {
      next(new AppError('Email already exists', 409))
      return
    }

    console.error('createUser error:', err)
    next(new AppError('Failed to create user', 500))
  }
}

/**
 * PATCH /api/backend/settings/users/:id
 * Updates an existing user. Returns { ok: true } or 404.
 */
export const updateUser: RequestHandler = async (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id)
    if (id == null) {
      next(new AppError('Invalid id', 400))
      return
    }

    const rawBody = req.body ?? {}
    const bodyParsed = updateUserSchema.parse(rawBody)
    const body = bodyParsed as UpdateUserInput

    const ok = await svcUpdate(id, {
      FirstName: body.FirstName ?? null,
      LastName: body.LastName ?? null,
      Email: body.Email ?? null,
      Password: body.Password,
      RoleID: body.RoleID ?? null,
      ProfilePic: body.ProfilePic ?? null,
      IsActive:
        typeof body.IsActive === 'boolean' ? body.IsActive : true,
    })

    if (!ok) {
      next(new AppError('Not found', 404))
      return
    }

    res.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      console.error('updateUser validation error:', err)
      next(new AppError('Invalid user payload', 400))
      return
    }

    const error = err as Error

    if (error.name === 'EMAIL_CONFLICT') {
      next(new AppError('Email already exists', 409))
      return
    }

    console.error('updateUser error:', err)
    next(new AppError('Failed to update user', 500))
  }
}

/**
 * DELETE /api/backend/settings/users/:id
 * Deletes a user. Returns { ok: true } or 404.
 */
export const deleteUser: RequestHandler = async (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id)
    if (id == null) {
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
    console.error('deleteUser error:', err)
    next(new AppError('Failed to delete user', 500))
  }
}

/**
 * POST /api/backend/admin/users/:userId/reset-password
 * Admin-only: Reset a user's password.
 * If newPassword is provided, uses it; otherwise generates a temp password.
 */
export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const userId = parseIntParam(req.params.userId)
    if (userId == null) {
      next(new AppError('Invalid userId', 400))
      return
    }

    const rawBody = req.body ?? {}
    const bodyParsed = resetPasswordSchema.parse(rawBody)
    const { newPassword } = bodyParsed

    // Import here to avoid circular dependency issues
    const { hashPassword } = await import('../services/passwordHasher')
    const crypto = await import('crypto')

    let passwordToUse: string
    let tempPassword: string | undefined

    if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
      passwordToUse = newPassword.trim()
    } else {
      // Generate temp password: 16 bytes = 24 base64url chars
      const randomBytes = crypto.randomBytes(16)
      tempPassword = randomBytes.toString('base64url')
      passwordToUse = tempPassword
    }

    const hashedPassword = await hashPassword(passwordToUse)
    const updated = await svcResetPassword(userId, hashedPassword)

    if (!updated) {
      next(new AppError('User not found', 404))
      return
    }

    const response: {
      userId: string
      tempPassword?: string
      message: string
    } = {
      userId: String(userId),
      message: tempPassword
        ? 'Password reset successfully. Temporary password generated.'
        : 'Password reset successfully.',
    }

    if (tempPassword) {
      response.tempPassword = tempPassword
    }

    res.json(response)
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      console.error('resetPassword validation error:', err)
      next(new AppError('Invalid request body', 400))
      return
    }

    console.error('resetPassword error:', err)
    next(new AppError('Failed to reset password', 500))
  }
}
