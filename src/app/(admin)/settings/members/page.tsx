import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PERMISSIONS } from '@/constants/permissions'
import { requireAuth } from '@/utils/sessionUtils.server'
import type { MemberRow } from './MembersTable'
import MembersTable from './MembersTable'

type MembersRes = { members: MemberRow[] }
type RolesRes = { roles: { roleId: number; roleName: string }[] }

export default async function MembersPage() {
  const session = await requireAuth() // Server-side auth gate - redirects to /login if unauth
  if (!session.permissions?.includes(PERMISSIONS.ACCOUNT_VIEW)) {
    redirect('/unauthorized')
  }

  const cookieStore = await cookies()
  const sid = cookieStore.get('sid')?.value
  if (!sid) {
    redirect('/login')
  }

  const membersUrl = '/api/backend/account-members'
  const rolesUrl = '/api/backend/roles'

  const headers = { Cookie: `sid=${sid}` } as const
  const [membersRes, rolesRes] = await Promise.all([
    fetch(membersUrl, { headers, cache: 'no-store' }),
    fetch(rolesUrl, { headers, next: { revalidate: 60 } }),
  ])

  let members: MemberRow[] = []
  let roles: { roleId: number; roleName: string }[] = []

  if (membersRes.ok) {
    const data: MembersRes = await membersRes.json()
    members = Array.isArray(data.members) ? data.members : []
  }
  if (rolesRes.ok) {
    const data: RolesRes = await rolesRes.json()
    roles = Array.isArray(data.roles) ? data.roles : []
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Account Members</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Manage roles and status for members in the current account.
      </p>
      <MembersTable members={members} roles={roles} permissions={session.permissions ?? []} />
    </div>
  )
}
