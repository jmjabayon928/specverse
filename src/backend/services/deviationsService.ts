import { poolPromise } from '../config/db'
import { insertAuditLog } from '../database/auditQueries'
import {
  createDeviation as repoCreateDeviation,
  getDeviationById as repoGetDeviationById,
  listDeviations as repoListDeviations,
  updateDeviation as repoUpdateDeviation,
  transitionDeviation as repoTransitionDeviation,
  type CreateDeviationInput,
  type ListDeviationsFilters,
  type ListDeviationsResult,
  type DeviationRow,
  type UpdateDeviationPatch,
} from '../repositories/deviationsRepository'
import { getLifecycleStateId, assertAllowedTransition } from './lifecycle/lifecycleService'

const ENTITY_TYPE = 'Deviation' as const

export async function createDeviation(
  accountId: number,
  userId: number,
  input: CreateDeviationInput
): Promise<DeviationRow> {
  const pool = await poolPromise
  const openStateId = await getLifecycleStateId(pool, ENTITY_TYPE, 'OPEN')
  const deviationId = await repoCreateDeviation(accountId, userId, input, openStateId)
  await insertAuditLog({
    TableName: 'Deviations',
    RecordID: deviationId,
    Action: 'DEVIATION_CREATE',
    PerformedBy: userId,
    Changes: JSON.stringify({ title: input.title }),
  })
  const row = await repoGetDeviationById(accountId, deviationId)
  if (!row) throw new Error('Deviation not found after create')
  return row
}

export async function getDeviationById(
  accountId: number,
  id: number
): Promise<DeviationRow | null> {
  return repoGetDeviationById(accountId, id)
}

export async function listDeviations(
  accountId: number,
  filters: ListDeviationsFilters
): Promise<ListDeviationsResult> {
  return repoListDeviations(accountId, filters)
}

export async function updateDeviation(
  accountId: number,
  userId: number,
  id: number,
  patch: { title?: string; description?: string | null }
): Promise<DeviationRow | null> {
  const current = await repoGetDeviationById(accountId, id)
  if (!current) return null
  const updatePatch: UpdateDeviationPatch = {
    title: patch.title ?? current.title,
    description: patch.description !== undefined ? patch.description : current.description,
  }
  const updated = await repoUpdateDeviation(accountId, userId, id, updatePatch)
  if (!updated) return null
  await insertAuditLog({
    TableName: 'Deviations',
    RecordID: id,
    Action: 'DEVIATION_UPDATE',
    PerformedBy: userId,
    Changes: JSON.stringify({ title: updatePatch.title }),
  })
  return repoGetDeviationById(accountId, id)
}

export async function transitionDeviation(
  accountId: number,
  userId: number,
  id: number,
  toCode: string,
  note?: string | null
): Promise<DeviationRow | null> {
  const current = await repoGetDeviationById(accountId, id)
  if (!current) return null
  assertAllowedTransition(ENTITY_TYPE, current.lifecycleCode, toCode)
  const toStateId = await getLifecycleStateId(await poolPromise, ENTITY_TYPE, toCode)
  await repoTransitionDeviation(
    accountId,
    userId,
    id,
    current.lifecycleStateId,
    toStateId,
    note
  )
  await insertAuditLog({
    TableName: 'Deviations',
    RecordID: id,
    Action: 'DEVIATION_TRANSITION',
    PerformedBy: userId,
    Changes: JSON.stringify({ from: current.lifecycleCode, to: toCode }),
  })
  return repoGetDeviationById(accountId, id)
}
