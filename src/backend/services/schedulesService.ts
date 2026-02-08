// src/backend/services/schedulesService.ts
import { AppError } from '../errors/AppError'
import { runInTransaction } from './filledSheetService'
import { sheetBelongsToAccount } from './sheetAccessService'
import { assetBelongsToAccount } from '../repositories/assetsRepository'
import {
  listSchedules,
  getScheduleDetail,
  getScheduleById,
  getScheduleColumns,
  createSchedule as repoCreateSchedule,
  updateSchedule as repoUpdateSchedule,
  replaceScheduleColumns as repoReplaceColumns,
  replaceScheduleEntries as repoReplaceEntries,
  type SchedulesListFilters,
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
  filters: SchedulesListFilters
): Promise<ScheduleHeader[]> {
  return listSchedules(accountId, filters)
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
  const scope = body.scope ?? null
  const clientId = body.clientId ?? null
  const projectId = body.projectId ?? null
  return repoCreateSchedule({
    accountId,
    disciplineId: body.disciplineId,
    subtypeId: body.subtypeId,
    name: body.name,
    scope,
    clientId,
    projectId,
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
  await repoUpdateSchedule(
    accountId,
    scheduleId,
    body.name,
    body.scope,
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
