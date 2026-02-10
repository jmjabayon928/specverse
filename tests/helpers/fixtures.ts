/**
 * Explicit, deterministic test fixtures.
 * No randomness, no time dependence, no global mutation.
 * All factories require explicit parameters (no hidden defaults).
 */

// User IDs
export const USER_ID_1 = 1
export const USER_ID_2 = 2
export const USER_ID_99 = 99
export const USER_ID_999 = 999

// Account IDs
export const ACCOUNT_ID_1 = 1
export const ACCOUNT_ID_2 = 2
export const ACCOUNT_ID_5 = 5
export const ACCOUNT_ID_10 = 10

// Member IDs
export const MEMBER_ID_10 = 10
export const MEMBER_ID_20 = 20

// Role IDs
export const ROLE_ID_ADMIN = 1
export const ROLE_ID_NON_ADMIN = 2

// Role Names
export const ROLE_ADMIN = 'Admin'
export const ROLE_VIEWER = 'Viewer'
export const ROLE_ENGINEER = 'Engineer'

/** Deterministic date for tests (no time dependence). */
export const FIXED_DATE = new Date('2024-01-01T00:00:00.000Z')

/**
 * Creates a token payload object for JWT signing.
 * All fields are optional except userId.
 */
export function makeTokenPayload(args: {
  userId: number
  accountId?: number
  roleId?: number
  role?: string
  email?: string
  name?: string
  profilePic?: string | null
  permissions?: string[]
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    userId: args.userId,
  }
  if (args.accountId !== undefined) {
    payload.accountId = args.accountId
  }
  if (args.roleId !== undefined) {
    payload.roleId = args.roleId
  }
  if (args.role !== undefined) {
    payload.role = args.role
  }
  if (args.email !== undefined) {
    payload.email = args.email
  }
  if (args.name !== undefined) {
    payload.name = args.name
  }
  if (args.profilePic !== undefined) {
    payload.profilePic = args.profilePic
  }
  if (args.permissions !== undefined) {
    payload.permissions = args.permissions
  }
  return payload
}

export type AccountFixture = {
  accountId: number
  accountName: string
  slug: string
  isActive: boolean
  ownerUserId?: number
}

/**
 * Creates an account object for repository mocks.
 */
export function makeAccount(args: {
  accountId: number
  accountName: string
  slug: string
  isActive: boolean
  ownerUserId?: number
}): AccountFixture {
  const account: AccountFixture = {
    accountId: args.accountId,
    accountName: args.accountName,
    slug: args.slug,
    isActive: args.isActive,
  }
  if (args.ownerUserId !== undefined) {
    account.ownerUserId = args.ownerUserId
  }
  return account
}

export type MemberFixture = {
  accountMemberId: number
  userId: number
  email: string
  firstName: string
  lastName: string
  roleId: number
  roleName: string
  isActive: boolean
  isOwner: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Creates a member object for repository mocks.
 * createdAt and updatedAt must be provided explicitly (no Date defaults).
 */
export function makeMember(args: {
  accountMemberId: number
  userId: number
  email: string
  firstName: string
  lastName: string
  roleId: number
  roleName: string
  isActive: boolean
  isOwner: boolean
  createdAt: Date
  updatedAt: Date
}): MemberFixture {
  return {
    accountMemberId: args.accountMemberId,
    userId: args.userId,
    email: args.email,
    firstName: args.firstName,
    lastName: args.lastName,
    roleId: args.roleId,
    roleName: args.roleName,
    isActive: args.isActive,
    isOwner: args.isOwner,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
  }
}

export type AccountContextFixture = {
  accountId: number
  roleId: number
  roleName: string
  permissions: string[]
  isOwner?: boolean
  ownerUserId?: number
}

/**
 * Creates an account context object for query mocks.
 */
export function makeAccountContext(args: {
  accountId: number
  roleId: number
  roleName: string
  permissions: string[]
  isOwner?: boolean
  ownerUserId?: number
}): AccountContextFixture {
  const context: AccountContextFixture = {
    accountId: args.accountId,
    roleId: args.roleId,
    roleName: args.roleName,
    permissions: args.permissions,
  }
  if (args.isOwner !== undefined) {
    context.isOwner = args.isOwner
  }
  if (args.ownerUserId !== undefined) {
    context.ownerUserId = args.ownerUserId
  }
  return context
}
