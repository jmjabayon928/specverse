// src/backend/services/rolesService.ts
import { poolPromise, sql } from '../config/db'
import { listRoleIdsAndNames } from '../repositories/rolesRepository'

interface RoleRowSQL {
  RoleID: number
  RoleName: string | null
  CreatedAt: Date | string
  UpdatedAt: Date | string
  PermissionsCount?: number
}

export interface PermissionDTO {
  PermissionID: number
  PermissionKey: string | null
  Description: string | null
}

interface CountRow {
  Total: number
}

export interface RoleDTO {
  RoleID: number
  RoleName: string | null
  CreatedAt: string
  UpdatedAt: string
  PermissionsCount?: number
}

export interface ListRolesParams {
  page: number
  pageSize: number
  search?: string
}

export interface ListRolesResult {
  page: number
  pageSize: number
  total: number
  rows: RoleDTO[]
}

export interface CreateRoleInput {
  RoleName: string
}

export interface UpdateRoleInput {
  RoleName: string | null
}

const mapRoleRowToDTO = (row: RoleRowSQL): RoleDTO => ({
  RoleID: row.RoleID,
  RoleName: row.RoleName ?? null,
  CreatedAt: new Date(row.CreatedAt).toISOString(),
  UpdatedAt: new Date(row.UpdatedAt).toISOString(),
  PermissionsCount:
    typeof row.PermissionsCount === 'number'
      ? row.PermissionsCount
      : undefined,
})

const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { originalError?: { number?: number; message?: string } }
  const code = e?.originalError?.number
  const msg = e?.originalError?.message ?? ''

  // 2601/2627 = duplicate key
  return code === 2601 || code === 2627 || msg.includes('UX_Roles_RoleName')
}

const bindSearch = (
  request: sql.Request,
  search: string,
): { where: string } => {
  const trimmed = (search ?? '').trim()

  if (!trimmed) {
    return { where: '' }
  }

  request.input('q', sql.NVarChar(100), `%${trimmed}%`)
  return { where: 'WHERE r.RoleName LIKE @q' }
}

/**
 * List roles with paging and optional search.
 * Includes PermissionsCount for each role.
 */
export const listRoles = async (
  params: ListRolesParams,
): Promise<ListRolesResult> => {
  const page = Math.max(1, params.page)
  const pageSize = Math.min(Math.max(1, params.pageSize), 100)
  const offset = (page - 1) * pageSize
  const search = params.search ?? ''

  const pool = await poolPromise

  const dataRequest = pool.request()
  dataRequest.input('Offset', sql.Int, offset)
  dataRequest.input('PageSize', sql.Int, pageSize)
  const { where } = bindSearch(dataRequest, search)

  const dataResult = await dataRequest.query<RoleRowSQL>(`
    SELECT
      r.RoleID,
      r.RoleName,
      r.CreatedAt,
      r.UpdatedAt,
      (
        SELECT COUNT(*)
        FROM dbo.RolePermissions rp
        WHERE rp.RoleID = r.RoleID
      ) AS PermissionsCount
    FROM dbo.Roles r
    ${where}
    ORDER BY r.RoleID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `)

  const rows = (dataResult.recordset ?? []).map(mapRoleRowToDTO)

  const countRequest = pool.request()
  bindSearch(countRequest, search)

  const countResult = await countRequest.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Roles r
    ${where};
  `)

  const total = countResult.recordset[0]?.Total ?? 0

  return { page, pageSize, total, rows }
}

export type RolesForDropdownResult = { roles: { roleId: number; roleName: string }[] }

/**
 * List roles for dropdown (e.g. account member management). Excludes deprecated by name.
 */
export const getRolesForDropdown = async (): Promise<RolesForDropdownResult> => {
  const roles = await listRoleIdsAndNames()
  return { roles }
}

/**
 * Fetch a single role by id, including PermissionsCount.
 */
export const getRoleById = async (id: number): Promise<RoleDTO | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<RoleRowSQL>(`
      SELECT
        r.RoleID,
        r.RoleName,
        r.CreatedAt,
        r.UpdatedAt,
        (
          SELECT COUNT(*)
          FROM dbo.RolePermissions rp
          WHERE rp.RoleID = r.RoleID
        ) AS PermissionsCount
      FROM dbo.Roles r
      WHERE r.RoleID = @id;
    `)

  const row = result.recordset[0]
  if (!row) {
    return null
  }

  return mapRoleRowToDTO(row)
}

/**
 * Create a new role and return its RoleID.
 */
export const createRole = async (
  input: CreateRoleInput,
): Promise<number> => {
  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .input('RoleName', sql.NVarChar(50), input.RoleName)
      .query<{ RoleID: number }>(`
        INSERT INTO dbo.Roles (RoleName)
        OUTPUT inserted.RoleID
        VALUES (@RoleName);
      `)

    return result.recordset[0].RoleID
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const conflictError = new Error('ROLENAME_CONFLICT')
      conflictError.name = 'ROLENAME_CONFLICT'
      throw conflictError
    }

    throw err
  }
}

/**
 * Update role name. Returns true if a row was updated.
 */
export const updateRole = async (
  id: number,
  input: UpdateRoleInput,
): Promise<boolean> => {
  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('RoleName', sql.NVarChar(50), input.RoleName)
      .query<{ Affected: number }>(`
        UPDATE dbo.Roles
        SET RoleName = @RoleName
        WHERE RoleID = @id;
        SELECT @@ROWCOUNT AS Affected;
      `)

    const affected = result.recordset[0]?.Affected ?? 0
    return affected > 0
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const conflictError = new Error('ROLENAME_CONFLICT')
      conflictError.name = 'ROLENAME_CONFLICT'
      throw conflictError
    }

    throw err
  }
}

/**
 * Delete role. Returns true if a row was deleted.
 */
export const deleteRole = async (id: number): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Roles
      WHERE RoleID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `)

  const affected = result.recordset[0]?.Affected ?? 0
  return affected > 0
}

