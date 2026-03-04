import { poolPromise } from '../config/db'
import { insertAuditLog } from '../database/auditQueries'
import {
  createSubmittal as repoCreateSubmittal,
  getSubmittalById as repoGetSubmittalById,
  listSubmittals as repoListSubmittals,
  updateSubmittal as repoUpdateSubmittal,
  transitionSubmittal as repoTransitionSubmittal,
  type CreateSubmittalInput,
  type ListSubmittalsFilters,
  type ListSubmittalsResult,
  type SubmittalRow,
  type UpdateSubmittalPatch,
} from '../repositories/submittalsRepository'
import { getLifecycleStateId, assertAllowedTransition } from './lifecycle/lifecycleService'

const ENTITY_TYPE = 'Submittal' as const

export async function createSubmittal(
  accountId: number,
  userId: number,
  input: CreateSubmittalInput
): Promise<SubmittalRow> {
  const pool = await poolPromise
  const draftStateId = await getLifecycleStateId(pool, ENTITY_TYPE, 'DRAFT')
  const submittalId = await repoCreateSubmittal(accountId, userId, input, draftStateId)
  await insertAuditLog({
    TableName: 'Submittals',
    RecordID: submittalId,
    Action: 'SUBMITTAL_CREATE',
    PerformedBy: userId,
    Changes: JSON.stringify({ title: input.title }),
  })
  const row = await repoGetSubmittalById(accountId, submittalId)
  if (!row) throw new Error('Submittal not found after create')
  return row
}

export async function getSubmittalById(
  accountId: number,
  id: number
): Promise<SubmittalRow | null> {
  return repoGetSubmittalById(accountId, id)
}

export async function listSubmittals(
  accountId: number,
  filters: ListSubmittalsFilters
): Promise<ListSubmittalsResult> {
  return repoListSubmittals(accountId, filters)
}

export async function updateSubmittal(
  accountId: number,
  userId: number,
  id: number,
  patch: { title?: string; description?: string | null }
): Promise<SubmittalRow | null> {
  const current = await repoGetSubmittalById(accountId, id)
  if (!current) return null
  const updatePatch: UpdateSubmittalPatch = {
    title: patch.title ?? current.title,
    description: patch.description !== undefined ? patch.description : current.description,
  }
  const updated = await repoUpdateSubmittal(accountId, userId, id, updatePatch)
  if (!updated) return null
  await insertAuditLog({
    TableName: 'Submittals',
    RecordID: id,
    Action: 'SUBMITTAL_UPDATE',
    PerformedBy: userId,
    Changes: JSON.stringify({ title: updatePatch.title }),
  })
  return repoGetSubmittalById(accountId, id)
}

export async function transitionSubmittal(
  accountId: number,
  userId: number,
  id: number,
  toCode: string,
  note?: string | null
): Promise<SubmittalRow | null> {
  const current = await repoGetSubmittalById(accountId, id)
  if (!current) return null
  assertAllowedTransition(ENTITY_TYPE, current.lifecycleCode, toCode)
  const toStateId = await getLifecycleStateId(await poolPromise, ENTITY_TYPE, toCode)
  await repoTransitionSubmittal(
    accountId,
    userId,
    id,
    current.lifecycleStateId,
    toStateId,
    note
  )
  await insertAuditLog({
    TableName: 'Submittals',
    RecordID: id,
    Action: 'SUBMITTAL_TRANSITION',
    PerformedBy: userId,
    Changes: JSON.stringify({ from: current.lifecycleCode, to: toCode }),
  })
  return repoGetSubmittalById(accountId, id)
}
