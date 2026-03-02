import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PERMISSIONS } from '@/constants/permissions'
import { requireAuth } from '@/utils/sessionUtils.server'
import { apiJson } from '@/utils/apiJson.server'
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

  let members: MemberRow[] = []
  let roles: { roleId: number; roleName: string }[] = []

  try {
    const membersData = await apiJson<MembersRes>(membersUrl, { cache: 'no-store' })
    members = Array.isArray(membersData.members) ? membersData.members : []
  } catch {
    // Silently handle errors to preserve existing behavior
  }

  try {
    const rolesData = await apiJson<RolesRes>(rolesUrl, { cache: 'no-store' })
    roles = Array.isArray(rolesData.roles) ? rolesData.roles : []
  } catch {
    // Silently handle errors to preserve existing behavior
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
