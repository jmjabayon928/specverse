import { poolPromise, sql } from "../config/db";

/** SQL row shape */
interface RoleRowSQL {
  RoleID: number;
  RoleName: string | null;
  CreatedAt: Date | string;
  UpdatedAt: Date | string;
  PermissionsCount?: number;
}

export interface PermissionDTO {
  PermissionID: number;
  PermissionKey: string | null;
  Description: string | null;
}

interface CountRow { Total: number; }

/** Public DTOs */
export interface RoleDTO {
  RoleID: number;
  RoleName: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  PermissionsCount?: number;
}

export interface ListRolesParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface ListRolesResult {
  page: number;
  pageSize: number;
  total: number;
  rows: RoleDTO[];
}

export interface CreateRoleInput { RoleName: string; }
export interface UpdateRoleInput { RoleName: string | null; }

/** Helpers */
function mapRow(row: RoleRowSQL): RoleDTO {
  return {
    RoleID: row.RoleID,
    RoleName: row.RoleName ?? null,
    CreatedAt: new Date(row.CreatedAt).toISOString(),
    UpdatedAt: new Date(row.UpdatedAt).toISOString(),
    PermissionsCount: typeof row.PermissionsCount === "number" ? row.PermissionsCount : undefined,
  };
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { originalError?: { number?: number; message?: string } };
  const code = e?.originalError?.number;
  const msg = e?.originalError?.message ?? "";
  // 2601/2627 = duplicate key, plus name of our unique index if you created it earlier
  return code === 2601 || code === 2627 || msg.includes("UX_Roles_RoleName");
}

function bindSearch(request: sql.Request, search: string): { where: string } {
  const q = (search ?? "").trim();
  if (!q) return { where: "" };
  request.input("q", sql.NVarChar(100), `%${q}%`);
  return { where: "WHERE r.RoleName LIKE @q" };
}

/** List roles with paging + optional search; includes PermissionsCount */
export async function listRoles(params: ListRolesParams): Promise<ListRolesResult> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), 100);
  const offset = (page - 1) * pageSize;
  const search = params.search ?? "";

  const p = await poolPromise;

  // 1) Data page
  const reqData = p.request();
  reqData.input("Offset", sql.Int, offset);
  reqData.input("PageSize", sql.Int, pageSize);
  const { where } = bindSearch(reqData, search);

  const dataResult = await reqData.query<RoleRowSQL>(`
    SELECT r.RoleID,
           r.RoleName,
           r.CreatedAt,
           r.UpdatedAt,
           (SELECT COUNT(*) FROM dbo.RolePermissions rp WHERE rp.RoleID = r.RoleID) AS PermissionsCount
    FROM dbo.Roles r
    ${where}
    ORDER BY r.RoleID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `);

  const rows = (dataResult.recordset ?? []).map(mapRow);

  // 2) Count
  const reqCount = p.request();
  bindSearch(reqCount, search);
  const countResult = await reqCount.query<CountRow>(`
    SELECT COUNT(1) AS Total FROM dbo.Roles r ${where};
  `);
  const total = countResult.recordset[0]?.Total ?? 0;

  return { page, pageSize, total, rows };
}

/** Get one role by id */
export async function getRoleById(id: number): Promise<RoleDTO | null> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, id)
    .query<RoleRowSQL>(`
      SELECT r.RoleID, r.RoleName, r.CreatedAt, r.UpdatedAt,
             (SELECT COUNT(*) FROM dbo.RolePermissions rp WHERE rp.RoleID = r.RoleID) AS PermissionsCount
      FROM dbo.Roles r
      WHERE r.RoleID = @id;
    `);
  const row = r.recordset[0];
  return row ? mapRow(row) : null;
}

/** Create role — returns new RoleID */
export async function createRole(input: CreateRoleInput): Promise<number> {
  try {
    const p = await poolPromise;
    const r = await p.request()
      .input("RoleName", sql.NVarChar(50), input.RoleName)
      .query<{ RoleID: number }>(`
        INSERT INTO dbo.Roles (RoleName)
        OUTPUT inserted.RoleID
        VALUES (@RoleName);
      `);
    return r.recordset[0].RoleID;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error("ROLENAME_CONFLICT");
      e.name = "ROLENAME_CONFLICT";
      throw e;
    }
    throw err;
  }
}

/** Update role — returns true if updated */
export async function updateRole(id: number, input: UpdateRoleInput): Promise<boolean> {
  try {
    const p = await poolPromise;
    const r = await p.request()
      .input("id", sql.Int, id)
      .input("RoleName", sql.NVarChar(50), input.RoleName)
      .query<{ Affected: number }>(`
        UPDATE dbo.Roles
        SET RoleName = @RoleName
        WHERE RoleID = @id;
        SELECT @@ROWCOUNT AS Affected;
      `);
    return (r.recordset[0]?.Affected ?? 0) > 0;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error("ROLENAME_CONFLICT");
      e.name = "ROLENAME_CONFLICT";
      throw e;
    }
    throw err;
  }
}

/** Delete role — returns true if a row was deleted */
export async function deleteRole(id: number): Promise<boolean> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Roles WHERE RoleID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `);
  return (r.recordset[0]?.Affected ?? 0) > 0;
}

export async function listRolePermissions(roleId: number): Promise<PermissionDTO[]> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, roleId)
    .query<PermissionDTO>(`
      SELECT p.PermissionID, p.PermissionKey, p.Description
      FROM dbo.RolePermissions rp
      INNER JOIN dbo.Permissions p ON p.PermissionID = rp.PermissionID
      WHERE rp.RoleID = @id
      ORDER BY p.PermissionKey ASC, p.PermissionID ASC;
    `);

  // normalize nulls
  return (r.recordset ?? []).map(row => ({
    PermissionID: row.PermissionID,
    PermissionKey: row.PermissionKey ?? null,
    Description: row.Description ?? null,
  }));
}

export async function listAvailablePermissionsForRole(roleId: number): Promise<PermissionDTO[]> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, roleId)
    .query<PermissionDTO>(`
      SELECT p.PermissionID, p.PermissionKey, p.Description
      FROM dbo.Permissions p
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.RolePermissions rp
        WHERE rp.RoleID = @id AND rp.PermissionID = p.PermissionID
      )
      ORDER BY p.PermissionKey ASC, p.PermissionID ASC;
    `);
  return (r.recordset ?? []).map(x => ({
    PermissionID: x.PermissionID,
    PermissionKey: x.PermissionKey ?? null,
    Description: x.Description ?? null,
  }));
}

export async function addPermissionToRole(roleId: number, permissionId: number): Promise<boolean> {
  const p = await poolPromise;
  try {
    const r = await p.request()
      .input("roleId", sql.Int, roleId)
      .input("permissionId", sql.Int, permissionId)
      .query<{ ok: number }>(`
        IF NOT EXISTS (
          SELECT 1 FROM dbo.RolePermissions WHERE RoleID = @roleId AND PermissionID = @permissionId
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
      `);
    return (r.recordset[0]?.ok ?? 0) === 1;
  } catch {
    return false;
  }
}

export async function removePermissionFromRole(roleId: number, permissionId: number): Promise<boolean> {
  const p = await poolPromise;
  const r = await p.request()
    .input("roleId", sql.Int, roleId)
    .input("permissionId", sql.Int, permissionId)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.RolePermissions
      WHERE RoleID = @roleId AND PermissionID = @permissionId;
      SELECT @@ROWCOUNT AS Affected;
    `);
  return (r.recordset[0]?.Affected ?? 0) > 0;
}