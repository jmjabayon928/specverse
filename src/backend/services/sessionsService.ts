// src/backend/services/sessionsService.ts
import { getAccountContextForUserAndAccount } from '../database/accountContextQueries'
import { setActiveAccount as repoSetActiveAccount } from '../repositories/userActiveAccountRepository'

/**
 * Sets the active account for the user. Validates that the user has an active membership
 * (AccountMembers.IsActive = 1, Accounts.IsActive = 1) for the given accountId.
 * @throws Error with message suitable for 403 when not a member
 */
export async function setActiveAccount(userId: number, accountId: number): Promise<void> {
  const ctx = await getAccountContextForUserAndAccount(userId, accountId)
  if (!ctx) {
    const err = new Error('Not a member of this account or account inactive')
    ;(err as Error & { statusCode?: number }).statusCode = 403
    throw err
  }
  await repoSetActiveAccount(userId, accountId)
}
