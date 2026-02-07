// src/backend/services/usersService.ts
import { poolPromise, sql } from '../config/db'
import { hashPassword } from './passwordHasher'

/** Row shape returned from SQL for the Users list/detail queries */
interface UserRowSQL {
  UserID: number
  FirstName: string | null
  LastName: string | null
  Email: string | null
  RoleID: number | null
  ProfilePic: string | null
  IsActive: boolean | number // SQL bit can appear as number in some drivers
  CreatedAt: Date | string
  UpdatedAt: Date | string
  RoleName: string | null
}

/** Row shape for COUNT queries */
interface CountRow {
  Total: number
}

/** Public DTOs & inputs */
export interface UserDTO {
  UserID: number
  FirstName: string | null
  LastName: string | null
  Email: string | null
  RoleID: number | null
  ProfilePic: string | null
  IsActive: boolean
  CreatedAt: string
  UpdatedAt: string
  RoleName?: string | null
}

export interface ListUsersParams {
  page: number
  pageSize: number
  search?: string
}

export interface ListUsersResult {
  page: number
  pageSize: number
  total: number
  rows: UserDTO[]
}

export interface CreateUserInput {
  FirstName?: string | null
  LastName?: string | null
  Email: string
  Password: string
  RoleID?: number | null
  ProfilePic?: string | null
  IsActive?: boolean
}

export interface UpdateUserInput {
  FirstName?: string | null
  LastName?: string | null
  Email?: string | null
  Password?: string // optional; if present we will re-hash
  RoleID?: number | null
  ProfilePic?: string | null
  IsActive?: boolean
}

/** Map raw SQL row to DTO safely */
const mapRowToDTO = (row: UserRowSQL): UserDTO => {
  const isActive =
    typeof row.IsActive === 'boolean' ? row.IsActive : row.IsActive === 1

  return {
    UserID: row.UserID,
    FirstName: row.FirstName ?? null,
    LastName: row.LastName ?? null,
    Email: row.Email ?? null,
    RoleID: row.RoleID ?? null,
    ProfilePic: row.ProfilePic ?? null,
    IsActive: isActive,
    CreatedAt: new Date(row.CreatedAt).toISOString(),
    UpdatedAt: new Date(row.UpdatedAt).toISOString(),
    RoleName: row.RoleName ?? null,
  }
}

/** Detect unique-key conflicts from SQL Server (email duplicates, etc.) */
const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { originalError?: { number?: number; message?: string } }
  const code = e?.originalError?.number
  const message = e?.originalError?.message ?? ''

  if (code === 2601 || code === 2627) {
    return true
  }

  if (message.includes('UX_Users_Email')) {
    return true
  }

  return false
}

/** Build WHERE clause and bind @q if search is present */
const bindSearch = (
  request: sql.Request,
  search: string
): { where: string } => {
  const q = search.trim()
  if (q.length === 0) {
    return { where: '' }
  }

  request.input('q', sql.NVarChar(255), `%${q}%`)
  return {
    where:
      'WHERE (u.Email LIKE @q OR u.FirstName LIKE @q OR u.LastName LIKE @q)',
  }
}

