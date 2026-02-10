// src/backend/database/platformAdminPort.ts
import { isActivePlatformAdmin } from './platformAdminQueries'

/**
 * Port module for platform admin lookup.
 * Provides a decoupled interface to reduce circular import risk.
 */
export const isUserPlatformAdmin = async (userId: number): Promise<boolean> => {
  return await isActivePlatformAdmin(userId)
}
