// src/backend/services/accountMembersService.ts
import {
  listMembers as repoList,
  getMemberInAccount,
  countActiveAdminsInAccount,
  updateMemberRole as repoUpdateRole,
  updateMemberStatus as repoUpdateStatus,
  type AccountMemberRow,
} from '../repositories/accountMembersRepository'
import { isAdminRole } from '../utils/roleUtils'

export type MemberDto = {
  accountMemberId: number
  userId: number
  email: string | null
  firstName: string | null
  lastName: string | null
  roleId: number
  roleName: string
  isActive: boolean
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

  await repoUpdateRole(accountId, accountMemberId, roleId)
  const updated = await getMemberInAccount(accountId, accountMemberId)
  if (!updated) {
    const err = new Error('Account member not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
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
): Promise<MemberDto> {
  const member = await getMemberInAccount(accountId, accountMemberId)
  if (!member) {
    const err = new Error('Account member not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }

  const adminCount = await countActiveAdminsInAccount(accountId)
  const isDeactivatingAdmin = isAdminRole(member.roleName) && member.isActive && !isActive
  if (isDeactivatingAdmin && adminCount <= 1) {
    const err = new Error('Cannot deactivate the last active Admin in the account')
    ;(err as Error & { statusCode?: number }).statusCode = 403
    throw err
  }

  await repoUpdateStatus(accountId, accountMemberId, isActive)
  const updated = await getMemberInAccount(accountId, accountMemberId)
  if (!updated) {
    const err = new Error('Account member not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }
  return toDto(updated)
}
