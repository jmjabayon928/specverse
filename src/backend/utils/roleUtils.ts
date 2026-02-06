// src/backend/utils/roleUtils.ts
// Centralized Admin role identification. Must stay in sync with repo SQL (e.g. countActiveAdminsInAccount).

export const ADMIN_ROLE_NAME_NORMALIZED = 'admin'

/**
 * Returns true when roleName (after trim and case-insensitive compare) equals 'admin'.
 */
export function isAdminRole(roleName: string): boolean {
  return roleName.trim().toLowerCase() === ADMIN_ROLE_NAME_NORMALIZED
}
