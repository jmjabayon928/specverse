// src/backend/services/invitesService.ts
import {
  createInvite,
  findPendingByAccountAndEmail,
  listPendingByAccount,
  listByAccount,
  findByTokenHash,
  getByIdAndAccount,
  updateTokenAndIncrementSend,
  setStatusRevoked,
  setStatusAcceptedIfPending,
  setStatusDeclined,
  type InviteRowWithDetails,
  type InviteListScope,
} from '../repositories/invitesRepository'
import { getMemberByAccountAndUser, insertAccountMember, updateMemberRole, updateMemberStatus } from '../repositories/accountMembersRepository'
import { setActiveAccount } from '../repositories/userActiveAccountRepository'
import { listRoleIdsAndNames } from '../repositories/rolesRepository'
import { getAccountNameById } from '../repositories/accountsRepository'
import { getUserByEmail } from '../database/userQueries'
import { createUser, updateUser } from './usersService'
import { generateInviteToken, inviteTokenSha256Hex } from '../utils/inviteTokenUtils'
import { devEmailSender } from './email/devEmailSender'
import { logAuditAction } from '../utils/logAuditAction'
import { AppError } from '../errors/AppError'

const INVITE_EXPIRY_DAYS = 7
const INVITE_BASE_URL = process.env.INVITE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export type InviteDto = {
  inviteId: number
  email: string
  roleId: number
  roleName: string
  status: 'Pending' | 'Accepted' | 'Declined' | 'Revoked' | 'Expired'
  resolvedStatus: 'Pending' | 'Accepted' | 'Declined' | 'Revoked' | 'Expired'
  expiresAt: string
  invitedByUserId: number
  inviterName: string | null
  sendCount: number
  lastSentAt: string | null
  createdAt: string
}

export type CreateInviteResult = {
  inviteId: number
  email: string
  roleId: number
  roleName: string
  expiresAt: string
  createdAt: string
  resent: boolean
}

export type ByTokenResult = {
  accountName: string
  status: 'pending' | 'expired' | 'accepted' | 'revoked' | 'declined'
  expiresAt: string
  email: string
  roleId: number
  roleName: string | null
}

export type AcceptInviteResult = {
  accountId: number
  accountName: string
}

export type InviteResolvedStatus = InviteDto['resolvedStatus']

export function computeResolvedInviteStatus(
  row: Pick<InviteRowWithDetails, 'status' | 'expiresAt'>,
  now: Date,
): InviteResolvedStatus {
  if (row.status !== 'Pending') return row.status
  return row.expiresAt < now ? 'Expired' : 'Pending'
}

function toInviteDto(row: InviteRowWithDetails, now: Date): InviteDto {
  const resolvedStatus = computeResolvedInviteStatus(row, now)
  return {
    inviteId: row.inviteId,
    email: row.email,
    roleId: row.roleId,
    roleName: row.roleName,
    status: row.status,
    resolvedStatus,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : String(row.expiresAt),
    invitedByUserId: row.invitedByUserId,
    inviterName: row.inviterName ?? null,
    sendCount: row.sendCount,
    lastSentAt: row.lastSentAt instanceof Date ? row.lastSentAt.toISOString() : (row.lastSentAt != null ? String(row.lastSentAt) : null),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  }
}

function getResolvedStatus(row: InviteRowWithDetails, now: Date): ByTokenResult['status'] {
  const resolved = computeResolvedInviteStatus(row, now)
  if (resolved === 'Pending') return 'pending'
  if (resolved === 'Accepted') return 'accepted'
  if (resolved === 'Revoked') return 'revoked'
  if (resolved === 'Declined') return 'declined'
  // Expired or any unexpected value: preserve legacy fallback
  return 'expired'
}

/**
 * Create invite or resend (rotate token) if pending invite exists for (accountId, email).
 * Validates roleId and that email is not already a member.
 */
