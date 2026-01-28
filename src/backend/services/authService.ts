// src/backend/services/authService.ts
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { poolPromise, sql } from '../config/db'
import { getUserPermissions } from '../database/permissionQueries'
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
  const permissions = await getUserPermissions(user.UserID)

  return {
    userId: user.UserID,
    roleId: user.RoleID,
    role: user.RoleName,
    email: user.Email,
    name: `${user.FirstName} ${user.LastName}`,
    profilePic: user.ProfilePic,
    permissions,
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
  const user = await findUserByEmail(email)

  if (!user) {
    return null
  }

  const passwordMatch = await bcrypt.compare(password, user.PasswordHash)
  if (!passwordMatch) {
    return null
  }

  const payload = await buildTokenPayload(user)
  const token = signToken(payload)

  return { token, payload }
}
