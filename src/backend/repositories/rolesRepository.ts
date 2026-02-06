// src/backend/repositories/rolesRepository.ts
import { poolPromise } from '../config/db'

export type RoleIdName = { roleId: number; roleName: string }

/**
 * Lists RoleID and RoleName for all roles, excluding those whose RoleName contains '(Deprecated)' (case-insensitive).
 */
export async function listRoleIdsAndNames(): Promise<RoleIdName[]> {
  const pool = await poolPromise
  const result = await pool.request().query<{ RoleID: number; RoleName: string }>(`
    SELECT RoleID, RoleName
    FROM dbo.Roles
    WHERE LOWER(ISNULL(RoleName, N'')) NOT LIKE N'%(deprecated)%'
    ORDER BY RoleName
  `)
  return (result.recordset ?? []).map(row => ({
    roleId: row.RoleID,
    roleName: row.RoleName ?? '',
  }))
}
