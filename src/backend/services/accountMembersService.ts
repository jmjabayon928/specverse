// src/backend/services/accountMembersService.ts
import {
  listMembers as repoList,
  getMemberInAccount,
  countActiveAdminsInAccount,
  countActiveOwnersInAccount,
  updateMemberRole as repoUpdateRole,
  updateMemberStatus as repoUpdateStatus,
  type AccountMemberRow,
} from '../repositories/accountMembersRepository'
import { getAccountById } from '../repositories/accountsRepository'
import { isAdminRole } from '../utils/roleUtils'
import { logAuditAction } from '../utils/logAuditAction'

export type AccountMembersAuditContext = {
  performedBy: number
  route: string | null
  method: string | null
}

export type MemberDto = {
  accountMemberId: number
  userId: number
  email: string | null
  firstName: string | null
  lastName: string | null
  roleId: number
  roleName: string
  isActive: boolean
  isOwner: boolean
  createdAt: string
  updatedAt: string
}

function toDto(row: AccountMemberRow): MemberDto {
  return {
    accountMemberId: row.accountMemberId,
    userId: row.userId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    roleId: row.roleId,
    roleName: row.roleName,
    isActive: row.isActive,
    isOwner: row.isOwner,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  }
}

export async function listMembers(accountId: number): Promise<MemberDto[]> {
  const rows = await repoList(accountId)
  return rows.map(toDto)
}

/**
 * Updates role. Throws if member not in account (404) or last-admin demotion (403).
 */
export async function updateMemberRole(
  accountId: number,
  accountMemberId: number,
  roleId: number,
  audit?: AccountMembersAuditContext,
): Promise<MemberDto> {
  const member = await getMemberInAccount(accountId, accountMemberId)
  if (!member) {
    const err = new Error('Account member not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }

  const adminCount = await countActiveAdminsInAccount(accountId)
  const isDemotingAdmin = isAdminRole(member.roleName) && member.roleId !== roleId
  if (isDemotingAdmin && adminCount <= 1) {
    const err = new Error('Cannot demote the last active Admin in the account')
    ;(err as Error & { statusCode?: number }).statusCode = 403
    throw err
  }

  const fromRoleId = member.roleId
  await repoUpdateRole(accountId, accountMemberId, roleId)
  const updated = await getMemberInAccount(accountId, accountMemberId)
  if (!updated) {
    const err = new Error('Account member not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }

  if (audit && fromRoleId !== roleId) {
    await logAuditAction({
      tableName: 'AccountMembers',
      recordId: accountMemberId,
      action: 'member.role_changed',
      performedBy: audit.performedBy,
      route: audit.route,
      method: audit.method,
      statusCode: 200,
      changes: { targetUserId: member.userId, fromRoleId, toRoleId: roleId },
    })
  }

  return toDto(updated)
}

/**
 * Updates status. Throws if member not in account (404) or last-admin deactivation (403).
 */
export async function updateMemberStatus(
  accountId: number,
  accountMemberId: number,
  isActive: boolean,
  audit?: AccountMembersAuditContext,
): Promise<MemberDto> {
  const member = await getMemberInAccount(accountId, accountMemberId)
  if (!member) {
    const err = new Error('Account member not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }

  const account = await getAccountById(accountId)
  const isDeactivating = member.isActive && !isActive
  if (
    account?.ownerUserId != null &&
    member.userId === account.ownerUserId &&
    isDeactivating
  ) {
    const err = new Error('Cannot deactivate the account owner; transfer ownership first.')
    ;(err as Error & { statusCode?: number }).statusCode = 403
    throw err
  }

  const adminCount = await countActiveAdminsInAccount(accountId)
  const isDeactivatingAdmin = isAdminRole(member.roleName) && member.isActive && !isActive
  if (isDeactivatingAdmin && adminCount <= 1) {
    const err = new Error('Cannot deactivate the last active Admin in the account')
    ;(err as Error & { statusCode?: number }).statusCode = 403
    throw err
  }

  const ownerCount = await countActiveOwnersInAccount(accountId)
  const isDeactivatingOwner = member.isOwner && member.isActive && !isActive
  if (isDeactivatingOwner && ownerCount <= 1) {
    const err = new Error('Cannot deactivate the last active Owner in the account')
    ;(err as Error & { statusCode?: number }).statusCode = 403
    throw err
  }

  const fromIsActive = member.isActive
  await repoUpdateStatus(accountId, accountMemberId, isActive)
  const updated = await getMemberInAccount(accountId, accountMemberId)
  if (!updated) {
    const err = new Error('Account member not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }

  if (audit && fromIsActive !== isActive) {
    const action =
      fromIsActive === true && isActive === false
        ? 'member.deactivated'
        : fromIsActive === false && isActive === true
          ? 'member.reactivated'
          : null

    if (action) {
      await logAuditAction({
        tableName: 'AccountMembers',
        recordId: accountMemberId,
        action,
        performedBy: audit.performedBy,
        route: audit.route,
        method: audit.method,
        statusCode: 200,
        changes: { targetUserId: member.userId, fromIsActive, toIsActive: isActive },
      })
    }
  }

  return toDto(updated)
}