export async function createOrResendInvite(
  accountId: number,
  invitedByUserId: number,
  email: string,
  roleId: number,
  auditContext: { route?: string; method?: string; statusCode?: number },
): Promise<CreateInviteResult> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    const err = new Error('Email is required')
    ;(err as Error & { statusCode?: number }).statusCode = 400
    throw err
  }

  const roles = await listRoleIdsAndNames()
  const roleExists = roles.some(r => r.roleId === roleId)
  if (!roleExists) {
    const err = new Error('Invalid role')
    ;(err as Error & { statusCode?: number }).statusCode = 400
    throw err
  }

  const existingUser = await getUserByEmail(normalizedEmail)
  if (existingUser) {
    const userId = typeof existingUser === 'object' && existingUser !== null && 'UserID' in existingUser && typeof existingUser.UserID === 'number' && Number.isFinite(existingUser.UserID)
      ? existingUser.UserID
      : null
    if (userId !== null) {
      const member = await getMemberByAccountAndUser(accountId, userId)
      if (member) {
        const err = new Error('User is already a member of this account')
        ;(err as Error & { statusCode?: number }).statusCode = 409
        throw err
      }
    }
  }

  const pending = await findPendingByAccountAndEmail(accountId, normalizedEmail)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)

  if (pending) {
    const auditStatusCode = 200
    const token = generateInviteToken()
    const tokenHash = inviteTokenSha256Hex(token)
    await updateTokenAndIncrementSend(pending.inviteId, tokenHash, expiresAt)
    const inviteLink = `${INVITE_BASE_URL}/invite/accept?token=${encodeURIComponent(token)}`
    await devEmailSender.sendInviteEmail({
      to: normalizedEmail,
      inviteAcceptLink: inviteLink,
      accountName: (await getAccountNameById(accountId)) ?? 'Account',
      inviterName: undefined,
    })
    await logAuditAction({
      tableName: 'AccountInvites',
      recordId: pending.inviteId,
      action: 'invite.resent',
      performedBy: invitedByUserId,
      route: auditContext.route ?? null,
      method: auditContext.method ?? null,
      statusCode: auditStatusCode,
      changes: { email: normalizedEmail, accountId },
    })
    const roleName = roles.find(r => r.roleId === pending.roleId)?.roleName ?? ''
    return {
      inviteId: pending.inviteId,
      email: normalizedEmail,
      roleId: pending.roleId,
      roleName,
      expiresAt: expiresAt.toISOString(),
      createdAt: pending.createdAt instanceof Date ? pending.createdAt.toISOString() : String(pending.createdAt),
      resent: true,
    }
  }

  const auditStatusCode = 201
  const token = generateInviteToken()
  const tokenHash = inviteTokenSha256Hex(token)
  const row = await createInvite(
    accountId,
    normalizedEmail,
    roleId,
    tokenHash,
    expiresAt,
    invitedByUserId,
  )
  const inviteLink = `${INVITE_BASE_URL}/invite/accept?token=${encodeURIComponent(token)}`
  await devEmailSender.sendInviteEmail({
    to: normalizedEmail,
    inviteAcceptLink: inviteLink,
    accountName: (await getAccountNameById(accountId)) ?? 'Account',
    inviterName: undefined,
  })
  await logAuditAction({
    tableName: 'AccountInvites',
    recordId: row.inviteId,
    action: 'invite.created',
    performedBy: invitedByUserId,
    route: auditContext.route ?? null,
    method: auditContext.method ?? null,
    statusCode: auditStatusCode,
    changes: { email: normalizedEmail, roleId, accountId },
  })
  const roleName = roles.find(r => r.roleId === roleId)?.roleName ?? ''
  return {
    inviteId: row.inviteId,
    email: row.email,
    roleId: row.roleId,
    roleName,
    expiresAt: expiresAt.toISOString(),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    resent: false,
  }
}

export async function listInvites(
  accountId: number,
  scope: InviteListScope = 'pending',
): Promise<InviteDto[]> {
  const rows = await listByAccount(accountId, scope)
  const now = new Date()
  return rows.map(r => toInviteDto(r, now))
}

/**
 * Resend: rotate token and increment send count. Invite must be Pending and in account.
 */