/** List users with paging + optional search on name/email */
export const listUsers = async (
  params: ListUsersParams
): Promise<ListUsersResult> => {
  const page = Math.max(1, params.page)
  const pageSize = Math.min(Math.max(1, params.pageSize), 100)
  const offset = (page - 1) * pageSize
  const search = params.search ?? ''

  const pool = await poolPromise

  // 1) Data page
  const reqData = pool.request()
  reqData.input('Offset', sql.Int, offset)
  reqData.input('PageSize', sql.Int, pageSize)
  const { where } = bindSearch(reqData, search)

  const dataResult = await reqData.query<UserRowSQL>(`
    SELECT
      u.UserID,
      u.FirstName,
      u.LastName,
      u.Email,
      u.RoleID,
      u.ProfilePic,
      u.IsActive,
      u.CreatedAt,
      u.UpdatedAt,
      r.RoleName
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleID = u.RoleID
    ${where}
    ORDER BY u.UserID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `)

  const rows = (dataResult.recordset ?? []).map(mapRowToDTO)

  // 2) Count (separate request keeps types clean)
  const reqCount = pool.request()
  bindSearch(reqCount, search)

  const countResult = await reqCount.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Users u
    ${where};
  `)

  const total = countResult.recordset[0]?.Total ?? 0

  return { page, pageSize, total, rows }
}

/** Fetch a single user by id (with RoleName) */
export const getUserById = async (userId: number): Promise<UserDTO | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, userId)
    .query<UserRowSQL>(`
      SELECT
        u.UserID,
        u.FirstName,
        u.LastName,
        u.Email,
        u.RoleID,
        u.ProfilePic,
        u.IsActive,
        u.CreatedAt,
        u.UpdatedAt,
        r.RoleName
      FROM dbo.Users u
      LEFT JOIN dbo.Roles r ON r.RoleID = u.RoleID
      WHERE u.UserID = @id;
    `)

  const row = result.recordset[0]
  if (!row) {
    return null
  }

  return mapRowToDTO(row)
}

/** Create user (hashes password) — returns new UserID */
export const createUser = async (
  input: CreateUserInput
): Promise<number> => {
  const hashed = await hashPassword(input.Password)
  const now = new Date()

  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .input('FirstName', sql.NVarChar(100), input.FirstName ?? null)
      .input('LastName', sql.NVarChar(100), input.LastName ?? null)
      .input('Email', sql.NVarChar(255), input.Email)
      .input('PasswordHash', sql.NVarChar(255), hashed)
      .input('RoleID', sql.Int, input.RoleID ?? null)
      .input('ProfilePic', sql.NVarChar(255), input.ProfilePic ?? null)
      .input(
        'IsActive',
        sql.Bit,
        typeof input.IsActive === 'boolean' ? input.IsActive : true
      )
      .input('CreatedAt', sql.DateTime2(0), now)
      .input('UpdatedAt', sql.DateTime2(0), now)
      .query<{ UserID: number }>(`
        INSERT INTO dbo.Users (
          FirstName,
          LastName,
          Email,
          PasswordHash,
          RoleID,
          ProfilePic,
          IsActive,
          CreatedAt,
          UpdatedAt
        )
        OUTPUT inserted.UserID
        VALUES (
          @FirstName,
          @LastName,
          @Email,
          @PasswordHash,
          @RoleID,
          @ProfilePic,
          @IsActive,
          @CreatedAt,
          @UpdatedAt
        );
      `)

    return result.recordset[0].UserID
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const error = new Error('EMAIL_CONFLICT')
      error.name = 'EMAIL_CONFLICT'
      throw error
    }

    throw err
  }
}

/** Update user (optionally re-hashes password) — returns true if updated */
export const updateUser = async (
  userId: number,
  input: UpdateUserInput
): Promise<boolean> => {
  const pool = await poolPromise

  const sets: string[] = [
    'FirstName = @FirstName',
    'LastName = @LastName',
    'Email = @Email',
    'RoleID = @RoleID',
    'ProfilePic = @ProfilePic',
    'IsActive = @IsActive',
  ]

  const request = pool
    .request()
    .input('id', sql.Int, userId)
    .input('FirstName', sql.NVarChar(100), input.FirstName ?? null)
    .input('LastName', sql.NVarChar(100), input.LastName ?? null)
    .input('Email', sql.NVarChar(255), input.Email ?? null)
    .input('RoleID', sql.Int, input.RoleID ?? null)
    .input('ProfilePic', sql.NVarChar(255), input.ProfilePic ?? null)
    .input(
      'IsActive',
      sql.Bit,
      typeof input.IsActive === 'boolean' ? input.IsActive : true
    )

  const hasPassword =
    typeof input.Password === 'string' &&
    input.Password.trim().length > 0

  if (hasPassword) {
    const pwd = input.Password?.trim() ?? '' 
    const newHash = await hashPassword(pwd)
    sets.push('PasswordHash = @PasswordHash')
    request.input('PasswordHash', sql.NVarChar(255), newHash)
  }

  try {
    const result = await request.query<{ Affected: number }>(`
      UPDATE dbo.Users
      SET ${sets.join(', ')}
      WHERE UserID = @id;

      SELECT @@ROWCOUNT AS Affected;
    `)

    const affected = result.recordset[0]?.Affected ?? 0
    return affected > 0
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const error = new Error('EMAIL_CONFLICT')
      error.name = 'EMAIL_CONFLICT'
      throw error
    }

    throw err
  }
}

/** Delete user — returns true if a row was deleted */
export const deleteUser = async (userId: number): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, userId)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Users
      WHERE UserID = @id;

      SELECT @@ROWCOUNT AS Affected;
    `)

  const affected = result.recordset[0]?.Affected ?? 0
  return affected > 0
}

/** Reset user password — returns true if updated, false if user not found */
export const resetUserPassword = async (
  userId: number,
  newPasswordHash: string
): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, userId)
    .input('PasswordHash', sql.NVarChar(255), newPasswordHash)
    .query<{ Affected: number }>(`
      UPDATE dbo.Users
      SET PasswordHash = @PasswordHash
      WHERE UserID = @id;

      SELECT @@ROWCOUNT AS Affected;
    `)

  const affected = result.recordset[0]?.Affected ?? 0
  return affected > 0
}
