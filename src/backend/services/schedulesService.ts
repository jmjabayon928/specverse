// src/backend/services/schedulesService.ts
import { AppError } from '../errors/AppError'
import { runInTransaction } from './filledSheetService'
import { sheetBelongsToAccount } from './sheetAccessService'
import { assetBelongsToAccount } from '../repositories/assetsRepository'
import {
  listSchedules,
  countSchedules,
  searchSheetOptions as repoSearchSheetOptions,
  searchFacilityOptions as repoSearchFacilityOptions,
  searchSpaceOptions as repoSearchSpaceOptions,
  searchSystemOptions as repoSearchSystemOptions,
  facilityBelongsToAccount,
  spaceBelongsToAccountAndFacility,
  systemBelongsToAccountAndFacility,
  getScheduleDetail,
  getScheduleById,
  getScheduleColumns,
  createSchedule as repoCreateSchedule,
  updateSchedule as repoUpdateSchedule,
  replaceScheduleColumns as repoReplaceColumns,
  replaceScheduleEntries as repoReplaceEntries,
  type SchedulesListFilters,
  type SheetOptionRow,
  type FacilityOptionRow,
  type SpaceOptionRow,
  type SystemOptionRow,
  type ColumnInput,
  type EntryInput,
} from '../repositories/schedulesRepository'
import type {
  ScheduleHeader,
  ScheduleDetail,
  CreateScheduleBody,
  PatchScheduleBody,
} from '@/domain/schedules/scheduleTypes'

export async function list(
  accountId: number,
  filters: SchedulesListFilters,
  pagination?: { page: number; limit: number }
): Promise<ScheduleHeader[]> {
  const page = pagination?.page ?? 1
  const limit = pagination?.limit ?? 25
  return listSchedules(accountId, filters, page, limit)
}

export async function count(
  accountId: number,
  filters: SchedulesListFilters
): Promise<number> {
  return countSchedules(accountId, filters)
}

export async function searchSheetOptions(
  accountId: number,
  params: { q: string; limit: number }
): Promise<SheetOptionRow[]> {
  return repoSearchSheetOptions(accountId, params.q, params.limit)
}

export async function searchFacilityOptions(
  accountId: number,
  params: { q: string; limit: number }
): Promise<FacilityOptionRow[]> {
  return repoSearchFacilityOptions(accountId, params.q, params.limit)
}

export async function searchSpaceOptions(
  accountId: number,
  params: { facilityId: number; q: string; limit: number }
): Promise<SpaceOptionRow[]> {
  return repoSearchSpaceOptions(accountId, params.facilityId, params.q, params.limit)
}

export async function searchSystemOptions(
  accountId: number,
  params: { facilityId: number; q: string; limit: number }
): Promise<SystemOptionRow[]> {
  return repoSearchSystemOptions(accountId, params.facilityId, params.q, params.limit)
}

export async function getDetail(
  accountId: number,
  scheduleId: number
): Promise<ScheduleDetail | null> {
  return getScheduleDetail(accountId, scheduleId)
}

export async function createSchedule(
  accountId: number,
  body: CreateScheduleBody,
  userId: number
): Promise<ScheduleHeader> {
  const clientId = body.clientId ?? null
  const projectId = body.projectId ?? null
  const facilityId = body.facilityId ?? null
  const spaceId = body.spaceId ?? null
  const systemId = body.systemId ?? null

  // Validation: if spaceId or systemId provided, facilityId must also be provided
  if ((spaceId != null || systemId != null) && facilityId == null) {
    throw new AppError('FacilityID is required when SpaceID or SystemID is provided', 400)
  }

  // Validate facility belongs to account
  if (facilityId != null) {
    const belongs = await facilityBelongsToAccount(facilityId, accountId)
    if (!belongs) {
      throw new AppError('Facility not found or does not belong to account', 404)
    }
  }

  // Validate space belongs to account and facility
  if (spaceId != null && facilityId != null) {
    const belongs = await spaceBelongsToAccountAndFacility(spaceId, accountId, facilityId)
    if (!belongs) {
      throw new AppError('Space not found or does not belong to facility', 404)
    }
  }

  // Validate system belongs to account and facility
  if (systemId != null && facilityId != null) {
    const belongs = await systemBelongsToAccountAndFacility(systemId, accountId, facilityId)
    if (!belongs) {
      throw new AppError('System not found or does not belong to facility', 404)
    }
  }

  return repoCreateSchedule({
    accountId,
    disciplineId: body.disciplineId,
    subtypeId: body.subtypeId,
    name: body.name,
    ...(body.scope !== undefined && { scope: body.scope }),
    clientId,
    projectId,
    ...(body.facilityId !== undefined && { facilityId }),
    ...(body.spaceId !== undefined && { spaceId }),
    ...(body.systemId !== undefined && { systemId }),
    createdBy: userId,
    updatedBy: userId,
  })
}