export async function resendInvite(
  accountId: number,
  inviteId: number,
  userId: number,
  auditContext: { route?: string; method?: string; statusCode?: number },
): Promise<InviteDto> {
  const row = await getByIdAndAccount(inviteId, accountId)
  if (!row) {
    const err = new Error('Invite not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }
  if (row.status !== 'Pending') {
    const err = new Error('Invite is not pending')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }

  const token = generateInviteToken()
  const tokenHash = inviteTokenSha256Hex(token)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)
  await updateTokenAndIncrementSend(inviteId, tokenHash, expiresAt)
  const inviteLink = `${INVITE_BASE_URL}/invite/accept?token=${encodeURIComponent(token)}`
  await devEmailSender.sendInviteEmail({
    to: row.email,
    inviteAcceptLink: inviteLink,
    accountName: (await getAccountNameById(accountId)) ?? 'Account',
    inviterName: undefined,
  })
  await logAuditAction({
    tableName: 'AccountInvites',
    recordId: inviteId,
    action: 'invite.resent',
    performedBy: userId,
    route: auditContext.route ?? null,
    method: auditContext.method ?? null,
    statusCode: auditContext.statusCode ?? null,
    changes: { email: row.email, accountId },
  })

  const updated = await listPendingByAccount(accountId)
  const found = updated.find(r => r.inviteId === inviteId)
  if (!found) {
    const err = new Error('Invite not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }
  const now = new Date()
  return toInviteDto(found, now)
}

export type DevAcceptLinkResult = {
  acceptUrl: string
}

/**
 * DEV-only: rotate invite token and return accept URL (no email). Call only when NODE_ENV !== 'production'.
 */
export async function devAcceptLink(accountId: number, inviteId: number): Promise<DevAcceptLinkResult> {
  const row = await getByIdAndAccount(inviteId, accountId)
  if (!row) {
    const err = new Error('Invite not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }
  if (row.status !== 'Pending') {
    const err = new Error('Invite is no longer valid')
    ;(err as Error & { statusCode?: number }).statusCode = 410
    throw err
  }
  const now = new Date()
  if (row.expiresAt < now) {
    const err = new Error('Invite has expired')
    ;(err as Error & { statusCode?: number }).statusCode = 410
    throw err
  }

  const token = generateInviteToken()
  const tokenHash = inviteTokenSha256Hex(token)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)
  await updateTokenAndIncrementSend(inviteId, tokenHash, expiresAt)
  const acceptUrl = `${INVITE_BASE_URL}/invite/accept?token=${encodeURIComponent(token)}`
  return { acceptUrl }
}

/**
 * Revoke invite. Invite must be Pending and in account.
 */
export async function revokeInvite(
  accountId: number,
  inviteId: number,
  userId: number,
  auditContext: { route?: string; method?: string; statusCode?: number },
): Promise<void> {
  const row = await getByIdAndAccount(inviteId, accountId)
  if (!row) {
    const err = new Error('Invite not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }
  if (row.status !== 'Pending') {
    const err = new Error('Invite is not pending')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }
  await setStatusRevoked(inviteId, userId)
  await logAuditAction({
    tableName: 'AccountInvites',
    recordId: inviteId,
    action: 'invite.revoked',
    performedBy: userId,
    route: auditContext.route ?? null,
    method: auditContext.method ?? null,
    statusCode: auditContext.statusCode ?? null,
    changes: { email: row.email, accountId },
  })
}

/**
 * Public: get invite info by token for accept page. Returns accountName, status, expiresAt, email, roleId, roleName.
 */
export async function getByToken(token: string): Promise<ByTokenResult | null> {
  const tokenHash = inviteTokenSha256Hex(token)
  const row = await findByTokenHash(tokenHash)
  if (!row) return null
  const now = new Date()
  const status = getResolvedStatus(row, now)
  return {
    accountName: row.accountName,
    status,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : String(row.expiresAt),
    email: row.email,
    roleId: row.roleId,
    roleName: row.roleName ?? null,
  }
}

/**
 * Accept invite: signed-in user only; invite email must match user email.
 * Creates or reactivates AccountMember, sets UserActiveAccount, marks invite Accepted.
 */
export async function acceptInvite(
  userId: number,
  userEmail: string,
  token: string,
  auditContext: { route?: string; method?: string; statusCode?: number },
): Promise<AcceptInviteResult> {
  const tokenHash = inviteTokenSha256Hex(token)
  const row = await findByTokenHash(tokenHash)
  if (!row) {
    const err = new Error('Invite not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }
  if (row.status !== 'Pending') {
    const err = new Error('Invite is no longer valid')
    ;(err as Error & { statusCode?: number }).statusCode = 410
    throw err
  }
  const now = new Date()
  if (row.expiresAt < now) {
    const err = new Error('Invite has expired')
    ;(err as Error & { statusCode?: number }).statusCode = 410
    throw err
  }
  const normalizedUserEmail = (userEmail ?? '').trim().toLowerCase()
  const normalizedInviteEmail = row.email.trim().toLowerCase()
  if (normalizedUserEmail !== normalizedInviteEmail) {
    const err = new Error('You must sign in with the email address that received this invite')
    ;(err as Error & { statusCode?: number }).statusCode = 403
    throw err
  }

  const existing = await getMemberByAccountAndUser(row.accountId, userId)
  if (existing?.isActive) {
    const err = new Error('You are already an active member of this account')
    ;(err as Error & { statusCode?: number }).statusCode = 409
    throw err
  }

  const claimed = await setStatusAcceptedIfPending(row.inviteId, userId)
  if (!claimed) {
    const err = new Error('Invite is no longer valid')
    ;(err as Error & { statusCode?: number }).statusCode = 410
    throw err
  }

  if (existing) {
    await updateMemberStatus(row.accountId, existing.accountMemberId, true)
    await updateMemberRole(row.accountId, existing.accountMemberId, row.roleId)
  } else {
    await insertAccountMember(row.accountId, userId, row.roleId)
  }
  await setActiveAccount(userId, row.accountId)

  await logAuditAction({
    tableName: 'AccountInvites',
    recordId: row.inviteId,
    action: 'invite.accepted',
    performedBy: userId,
    route: auditContext.route ?? null,
    method: auditContext.method ?? null,
    statusCode: auditContext.statusCode ?? null,
    changes: { accountId: row.accountId, email: row.email },
  })

  return {
    accountId: row.accountId,
    accountName: row.accountName,
  }
}

/**
 * Decline invite (public). Token becomes unusable. Audit logged only when performedByUserId is not null (authenticated decline).
 * When authenticated, invite email must match the signed-in user's email (same as accept).
 */
export async function declineInvite(
  token: string,
  performedByUserId: number | null,
  userEmail: string | null | undefined,
  auditContext: { route?: string; method?: string; statusCode?: number },
): Promise<void> {
  const tokenHash = inviteTokenSha256Hex(token)
  const row = await findByTokenHash(tokenHash)
  if (!row) {
    const err = new Error('Invite not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }
  if (row.status !== 'Pending') {
    const err = new Error('Invite is no longer valid')
    ;(err as Error & { statusCode?: number }).statusCode = 410
    throw err
  }
  if (performedByUserId != null) {
    if (typeof userEmail !== 'string' || !userEmail.trim()) {
      const err = new Error('User email is required to decline invite')
      ;(err as Error & { statusCode?: number }).statusCode = 403
      throw err
    }
    const normalizedUserEmail = userEmail.trim().toLowerCase()
    const normalizedInviteEmail = row.email.trim().toLowerCase()
    if (normalizedUserEmail !== normalizedInviteEmail) {
      const err = new Error('You must sign in with the email address that received this invite')
      ;(err as Error & { statusCode?: number }).statusCode = 403
      throw err
    }
  }
  await setStatusDeclined(row.inviteId)
  if (performedByUserId != null) {
    await logAuditAction({
      tableName: 'AccountInvites',
      recordId: row.inviteId,
      action: 'invite.declined',
      performedBy: performedByUserId,
      route: auditContext.route ?? null,
      method: auditContext.method ?? null,
      statusCode: auditContext.statusCode ?? null,
      changes: { email: row.email, accountId: row.accountId },
    })
  }
}

export type AcceptInvitePublicInput = {
  token: string
  firstName?: string | null
  lastName?: string | null
  password?: string | null
}

/**
 * Public accept: create or reactivate user by invite email, claim invite, upsert membership, audit.
 * Throws with statusCode 404 (not found), 410 (used/expired/double-accept), 409 (already active member).
 */
export async function acceptInvitePublic(
  input: AcceptInvitePublicInput,
  auditContext: { route?: string; method?: string; statusCode?: number },
): Promise<AcceptInviteResult> {
  const tokenHash = inviteTokenSha256Hex(input.token.trim())
  const row = await findByTokenHash(tokenHash)
  if (!row) {
    const err = new Error('Invite not found')
    ;(err as Error & { statusCode?: number }).statusCode = 404
    throw err
  }
  if (row.status !== 'Pending') {
    const err = new Error('Invite is no longer valid')
    ;(err as Error & { statusCode?: number }).statusCode = 410
    throw err
  }
  const now = new Date()
  if (row.expiresAt < now) {
    const err = new Error('Invite has expired')
    ;(err as Error & { statusCode?: number }).statusCode = 410
    throw err
  }

  const inviteEmail = row.email.trim().toLowerCase()
  const firstName = (input.firstName ?? '').trim()
  const lastName = (input.lastName ?? '').trim()
  const password = (input.password ?? '').trim()
  if (!firstName || !lastName || !password) {
    const err = new Error('firstName, lastName, and password are required')
    ;(err as Error & { statusCode?: number }).statusCode = 400
    throw err
  }

  const isActiveUser = (value: unknown): boolean => {
    if (value === true) return true
    if (value === 1) return true
    return false
  }

  let userId: number
  const existingUser = await getUserByEmail(inviteEmail)
  const activeFlag = (existingUser as Record<string, unknown>)?.IsActive
  if (existingUser && isActiveUser(activeFlag)) {
    throw new AppError('Account already exists. Please sign in to accept this invite.', 409)
  }
  if (!existingUser) {
    const roleId = row.roleId
    if (!Number.isFinite(roleId)) {
      throw new AppError('Invite role is invalid', 500)
    }
    userId = await createUser({
      Email: inviteEmail,
      Password: password,
      FirstName: firstName || null,
      LastName: lastName || null,
      IsActive: true,
      RoleID: roleId,
    })
  } else {
    const uid = (existingUser as { UserID?: number }).UserID
    if (typeof uid !== 'number' || !Number.isFinite(uid)) {
      const err = new Error('Invalid user record')
      ;(err as Error & { statusCode?: number }).statusCode = 500
      throw err
    }
    userId = uid
    const isActive = (existingUser as { IsActive?: boolean | number }).IsActive
    const active = isActive === true || isActive === 1
    if (!active) {
      await updateUser(userId, {
        IsActive: true,
        FirstName: firstName || null,
        LastName: lastName || null,
        Password: password,
      })
    }
  }

  const existing = await getMemberByAccountAndUser(row.accountId, userId)
  if (existing?.isActive) {
    const err = new Error('You are already an active member of this account')
    ;(err as Error & { statusCode?: number }).statusCode = 409
    throw err
  }

  const claimed = await setStatusAcceptedIfPending(row.inviteId, userId)
  if (!claimed) {
    const err = new Error('Invite is no longer valid')
    ;(err as Error & { statusCode?: number }).statusCode = 410
    throw err
  }

  if (existing) {
    await updateMemberStatus(row.accountId, existing.accountMemberId, true)
    await updateMemberRole(row.accountId, existing.accountMemberId, row.roleId)
  } else {
    await insertAccountMember(row.accountId, userId, row.roleId)
  }
  await setActiveAccount(userId, row.accountId)

  await logAuditAction({
    tableName: 'AccountInvites',
    recordId: row.inviteId,
    action: 'invite.accepted',
    performedBy: userId,
    route: auditContext.route ?? null,
    method: auditContext.method ?? null,
    statusCode: auditContext.statusCode ?? null,
    changes: { accountId: row.accountId, email: row.email },
  })

  return {
    accountId: row.accountId,
    accountName: row.accountName,
  }
}
