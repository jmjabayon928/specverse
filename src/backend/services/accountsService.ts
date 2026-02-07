// src/backend/services/accountsService.ts
import {
  createAccount as repoCreate,
  getAccountById as repoGetById,
  listAccountsForUser as repoList,
  updateAccount as repoUpdate,
} from '../repositories/accountsRepository'

export type AccountWithRole = {
  accountId: number
  accountName: string
  slug: string
  isActive: boolean
  roleName: string
}

export type AccountDto = {
  accountId: number
  accountName: string
  slug: string
  isActive: boolean
}

export type ListAccountsResult = {
  accounts: AccountWithRole[]
  activeAccountId: number
}

type StatusCodeError = Error & { statusCode?: number }
function err(message: string, statusCode: number): StatusCodeError {
  const e = new Error(message) as StatusCodeError
  e.statusCode = statusCode
  return e
}

function isSqlServerDuplicateKeyError(e: unknown): boolean {
  const anyErr = e as { number?: unknown; code?: unknown; message?: unknown }
  const num = typeof anyErr?.number === 'number' ? anyErr.number : undefined
  // SQL Server: 2627 = Violation of UNIQUE KEY constraint; 2601 = Cannot insert duplicate key row.
  if (num === 2627 || num === 2601) return true

  const msg = typeof anyErr?.message === 'string' ? anyErr.message.toLowerCase() : ''
  // Fallback for environments where `number` isn't present.
  return msg.includes('duplicate') && (msg.includes('key') || msg.includes('unique'))
}

function validateAccountName(raw: string): string {
  const v = raw.trim()
  if (!v) throw err('accountName must be non-empty', 400)
  return v
}

function validateSlug(raw: string): string {
  const v = raw.trim()
  if (!v) throw err('slug must be non-empty', 400)
  if (!/^[a-z0-9-]{3,50}$/.test(v)) {
    throw err('slug must be 3–50 chars of lowercase letters, digits, or hyphens', 400)
  }
  return v
}

export async function listAccountsForUser(
  userId: number,
  activeAccountId: number,
): Promise<ListAccountsResult> {
  const rows = await repoList(userId)
  const accounts = rows.filter(a => a.isActive)
  return { accounts, activeAccountId }
}

export async function getAccountById(accountId: number): Promise<AccountDto> {
  const row = await repoGetById(accountId)
  if (!row) throw err('Account not found', 404)
  return row
}

export async function createAccount(accountName: string, slug: string): Promise<AccountDto> {
  const name = validateAccountName(accountName)
  const s = validateSlug(slug)
  try {
    return await repoCreate(name, s, true)
  } catch (e) {
    if (isSqlServerDuplicateKeyError(e)) {
      throw err('slug is already in use', 409)
    }
    throw e
  }
}

export type AccountPatch = { accountName?: string; slug?: string; isActive?: boolean }

export async function updateAccount(accountId: number, patch: AccountPatch): Promise<AccountDto> {
  const hasAny = patch.accountName !== undefined || patch.slug !== undefined || patch.isActive !== undefined
  if (!hasAny) throw err('At least one field is required', 400)

  const normalized: AccountPatch = {}
  if (patch.accountName !== undefined) normalized.accountName = validateAccountName(patch.accountName)
  if (patch.slug !== undefined) normalized.slug = validateSlug(patch.slug)
  if (patch.isActive !== undefined) normalized.isActive = patch.isActive

  let updated: AccountDto | null = null
  try {
    updated = await repoUpdate(accountId, normalized)
  } catch (e) {
    if (normalized.slug !== undefined && isSqlServerDuplicateKeyError(e)) {
      throw err('slug is already in use', 409)
    }
    throw e
  }
  if (!updated) throw err('Account not found', 404)
  return updated
}
