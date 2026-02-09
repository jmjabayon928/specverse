import { poolPromise, sql } from '../config/db'
import {
  getAccountById,
  updateAccount,
  updateAccountOwner,
} from '../repositories/accountsRepository'
import {
  clearAccountMemberOwnerFlags,
  getMemberByAccountAndUser,
  setMemberIsOwner,
} from '../repositories/accountMembersRepository'

type StatusCodeError = Error & { statusCode?: number }
function err(message: string, statusCode: number): StatusCodeError {
  const e = new Error(message) as StatusCodeError
  e.statusCode = statusCode
  return e
}

export type GovernanceStatusResult = { isActive: boolean }
export type GovernanceTransferResult = { ownerUserId: number | null }
export type GovernanceSoftDeleteResult = { isActive: false }

export async function updateAccountStatus(
  accountId: number,
  isActive: boolean,
): Promise<GovernanceStatusResult> {
  const updated = await updateAccount(accountId, { isActive })
  if (!updated) throw err('Account not found', 404)
  return { isActive: updated.isActive }
}

export async function transferOwnership(
  accountId: number,
  currentOwnerUserId: number | null,
  targetUserId: number,
): Promise<GovernanceTransferResult> {
  if (targetUserId === currentOwnerUserId) {
    throw err('Target user is already the owner', 400)
  }
  const targetMember = await getMemberByAccountAndUser(accountId, targetUserId)
  if (!targetMember) throw err('Target user is not a member of this account', 404)
  if (!targetMember.isActive) throw err('Target member is not active', 400)

  const account = await getAccountById(accountId)
  if (!account) throw err('Account not found', 404)

  const pool = await poolPromise
  const transaction = new sql.Transaction(pool)
  let didBegin = false
  let didCommit = false
  try {
    await transaction.begin()
    didBegin = true
    await updateAccountOwner(accountId, targetUserId, transaction)
    await clearAccountMemberOwnerFlags(accountId, transaction)
    await setMemberIsOwner(accountId, targetMember.accountMemberId, true, transaction)
    await transaction.commit()
    didCommit = true
    return { ownerUserId: targetUserId }
  } catch (error) {
    if (didBegin && !didCommit) {
      try {
        await transaction.rollback()
      } catch (rollbackErr: unknown) {
        console.error('rollback failed', rollbackErr)
      }
    }
    throw error
  }
}

export async function softDeleteAccount(accountId: number): Promise<GovernanceSoftDeleteResult> {
  const updated = await updateAccount(accountId, { isActive: false })
  if (!updated) throw err('Account not found', 404)
  return { isActive: false }
}
