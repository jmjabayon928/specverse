// src/backend/services/accountsService.ts
import { listAccountsForUser as repoList } from '../repositories/accountsRepository'

export type AccountWithRole = {
  accountId: number
  accountName: string
  slug: string
  isActive: boolean
  roleName: string
}

export type ListAccountsResult = {
  accounts: AccountWithRole[]
  activeAccountId: number
}

export async function listAccountsForUser(
  userId: number,
  activeAccountId: number,
): Promise<ListAccountsResult> {
  const rows = await repoList(userId)
  const accounts = rows.filter(a => a.isActive)
  return { accounts, activeAccountId }
}