export async function patchSchedule(
  accountId: number,
  scheduleId: number,
  body: PatchScheduleBody,
  userId: number
): Promise<void> {
  const schedule = await getScheduleById(accountId, scheduleId)
  if (!schedule) {
    throw new AppError('Schedule not found', 404)
  }

  // Determine facilityId: use provided value, or existing schedule value, or null
  const facilityId = body.facilityId !== undefined ? body.facilityId : schedule.facilityId
  const spaceId = body.spaceId !== undefined ? body.spaceId : null
  const systemId = body.systemId !== undefined ? body.systemId : null

  // Validation: if spaceId or systemId provided, facilityId must also be provided
  if ((spaceId != null || systemId != null) && facilityId == null) {
    throw new AppError('FacilityID is required when SpaceID or SystemID is provided', 400)
  }

  // Validate facility belongs to account (if provided)
  if (body.facilityId !== undefined && body.facilityId != null) {
    const belongs = await facilityBelongsToAccount(body.facilityId, accountId)
    if (!belongs) {
      throw new AppError('Facility not found or does not belong to account', 404)
    }
  }

  // Validate space belongs to account and facility (if provided)
  if (body.spaceId !== undefined && body.spaceId != null && facilityId != null) {
    const belongs = await spaceBelongsToAccountAndFacility(body.spaceId, accountId, facilityId)
    if (!belongs) {
      throw new AppError('Space not found or does not belong to facility', 404)
    }
  }

  // Validate system belongs to account and facility (if provided)
  if (body.systemId !== undefined && body.systemId != null && facilityId != null) {
    const belongs = await systemBelongsToAccountAndFacility(body.systemId, accountId, facilityId)
    if (!belongs) {
      throw new AppError('System not found or does not belong to facility', 404)
    }
  }

  await repoUpdateSchedule(
    accountId,
    scheduleId,
    body.name,
    body.scope,
    body.facilityId,
    body.spaceId,
    body.systemId,
    userId
  )
}

export async function replaceColumns(
  accountId: number,
  scheduleId: number,
  columns: ColumnInput[],
  userId: number
): Promise<ScheduleDetail['columns']> {
  const schedule = await getScheduleById(accountId, scheduleId)
  if (!schedule) {
    throw new AppError('Schedule not found', 404)
  }
  try {
    return await runInTransaction(async (tx) => {
      return repoReplaceColumns(tx, accountId, scheduleId, columns, userId)
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE_COLUMN_KEY') {
      throw new AppError('Duplicate column key for this schedule', 409)
    }
    throw err
  }
}

export async function replaceEntries(
  accountId: number,
  scheduleId: number,
  entries: EntryInput[],
  userId: number
): Promise<void> {
  const schedule = await getScheduleById(accountId, scheduleId)
  if (!schedule) {
    throw new AppError('Schedule not found', 404)
  }
  const columns = await getScheduleColumns(accountId, scheduleId)
  const columnKeyToId = new Map(columns.map(c => [c.columnKey, c.scheduleColumnId]))

  for (const e of entries) {
    const belongs = await assetBelongsToAccount(e.assetId, accountId)
    if (!belongs) {
      throw new AppError('Asset not found or does not belong to account', 404)
    }
    if (e.sheetId != null && e.sheetId > 0) {
      const sheetBelongs = await sheetBelongsToAccount(e.sheetId, accountId)
      if (!sheetBelongs) {
        throw new AppError('Sheet not found or does not belong to account', 404)
      }
    }
    for (const v of e.values) {
      if (!columnKeyToId.has(v.columnKey)) {
        throw new AppError(`Unknown columnKey: ${v.columnKey}`, 400)
      }
    }
  }

  const assetIds = entries.map(e => e.assetId)
  if (new Set(assetIds).size !== assetIds.length) {
    throw new AppError('Duplicate assetId in entries.', 400)
  }

  try {
    await runInTransaction(async (tx) => {
      await repoReplaceEntries(tx, accountId, scheduleId, entries, columnKeyToId, userId, userId)
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNKNOWN_COLUMN_KEY') {
      throw new AppError('Unknown columnKey in entry values', 400)
    }
    if (err instanceof Error && err.message === 'MULTIPLE_VALUES_PER_CELL') {
      throw new AppError('Only one typed value per cell allowed', 400)
    }
    throw err
  }
}
