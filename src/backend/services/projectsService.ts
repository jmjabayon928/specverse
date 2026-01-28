// src/backend/services/projectsService.ts
import { poolPromise, sql } from '../config/db'

type SqlDate = Date | string
type SqlDateNullable = SqlDate | null

interface ProjectRowSQL {
  ProjectID: number
  ClientID: number
  ClientProjNum: string
  ProjNum: string
  ProjName: string
  ProjDesc: string
  ManagerID: number
  StartDate: SqlDate
  EndDate: SqlDateNullable
  ClientName?: string
  ManagerName?: string
  CreatedAt?: SqlDate
  UpdatedAt?: SqlDate
}

interface CountRow {
  A: number
}

export interface ProjectDTO {
  ProjectID: number
  ClientID: number
  ClientProjNum: string
  ProjNum: string
  ProjName: string
  ProjDesc: string
  ManagerID: number
  StartDate: string | null
  EndDate: string | null
  ClientName?: string
  ManagerName?: string
  CreatedAt?: string
  UpdatedAt?: string
}

export interface ListProjectsParams {
  page: number
  pageSize: number
  search?: string
}

export interface ListProjectsResult {
  page: number
  pageSize: number
  total: number
  rows: ProjectDTO[]
}

export interface CreateProjectInput {
  ClientID: number
  ClientProjNum: string
  ProjNum: string
  ProjName: string
  ProjDesc: string
  ManagerID: number
  StartDate: SqlDate
  EndDate?: SqlDateNullable
}

export interface UpdateProjectInput {
  ClientID?: number
  ClientProjNum?: string
  ProjNum?: string
  ProjName?: string
  ProjDesc?: string
  ManagerID?: number
  StartDate?: SqlDateNullable
  EndDate?: SqlDateNullable
}

export interface ProjectOptionsResult {
  clients: { ClientID: number; ClientName: string }[]
  managers: { UserID: number; FirstName: string; LastName: string; Email: string }[]
}

const toISO = (value: Date | string | null | undefined): string | null | undefined => {
  if (value === null || value === undefined) {
    return value
  }

  return new Date(value).toISOString()
}

const mapRow = (row: ProjectRowSQL): ProjectDTO => ({
  ProjectID: row.ProjectID,
  ClientID: row.ClientID,
  ClientProjNum: row.ClientProjNum,
  ProjNum: row.ProjNum,
  ProjName: row.ProjName,
  ProjDesc: row.ProjDesc,
  ManagerID: row.ManagerID,
  StartDate: toISO(row.StartDate) ?? null,
  EndDate: toISO(row.EndDate ?? null) ?? null,
  ClientName: row.ClientName ?? undefined,
  ManagerName: row.ManagerName ?? undefined,
  CreatedAt: toISO(row.CreatedAt ?? null) ?? undefined,
  UpdatedAt: toISO(row.UpdatedAt ?? null) ?? undefined,
})

const bindSearch = (request: sql.Request, search?: string): { where: string } => {
  const trimmed = search?.trim() ?? ''

  if (trimmed.length === 0) {
    return { where: '' }
  }

  const q = `%${trimmed}%`
  request.input('Q', sql.NVarChar(sql.MAX), q)

  const where = `
    WHERE (
      p.ProjNum LIKE @Q OR
      p.ProjName LIKE @Q OR
      p.ClientProjNum LIKE @Q OR
      c.ClientName LIKE @Q OR
      u.FirstName LIKE @Q OR
      u.LastName LIKE @Q
    )
  `

  return { where }
}

export const listProjects = async (
  params: ListProjectsParams,
): Promise<ListProjectsResult> => {
  const page = Math.max(1, params.page)
  const pageSize = Math.min(Math.max(1, params.pageSize), 100)
  const offset = (page - 1) * pageSize
  const search = params.search ?? ''

  const pool = await poolPromise

  // Data page
  const dataRequest = pool.request()
  dataRequest.input('Offset', sql.Int, offset)
  dataRequest.input('PageSize', sql.Int, pageSize)
  const { where } = bindSearch(dataRequest, search)

  const dataResult = await dataRequest.query<ProjectRowSQL>(`
    SELECT
      p.ProjectID,
      p.ClientID,
      p.ClientProjNum,
      p.ProjNum,
      p.ProjName,
      p.ProjDesc,
      p.ManagerID,
      p.StartDate,
      p.EndDate,
      p.CreatedAt,
      p.UpdatedAt,
      c.ClientName,
      CONCAT(u.FirstName, ' ', u.LastName) AS ManagerName
    FROM dbo.Projects p
    INNER JOIN dbo.Clients c ON c.ClientID = p.ClientID
    INNER JOIN dbo.Users u ON u.UserID = p.ManagerID
    ${where}
    ORDER BY p.ProjectID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `)

  const rows = (dataResult.recordset ?? []).map((row) => mapRow(row))

  // Count
  const countRequest = pool.request()
  bindSearch(countRequest, search)

  const countResult = await countRequest.query<CountRow>(`
    SELECT COUNT(1) AS A
    FROM dbo.Projects p
    INNER JOIN dbo.Clients c ON c.ClientID = p.ClientID
    INNER JOIN dbo.Users u ON u.UserID = p.ManagerID
    ${where};
  `)

  const total = countResult.recordset?.[0]?.A ?? 0

  return {
    page,
    pageSize,
    total,
    rows,
  }
}

