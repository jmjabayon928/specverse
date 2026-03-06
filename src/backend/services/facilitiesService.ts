// src/backend/services/facilitiesService.ts
import {
  listFacilities as repoListFacilities,
  getFacilityById as repoGetFacilityById,
  listSystems as repoListSystems,
  getSystemById as repoGetSystemById,
  facilityBelongsToAccount as repoFacilityBelongsToAccount,
  systemBelongsToAccountAndFacility as repoSystemBelongsToAccountAndFacility,
  type FacilityRow,
  type SystemRow,
  type FacilitiesListFilters,
  type SystemsListFilters,
} from '../repositories/facilitiesRepository'

export async function listFacilities(
  accountId: number,
  filters: FacilitiesListFilters
): Promise<{ items: FacilityRow[]; total: number }> {
  return repoListFacilities(accountId, filters)
}

export async function getFacilityById(
  accountId: number,
  facilityId: number
): Promise<FacilityRow | null> {
  return repoGetFacilityById(accountId, facilityId)
}

export async function listSystems(
  accountId: number,
  facilityId: number,
  filters: SystemsListFilters
): Promise<{ items: SystemRow[]; total: number }> {
  return repoListSystems(accountId, facilityId, filters)
}

export async function getSystemById(
  accountId: number,
  facilityId: number,
  systemId: number
): Promise<SystemRow | null> {
  return repoGetSystemById(accountId, facilityId, systemId)
}

export async function facilityBelongsToAccount(
  facilityId: number,
  accountId: number
): Promise<boolean> {
  return repoFacilityBelongsToAccount(facilityId, accountId)
}

export async function systemBelongsToAccountAndFacility(
  systemId: number,
  accountId: number,
  facilityId: number
): Promise<boolean> {
  return repoSystemBelongsToAccountAndFacility(systemId, accountId, facilityId)
}
