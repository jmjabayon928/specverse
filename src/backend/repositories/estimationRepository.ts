// src/backend/repositories/estimationRepository.ts
import { poolPromise, sql } from '../config/db'
import type { Estimation } from '@/domain/estimations/estimationTypes'

export type EstimationFilter = {
  statuses?: string[]
  clients?: number[]
  projects?: number[]
  search?: string
  page?: number
  pageSize?: number
}

export type EstimationFilterResult = {
  estimations: Estimation[]
  totalCount: number
}

export type PastEstimationSummary = {
  EstimationID: number
  EstimationName: string
  EstimatorID: number
  EstimatorName: string
  CreatedAt: string
  TotalEstimatedCost: number
  ItemCount: number
  LastModified: string | null
}

const baseSelectColumns = `
  e.EstimationID,
  e.ClientID,
  c.ClientName,
  e.ProjectID,
  p.ProjName,
  e.Title,
  e.Description,
  e.TotalMaterialCost,
  e.TotalLaborCost,
  e.TotalDurationDays,
  e.CurrencyCode,
  e.Status,
  u1.FirstName + ' ' + u1.LastName AS CreatedByName,
  e.CreatedAt,
  e.VerifiedAt,
  u2.FirstName + ' ' + u2.LastName AS VerifiedByName,
  e.ApprovedAt,
  u3.FirstName + ' ' + u3.LastName AS ApprovedByName
`

const baseFromClause = `
  FROM Estimations e
  LEFT JOIN Clients c ON e.ClientID = c.ClientID
  LEFT JOIN Projects p ON e.ProjectID = p.ProjectID
  LEFT JOIN Users u1 ON e.CreatedBy = u1.UserID
  LEFT JOIN Users u2 ON e.VerifiedBy = u2.UserID
  LEFT JOIN Users u3 ON e.ApprovedBy = u3.UserID
`

export const findAllEstimations = async (): Promise<Estimation[]> => {
  const pool = await poolPromise

  const result = await pool.request().query(`
    SELECT
      ${baseSelectColumns}
    ${baseFromClause}
    ORDER BY e.CreatedAt DESC
  `)

  return result.recordset as Estimation[]
}

export const findEstimationById = async (
  id: number
): Promise<Estimation | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('EstimationID', sql.Int, id)
    .query(`
      SELECT
        ${baseSelectColumns}
      ${baseFromClause}
      WHERE e.EstimationID = @EstimationID
    `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0] as Estimation
}

type InsertEstimationInput = {
  ClientID: number
  ProjectID: number
  Title: string
  Description?: string
  CreatedBy?: number
}

export const insertEstimation = async (
  input: InsertEstimationInput
): Promise<Estimation> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('ClientID', sql.Int, input.ClientID)
    .input('ProjectID', sql.Int, input.ProjectID)
    .input('Title', sql.NVarChar(255), input.Title)
    .input('Description', sql.NVarChar(sql.MAX), input.Description ?? null)
    .input('CreatedBy', sql.Int, input.CreatedBy ?? null)
    .query(`
      INSERT INTO Estimations (ClientID, ProjectID, Title, Description, Status, CreatedAt, CreatedBy)
      OUTPUT INSERTED.*
      VALUES (@ClientID, @ProjectID, @Title, @Description, 'Draft', GETDATE(), @CreatedBy)
    `)

  return result.recordset[0] as Estimation
}

type UpdateEstimationInput = {
  Title: string
  Description?: string
  ProjectID?: number | null
}

export const updateEstimation = async (
  id: number,
  input: UpdateEstimationInput
): Promise<Estimation | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('EstimationID', sql.Int, id)
    .input('Title', sql.NVarChar(255), input.Title)
    .input('Description', sql.NVarChar(sql.MAX), input.Description ?? null)
    .input('ProjectID', sql.Int, input.ProjectID ?? null)
    .query(`
      UPDATE Estimations
      SET
        Title = @Title,
        Description = @Description,
        ProjectID = @ProjectID
      WHERE EstimationID = @EstimationID;

      SELECT
        ${baseSelectColumns}
      ${baseFromClause}
      WHERE e.EstimationID = @EstimationID
    `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0] as Estimation
}

export const deleteEstimation = async (id: number): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('EstimationID', sql.Int, id)
    .query('DELETE FROM Estimations WHERE EstimationID = @EstimationID')

  const totalRows = Array.isArray(result.rowsAffected)
    ? result.rowsAffected.reduce((sum, value) => sum + value, 0)
    : 0

  return totalRows > 0
}

