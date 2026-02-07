// src/backend/services/authService.ts
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { verifyPassword } from './passwordHasher'
import { poolPromise, sql } from '../config/db'
import { getAccountContextForUser } from '../database/accountContextQueries'
import type { JwtPayload as CustomJwtPayload } from '../../domain/auth/JwtTypes'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables')
}

interface DbUser {
  UserID: number
  FirstName: string
  LastName: string
  Email: string
  PasswordHash: string
  RoleID: number
  ProfilePic: string | null
  RoleName: string
}

export interface AuthTokenResult {
  token: string
  payload: CustomJwtPayload
}

const findUserByEmail = async (email: string): Promise<DbUser | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('Email', sql.VarChar, email)
    .query<DbUser>(`
      SELECT 
        u.UserID,
        u.FirstName,
        u.LastName,
        u.Email,
        u.PasswordHash,
        u.RoleID,
        u.ProfilePic,
        r.RoleName
      FROM Users u
      JOIN Roles r ON r.RoleID = u.RoleID
      WHERE u.Email = @Email
    `)

  const user = (result.recordset[0] as DbUser | undefined) ?? null
  return user
}

const buildTokenPayload = async (user: DbUser): Promise<CustomJwtPayload> => {
  const ctx = await getAccountContextForUser(user.UserID)

  // If user has no membership yet, keep legacy payload (role from Users.RoleID) and empty permissions.
  // Bundle 1 should have backfilled AccountMembers; this fallback is defensive.
  if (!ctx) {
    return {
      userId: user.UserID,
      roleId: user.RoleID,
      role: user.RoleName,
      email: user.Email,
      name: `${user.FirstName} ${user.LastName}`,
      profilePic: user.ProfilePic,
      permissions: [],
    }
  }

  return {
    userId: user.UserID,
    roleId: ctx.roleId,
    role: ctx.roleName,
    email: user.Email,
    name: `${user.FirstName} ${user.LastName}`,
    profilePic: user.ProfilePic,
    permissions: ctx.permissions,
    accountId: ctx.accountId,
  }
}

const signToken = (payload: CustomJwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '60m',
  })
}

// Returns null if email/password is invalid, otherwise token + payload.
export const loginWithEmailAndPassword = async (
  email: string,
  password: string,
): Promise<AuthTokenResult | null> => {
  const normalizedEmail = (email ?? '').trim().toLowerCase()
  if (!normalizedEmail) return null
  const user = await findUserByEmail(normalizedEmail)

  if (!user) {
    return null
  }

  const hash = user.PasswordHash
  const isArgon = hash.startsWith('$argon2')
  const isBcrypt =
    hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')

  let passwordMatch = false
  if (isArgon) {
    passwordMatch = await verifyPassword(hash, password)
  } else if (isBcrypt) {
    passwordMatch = await bcrypt.compare(password, hash)
  }
  if (!passwordMatch) {
    return null
  }

  const payload = await buildTokenPayload(user)
  const token = signToken(payload)

  return { token, payload }
}
