// src/backend/services/permissionsService.ts
import { poolPromise, sql } from '../config/db'

/** Raw row shape returned from SQL */
interface PermissionRowSQL {
  PermissionID: number
  PermissionKey: string | null
  Description: string | null
  CreatedAt: Date | string
  UpdatedAt: Date | string
  AssignedCount?: number
}

interface CountRow {
  Total: number
}

/** Public DTOs */
export interface PermissionDTO {
  PermissionID: number
  PermissionKey: string | null
  Description: string | null
  CreatedAt: string
  UpdatedAt: string
  AssignedCount?: number
}

export interface ListPermissionsParams {
  page: number
  pageSize: number
  search?: string
}

export interface ListPermissionsResult {
  page: number
  pageSize: number
  total: number
  rows: PermissionDTO[]
}

export interface CreatePermissionInput {
  PermissionKey: string
  Description: string | null
}

export interface UpdatePermissionInput {
  PermissionKey: string | null
  Description: string | null
}

/** Map a raw SQL row into a safe DTO */
function mapRow(row: PermissionRowSQL): PermissionDTO {
  return {
    PermissionID: row.PermissionID,
    PermissionKey: row.PermissionKey ?? null,
    Description: row.Description ?? null,
    CreatedAt: new Date(row.CreatedAt).toISOString(),
    UpdatedAt: new Date(row.UpdatedAt).toISOString(),
    AssignedCount: typeof row.AssignedCount === 'number' ? row.AssignedCount : undefined,
  }
}

/** Detect unique-key conflicts from SQL Server (duplicate PermissionKey) */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { originalError?: { number?: number; message?: string } }
  const code = e?.originalError?.number
  const msg = e?.originalError?.message ?? ''
  // 2601/2627 = duplicate key, plus our filtered unique index name if present
  return code === 2601 || code === 2627 || msg.includes('UX_Permissions_Key')
}

/** Attach search filter to a request and return the WHERE clause */
function bindSearch(request: sql.Request, search: string): { where: string } {
  const q = (search ?? '').trim()
  if (!q) {
    return { where: '' }
  }

  request.input('q', sql.NVarChar(255), `%${q}%`)
  return {
    where: 'WHERE (p.PermissionKey LIKE @q OR p.Description LIKE @q)',
  }
}

/** List permissions with paging + optional search; includes AssignedCount */
export async function listPermissions(
  params: ListPermissionsParams,
): Promise<ListPermissionsResult> {
  const page = Math.max(1, params.page)
  const pageSize = Math.min(Math.max(1, params.pageSize), 100)
  const offset = (page - 1) * pageSize
  const search = params.search ?? ''

  const pool = await poolPromise

  // 1) Data page
  const dataRequest = pool.request()
  dataRequest.input('Offset', sql.Int, offset)
  dataRequest.input('PageSize', sql.Int, pageSize)
  const { where } = bindSearch(dataRequest, search)

  const dataResult = await dataRequest.query<PermissionRowSQL>(`
    SELECT
      p.PermissionID,
      p.PermissionKey,
      p.Description,
      p.CreatedAt,
      p.UpdatedAt,
      (
        SELECT COUNT(*)
        FROM dbo.RolePermissions rp
        WHERE rp.PermissionID = p.PermissionID
      ) AS AssignedCount
    FROM dbo.Permissions p
    ${where}
    ORDER BY p.PermissionID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `)

  const rows = (dataResult.recordset ?? []).map(mapRow)

  // 2) Count
  const countRequest = pool.request()
  bindSearch(countRequest, search)

  const countResult = await countRequest.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Permissions p
    ${where};
  `)

  const total = countResult.recordset[0]?.Total ?? 0

  return {
    page,
    pageSize,
    total,
    rows,
  }
}

/** Get a single permission by id */
export async function getPermissionById(id: number): Promise<PermissionDTO | null> {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<PermissionRowSQL>(`
      SELECT
        p.PermissionID,
        p.PermissionKey,
        p.Description,
        p.CreatedAt,
        p.UpdatedAt,
        (
          SELECT COUNT(*)
          FROM dbo.RolePermissions rp
          WHERE rp.PermissionID = p.PermissionID
        ) AS AssignedCount
      FROM dbo.Permissions p
      WHERE p.PermissionID = @id;
    `)

  const row = result.recordset[0]
  if (!row) {
    return null
  }

  return mapRow(row)
}

/** Create a permission — returns new PermissionID */
export async function createPermission(input: CreatePermissionInput): Promise<number> {
  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .input('PermissionKey', sql.NVarChar(100), input.PermissionKey)
      .input('Description', sql.NVarChar(255), input.Description)
      .query<{ PermissionID: number }>(`
        INSERT INTO dbo.Permissions (PermissionKey, Description)
        OUTPUT inserted.PermissionID
        VALUES (@PermissionKey, @Description);
      `)

    return result.recordset[0].PermissionID
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error('PERMISSIONKEY_CONFLICT')
      e.name = 'PERMISSIONKEY_CONFLICT'
      throw e
    }

    throw err
  }
}

/** Update a permission — returns true when a row was updated */
export async function updatePermission(
  id: number,
  input: UpdatePermissionInput,
): Promise<boolean> {
  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('PermissionKey', sql.NVarChar(100), input.PermissionKey)
      .input('Description', sql.NVarChar(255), input.Description)
      .query<{ Affected: number }>(`
        UPDATE dbo.Permissions
        SET PermissionKey = @PermissionKey,
            Description = @Description
        WHERE PermissionID = @id;

        SELECT @@ROWCOUNT AS Affected;
      `)

    const affected = result.recordset[0]?.Affected ?? 0
    return affected > 0
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error('PERMISSIONKEY_CONFLICT')
      e.name = 'PERMISSIONKEY_CONFLICT'
      throw e
    }

    throw err
  }
}

/** Delete a permission — returns true when a row was deleted */
export async function deletePermission(id: number): Promise<boolean> {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Permissions
      WHERE PermissionID = @id;

      SELECT @@ROWCOUNT AS Affected;
    `)

  const affected = result.recordset[0]?.Affected ?? 0
  return affected > 0
}
