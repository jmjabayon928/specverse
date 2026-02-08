// src/backend/services/instrumentLoopsService.ts
import { AppError } from '../errors/AppError'
import {
  listByAccount,
  getById,
  getByIdWithMembers,
  type InstrumentLoopRow,
  type LoopWithMembersRow,
} from '../repositories/instrumentLoopsRepository'

export type { InstrumentLoopRow, LoopWithMembersRow }

export async function listLoops(accountId: number): Promise<InstrumentLoopRow[]> {
  return listByAccount(accountId)
}

export async function getLoopWithMembers(
  accountId: number,
  loopId: number
): Promise<LoopWithMembersRow | null> {
  const loop = await getByIdWithMembers(accountId, loopId)
  if (!loop) {
    throw new AppError('Loop not found', 404)
  }
  return loop
}

export async function getLoop(accountId: number, loopId: number): Promise<InstrumentLoopRow | null> {
  return getById(accountId, loopId)
}
