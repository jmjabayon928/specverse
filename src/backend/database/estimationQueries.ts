// src/backend/database/estimationQueries.ts
import type { Estimation } from '@/domain/estimations/estimationTypes'
import {
  filterEstimations,
  findAllEstimations,
  findEstimationById,
  insertEstimation,
  updateEstimation as repoUpdateEstimation,
  type EstimationFilter,
  type EstimationFilterResult
} from '../repositories/estimationRepository'

export const getAllEstimations = async (): Promise<Estimation[]> => {
  return findAllEstimations()
}

export const getEstimationById = async (
  id: number
): Promise<Estimation | null> => {
  return findEstimationById(id)
}

export const createEstimation = async (data: {
  ProjectID: number
  Title: string
  Description?: string
  CreatedBy?: number
  ClientID: number
}): Promise<Estimation> => {
  return insertEstimation({
    ClientID: data.ClientID,
    ProjectID: data.ProjectID,
    Title: data.Title,
    Description: data.Description,
    CreatedBy: data.CreatedBy
  })
}

export const updateEstimation = async (
  estimationId: number,
  data: {
    Title: string
    Description?: string
    ProjectID?: number
  }
): Promise<Estimation | null> => {
  return repoUpdateEstimation(estimationId, {
    Title: data.Title,
    Description: data.Description,
    ProjectID: data.ProjectID ?? null
  })
}

// Used by export service to fetch a large filtered set without pagination
export const getFilteredEstimations = async (
  statuses: string[],
  clients: number[],
  projects: number[],
  search: string
): Promise<Estimation[]> => {
  const filter: EstimationFilter = {
    statuses,
    clients,
    projects,
    search,
    page: 1,
    pageSize: 10000
  }

  const result: EstimationFilterResult = await filterEstimations(filter)
  return result.estimations
}

// Used by /api/backend/estimation/filter to support pagination
export const getFilteredEstimationsWithPagination = async (
  statuses: string[],
  clients: number[],
  projects: number[],
  search: string,
  page: number,
  pageSize: number
): Promise<EstimationFilterResult> => {
  const filter: EstimationFilter = {
    statuses,
    clients,
    projects,
    search,
    page,
    pageSize
  }

  return filterEstimations(filter)
}
