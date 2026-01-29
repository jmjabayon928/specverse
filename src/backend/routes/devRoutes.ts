// src/backend/routes/devRoutes.ts
// DEV-ONLY routes for seeding/resetting admin users.
// Guarded by NODE_ENV !== 'production' AND DEV_ADMIN_UTILS=1

import { Router, type Request, type Response } from 'express'
import { z, ZodError } from 'zod'
import { AppError } from '../errors/AppError'
import { poolPromise, sql } from '../config/db'
import { hashPassword } from '../services/passwordHasher'
import { createUser } from '../services/usersService'
import { resetUserPassword } from '../services/usersService'
import crypto from 'crypto'

const router = Router()

/**
 * Dev-only guard middleware
 */
const devOnlyGuard = (
  req: Request,
  res: Response,
  next: () => void
): void => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' })
    return
  }

  if (process.env.DEV_ADMIN_UTILS !== '1') {
    res.status(404).json({ error: 'Not found' })
    return
  }

  next()
}

const seedAdminSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().optional(),
})

/**
 * POST /api/backend/dev/seed-admin
 * Idempotent: Creates an admin user if none exists with the given email.
 * If email not provided, uses 'admin@specverse.local'.
 * If password not provided, generates a temp password.
 */
router.post('/seed-admin', devOnlyGuard, async (req, res, next) => {
  try {
    const rawBody = req.body ?? {}
    const bodyParsed = seedAdminSchema.parse(rawBody)
    const email = bodyParsed.email ?? 'admin@specverse.local'
    const providedPassword = bodyParsed.password

    const pool = await poolPromise

    // Check if admin user already exists
    const existingResult = await pool
      .request()
      .input('Email', sql.NVarChar(255), email)
      .query<{ UserID: number }>(`
        SELECT UserID
        FROM dbo.Users
        WHERE Email = @Email;
      `)

    if (existingResult.recordset.length > 0) {
      res.json({
        message: 'Admin user already exists',
        userId: existingResult.recordset[0].UserID,
        email,
      })
      return
    }

    // Find or create Admin role
    let adminRoleId: number
    const roleResult = await pool
      .request()
      .query<{ RoleID: number; RoleName: string }>(`
        SELECT RoleID, RoleName
        FROM dbo.Roles
        WHERE LOWER(RoleName) = 'admin';
      `)

    if (roleResult.recordset.length > 0) {
      adminRoleId = roleResult.recordset[0].RoleID
    } else {
      // Create Admin role if it doesn't exist
      const newRoleResult = await pool
        .request()
        .input('RoleName', sql.NVarChar(50), 'Admin')
        .query<{ RoleID: number }>(`
          INSERT INTO dbo.Roles (RoleName)
          OUTPUT inserted.RoleID
          VALUES (@RoleName);
        `)
      adminRoleId = newRoleResult.recordset[0].RoleID
    }

    // Generate password if not provided
    let passwordToUse: string
    let tempPassword: string | undefined

    if (typeof providedPassword === 'string' && providedPassword.trim().length > 0) {
      passwordToUse = providedPassword.trim()
    } else {
      const randomBytes = crypto.randomBytes(16)
      tempPassword = randomBytes.toString('base64url')
      passwordToUse = tempPassword
    }

    // Create admin user (createUser handles password hashing internally)
    const userId = await createUser({
      FirstName: 'Admin',
      LastName: 'User',
      Email: email,
      Password: passwordToUse,
      RoleID: adminRoleId,
      IsActive: true,
    })

    const response: {
      message: string
      userId: number
      email: string
      tempPassword?: string
    } = {
      message: 'Admin user created successfully',
      userId,
      email,
    }

    if (tempPassword) {
      response.tempPassword = tempPassword
    }

    res.status(201).json(response)
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      next(new AppError('Invalid request body', 400))
      return
    }

    console.error('seed-admin error:', err)
    next(new AppError('Failed to seed admin user', 500))
  }
})

/**
 * POST /api/backend/dev/reset-admin-password
 * Resets password for admin user with email 'admin@specverse.local' (or provided email).
 * Returns temp password.
 */
router.post('/reset-admin-password', devOnlyGuard, async (req, res, next) => {
  try {
    const rawBody = req.body ?? {}
    const email = typeof rawBody.email === 'string' ? rawBody.email : 'admin@specverse.local'

    const pool = await poolPromise

    // Find admin user
    const userResult = await pool
      .request()
      .input('Email', sql.NVarChar(255), email)
      .query<{ UserID: number; RoleID: number; RoleName: string }>(`
        SELECT u.UserID, u.RoleID, r.RoleName
        FROM dbo.Users u
        LEFT JOIN dbo.Roles r ON r.RoleID = u.RoleID
        WHERE u.Email = @Email AND LOWER(r.RoleName) = 'admin';
      `)

    if (userResult.recordset.length === 0) {
      next(new AppError('Admin user not found', 404))
      return
    }

    const userId = userResult.recordset[0].UserID

    // Generate temp password
    const randomBytes = crypto.randomBytes(16)
    const tempPassword = randomBytes.toString('base64url')
    const hashedPassword = await hashPassword(tempPassword)

    const updated = await resetUserPassword(userId, hashedPassword)

    if (!updated) {
      next(new AppError('Failed to reset password', 500))
      return
    }

    res.json({
      message: 'Admin password reset successfully',
      userId,
      email,
      tempPassword,
    })
  } catch (err: unknown) {
    console.error('reset-admin-password error:', err)
    next(new AppError('Failed to reset admin password', 500))
  }
})

export default router
