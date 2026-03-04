import type { ConnectionPool } from 'mssql'
import { sql } from '../../config/db'
import { AppError } from '../../errors/AppError'
import type { LifecycleEntityType } from './lifecycleTypes'
import { allowedTransitions } from './lifecycleTypes'

export async function getLifecycleStateId(
  pool: ConnectionPool,
  entityType: LifecycleEntityType,
  code: string
): Promise<number> {
  const result = await pool
    .request()
    .input('EntityType', sql.NVarChar(40), entityType)
    .input('Code', sql.VarChar(30), code)
    .query<{ LifecycleStateID: number }>(`
      SELECT LifecycleStateID
      FROM dbo.LifecycleStates
      WHERE EntityType = @EntityType AND Code = @Code
    `)
  const row = result.recordset?.[0]
  if (!row) {
    throw new AppError(`Lifecycle state not found: ${entityType}/${code}`, 400)
  }
  return row.LifecycleStateID
}

export function assertAllowedTransition(
  entityType: LifecycleEntityType,
  fromCode: string,
  toCode: string
): void {
  const map = allowedTransitions[entityType]
  if (!map) {
    throw new AppError(`Unknown entity type: ${entityType}`, 400)
  }
  const allowed = map[fromCode]
  if (allowed === undefined) {
    throw new AppError(`Invalid from state: ${fromCode}`, 400)
  }
  if (!allowed.includes(toCode)) {
    throw new AppError(`Transition not allowed: ${fromCode} -> ${toCode}`, 400)
  }
}