/**
 * List permissions currently assigned to a role.
 */
export const listRolePermissions = async (
  roleId: number,
): Promise<PermissionDTO[]> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, roleId)
    .query<PermissionDTO>(`
      SELECT
        p.PermissionID,
        p.PermissionKey,
        p.Description
      FROM dbo.RolePermissions rp
      INNER JOIN dbo.Permissions p
        ON p.PermissionID = rp.PermissionID
      WHERE rp.RoleID = @id
      ORDER BY p.PermissionKey ASC, p.PermissionID ASC;
    `)

  return (result.recordset ?? []).map(row => ({
    PermissionID: row.PermissionID,
    PermissionKey: row.PermissionKey ?? null,
    Description: row.Description ?? null,
  }))
}

/**
 * List permissions that are not yet assigned to the given role.
 */
export const listAvailablePermissionsForRole = async (
  roleId: number,
): Promise<PermissionDTO[]> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, roleId)
    .query<PermissionDTO>(`
      SELECT
        p.PermissionID,
        p.PermissionKey,
        p.Description
      FROM dbo.Permissions p
      WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.RolePermissions rp
        WHERE rp.RoleID = @id
          AND rp.PermissionID = p.PermissionID
      )
      ORDER BY p.PermissionKey ASC, p.PermissionID ASC;
    `)

  return (result.recordset ?? []).map(row => ({
    PermissionID: row.PermissionID,
    PermissionKey: row.PermissionKey ?? null,
    Description: row.Description ?? null,
  }))
}

/**
 * Add a permission to a role.
 * Returns true when inserted, false when already exists or invalid.
 */
export const addPermissionToRole = async (
  roleId: number,
  permissionId: number,
): Promise<boolean> => {
  const pool = await poolPromise

  try {
    const result = await pool
      .request()
      .input('roleId', sql.Int, roleId)
      .input('permissionId', sql.Int, permissionId)
      .query<{ ok: number }>(`
        IF NOT EXISTS (
          SELECT 1
          FROM dbo.RolePermissions
          WHERE RoleID = @roleId
            AND PermissionID = @permissionId
        )
        BEGIN
          INSERT INTO dbo.RolePermissions (RoleID, PermissionID)
          VALUES (@roleId, @permissionId);
          SELECT 1 AS ok;
        END
        ELSE
        BEGIN
          SELECT 0 AS ok;
        END
      `)

    const ok = result.recordset[0]?.ok ?? 0
    return ok === 1
  } catch {
    // Keep original behavior: on error, treat as failure instead of throwing
    return false
  }
}

/**
 * Remove a permission from a role.
 * Returns true when a row was deleted.
 */
export const removePermissionFromRole = async (
  roleId: number,
  permissionId: number,
): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('roleId', sql.Int, roleId)
    .input('permissionId', sql.Int, permissionId)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.RolePermissions
      WHERE RoleID = @roleId
        AND PermissionID = @permissionId;
      SELECT @@ROWCOUNT AS Affected;
    `)

  const affected = result.recordset[0]?.Affected ?? 0
  return affected > 0
}
