import { poolPromise, sql } from "../config/db";

type SqlDate = Date | string;
type SqlDateNullable = SqlDate | null;

/** SQL row shape */
interface ProjectRowSQL {
  ProjectID: number;
  ClientID: number;
  ClientProjNum: string;
  ProjNum: string;
  ProjName: string;
  ProjDesc: string;
  ManagerID: number;
  StartDate: SqlDate;
  EndDate: SqlDateNullable;
  CreatedAt?: SqlDate;
  UpdatedAt?: SqlDate;
  ClientName?: string | null;
  ManagerName?: string | null;
}

interface CountRow {
  A: number;
}

/** Outgoing DTO */
export interface ProjectDTO {
  ProjectID: number;
  ClientID: number;
  ClientProjNum: string;
  ProjNum: string;
  ProjName: string;
  ProjDesc: string;
  ManagerID: number;
  StartDate: string | null;
  EndDate: string | null;
  ClientName?: string;
  ManagerName?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface ListProjectsParams {
  page: number;
  pageSize: number;
  search?: string;
}
export interface ListProjectsResult {
  page: number;
  pageSize: number;
  total: number;
  rows: ProjectDTO[];
}

export interface CreateProjectDTO {
  ClientID: number;
  ClientProjNum: string;
  ProjNum: string;
  ProjName: string;
  ProjDesc: string;
  ManagerID: number;
  StartDate: SqlDateNullable;  // was: string | Date | null
  EndDate: SqlDateNullable;    // was: string | Date | null
}

export interface UpdateProjectDTO {
  ClientID?: number;
  ClientProjNum?: string;
  ProjNum?: string;
  ProjName?: string;
  ProjDesc?: string;
  ManagerID?: number;
  StartDate?: SqlDateNullable; // was: string | Date | null
  EndDate?: SqlDateNullable;   // was: string | Date | null
}

/** Helpers */
function toISO(x: Date | string | null | undefined): string | null | undefined {
  if (x === null || x === undefined) return x;
  return new Date(x).toISOString();
}
function mapRow(row: ProjectRowSQL): ProjectDTO {
  return {
    ProjectID: row.ProjectID,
    ClientID: row.ClientID,
    ClientProjNum: row.ClientProjNum,
    ProjNum: row.ProjNum,
    ProjName: row.ProjName,
    ProjDesc: row.ProjDesc,
    ManagerID: row.ManagerID,
    StartDate: (toISO(row.StartDate) ?? null),
    EndDate: (toISO(row.EndDate) ?? null),
    ClientName: row.ClientName ?? undefined,
    ManagerName: row.ManagerName ?? undefined,
    CreatedAt: toISO(row.CreatedAt) ?? undefined,
    UpdatedAt: toISO(row.UpdatedAt) ?? undefined,
  };
}

function bindSearch(req: sql.Request, search?: string) {
  if (!search?.trim()) {
    return { where: "" };
  }
  const q = `%${search}%`;
  req.input("Q", sql.NVarChar(sql.MAX), q);
  const where = `
    WHERE (
      p.ProjNum LIKE @Q OR
      p.ProjName LIKE @Q OR
      p.ClientProjNum LIKE @Q OR
      c.ClientName LIKE @Q OR
      u.FirstName LIKE @Q OR
      u.LastName LIKE @Q
    )
  `;
  return { where };
}

/** List projects (paged) */
export async function listProjects(params: ListProjectsParams): Promise<ListProjectsResult> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), 100);
  const offset = (page - 1) * pageSize;
  const search = params.search ?? "";

  const p = await poolPromise;

  // Data page
  const reqData = p.request();
  reqData.input("Offset", sql.Int, offset);
  reqData.input("PageSize", sql.Int, pageSize);
  const { where } = bindSearch(reqData, search);

  const dataResult = await reqData.query<ProjectRowSQL>(`
    SELECT
      p.ProjectID, p.ClientID, p.ClientProjNum, p.ProjNum, p.ProjName, p.ProjDesc,
      p.ManagerID, p.StartDate, p.EndDate, p.CreatedAt, p.UpdatedAt,
      c.ClientName,
      CONCAT(u.FirstName, ' ', u.LastName) AS ManagerName
    FROM dbo.Projects p
    INNER JOIN dbo.Clients c ON c.ClientID = p.ClientID
    INNER JOIN dbo.Users u ON u.UserID = p.ManagerID
    ${where}
    ORDER BY p.ProjectID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `);
  const rows = (dataResult.recordset ?? []).map(mapRow);

  // Count
  const reqCount = p.request();
  bindSearch(reqCount, search);
  const countResult = await reqCount.query<CountRow>(`
    SELECT COUNT(1) AS A
    FROM dbo.Projects p
    INNER JOIN dbo.Clients c ON c.ClientID = p.ClientID
    INNER JOIN dbo.Users u ON u.UserID = p.ManagerID
    ${where};
  `);
  const total = countResult.recordset?.[0]?.A ?? 0;

  return { page, pageSize, total, rows };
}