const addStatusesFilter = (
  filter: EstimationFilter,
  request: sql.Request,
  whereClauses: string[]
): void => {
  const statuses = filter.statuses

  if (statuses && statuses.length > 0) {
    const placeholders: string[] = []

    for (let index = 0; index < statuses.length; index++) {
      const status = statuses[index]
      const paramName = `Status${index}`

      placeholders.push(`@${paramName}`)
      request.input(paramName, sql.NVarChar(50), status)
    }

    whereClauses.push(`e.Status IN (${placeholders.join(', ')})`)
  }
}

const addClientsFilter = (
  filter: EstimationFilter,
  request: sql.Request,
  whereClauses: string[]
): void => {
  const clients = filter.clients

  if (clients && clients.length > 0) {
    const placeholders: string[] = []

    for (let index = 0; index < clients.length; index++) {
      const clientId = clients[index]
      const paramName = `Client${index}`

      placeholders.push(`@${paramName}`)
      request.input(paramName, sql.Int, clientId)
    }

    whereClauses.push(`e.ClientID IN (${placeholders.join(', ')})`)
  }
}

const addProjectsFilter = (
  filter: EstimationFilter,
  request: sql.Request,
  whereClauses: string[]
): void => {
  const projects = filter.projects

  if (projects && projects.length > 0) {
    const placeholders: string[] = []

    for (let index = 0; index < projects.length; index++) {
      const projectId = projects[index]
      const paramName = `Project${index}`

      placeholders.push(`@${paramName}`)
      request.input(paramName, sql.Int, projectId)
    }

    whereClauses.push(`e.ProjectID IN (${placeholders.join(', ')})`)
  }
}

const addSearchFilter = (
  filter: EstimationFilter,
  request: sql.Request,
  whereClauses: string[]
): void => {
  const search = filter.search?.trim()

  if (search && search.length > 0) {
    request.input('SearchTerm', sql.NVarChar(255), `%${search}%`)
    whereClauses.push(
      '(e.Title LIKE @SearchTerm OR e.Description LIKE @SearchTerm)'
    )
  }
}

export const filterEstimations = async (
  filter: EstimationFilter
): Promise<EstimationFilterResult> => {
  const pool = await poolPromise
  const request = pool.request()

  const whereClauses: string[] = []

  addStatusesFilter(filter, request, whereClauses)
  addClientsFilter(filter, request, whereClauses)
  addProjectsFilter(filter, request, whereClauses)
  addSearchFilter(filter, request, whereClauses)

  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 10
  const offset = (page - 1) * pageSize

  request.input('Offset', sql.Int, offset)
  request.input('Limit', sql.Int, pageSize)

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const result = await request.query(`
    WITH EstimationCTE AS (
      SELECT
        ${baseSelectColumns},
        COUNT(*) OVER() AS TotalCount
      ${baseFromClause}
      ${whereSql}
    )
    SELECT *
    FROM EstimationCTE
    ORDER BY CreatedAt DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limit ROWS ONLY
  `)

  const estimations = result.recordset as (Estimation & {
    TotalCount?: number
  })[]

  const first = estimations[0]
  const totalCount =
    estimations.length > 0 && typeof first?.TotalCount === 'number'
      ? first.TotalCount
      : 0

  return {
    estimations,
    totalCount
  }
}

export const getPastEstimations = async (): Promise<
  PastEstimationSummary[]
> => {
  const pool = await poolPromise

  const result = await pool.request().query(`
    SELECT 
      e.EstimationID,
      e.Title AS EstimationName,
      e.CreatedBy AS EstimatorID,
      u.FirstName + ' ' + u.LastName AS EstimatorName,
      e.CreatedAt,
      ISNULL(e.TotalMaterialCost, 0) + ISNULL(e.TotalLaborCost, 0) AS TotalEstimatedCost,
      COUNT(DISTINCT ei.EItemID) AS ItemCount,
      MAX(eq.ModifiedAt) AS LastModified
    FROM Estimations e
      LEFT JOIN Users u ON e.CreatedBy = u.UserID
      LEFT JOIN EstimationItems ei ON e.EstimationID = ei.EstimationID
      LEFT JOIN EstimationItemSupplierQuotes eq ON ei.EItemID = eq.ItemID
    GROUP BY 
      e.EstimationID,
      e.Title,
      e.CreatedBy,
      u.FirstName,
      u.LastName,
      e.CreatedAt,
      e.TotalMaterialCost,
      e.TotalLaborCost
    ORDER BY e.CreatedAt DESC
  `)

  return result.recordset as PastEstimationSummary[]
}
