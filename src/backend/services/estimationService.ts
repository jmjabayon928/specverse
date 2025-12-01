// src/backend/services/estimationService.ts

import type {
  Estimation
} from '@/domain/estimations/estimationTypes'

import { AppError } from '../errors/AppError'
import {
  getAllEstimations,
  getEstimationById,
  createEstimation,
  updateEstimation,
  getFilteredEstimationsWithPagination
} from '../database/estimationQueries'
import { poolPromise, sql } from '../config/db'

export type EstimationFilterInput = {
  statuses?: string[]
  clientIds?: number[]
  projectIds?: number[]
  search?: string
  page?: number
  pageSize?: number
}

// This matches the structure already used in the frontend
export type EstimationFilterResult = {
  data: Estimation[]
  totalCount: number
}

/**
 * List all estimations (used by useEstimationData)
 */
export const listEstimations = async (): Promise<Estimation[]> => {
  const rows = await getAllEstimations()
  return rows as Estimation[]
}

/**
 * Get a single estimation by id
 */
export const getEstimation = async (id: number): Promise<Estimation> => {
  if (!Number.isFinite(id) || id <= 0) {
    throw new AppError('Invalid estimation id', 400)
  }

  const row = await getEstimationById(id)

  if (!row) {
    throw new AppError('Estimation not found', 404)
  }

  return row as Estimation
}

type CreateEstimationInput = {
  clientId: number
  projectId: number
  title: string
  description?: string
  createdBy?: number
}

/**
 * Create new estimation
 * (used by EstimationForm in `mode="create"`)
 */
export const createEstimationRecord = async (
  input: CreateEstimationInput
): Promise<Estimation> => {
  const { clientId, projectId, title, description, createdBy } = input

  if (!clientId || !projectId || title?.trim()?.length === 0) {
    throw new AppError('Client, project and title are required', 400)
  }

  const row = await createEstimation({
    ClientID: clientId,
    ProjectID: projectId,
    Title: title.trim(),
    Description: description,
    CreatedBy: createdBy
  })

  return row as Estimation
}

type UpdateEstimationInput = {
  title: string
  description?: string
  projectId?: number
}

/**
 * Update an existing estimation
 * (used by EstimationForm in `mode="edit"`)
 */
export const updateEstimationRecord = async (
  id: number,
  input: UpdateEstimationInput
): Promise<Estimation> => {
  if (!Number.isFinite(id) || id <= 0) {
    throw new AppError('Invalid estimation id', 400)
  }

  if (input.title?.trim()?.length === 0) {
    throw new AppError('Title is required', 400)
  }

  const row = await updateEstimation(id, {
    Title: input.title.trim(),
    Description: input.description,
    ProjectID: input.projectId
  })

  if (!row) {
    throw new AppError('Estimation not found', 404)
  }

  return row as Estimation
}

/**
 * Delete an estimation by id
 * (used by EstimationTable delete button)
 *
 * Note: this mirrors the existing controller behavior (simple delete).
 * If you want explicit cascading deletes here, we can extend this later.
 */
export const deleteEstimationRecord = async (id: number): Promise<void> => {
  if (!Number.isFinite(id) || id <= 0) {
    throw new AppError('Invalid estimation id', 400)
  }

  const pool = await poolPromise
  const result = await pool.request()
    .input('EstimationID', sql.Int, id)
    .query('DELETE FROM Estimations WHERE EstimationID = @EstimationID')

  const rowsAffected = Array.isArray(result.rowsAffected)
    ? result.rowsAffected.reduce((sum, n) => sum + n, 0)
    : 0

  if (rowsAffected === 0) {
    throw new AppError('Estimation not found', 404)
  }
}

/**
 * Filter + paginate estimations.
 * This matches the payload used by `/api/backend/estimation/filter`
 * in `src/app/(admin)/estimation/page.tsx`.
 */
export const filterEstimations = async (
  input: EstimationFilterInput
): Promise<EstimationFilterResult> => {
  const {
    statuses = [],
    clientIds = [],
    projectIds = [],
    search = '',
    page = 1,
    pageSize = 10
  } = input

  if (page <= 0 || pageSize <= 0) {
    throw new AppError('Page and pageSize must be positive', 400)
  }

  const { estimations, totalCount } = await getFilteredEstimationsWithPagination(
    statuses,
    clientIds,
    projectIds,
    search,
    page,
    pageSize
  )

  return {
    data: estimations as Estimation[],
    totalCount
  }
}

/**
 * Past estimations summary for `/api/backend/estimation/history`
 */
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

export const getPastEstimations = async (): Promise<PastEstimationSummary[]> => {
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