/** Get one project */
export async function getProjectById(projectId: number): Promise<ProjectDTO | null> {
  const p = await poolPromise;
  const r = await p.request()
    .input("ProjectID", sql.Int, projectId)
    .query<ProjectRowSQL>(`
      SELECT
        p.ProjectID, p.ClientID, p.ClientProjNum, p.ProjNum, p.ProjName, p.ProjDesc,
        p.ManagerID, p.StartDate, p.EndDate, p.CreatedAt, p.UpdatedAt,
        c.ClientName,
        CONCAT(u.FirstName, ' ', u.LastName) AS ManagerName
      FROM dbo.Projects p
      INNER JOIN dbo.Clients c ON c.ClientID = p.ClientID
      INNER JOIN dbo.Users u ON u.UserID = p.ManagerID
      WHERE p.ProjectID = @ProjectID;
    `);

  const row = r.recordset?.[0];
  return row ? mapRow(row) : null;
}

/** Create */
export async function createProject(input: CreateProjectDTO): Promise<ProjectDTO> {
  const p = await poolPromise;
  const req = p.request()
    .input("ClientID", sql.Int, input.ClientID)
    .input("ClientProjNum", sql.NVarChar(sql.MAX), input.ClientProjNum)
    .input("ProjNum", sql.NVarChar(sql.MAX), input.ProjNum)
    .input("ProjName", sql.NVarChar(sql.MAX), input.ProjName)
    .input("ProjDesc", sql.NVarChar(sql.MAX), input.ProjDesc)
    .input("ManagerID", sql.Int, input.ManagerID)
    .input("StartDate", sql.Date, input.StartDate)
    .input("EndDate", sql.Date, input.EndDate);

  const r = await req.query<ProjectRowSQL>(`
    INSERT INTO dbo.Projects
      (ClientID, ClientProjNum, ProjNum, ProjName, ProjDesc, ManagerID, StartDate, EndDate, CreatedAt, UpdatedAt)
    OUTPUT
      inserted.ProjectID, inserted.ClientID, inserted.ClientProjNum, inserted.ProjNum, inserted.ProjName,
      inserted.ProjDesc, inserted.ManagerID, inserted.StartDate, inserted.EndDate, inserted.CreatedAt, inserted.UpdatedAt
    VALUES
      (@ClientID, @ClientProjNum, @ProjNum, @ProjName, @ProjDesc, @ManagerID, @StartDate, @EndDate, SYSUTCDATETIME(), SYSUTCDATETIME());
  `);

  return mapRow(r.recordset[0]);
}

/** Update */
export async function updateProject(projectId: number, input: UpdateProjectDTO): Promise<ProjectDTO | null> {
  const p = await poolPromise;
  const fields: string[] = [];
  const req = p.request().input("ProjectID", sql.Int, projectId);

  if (input.ClientID !== undefined) {
    fields.push("ClientID = @ClientID");
    req.input("ClientID", sql.Int, input.ClientID);
  }
  if (input.ClientProjNum !== undefined) {
    fields.push("ClientProjNum = @ClientProjNum");
    req.input("ClientProjNum", sql.NVarChar(sql.MAX), input.ClientProjNum);
  }
  if (input.ProjNum !== undefined) {
    fields.push("ProjNum = @ProjNum");
    req.input("ProjNum", sql.NVarChar(sql.MAX), input.ProjNum);
  }
  if (input.ProjName !== undefined) {
    fields.push("ProjName = @ProjName");
    req.input("ProjName", sql.NVarChar(sql.MAX), input.ProjName);
  }
  if (input.ProjDesc !== undefined) {
    fields.push("ProjDesc = @ProjDesc");
    req.input("ProjDesc", sql.NVarChar(sql.MAX), input.ProjDesc);
  }
  if (input.ManagerID !== undefined) {
    fields.push("ManagerID = @ManagerID");
    req.input("ManagerID", sql.Int, input.ManagerID);
  }
  if (input.StartDate !== undefined) {
    fields.push("StartDate = @StartDate");
    req.input("StartDate", sql.Date, input.StartDate);
  }
  if (input.EndDate !== undefined) {
    fields.push("EndDate = @EndDate");
    req.input("EndDate", sql.Date, input.EndDate);
  }

  if (fields.length === 0) {
    // Nothing to update; return current row if exists
    return await getProjectById(projectId);
  }

  await req.query(`
    UPDATE dbo.Projects
    SET ${fields.join(", ")}, UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectID = @ProjectID;
  `);

  return await getProjectById(projectId);
}

/** Delete */
export async function deleteProject(projectId: number): Promise<boolean> {
  const p = await poolPromise;
  const r = await p.request()
    .input("ProjectID", sql.Int, projectId)
    .query<{ affected: number }>(`
      DELETE FROM dbo.Projects WHERE ProjectID = @ProjectID;
      SELECT @@ROWCOUNT AS affected;
    `);
  const affected = r.recordset?.[0]?.affected ?? 0;
  return affected > 0;
}

/** Dropdown options used by UI */
export async function fetchProjectOptions(): Promise<{
  clients: { ClientID: number; ClientName: string }[];
  managers: { UserID: number; FirstName: string; LastName: string; Email: string }[];
}> {
  const p = await poolPromise;
  const [clientsRes, managersRes] = await Promise.all([
    p.request().query<{ ClientID: number; ClientName: string }>(`
      SELECT ClientID, ClientName
      FROM dbo.Clients
      ORDER BY ClientName;
    `),
    p.request().query<{ UserID: number; FirstName: string; LastName: string; Email: string }>(`
      SELECT UserID, FirstName, LastName, Email
      FROM dbo.Users
      ORDER BY FirstName, LastName;
    `),
  ]);

  return {
    clients: clientsRes.recordset ?? [],
    managers: managersRes.recordset ?? [],
  };
}
