import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/utils/sessionUtils.server'
import type { AccountRow } from './AccountsTable'
import AccountsTable from './AccountsTable'

const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

type AccountsRes = { accounts: AccountRow[]; activeAccountId: number }

export default async function AccountsPage() {
  await requireAuth()

  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) {
    redirect('/login')
  }

  const headers = { Cookie: `token=${token}` } as const
  const res = await fetch(`${base}/api/backend/accounts`, { headers, cache: 'no-store' })

  if (res.status === 401) {
    redirect('/login')
  }
  if (res.status === 403) {
    redirect('/unauthorized')
  }

  let accounts: AccountRow[] = []
  if (res.ok) {
    const data: AccountsRes = await res.json()
    accounts = Array.isArray(data.accounts) ? data.accounts : []
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Accounts</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">Create and manage accounts.</p>
      <AccountsTable initialAccounts={accounts} />
    </div>
  )
}