export const getProjectById = async (projectId: number): Promise<ProjectDTO | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('ProjectID', sql.Int, projectId)
    .query<ProjectRowSQL>(`
      SELECT
        p.ProjectID,
        p.ClientID,
        p.ClientProjNum,
        p.ProjNum,
        p.ProjName,
        p.ProjDesc,
        p.ManagerID,
        p.StartDate,
        p.EndDate,
        p.CreatedAt,
        p.UpdatedAt,
        c.ClientName,
        CONCAT(u.FirstName, ' ', u.LastName) AS ManagerName
      FROM dbo.Projects p
      INNER JOIN dbo.Clients c ON c.ClientID = p.ClientID
      INNER JOIN dbo.Users u ON u.UserID = p.ManagerID
      WHERE p.ProjectID = @ProjectID;
    `)

  const row = result.recordset[0]

  if (!row) {
    return null
  }

  return mapRow(row)
}

export const createProject = async (
  input: CreateProjectInput,
): Promise<ProjectDTO> => {
  const pool = await poolPromise

  const request = pool
    .request()
    .input('ClientID', sql.Int, input.ClientID)
    .input('ClientProjNum', sql.NVarChar(sql.MAX), input.ClientProjNum)
    .input('ProjNum', sql.NVarChar(sql.MAX), input.ProjNum)
    .input('ProjName', sql.NVarChar(sql.MAX), input.ProjName)
    .input('ProjDesc', sql.NVarChar(sql.MAX), input.ProjDesc)
    .input('ManagerID', sql.Int, input.ManagerID)
    .input('StartDate', sql.Date, input.StartDate)

  if (input.EndDate === undefined) {
    request.input('EndDate', sql.Date, null)
  } else {
    request.input('EndDate', sql.Date, input.EndDate)
  }

  const result = await request.query<ProjectRowSQL>(`
    INSERT INTO dbo.Projects (
      ClientID,
      ClientProjNum,
      ProjNum,
      ProjName,
      ProjDesc,
      ManagerID,
      StartDate,
      EndDate,
      CreatedAt,
      UpdatedAt
    )
    OUTPUT
      inserted.ProjectID,
      inserted.ClientID,
      inserted.ClientProjNum,
      inserted.ProjNum,
      inserted.ProjName,
      inserted.ProjDesc,
      inserted.ManagerID,
      inserted.StartDate,
      inserted.EndDate,
      inserted.CreatedAt,
      inserted.UpdatedAt
    VALUES (
      @ClientID,
      @ClientProjNum,
      @ProjNum,
      @ProjName,
      @ProjDesc,
      @ManagerID,
      @StartDate,
      @EndDate,
      SYSUTCDATETIME(),
      SYSUTCDATETIME()
    );
  `)

  const row = result.recordset[0]

  return mapRow(row)
}

export const updateProject = async (
  projectId: number,
  input: UpdateProjectInput,
): Promise<ProjectDTO | null> => {
  const pool = await poolPromise

  const fields: string[] = []
  const request = pool.request().input('ProjectID', sql.Int, projectId)

  if (input.ClientID !== undefined) {
    fields.push('ClientID = @ClientID')
    request.input('ClientID', sql.Int, input.ClientID)
  }

  if (input.ClientProjNum !== undefined) {
    fields.push('ClientProjNum = @ClientProjNum')
    request.input('ClientProjNum', sql.NVarChar(sql.MAX), input.ClientProjNum)
  }

  if (input.ProjNum !== undefined) {
    fields.push('ProjNum = @ProjNum')
    request.input('ProjNum', sql.NVarChar(sql.MAX), input.ProjNum)
  }

  if (input.ProjName !== undefined) {
    fields.push('ProjName = @ProjName')
    request.input('ProjName', sql.NVarChar(sql.MAX), input.ProjName)
  }

  if (input.ProjDesc !== undefined) {
    fields.push('ProjDesc = @ProjDesc')
    request.input('ProjDesc', sql.NVarChar(sql.MAX), input.ProjDesc)
  }

  if (input.ManagerID !== undefined) {
    fields.push('ManagerID = @ManagerID')
    request.input('ManagerID', sql.Int, input.ManagerID)
  }

  if (input.StartDate !== undefined) {
    fields.push('StartDate = @StartDate')
    request.input('StartDate', sql.Date, input.StartDate)
  }

  if (input.EndDate !== undefined) {
    fields.push('EndDate = @EndDate')
    request.input('EndDate', sql.Date, input.EndDate)
  }

  if (fields.length === 0) {
    return getProjectById(projectId)
  }

  await request.query(`
    UPDATE dbo.Projects
    SET ${fields.join(', ')}, UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectID = @ProjectID;
  `)

  return getProjectById(projectId)
}

export const deleteProject = async (projectId: number): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('ProjectID', sql.Int, projectId)
    .query<{ affected: number }>(`
      DELETE FROM dbo.Projects
      WHERE ProjectID = @ProjectID;
      SELECT @@ROWCOUNT AS affected;
    `)

  const affected = result.recordset?.[0]?.affected ?? 0

  return affected > 0
}

export const fetchProjectOptions = async (): Promise<ProjectOptionsResult> => {
  const pool = await poolPromise

  const [clientsResult, managersResult] = await Promise.all([
    pool.request().query<{ ClientID: number; ClientName: string }>(`
      SELECT ClientID, ClientName
      FROM dbo.Clients
      ORDER BY ClientName;
    `),
    pool.request().query<{
      UserID: number
      FirstName: string
      LastName: string
      Email: string
    }>(`
      SELECT UserID, FirstName, LastName, Email
      FROM dbo.Users
      ORDER BY FirstName, LastName;
    `),
  ])

  return {
    clients: clientsResult.recordset ?? [],
    managers: managersResult.recordset ?? [],
  }
}
