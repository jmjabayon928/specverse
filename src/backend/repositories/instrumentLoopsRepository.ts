// src/backend/repositories/instrumentLoopsRepository.ts
import { poolPromise, sql } from '../config/db'

export type InstrumentLoopRow = {
  loopId: number
  loopTag: string
  loopTagNorm: string | null
  service: string | null
  system: string | null
  status: string
  accountId: number | null
  createdAt: Date
  updatedAt: Date
  lockedAt: Date | null
  lockedBy: number | null
}

export type InstrumentLoopMemberRow = {
  instrumentLoopMemberId: number
  accountId: number
  loopId: number
  instrumentId: number
  role: string | null
  createdAt: Date
  createdBy: number | null
}

export type LoopWithMembersRow = InstrumentLoopRow & {
  members: Array<{ instrumentId: number; instrumentTag: string; role: string | null }>
}

export async function listByAccount(accountId: number): Promise<InstrumentLoopRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .query(`
      SELECT LoopID AS loopId, LoopTag AS loopTag, LoopTagNorm AS loopTagNorm,
             Service AS service, System AS [system], Status AS status,
             AccountID AS accountId, CreatedAt AS createdAt, UpdatedAt AS updatedAt,
             LockedAt AS lockedAt, LockedBy AS lockedBy
      FROM dbo.InstrumentLoops
      WHERE AccountID = @AccountID
      ORDER BY LoopTagNorm, LoopID
    `)
  return result.recordset as InstrumentLoopRow[]
}

export async function getById(accountId: number, loopId: number): Promise<InstrumentLoopRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('LoopID', sql.Int, loopId)
    .query(`
      SELECT LoopID AS loopId, LoopTag AS loopTag, LoopTagNorm AS loopTagNorm,
             Service AS service, System AS [system], Status AS status,
             AccountID AS accountId, CreatedAt AS createdAt, UpdatedAt AS updatedAt,
             LockedAt AS lockedAt, LockedBy AS lockedBy
      FROM dbo.InstrumentLoops
      WHERE LoopID = @LoopID AND AccountID = @AccountID
    `)
  if (result.recordset.length === 0) return null
  return result.recordset[0] as InstrumentLoopRow
}

export async function listMembersByLoop(
  accountId: number,
  loopId: number
): Promise<InstrumentLoopMemberRow[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('LoopID', sql.Int, loopId)
    .query(`
      SELECT ilm.InstrumentLoopMemberID AS instrumentLoopMemberId, ilm.AccountID AS accountId,
             ilm.LoopID AS loopId, ilm.InstrumentID AS instrumentId, ilm.Role AS role,
             ilm.CreatedAt AS createdAt, ilm.CreatedBy AS createdBy
      FROM dbo.InstrumentLoopMembers ilm
      WHERE ilm.AccountID = @AccountID AND ilm.LoopID = @LoopID
      ORDER BY ilm.InstrumentLoopMemberID
    `)
  return result.recordset as InstrumentLoopMemberRow[]
}

export async function getByIdWithMembers(
  accountId: number,
  loopId: number
): Promise<LoopWithMembersRow | null> {
  const loop = await getById(accountId, loopId)
  if (!loop) return null
  const members = await listMembersByLoop(accountId, loopId)
  const pool = await poolPromise
  const memberDetails: LoopWithMembersRow['members'] = []
  for (const m of members) {
    const r = await pool
      .request()
      .input('AccountID', sql.Int, accountId)
      .input('InstrumentID', sql.Int, m.instrumentId)
      .query(`
        SELECT InstrumentTag AS instrumentTag FROM dbo.Instruments
        WHERE InstrumentID = @InstrumentID AND AccountID = @AccountID
      `)
    const tag = (r.recordset[0] as { instrumentTag: string } | undefined)?.instrumentTag ?? ''
    memberDetails.push({ instrumentId: m.instrumentId, instrumentTag: tag, role: m.role })
  }
  return { ...loop, members: memberDetails }
}
