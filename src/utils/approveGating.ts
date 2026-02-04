// src/utils/approveGating.ts
// Single source of truth: Supervisor must not see Approve UI (icon/button/page).
// Backend uses PERMISSIONS.DATASHEET_APPROVE; this gates UI and page access only.

import type { UserSession } from '@/domain/auth/sessionTypes'
import { PERMISSIONS } from '@/constants/permissions'

const APPROVE_PERMISSION = PERMISSIONS.DATASHEET_APPROVE
const SUPERVISOR_ROLE = 'Supervisor'

/**
 * True if the user may see Approve actions (template and filled) in the UI
 * and access approve pages. Supervisor never sees approve; Admin/others with
 * DATASHEET_APPROVE do.
 */
export function canSeeApproveUI(user: UserSession): boolean {
  if (!user?.role || !Array.isArray(user.permissions)) {
    return false
  }
  if (user.role === SUPERVISOR_ROLE) {
    return false
  }
  return user.permissions.includes(APPROVE_PERMISSION)
}
